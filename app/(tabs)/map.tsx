import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppStatusBar, StatusBarConfigs } from '@/components/AppStatusBar';

import LocationService, { LocationResult } from '@/utils/LocationService';
import { useAppContext } from '@/contexts/AppContext';
import OSMapView from '@/components/OSMapView';

interface WorkOrderMarker {
  id: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  title: string;
  description: string;
  status: string;
}

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export default function MapScreen() {
  const { workOrders, setSelectedWorkOrder } = useAppContext();
  const insets = useSafeAreaInsets();
  const [currentLocation, setCurrentLocation] = useState<LocationResult | null>(null);
  const [region, setRegion] = useState<Region>({
    latitude: 31.230416, // 更新为上海坐标
    longitude: 121.473701,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [workOrderMarkers, setWorkOrderMarkers] = useState<WorkOrderMarker[]>([
    {
      id: 'WO001',
      coordinate: { latitude: 31.230416, longitude: 121.473701 },
      title: '外滩河道巡查',
      description: '外滩区域河道水质检测',
      status: '待接收',
    },
    {
      id: 'WO002',
      coordinate: { latitude: 31.239778, longitude: 121.499718 },
      title: '陆家嘴水域检查',
      description: '东方明珠附近水域巡查',
      status: '处理中',
    },
    {
      id: 'WO003',
      coordinate: { latitude: 31.223344, longitude: 121.457856 },
      title: '人民广场排水检测',
      description: '人民广场区域排水系统检查',
      status: '已完成',
    },
    {
      id: 'WO004',
      coordinate: { latitude: 31.245421, longitude: 121.506234 },
      title: '世纪公园水质监测',
      description: '世纪公园人工湖水质采样',
      status: '待审核',
    },
    {
      id: 'WO005',
      coordinate: { latitude: 31.218534, longitude: 121.484573 },
      title: '豫园池塘清理',
      description: '豫园九曲桥池塘清理作业',
      status: '处理中',
    },
  ]);
  // 移除手动切换逻辑，使用OSMapView

  useEffect(() => {
    if (Platform.OS !== 'web') {
      initializeLocation();
    }
    
    return () => {
      LocationService.stopWatching();
    };
  }, []);

  const initializeMarkers = useCallback(() => {
    // 转换工单数据为地图标记点
    const markers: WorkOrderMarker[] = workOrders.map((order) => {
      // 在上海周边随机分布工单位置
      const baseLatitude = 31.230416;
      const baseLongitude = 121.473701;
      
      return {
        id: order.id,
        coordinate: {
          latitude: baseLatitude + (Math.random() - 0.5) * 0.02,
          longitude: baseLongitude + (Math.random() - 0.5) * 0.02,
        },
        title: order.title,
        description: order.description || order.location || '工单详情',
        status: order.status,
      };
    });
    setWorkOrderMarkers(markers);
  }, [workOrders]);

  useEffect(() => {
    initializeMarkers();
  }, [initializeMarkers]);

  const initializeLocation = async () => {
    const location = await LocationService.getCurrentPosition();
    if (location) {
      setCurrentLocation(location);
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      setIsLocationEnabled(true);
    }
  };

  const handleLocationSearch = () => {
    Alert.alert('位置搜索', '位置搜索功能开发中');
  };

  const handleLayerToggle = () => {
    Alert.alert('图层控制', '图层控制功能开发中');
  };

  const handleMeasurement = () => {
    Alert.alert('距离测量', '距离测量功能开发中');
  };

  const handleMyLocation = async () => {
    const location = await LocationService.getCurrentPosition();
    if (location) {
      setCurrentLocation(location);
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const handleMarkerPress = (marker: WorkOrderMarker) => {
    const workOrder = workOrders.find(order => order.id === marker.id);
    if (workOrder) {
      setSelectedWorkOrder(workOrder);
      router.push('/workorder-detail');
    }
  };


  const renderSmartMap = () => {
    // 使用OpenStreetMap组件
    const smartMarkers = workOrderMarkers.map(marker => ({
      id: marker.id,
      latitude: marker.coordinate.latitude,
      longitude: marker.coordinate.longitude,
      title: marker.title,
      description: marker.description,
      type: 'workorder' as const,
      status: marker.status,
    }));

    return (
      <OSMapView
        style={styles.map}
        markers={smartMarkers}
        showUserLocation={true}
        onLocationChange={(location) => {
          setCurrentLocation({
            coords: {
              latitude: location.latitude,
              longitude: location.longitude,
              altitude: 0,
              accuracy: location.accuracy || 10,
              heading: 0,
              speed: 0,
            },
            timestamp: Date.now(),
          } as any);
        }}
        onMarkerPress={(markerId) => {
          const marker = workOrderMarkers.find(m => m.id === markerId);
          if (marker) {
            handleMarkerPress(marker);
          }
        }}
      />
    );
  };

  const renderWebMap = () => {
    // Web平台也使用OpenStreetMap
    const markers = workOrderMarkers.map(marker => ({
      id: marker.id,
      latitude: marker.coordinate.latitude,
      longitude: marker.coordinate.longitude,
      title: marker.title,
      description: marker.description,
      type: 'workorder' as const,
      status: marker.status,
    }));

    return (
      <OSMapView
        style={styles.map}
        markers={markers}
        showUserLocation={false}
        onMarkerPress={(markerId: string) => {
          const marker = workOrderMarkers.find(m => m.id === markerId);
          if (marker) {
            handleMarkerPress(marker);
          }
        }}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppStatusBar {...StatusBarConfigs.transparent} />
      <View style={[styles.content, { paddingTop: Math.max(insets.top + 10, 30) }]}>
        {/* 地图 */}
        {Platform.OS === 'web' ? renderWebMap() : renderSmartMap()}

        {/* 开发中蒙版 */}
        <View style={styles.developmentOverlay}>
          <View style={styles.developmentCard}>
            <MaterialIcons name="construction" size={48} color="#FFA500" />
            <Text style={styles.developmentTitle}>地图工单功能开发中</Text>
            <Text style={styles.developmentSubtitle}>该功能正在完善，敬请期待</Text>
          </View>
        </View>

        {/* 地图控制按钮 */}
        <View style={[styles.mapControls, { opacity: 0.3, pointerEvents: 'none' }]}>
          <TouchableOpacity style={styles.controlButton} onPress={handleLocationSearch}>
            <MaterialIcons name="search" size={20} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.controlButton} 
            onPress={handleMyLocation}
          >
            <MaterialIcons name="my-location" size={20} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={handleLayerToggle}>
            <MaterialIcons name="layers" size={20} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={handleMeasurement}>
            <MaterialIcons name="straighten" size={20} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        {/* 底部信息面板 */}
        <View style={[styles.infoPanel, { opacity: 0.3, pointerEvents: 'none' }]}>
          <View style={styles.infoPanelHeader}>
            <Text style={styles.infoPanelTitle}>工单分布</Text>
          </View>
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>
                待处理 ({workOrderMarkers.filter(m => m.status === '待接收').length})
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendText}>
                处理中 ({workOrderMarkers.filter(m => m.status === '处理中').length})
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>
                已完成 ({workOrderMarkers.filter(m => m.status === '已完成').length})
              </Text>
            </View>
          </View>

          {/* 当前位置信息 */}
          {currentLocation && (
            <View style={styles.locationInfo}>
              <MaterialIcons name="gps-fixed" size={16} color="#3B82F6" />
              <Text style={styles.locationText}>
                当前位置: {currentLocation.coords.latitude.toFixed(6)}, {currentLocation.coords.longitude.toFixed(6)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  webWorkOrdersList: {
    marginTop: 24,
    width: '100%',
    maxWidth: 300,
  },
  webListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  webWorkOrderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  webMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  webWorkOrderTitle: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  mapControls: {
    position: 'absolute',
    right: 16,
    top: 20,
    flexDirection: 'column',
    gap: 12,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  activeControlButton: {
    backgroundColor: '#3B82F6',
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  infoPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoPanelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  mapTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mapTypeText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  locationText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  developmentOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  developmentCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    minWidth: 280,
  },
  developmentTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  developmentSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});