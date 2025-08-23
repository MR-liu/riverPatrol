import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
// import DeviceInfo from 'react-native-device-info'; // Optional dependency

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  category: string;
  userId?: string;
  sessionId: string;
  deviceInfo: {
    platform: string;
    version: string;
    model: string;
    appVersion: string;
  };
  metadata?: { [key: string]: any };
  stackTrace?: string;
  performance?: {
    memory: number;
    cpu: number;
    networkLatency?: number;
  };
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}

export interface LoggerConfig {
  enabled: boolean;
  level: LogEntry['level'];
  categories: string[];
  maxEntries: number;
  uploadInterval: number;
  uploadOnCrash: boolean;
  includeStackTrace: boolean;
  includePerformanceMetrics: boolean;
  includeLocationData: boolean;
  encryption: {
    enabled: boolean;
    algorithm: 'AES-256' | 'RSA';
    keyRotationInterval: number;
  };
  compliance: {
    gdprCompliant: boolean;
    dataRetentionDays: number;
    anonymizeUserData: boolean;
  };
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private sessionId: string;
  private config: LoggerConfig;
  private isInitialized = false;
  private uploadQueue: LogEntry[] = [];
  private performanceMonitor: any;

  private readonly STORAGE_KEYS = {
    LOGS: 'logger_entries',
    CONFIG: 'logger_config',
    SESSION: 'logger_session',
    UPLOAD_QUEUE: 'logger_upload_queue',
  };

  private readonly defaultConfig: LoggerConfig = {
    enabled: true,
    level: __DEV__ ? 'debug' : 'warn',
    categories: ['app', 'api', 'ui', 'performance', 'security'],
    maxEntries: 10000,
    uploadInterval: 300000, // 5 minutes
    uploadOnCrash: true,
    includeStackTrace: true,
    includePerformanceMetrics: true,
    includeLocationData: false,
    encryption: {
      enabled: true,
      algorithm: 'AES-256',
      keyRotationInterval: 86400000, // 24 hours
    },
    compliance: {
      gdprCompliant: true,
      dataRetentionDays: 90,
      anonymizeUserData: true,
    },
  };

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.config = this.defaultConfig;
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loadConfig();
      await this.loadLogs();
      await this.loadUploadQueue();
      
      if (this.config.enabled) {
        this.startPerformanceMonitoring();
        this.setupCrashHandler();
        this.scheduleLogUpload();
      }

