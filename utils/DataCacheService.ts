import AsyncStorage from '@react-native-async-storage/async-storage';
// import NetInfo from '@react-native-community/netinfo'; // Optional dependency
// import CryptoJS from 'crypto-js'; // Optional dependency
// import { logger } from './Logger'; // Optional dependency

export interface CacheEntry<T = any> {
  id: string;
  key: string;
  data: T;
  timestamp: number;
  expiresAt?: number;
  version: number;
  checksum: string;
  tags: string[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflict';
  lastSyncAttempt?: number;
  retryCount: number;
  metadata?: {
    source: 'local' | 'remote';
    userId?: string;
    sessionId?: string;
    [key: string]: any;
  };
}

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'bulk';
  entityType: string;
  entityId: string;
  payload: any;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  dependencies?: string[];
  conflictResolution?: 'local' | 'remote' | 'merge' | 'manual';
  errorDetails?: {
    code: string;
    message: string;
    timestamp: number;
    context?: any;
  };
}

export interface CacheConfig {
  maxSize: number; // Maximum cache size in MB
  maxEntries: number;
  defaultTTL: number; // Default time-to-live in milliseconds
  cleanupInterval: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  encryptionKey?: string;
  syncEnabled: boolean;
  syncInterval: number;
  conflictResolutionStrategy: 'local' | 'remote' | 'merge' | 'manual';
  offlineMode: boolean;
  batchSize: number;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number;
    maxDelay: number;
  };
  compression: {
    enabled: boolean;
    algorithm: 'gzip' | 'lz4';
    threshold: number; // Compress if data size > threshold bytes
  };
  indexing: {
    enabled: boolean;
    fields: string[];
    fullTextSearch: boolean;
  };
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number; // in bytes
  hitRate: number;
  missRate: number;
  evictionCount: number;
  syncStats: {
    pendingOperations: number;
    failedOperations: number;
    lastSyncTime?: number;
    conflictCount: number;
  };
  performanceMetrics: {
    averageReadTime: number;
    averageWriteTime: number;
    averageSyncTime: number;
  };
}

class DataCacheService {
  private static instance: DataCacheService;
  private cache: Map<string, CacheEntry> = new Map();
  private syncQueue: Map<string, SyncOperation> = new Map();
  private config: CacheConfig;
  private isInitialized = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isOnline = true;
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;

  private readonly STORAGE_KEYS = {
    CACHE_DATA: 'datacache_entries',
    SYNC_QUEUE: 'datacache_sync_queue',
    CONFIG: 'datacache_config',
    STATS: 'datacache_stats',
    INDEX: 'datacache_index',
  };

  private readonly defaultConfig: CacheConfig = {
    maxSize: 100, // 100MB
    maxEntries: 10000,
    defaultTTL: 3600000, // 1 hour
    cleanupInterval: 300000, // 5 minutes
    compressionEnabled: true,
    encryptionEnabled: true,
    syncEnabled: true,
    syncInterval: 60000, // 1 minute
    conflictResolutionStrategy: 'merge',
    offlineMode: false,
    batchSize: 50,
    retryPolicy: {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000,
      maxDelay: 30000,
    },
    compression: {
      enabled: true,
      algorithm: 'gzip',
      threshold: 1024, // 1KB
    },
    indexing: {
      enabled: true,
      fields: ['id', 'timestamp', 'tags', 'entityType'],
      fullTextSearch: false,
    },
  };

  private constructor() {
    this.config = this.defaultConfig;
  }

