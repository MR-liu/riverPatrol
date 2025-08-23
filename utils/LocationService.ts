import { Alert } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

export interface LocationResult {
  coords: LocationCoords;
  timestamp: number;
}

export interface TrackPoint {
  id: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: number;
  address?: string;
}

export interface PatrolTrack {
  id: string;
  userId: string;
  startTime: number;
  endTime?: number;
  points: TrackPoint[];
  totalDistance: number;
  totalDuration: number;
  status: 'active' | 'paused' | 'completed';
  workOrderId?: string;
  notes?: string;
}

class LocationService {
  private subscription: Location.LocationSubscription | null = null;
  private currentTrack: PatrolTrack | null = null;
  private lastTrackPoint: TrackPoint | null = null;
  private trackingEnabled: boolean = false;

  // 请求位置权限
  async requestLocationPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      console.warn(err);
      return false;
    }
  }

  // 获取当前位置
  async getCurrentPosition(): Promise<LocationResult | null> {
    const hasPermission = await this.requestLocationPermission();
    if (!hasPermission) {
      Alert.alert('权限不足', '请授予位置权限后重试');
      return null;
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 1,
      });

      const result: LocationResult = {
        coords: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude || undefined,
          accuracy: location.coords.accuracy || undefined,
          heading: location.coords.heading || undefined,
          speed: location.coords.speed || undefined,
        },
        timestamp: location.timestamp,
      };

      return result;
    } catch (error) {
      console.log('Location error:', error);
      Alert.alert('定位失败', '无法获取当前位置，请检查GPS设置');
      return null;
    }
  }

  // 开始位置监听
  async startWatching(
    onLocationUpdate: (location: LocationResult) => void,
    onError?: (error: any) => void
  ): Promise<boolean> {
    const hasPermission = await this.requestLocationPermission();
    if (!hasPermission) {
      Alert.alert('权限不足', '请授予位置权限后重试');
      return false;
    }

    // 停止之前的监听
    this.stopWatching();

    try {
      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // 5秒更新一次
          distanceInterval: 10, // 10米才更新一次
        },
        (location) => {
          const result: LocationResult = {
            coords: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              altitude: location.coords.altitude || undefined,
              accuracy: location.coords.accuracy || undefined,
              heading: location.coords.heading || undefined,
              speed: location.coords.speed || undefined,
            },
            timestamp: location.timestamp,
          };
          onLocationUpdate(result);
        }
      );

      return true;
    } catch (error) {
      console.log('Watch position error:', error);
      if (onError) {
        onError(error);
      }
      return false;
    }
  }

  // 停止位置监听
  stopWatching(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
  }

  // 计算两点之间的距离（米）
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // 地球半径（米）
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;
    return Math.round(distance);
  }

  // 格式化距离显示
  formatDistance(distance: number): string {
    if (distance < 1000) {
      return `${distance}m`;
    } else {
      return `${(distance / 1000).toFixed(1)}km`;
    }
  }

  // 获取地址信息（逆地理编码）
  async getAddressFromCoords(
    latitude: number,
    longitude: number
  ): Promise<string> {
    try {
      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (addresses && addresses.length > 0) {
        const address = addresses[0];
        const parts = [
          address.country,
          address.region,
          address.city,
          address.district,
          address.street,
          address.streetNumber,
        ].filter(Boolean);
        
        return parts.length > 0 ? parts.join(' ') : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      }
      
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    } catch (error) {
      console.log('Reverse geocoding error:', error);
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
  }

  // 检查GPS是否开启
  async isLocationEnabled(): Promise<boolean> {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      return enabled;
    } catch (error) {
      console.log('Location services check error:', error);
      return false;
    }
  }

  // 获取位置权限状态
  async getLocationPermissionStatus(): Promise<string> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status;
    } catch (error) {
      console.log('Get permission status error:', error);
      return 'undetermined';
    }
  }

  // ===== GPS轨迹记录功能 =====

  // 开始巡视轨迹记录
  async startPatrolTrack(userId: string, workOrderId?: string): Promise<string | null> {
    try {
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        Alert.alert('权限不足', '请授予位置权限后重试');
        return null;
      }

      const trackId = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const currentLocation = await this.getCurrentPosition();
      
      if (!currentLocation) {
        Alert.alert('定位失败', '无法获取当前位置，请检查GPS设置');
        return null;
      }

      this.currentTrack = {
        id: trackId,
        userId,
        startTime: Date.now(),
        points: [],
        totalDistance: 0,
        totalDuration: 0,
        status: 'active',
        workOrderId,
      };

      // 添加起始点
      const startPoint: TrackPoint = {
        id: `point_${Date.now()}`,
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        altitude: currentLocation.coords.altitude,
        accuracy: currentLocation.coords.accuracy,
        speed: currentLocation.coords.speed,
        heading: currentLocation.coords.heading,
        timestamp: currentLocation.timestamp,
      };

      this.currentTrack.points.push(startPoint);
      this.lastTrackPoint = startPoint;
      this.trackingEnabled = true;

      // 开始位置监听
      await this.startTrackingLocationUpdates();

      // 保存到本地存储
      await this.saveCurrentTrack();

      return trackId;
    } catch (error) {
      console.error('Start patrol track error:', error);
      return null;
    }
  }

  // 暂停轨迹记录
  async pausePatrolTrack(): Promise<boolean> {
    if (!this.currentTrack || this.currentTrack.status !== 'active') {
      return false;
    }

    try {
      this.currentTrack.status = 'paused';
      this.stopWatching();
      await this.saveCurrentTrack();
      return true;
    } catch (error) {
      console.error('Pause patrol track error:', error);
      return false;
    }
  }

  // 恢复轨迹记录
  async resumePatrolTrack(): Promise<boolean> {
    if (!this.currentTrack || this.currentTrack.status !== 'paused') {
      return false;
    }

    try {
      this.currentTrack.status = 'active';
      await this.startTrackingLocationUpdates();
      await this.saveCurrentTrack();
      return true;
    } catch (error) {
      console.error('Resume patrol track error:', error);
      return false;
    }
  }

  // 结束轨迹记录
  async stopPatrolTrack(notes?: string): Promise<PatrolTrack | null> {
    if (!this.currentTrack) {
      return null;
    }

    try {
      this.currentTrack.endTime = Date.now();
      this.currentTrack.totalDuration = this.currentTrack.endTime - this.currentTrack.startTime;
      this.currentTrack.status = 'completed';
      this.currentTrack.notes = notes;
      this.trackingEnabled = false;

      this.stopWatching();

      // 保存完整的轨迹记录
      await this.saveCompletedTrack(this.currentTrack);
      
      const completedTrack = { ...this.currentTrack };
      this.currentTrack = null;
      this.lastTrackPoint = null;

      return completedTrack;
    } catch (error) {
      console.error('Stop patrol track error:', error);
      return null;
    }
  }

  // 获取当前轨迹状态
  getCurrentTrackStatus(): { isTracking: boolean; track: PatrolTrack | null } {
    return {
      isTracking: this.trackingEnabled && this.currentTrack?.status === 'active',
      track: this.currentTrack,
    };
  }

  // 开始位置更新监听（用于轨迹记录）
  private async startTrackingLocationUpdates(): Promise<void> {
    if (!this.trackingEnabled || !this.currentTrack) {
      return;
    }

    await this.startWatching(
      (location) => {
        this.handleTrackLocationUpdate(location);
      },
      (error) => {
        console.error('Track location update error:', error);
      }
    );
  }

  // 处理轨迹位置更新
  private handleTrackLocationUpdate(location: LocationResult): void {
    if (!this.currentTrack || !this.trackingEnabled || this.currentTrack.status !== 'active') {
      return;
    }

    const newPoint: TrackPoint = {
      id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
      timestamp: location.timestamp,
    };

    // 计算与上一个点的距离
    if (this.lastTrackPoint) {
      const distance = this.calculateDistance(
        this.lastTrackPoint.latitude,
        this.lastTrackPoint.longitude,
        newPoint.latitude,
        newPoint.longitude
      );

      // 只有移动距离超过5米才记录新点（避免GPS漂移）
      if (distance > 5) {
        this.currentTrack.points.push(newPoint);
        this.currentTrack.totalDistance += distance;
        this.lastTrackPoint = newPoint;

        // 异步保存，避免阻塞UI
        this.saveCurrentTrack().catch(console.error);
      }
    } else {
      this.currentTrack.points.push(newPoint);
      this.lastTrackPoint = newPoint;
    }
  }

  // 保存当前轨迹到本地存储
  private async saveCurrentTrack(): Promise<void> {
    if (!this.currentTrack) {
      return;
    }

    try {
      await AsyncStorage.setItem('current_patrol_track', JSON.stringify(this.currentTrack));
    } catch (error) {
      console.error('Save current track error:', error);
    }
  }

  // 保存已完成的轨迹
  private async saveCompletedTrack(track: PatrolTrack): Promise<void> {
    try {
      const existingTracks = await AsyncStorage.getItem('completed_patrol_tracks');
      const tracks: PatrolTrack[] = existingTracks ? JSON.parse(existingTracks) : [];
      
      tracks.push(track);
      
      // 只保留最近30天的轨迹
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const filteredTracks = tracks.filter(t => t.startTime > thirtyDaysAgo);
      
      await AsyncStorage.setItem('completed_patrol_tracks', JSON.stringify(filteredTracks));
      
      // 清除当前轨迹
      await AsyncStorage.removeItem('current_patrol_track');
    } catch (error) {
      console.error('Save completed track error:', error);
    }
  }

  // 恢复未完成的轨迹（应用重启时调用）
  async restoreCurrentTrack(): Promise<PatrolTrack | null> {
    try {
      const trackData = await AsyncStorage.getItem('current_patrol_track');
      if (trackData) {
        const track: PatrolTrack = JSON.parse(trackData);
        this.currentTrack = track;
        this.trackingEnabled = track.status === 'active';
        
        if (track.points.length > 0) {
          this.lastTrackPoint = track.points[track.points.length - 1];
        }
        
        // 如果之前是活动状态，恢复位置监听
        if (this.trackingEnabled) {
          await this.startTrackingLocationUpdates();
        }
        
        return track;
      }
      return null;
    } catch (error) {
      console.error('Restore current track error:', error);
      return null;
    }
  }

  // 获取已完成的轨迹列表
  async getCompletedTracks(limit?: number): Promise<PatrolTrack[]> {
    try {
      const tracksData = await AsyncStorage.getItem('completed_patrol_tracks');
      if (tracksData) {
        const tracks: PatrolTrack[] = JSON.parse(tracksData);
        const sortedTracks = tracks.sort((a, b) => b.startTime - a.startTime);
        return limit ? sortedTracks.slice(0, limit) : sortedTracks;
      }
      return [];
    } catch (error) {
      console.error('Get completed tracks error:', error);
      return [];
    }
  }

  // 删除指定轨迹
  async deleteTrack(trackId: string): Promise<boolean> {
    try {
      const tracksData = await AsyncStorage.getItem('completed_patrol_tracks');
      if (tracksData) {
        const tracks: PatrolTrack[] = JSON.parse(tracksData);
        const filteredTracks = tracks.filter(t => t.id !== trackId);
        await AsyncStorage.setItem('completed_patrol_tracks', JSON.stringify(filteredTracks));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Delete track error:', error);
      return false;
    }
  }

  // 获取轨迹统计信息
  async getTrackStats(): Promise<{
    totalTracks: number;
    totalDistance: number;
    totalDuration: number;
    averageSpeed: number;
  }> {
    try {
      const tracks = await this.getCompletedTracks();
      const totalTracks = tracks.length;
      const totalDistance = tracks.reduce((sum, track) => sum + track.totalDistance, 0);
      const totalDuration = tracks.reduce((sum, track) => sum + track.totalDuration, 0);
      const averageSpeed = totalDuration > 0 ? (totalDistance / (totalDuration / 1000)) * 3.6 : 0; // km/h

      return {
        totalTracks,
        totalDistance,
        totalDuration,
        averageSpeed,
      };
    } catch (error) {
      console.error('Get track stats error:', error);
      return {
        totalTracks: 0,
        totalDistance: 0,
        totalDuration: 0,
        averageSpeed: 0,
      };
    }
  }

  // 格式化时间显示
  formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // 获取轨迹的边界范围（用于地图显示）
  getTrackBounds(track: PatrolTrack): {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } | null {
    if (track.points.length === 0) {
      return null;
    }

    let minLat = track.points[0].latitude;
    let maxLat = track.points[0].latitude;
    let minLng = track.points[0].longitude;
    let maxLng = track.points[0].longitude;

    track.points.forEach(point => {
      minLat = Math.min(minLat, point.latitude);
      maxLat = Math.max(maxLat, point.latitude);
      minLng = Math.min(minLng, point.longitude);
      maxLng = Math.max(maxLng, point.longitude);
    });

    return { minLat, maxLat, minLng, maxLng };
  }
}

export default new LocationService();