      this.isInitialized = true;
      this.info('Logger initialized successfully', 'system');
    } catch (error) {
      console.error('Logger initialization failed:', error);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async loadConfig(): Promise<void> {
    try {
      const configStr = await AsyncStorage.getItem(this.STORAGE_KEYS.CONFIG);
      if (configStr) {
        this.config = { ...this.defaultConfig, ...JSON.parse(configStr) };
      }
    } catch (error) {
      console.error('Failed to load logger config:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.CONFIG, JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save logger config:', error);
    }
  }

  private async loadLogs(): Promise<void> {
    try {
      const logsStr = await AsyncStorage.getItem(this.STORAGE_KEYS.LOGS);
      if (logsStr) {
        this.logs = JSON.parse(logsStr);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
      this.logs = [];
    }
  }

  private async saveLogs(): Promise<void> {
    try {
      // Rotate logs if exceeding max entries
      if (this.logs.length > this.config.maxEntries) {
        this.logs = this.logs.slice(-this.config.maxEntries);
      }

      await AsyncStorage.setItem(this.STORAGE_KEYS.LOGS, JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to save logs:', error);
    }
  }

  private async loadUploadQueue(): Promise<void> {
    try {
      const queueStr = await AsyncStorage.getItem(this.STORAGE_KEYS.UPLOAD_QUEUE);
      if (queueStr) {
        this.uploadQueue = JSON.parse(queueStr);
      }
    } catch (error) {
      console.error('Failed to load upload queue:', error);
      this.uploadQueue = [];
    }
  }

  private async saveUploadQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.UPLOAD_QUEUE, JSON.stringify(this.uploadQueue));
    } catch (error) {
      console.error('Failed to save upload queue:', error);
    }
  }

  private shouldLog(level: LogEntry['level'], category: string): boolean {
    if (!this.config.enabled) return false;
    if (!this.config.categories.includes(category)) return false;

    const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
    const configLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= configLevelIndex;
  }

  private async createLogEntry(
    level: LogEntry['level'],
    message: string,
    category: string,
    metadata?: any,
    error?: Error
  ): Promise<LogEntry> {
    const deviceInfo = await this.getDeviceInfo();
    const performance = this.config.includePerformanceMetrics 
      ? await this.getPerformanceMetrics() 
      : undefined;
    
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      message,
      category,
      sessionId: this.sessionId,
      deviceInfo,
      metadata: this.sanitizeMetadata(metadata),
      stackTrace: this.config.includeStackTrace && error ? error.stack : undefined,
      performance,
    };

    return entry;
  }

  private async getDeviceInfo() {
    try {
      // Fallback implementation when DeviceInfo is not available
      return {
        platform: Platform.OS,
        version: Platform.Version?.toString() || 'unknown',
        model: 'unknown',
        appVersion: '1.0.0',
      };
      
      // If DeviceInfo is available, uncomment below:
      // const [version, model, appVersion] = await Promise.all([
      //   DeviceInfo.getSystemVersion(),
      //   DeviceInfo.getModel(),
      //   DeviceInfo.getVersion(),
      // ]);
      // return { platform: Platform.OS, version, model, appVersion };
    } catch (error) {
      return {
        platform: Platform.OS,
        version: 'unknown',
        model: 'unknown',
        appVersion: 'unknown',
      };
    }
  }

  private async getPerformanceMetrics() {
    try {
      // This would require additional native modules for accurate metrics
      return {
        memory: 0, // Could use react-native-device-info
        cpu: 0,    // Would need custom native module
      };
    } catch (error) {
      return undefined;
    }
  }

  private sanitizeMetadata(metadata: any): any {
    if (!metadata) return undefined;
    
    // Remove sensitive information
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];
    const sanitized = { ...metadata };
    
    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      const result: any = Array.isArray(obj) ? [] : {};
      
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const shouldSanitize = sensitiveKeys.some(sensitiveKey => 
          lowerKey.includes(sensitiveKey)
        );
        
        if (shouldSanitize) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    };
    
    return sanitizeObject(sanitized);
  }

  private async log(level: LogEntry['level'], message: string, category: string, metadata?: any, error?: Error): Promise<void> {
    if (!this.shouldLog(level, category)) return;

    try {
      const entry = await this.createLogEntry(level, message, category, metadata, error);
      
      this.logs.push(entry);
      
      // Add to upload queue for high priority logs
      if (['error', 'fatal'].includes(level)) {
        this.uploadQueue.push(entry);
        await this.saveUploadQueue();
      }
      
      await this.saveLogs();
      
      // Console output in development
      if (__DEV__) {
        const consoleMethod = level === 'fatal' ? 'error' : (level === 'debug' || level === 'info' ? 'log' : level);
        (console as any)[consoleMethod](`[${category.toUpperCase()}] ${message}`, metadata);
      }
    } catch (error) {
      console.error('Failed to create log entry:', error);
    }
  }

  debug(message: string, category: string = 'app', metadata?: any): void {
    this.log('debug', message, category, metadata);
  }

  info(message: string, category: string = 'app', metadata?: any): void {
    this.log('info', message, category, metadata);
  }

  warn(message: string, category: string = 'app', metadata?: any, error?: Error): void {
    this.log('warn', message, category, metadata, error);
  }

  error(message: string, category: string = 'app', metadata?: any, error?: Error): void {
    this.log('error', message, category, metadata, error);
  }

  fatal(message: string, category: string = 'app', metadata?: any, error?: Error): void {
    this.log('fatal', message, category, metadata, error);
  }

  private startPerformanceMonitoring(): void {
    // Monitor app performance metrics
    if (this.config.includePerformanceMetrics) {
      this.performanceMonitor = setInterval(() => {
        this.debug('Performance metrics collected', 'performance', {
          timestamp: Date.now(),
          sessionId: this.sessionId,
        });
      }, 60000); // Every minute
    }
  }

  private setupCrashHandler(): void {
    // Global error handler for unhandled promise rejections
    if (typeof global !== 'undefined') {
      const globalObj = global as any;
      if (globalObj.HermesInternal && globalObj.ErrorUtils?.setGlobalHandler) {
        const originalHandler = globalObj.ErrorUtils.setGlobalHandler;
        originalHandler((error: Error, isFatal?: boolean) => {
          this.fatal('Unhandled error', 'crash', {
            isFatal,
            error: error.message,
          }, error);
          
          if (this.config.uploadOnCrash) {
            this.uploadLogs(true);
          }
        });
      }
    }
  }

  private scheduleLogUpload(): void {
    setInterval(() => {
      this.uploadLogs();
    }, this.config.uploadInterval);
  }

  private async uploadLogs(force: boolean = false): Promise<void> {
    if (this.uploadQueue.length === 0 && !force) return;

    try {
      // Simple network check - in production use @react-native-community/netinfo
      // const netInfo = await import('@react-native-community/netinfo');
      // const networkState = await netInfo.default.fetch();
      // if (!networkState.isConnected) return;
      
      const logsToUpload = force ? [...this.logs] : [...this.uploadQueue];
      
      if (logsToUpload.length === 0) return;

      this.info(`Uploading ${logsToUpload.length} log entries`, 'upload');
      
      const uploadResult = await this.mockUploadToServer(logsToUpload);
      
      if (uploadResult.success) {
        this.uploadQueue = [];
        await this.saveUploadQueue();
        this.info('Logs uploaded successfully', 'upload');
      } else {
        this.error('Failed to upload logs', 'upload', { error: uploadResult.error });
      }
    } catch (error) {
      this.error('Log upload failed', 'upload', {}, error as Error);
    }
  }

  private async mockUploadToServer(logs: LogEntry[]): Promise<{ success: boolean; error?: string }> {
    // Mock implementation - replace with actual upload logic
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true });
      }, 1000);
    });
  }

  async getLogs(filter?: {
    level?: LogEntry['level'][];
    category?: string[];
    dateRange?: { start: number; end: number };
    limit?: number;
  }): Promise<LogEntry[]> {
    await this.initialize();
    
    let filteredLogs = [...this.logs];
    
    if (filter) {
      if (filter.level) {
        filteredLogs = filteredLogs.filter(log => filter.level!.includes(log.level));
      }
      
      if (filter.category) {
        filteredLogs = filteredLogs.filter(log => filter.category!.includes(log.category));
      }
      
      if (filter.dateRange) {
        filteredLogs = filteredLogs.filter(log => 
          log.timestamp >= filter.dateRange!.start && 
          log.timestamp <= filter.dateRange!.end
        );
      }
      
      if (filter.limit) {
        filteredLogs = filteredLogs.slice(-filter.limit);
      }
    }
    
    return filteredLogs.sort((a, b) => b.timestamp - a.timestamp);
  }

  async clearLogs(): Promise<void> {
    this.logs = [];
    this.uploadQueue = [];
    await this.saveLogs();
    await this.saveUploadQueue();
    this.info('All logs cleared', 'system');
  }

  async exportLogs(): Promise<string> {
    await this.initialize();
    return JSON.stringify(this.logs, null, 2);
  }

  async updateConfig(config: Partial<LoggerConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.saveConfig();
    this.info('Logger configuration updated', 'system', { config });
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  async getLogStats(): Promise<{
    totalLogs: number;
    logsByLevel: { [key: string]: number };
    logsByCategory: { [key: string]: number };
    uploadQueueSize: number;
    sessionId: string;
  }> {
    await this.initialize();
    
    const logsByLevel: { [key: string]: number } = {};
    const logsByCategory: { [key: string]: number } = {};
    
    for (const log of this.logs) {
      logsByLevel[log.level] = (logsByLevel[log.level] || 0) + 1;
      logsByCategory[log.category] = (logsByCategory[log.category] || 0) + 1;
    }
    
    return {
      totalLogs: this.logs.length,
      logsByLevel,
      logsByCategory,
      uploadQueueSize: this.uploadQueue.length,
      sessionId: this.sessionId,
    };
  }

  // GDPR compliance methods
  async anonymizeUserData(userId: string): Promise<void> {
    for (const log of this.logs) {
      if (log.userId === userId) {
        log.userId = '[ANONYMIZED]';
        if (log.metadata) {
          log.metadata = this.sanitizeMetadata(log.metadata);
        }
      }
    }
    
    await this.saveLogs();
    this.info('User data anonymized for compliance', 'compliance', { userId: '[ANONYMIZED]' });
  }

  async deleteUserData(userId: string): Promise<void> {
    this.logs = this.logs.filter(log => log.userId !== userId);
    this.uploadQueue = this.uploadQueue.filter(log => log.userId !== userId);
    
    await this.saveLogs();
    await this.saveUploadQueue();
    
    this.info('User data deleted for compliance', 'compliance', { userId: '[DELETED]' });
  }

  async cleanupExpiredLogs(): Promise<void> {
    const retentionPeriod = this.config.compliance.dataRetentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - retentionPeriod;
    
    const beforeCount = this.logs.length;
    this.logs = this.logs.filter(log => log.timestamp > cutoffTime);
    const afterCount = this.logs.length;
    
    await this.saveLogs();
    
    this.info('Expired logs cleaned up', 'cleanup', {
      deleted: beforeCount - afterCount,
      remaining: afterCount,
    });
  }
}

export const logger = Logger.getInstance();
export default logger;