  static getInstance(): DataCacheService {
    if (!DataCacheService.instance) {
      DataCacheService.instance = new DataCacheService();
    }
    return DataCacheService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing DataCacheService');
      
      await this.loadConfig();
      await this.loadCache();
      await this.loadSyncQueue();
      
      this.setupNetworkMonitoring();
      this.startCleanupTimer();
      
      if (this.config.syncEnabled) {
        this.startSyncTimer();
      }

      this.isInitialized = true;
      console.log('DataCacheService initialized successfully', {
        cacheSize: this.cache.size,
        syncQueueSize: this.syncQueue.size,
      });
    } catch (error) {
      console.error('Failed to initialize DataCacheService:', error);
      throw error;
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const configStr = await AsyncStorage.getItem(this.STORAGE_KEYS.CONFIG);
      if (configStr) {
        const storedConfig = JSON.parse(configStr);
        this.config = { ...this.defaultConfig, ...storedConfig };
      }
    } catch (error) {
      console.warn('Failed to load cache config, using defaults:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.CONFIG, JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save cache config:', error);
    }
  }

  private async loadCache(): Promise<void> {
    try {
      const cacheStr = await AsyncStorage.getItem(this.STORAGE_KEYS.CACHE_DATA);
      if (cacheStr) {
        const cacheData = JSON.parse(cacheStr);
        this.cache = new Map(cacheData.map((entry: CacheEntry) => [entry.key, entry]));
        
        // Clean expired entries
        await this.cleanupExpiredEntries();
        
        console.log('Cache loaded successfully', { entriesCount: this.cache.size });
      }
    } catch (error) {
      console.error('Failed to load cache data:', error);
      this.cache = new Map();
    }
  }

  private async saveCache(): Promise<void> {
    try {
      const cacheArray = Array.from(this.cache.values());
      const compressedData = this.config.compressionEnabled 
        ? this.compressData(JSON.stringify(cacheArray))
        : JSON.stringify(cacheArray);
      
      await AsyncStorage.setItem(this.STORAGE_KEYS.CACHE_DATA, compressedData);
      console.log('Cache saved to storage', { entriesCount: cacheArray.length });
    } catch (error) {
      console.error('Failed to save cache data:', error);
    }
  }

  private async loadSyncQueue(): Promise<void> {
    try {
      const queueStr = await AsyncStorage.getItem(this.STORAGE_KEYS.SYNC_QUEUE);
      if (queueStr) {
        const queueData = JSON.parse(queueStr);
        this.syncQueue = new Map(queueData.map((op: SyncOperation) => [op.id, op]));
        console.log('Sync queue loaded', { operationsCount: this.syncQueue.size });
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      this.syncQueue = new Map();
    }
  }

  private async saveSyncQueue(): Promise<void> {
    try {
      const queueArray = Array.from(this.syncQueue.values());
      await AsyncStorage.setItem(this.STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queueArray));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  private setupNetworkMonitoring(): void {
    // Simple network monitoring - replace with @react-native-community/netinfo in production
    // NetInfo.addEventListener(state => {
    //   const wasOnline = this.isOnline;
    //   this.isOnline = state.isConnected ?? false;
    //   if (!wasOnline && this.isOnline) {
    //     this.processSyncQueue();
    //   }
    // });
    
    // Fallback: assume online for now
    this.isOnline = true;
  }

  private startSyncTimer(): void {
    this.syncTimer = setInterval(() => {
      if (this.isOnline && this.syncQueue.size > 0) {
        this.processSyncQueue();
      }
    }, this.config.syncInterval) as unknown as NodeJS.Timeout;
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
      this.enforceMaxSize();
    }, this.config.cleanupInterval) as unknown as NodeJS.Timeout;
  }

  // Core cache operations
  async get<T = any>(key: string): Promise<T | null> {
    await this.initialize();
    
    const startTime = Date.now();
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.missCount++;
      console.log('Cache miss', { key });
      return null;
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.missCount++;
      console.log('Cache entry expired', { key, expiresAt: entry.expiresAt });
      return null;
    }

    this.hitCount++;
    const readTime = Date.now() - startTime;
    console.log('Cache hit', { key, readTime });
    
    return this.decryptData(entry.data) as T;
  }

  async set<T = any>(
    key: string, 
    data: T, 
    options?: {
      ttl?: number;
      tags?: string[];
      priority?: CacheEntry['priority'];
      syncEnabled?: boolean;
      metadata?: any;
    }
  ): Promise<void> {
    await this.initialize();
    
    const startTime = Date.now();
    const now = Date.now();
    const ttl = options?.ttl ?? this.config.defaultTTL;
    
    const entry: CacheEntry<T> = {
      id: this.generateId(),
      key,
      data: this.encryptData(data),
      timestamp: now,
      expiresAt: ttl > 0 ? now + ttl : undefined,
      version: this.getNextVersion(key),
      checksum: this.calculateChecksum(data),
      tags: options?.tags ?? [],
      priority: options?.priority ?? 'normal',
      syncStatus: options?.syncEnabled !== false && this.config.syncEnabled ? 'pending' : 'synced',
      retryCount: 0,
      metadata: {
        source: 'local',
        ...options?.metadata,
      },
    };

    this.cache.set(key, entry);
    
    // Add to sync queue if sync is enabled
    if (entry.syncStatus === 'pending') {
      await this.addToSyncQueue('update', 'cache_entry', key, data);
    }

    await this.saveCache();
    
    const writeTime = Date.now() - startTime;
    console.log('Cache entry set', { key, writeTime, syncStatus: entry.syncStatus });
  }

  async delete(key: string): Promise<boolean> {
    await this.initialize();
    
    const existed = this.cache.has(key);
    this.cache.delete(key);
    
    if (existed && this.config.syncEnabled) {
      await this.addToSyncQueue('delete', 'cache_entry', key, null);
    }

    await this.saveCache();
    console.log('Cache entry deleted', { key, existed });
    
    return existed;
  }

  async clear(): Promise<void> {
    await this.initialize();
    
    const entriesCount = this.cache.size;
    this.cache.clear();
    this.syncQueue.clear();
    
    await this.saveCache();
    await this.saveSyncQueue();
    
    console.log('Cache cleared', { deletedEntries: entriesCount });
  }

  // Advanced operations
  async getByTags(tags: string[]): Promise<CacheEntry[]> {
    await this.initialize();
    
    return Array.from(this.cache.values()).filter(entry => 
      tags.every(tag => entry.tags.includes(tag))
    );
  }

  async invalidateByTags(tags: string[]): Promise<number> {
    await this.initialize();
    
    let invalidatedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (tags.some(tag => entry.tags.includes(tag))) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }

    await this.saveCache();
    console.log('Entries invalidated by tags', { tags, count: invalidatedCount });
    
    return invalidatedCount;
  }

  async getMultiple<T = any>(keys: string[]): Promise<{ [key: string]: T | null }> {
    await this.initialize();
    
    const results: { [key: string]: T | null } = {};
    
    for (const key of keys) {
      results[key] = await this.get<T>(key);
    }
    
    return results;
  }

  async setMultiple<T = any>(entries: { key: string; data: T; options?: any }[]): Promise<void> {
    await this.initialize();
    
    const promises = entries.map(({ key, data, options }) => 
      this.set(key, data, options)
    );
    
    await Promise.all(promises);
    console.log('Multiple entries set', { count: entries.length });
  }

  // Sync operations
  private async addToSyncQueue(
    type: SyncOperation['type'],
    entityType: string,
    entityId: string,
    payload: any,
    priority: SyncOperation['priority'] = 'normal'
  ): Promise<void> {
    const operation: SyncOperation = {
      id: this.generateId(),
      type,
      entityType,
      entityId,
      payload,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      maxRetries: this.config.retryPolicy.maxRetries,
      priority,
    };

    this.syncQueue.set(operation.id, operation);
    await this.saveSyncQueue();
    
    console.log('Operation added to sync queue', { operationId: operation.id, type });
  }

  private async processSyncQueue(): Promise<void> {
    if (!this.isOnline || this.syncQueue.size === 0) return;

    console.log('Processing sync queue', { operationsCount: this.syncQueue.size });
    
    const pendingOps = Array.from(this.syncQueue.values())
      .filter(op => op.status === 'pending' || op.status === 'failed')
      .sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority))
      .slice(0, this.config.batchSize);

    const promises = pendingOps.map(op => this.processSyncOperation(op));
    await Promise.allSettled(promises);
    
    await this.saveSyncQueue();
  }

  private async processSyncOperation(operation: SyncOperation): Promise<void> {
    try {
      operation.status = 'processing';
      
      // Mock sync operation - replace with actual API calls
      const result = await this.mockSyncToServer(operation);
      
      if (result.success) {
        operation.status = 'completed';
        this.syncQueue.delete(operation.id);
        console.log('Sync operation completed', { operationId: operation.id });
      } else {
        throw new Error(result.error || 'Sync operation failed');
      }
    } catch (error) {
      operation.status = 'failed';
      operation.retryCount++;
      operation.errorDetails = {
        code: 'SYNC_ERROR',
        message: (error as Error).message,
        timestamp: Date.now(),
      };
      
      if (operation.retryCount >= operation.maxRetries) {
        console.error('Sync operation failed permanently', {
          operationId: operation.id,
          retryCount: operation.retryCount,
        }, error);
      } else {
        console.warn('Sync operation failed, will retry', {
          operationId: operation.id,
          retryCount: operation.retryCount,
        }, error);
      }
    }
  }

  private async mockSyncToServer(operation: SyncOperation): Promise<{ success: boolean; error?: string }> {
    // Mock implementation - replace with actual server sync logic
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: Math.random() > 0.1 }); // 90% success rate
      }, Math.random() * 1000);
    });
  }

  // Utility methods
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getNextVersion(key: string): number {
    const existing = this.cache.get(key);
    return existing ? existing.version + 1 : 1;
  }

  private calculateChecksum(data: any): string {
    // Simple checksum - replace with crypto-js in production
    return JSON.stringify(data).length.toString();
    // return CryptoJS.MD5(JSON.stringify(data)).toString();
  }

  private encryptData(data: any): any {
    if (!this.config.encryptionEnabled || !this.config.encryptionKey) {
      return data;
    }
    
    // Simple base64 encoding - replace with proper encryption in production
    try {
      const jsonString = JSON.stringify(data);
      return btoa(jsonString); // Base64 encoding
      // return CryptoJS.AES.encrypt(jsonString, this.config.encryptionKey).toString();
    } catch (error) {
      console.warn('Failed to encrypt data:', error);
      return data;
    }
  }

  private decryptData(data: any): any {
    if (!this.config.encryptionEnabled || !this.config.encryptionKey || typeof data !== 'string') {
      return data;
    }
    
    // Simple base64 decoding - replace with proper decryption in production
    try {
      const jsonString = atob(data); // Base64 decoding
      return JSON.parse(jsonString);
      // const bytes = CryptoJS.AES.decrypt(data, this.config.encryptionKey);
      // const jsonString = bytes.toString(CryptoJS.enc.Utf8);
      // return JSON.parse(jsonString);
    } catch (error) {
      console.warn('Failed to decrypt data:', error);
      return data;
    }
  }

  private compressData(data: string): string {
    // Mock compression - in real implementation, use a proper compression library
    return data;
  }

  private decompressData(data: string): string {
    // Mock decompression
    return data;
  }

  private getPriorityWeight(priority: SyncOperation['priority']): number {
    const weights = { low: 1, normal: 2, high: 3, critical: 4 };
    return weights[priority] || 2;
  }

  // Maintenance operations
  private async cleanupExpiredEntries(): Promise<void> {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      await this.saveCache();
      console.log('Expired entries cleaned up', { count: cleanedCount });
    }
  }

  private async enforceMaxSize(): Promise<void> {
    if (this.cache.size <= this.config.maxEntries) return;

    // Sort entries by priority and timestamp (LRU for same priority)
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => {
        const priorityDiff = this.getPriorityWeight(a.priority) - this.getPriorityWeight(b.priority);
        if (priorityDiff !== 0) return priorityDiff;
        return a.timestamp - b.timestamp; // Older entries first
      });

    const excessCount = this.cache.size - this.config.maxEntries;
    
    for (let i = 0; i < excessCount; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      this.evictionCount++;
    }

    await this.saveCache();
    console.log('Cache size enforced', { evicted: excessCount });
  }

  // Statistics and monitoring
  async getStats(): Promise<CacheStats> {
    await this.initialize();

    const totalHits = this.hitCount + this.missCount;
    const hitRate = totalHits > 0 ? (this.hitCount / totalHits) * 100 : 0;
    const missRate = totalHits > 0 ? (this.missCount / totalHits) * 100 : 0;

    const pendingOps = Array.from(this.syncQueue.values()).filter(op => op.status === 'pending').length;
    const failedOps = Array.from(this.syncQueue.values()).filter(op => op.status === 'failed').length;
    const conflictOps = Array.from(this.syncQueue.values()).filter(op => op.status === 'failed' && op.errorDetails?.code === 'CONFLICT').length;

    return {
      totalEntries: this.cache.size,
      totalSize: this.calculateTotalSize(),
      hitRate,
      missRate,
      evictionCount: this.evictionCount,
      syncStats: {
        pendingOperations: pendingOps,
        failedOperations: failedOps,
        lastSyncTime: this.getLastSyncTime(),
        conflictCount: conflictOps,
      },
      performanceMetrics: {
        averageReadTime: 0, // Would be calculated from actual measurements
        averageWriteTime: 0,
        averageSyncTime: 0,
      },
    };
  }

  private calculateTotalSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += JSON.stringify(entry).length * 2; // Rough estimate (UTF-16)
    }
    return totalSize;
  }

  private getLastSyncTime(): number | undefined {
    const completedOps = Array.from(this.syncQueue.values())
      .filter(op => op.status === 'completed')
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return completedOps.length > 0 ? completedOps[0].timestamp : undefined;
  }

  // Configuration management
  async updateConfig(newConfig: Partial<CacheConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await this.saveConfig();
    
    // Restart timers with new intervals if needed
    if (newConfig.syncInterval && this.syncTimer) {
      clearInterval(this.syncTimer);
      this.startSyncTimer();
    }
    
    if (newConfig.cleanupInterval && this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.startCleanupTimer();
    }
    
    console.log('Cache configuration updated', { config: newConfig });
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  // Cleanup
  async shutdown(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    await this.saveCache();
    await this.saveSyncQueue();
    
    console.log('DataCacheService shutdown completed');
  }
}

export const dataCacheService = DataCacheService.getInstance();
export default dataCacheService;