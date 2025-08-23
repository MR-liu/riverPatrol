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
import MapComponent from '@/components/MapComponent';

// 创建Marker组件来处理地图标记
const MapMarker: React.FC<{ 
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  pinColor?: string;
  onPress?: () => void;
}> = ({ coordinate, title, description, pinColor = 'red', onPress }) => {
  if (Platform.OS === 'web') {
    // Web平台不显示标记
    return null;
  }

  try {
    // 使用eval来避免Metro在web上解析这个模块
    const moduleName = 'react-native-maps';
    const RNMaps = eval(`require('${moduleName}')`);
    const Marker = RNMaps.Marker;
    
    return (
      <Marker
        coordinate={coordinate}
        title={title}
        description={description}
        pinColor={pinColor}
        onPress={onPress}
      />
    );
  } catch (error) {
    console.warn('Marker component not available:', error);
    return null;
  }
};

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
    latitude: 39.9042,
    longitude: 116.4074,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [workOrderMarkers, setWorkOrderMarkers] = useState<WorkOrderMarker[]>([]);
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [currentTrackPoints, setCurrentTrackPoints] = useState<any[]>([]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      initializeLocation();
      checkTrackingStatus();
    }
    
    return () => {
      LocationService.stopWatching();
    };
  }, []);

  const checkTrackingStatus = async () => {
    const trackStatus = LocationService.getCurrentTrackStatus();
    setIsTrackingActive(trackStatus.isTracking);
    
    if (trackStatus.track && trackStatus.track.points.length > 0) {
      setCurrentTrackPoints(trackStatus.track.points);
    }
  };

  const initializeMarkers = useCallback(() => {
    // 模拟工单位置数据
    const markers: WorkOrderMarker[] = workOrders.map((order) => ({
      id: order.id,
      coordinate: {
        latitude: 39.9042 + (Math.random() - 0.5) * 0.01,
        longitude: 116.4074 + (Math.random() - 0.5) * 0.01,
      },
      title: order.title,
      description: order.description,
      status: order.status,
    }));
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

  const getMarkerColor = (status: string) => {
    switch (status) {
      case '待接收':
        return 'red';
      case '处理中':
        return 'orange';
      case '已完成':
        return 'green';
      case '待审核':
        return 'purple';
      default:
        return 'gray';
    }
  };

  const renderNativeMap = () => (
    <MapComponent
      region={region}
      onRegionChangeComplete={setRegion}
    >
      {/* 当前位置标记 */}
      {currentLocation && (
        <MapMarker
          coordinate={{
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          }}
          title="我的位置"
          description="当前位置"
          pinColor="#3B82F6"
        />
      )}

      {/* 工单标记 */}
      {workOrderMarkers.map((marker) => (
        <MapMarker
          key={marker.id}
          coordinate={marker.coordinate}
          title={marker.title}
          description={marker.description}
          pinColor={getMarkerColor(marker.status)}
          onPress={() => handleMarkerPress(marker)}
        />
      ))}
    </MapComponent>
  );

  const renderWebMap = () => (
    <MapComponent
      region={region}
      onRegionChangeComplete={setRegion}
    >
      {/* 工单列表显示 */}
      <View style={styles.webWorkOrdersList}>
        <Text style={styles.webListTitle}>工单位置列表：</Text>
        {workOrderMarkers.slice(0, 3).map((marker) => (
          <TouchableOpacity
            key={marker.id}
            style={styles.webWorkOrderItem}
            onPress={() => handleMarkerPress(marker)}
          >
            <View style={[
              styles.webMarkerDot,
              { backgroundColor: getMarkerColor(marker.status) === 'red' ? '#EF4444' : 
                               getMarkerColor(marker.status) === 'orange' ? '#F59E0B' :
                               getMarkerColor(marker.status) === 'green' ? '#10B981' : '#8B5CF6' }
            ]} />
            <Text style={styles.webWorkOrderTitle}>{marker.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </MapComponent>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppStatusBar {...StatusBarConfigs.transparent} />
      <View style={[styles.content, { paddingTop: Math.max(insets.top, 20) }]}>
        {/* 地图 */}
        {Platform.OS === 'web' ? renderWebMap() : renderNativeMap()}

        {/* 地图控制按钮 */}
        <View style={styles.mapControls}>
          <TouchableOpacity style={styles.controlButton} onPress={handleLocationSearch}>
            <MaterialIcons name="search" size={24} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.controlButton} 
            onPress={() => Alert.alert('定位', '正在获取当前位置...')}
          >
            <MaterialIcons name="my-location" size={24} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={handleLayerToggle}>
            <MaterialIcons name="layers" size={24} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={handleMeasurement}>
            <MaterialIcons name="straighten" size={24} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={handleMyLocation}>
            <MaterialIcons name="my-location" size={24} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        {/* 底部信息面板 */}
        <View style={styles.infoPanel}>
          <Text style={styles.infoPanelTitle}>工单分布</Text>
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
  infoPanelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
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
});