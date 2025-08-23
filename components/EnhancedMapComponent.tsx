import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Text, ActivityIndicator } from 'react-native';
import MapView, { Region, Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';

interface EnhancedMapComponentProps {
  region: Region;
  onRegionChangeComplete?: (region: Region) => void;
  children?: React.ReactNode;
  markers?: Array<{
    id: string;
    coordinate: { latitude: number; longitude: number };
    title?: string;
    description?: string;
    color?: string;
    onPress?: () => void;
  }>;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  trackPoints?: Array<{ latitude: number; longitude: number }>;
  patrolAreas?: Array<{
    id: string;
    center: { latitude: number; longitude: number };
    radius: number;
    fillColor?: string;
    strokeColor?: string;
  }>;
  mapType?: 'standard' | 'satellite' | 'hybrid' | 'terrain';
  showsTraffic?: boolean;
  showsCompass?: boolean;
  zoomEnabled?: boolean;
  scrollEnabled?: boolean;
  pitchEnabled?: boolean;
  rotateEnabled?: boolean;
}

// 自定义地图样式
const customMapStyle = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#f5f5f5' }],
  },
  {
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#616161' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#f5f5f5' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#c9e4f5' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3B82F6' }],
  },
];

const EnhancedMapComponent: React.FC<EnhancedMapComponentProps> = ({
  region,
  onRegionChangeComplete,
  children,
  markers = [],
  showsUserLocation = true,
  showsMyLocationButton = true,
  trackPoints = [],
  patrolAreas = [],
  mapType = 'standard',
  showsTraffic = false,
  showsCompass = true,
  zoomEnabled = true,
  scrollEnabled = true,
  pitchEnabled = true,
  rotateEnabled = true,
}) => {
  const mapRef = useRef<MapView>(null);

  // Web平台的备用地图显示
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webMapContainer}>
        <View style={styles.webMapPlaceholder}>
          <Text style={styles.webMapTitle}>河道巡查地图</Text>
          <Text style={styles.webMapSubtitle}>
            位置: {region.latitude.toFixed(6)}, {region.longitude.toFixed(6)}
          </Text>
          {children}
        </View>
      </View>
    );
  }

  const getMarkerColor = (color?: string) => {
    switch (color) {
      case 'red':
        return '#EF4444';
      case 'blue':
        return '#3B82F6';
      case 'green':
        return '#10B981';
      case 'orange':
        return '#F59E0B';
      case 'purple':
        return '#8B5CF6';
      default:
        return color || '#EF4444';
    }
  };

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      region={region}
      onRegionChangeComplete={onRegionChangeComplete}
      provider={PROVIDER_GOOGLE}
      customMapStyle={customMapStyle}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={showsMyLocationButton}
      mapType={mapType}
      showsTraffic={showsTraffic}
      showsCompass={showsCompass}
      zoomEnabled={zoomEnabled}
      scrollEnabled={scrollEnabled}
      pitchEnabled={pitchEnabled}
      rotateEnabled={rotateEnabled}
      showsScale={true}
      showsBuildings={true}
      showsIndoors={false}
      loadingEnabled={true}
      loadingIndicatorColor="#3B82F6"
      loadingBackgroundColor="#F9FAFB"
    >
      {/* 渲染标记点 */}
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          coordinate={marker.coordinate}
          title={marker.title}
          description={marker.description}
          pinColor={getMarkerColor(marker.color)}
          onPress={marker.onPress}
          tracksViewChanges={false}
        />
      ))}

      {/* 渲染巡查轨迹 */}
      {trackPoints.length > 1 && (
        <Polyline
          coordinates={trackPoints}
          strokeColor="#3B82F6"
          strokeWidth={3}
          lineDashPattern={[5, 5]}
        />
      )}

      {/* 渲染巡查区域 */}
      {patrolAreas.map((area) => (
        <Circle
          key={area.id}
          center={area.center}
          radius={area.radius}
          fillColor={area.fillColor || 'rgba(59, 130, 246, 0.2)'}
          strokeColor={area.strokeColor || '#3B82F6'}
          strokeWidth={2}
        />
      ))}

      {children}
    </MapView>
  );
};

// 创建一个加载状态组件
export const MapLoadingOverlay: React.FC = () => (
  <View style={styles.loadingOverlay}>
    <ActivityIndicator size="large" color="#3B82F6" />
    <Text style={styles.loadingText}>加载地图中...</Text>
  </View>
);

// 创建地图控制组件
export const MapControls: React.FC<{
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onCenterLocation?: () => void;
  onToggleMapType?: () => void;
  onToggleTraffic?: () => void;
}> = ({ onZoomIn, onZoomOut, onCenterLocation, onToggleMapType, onToggleTraffic }) => {
  return (
    <View style={styles.mapControls}>
      {/* 控制按钮可以在这里添加 */}
    </View>
  );
};

// 地图工具函数
export const mapUtils = {
  // 计算两点之间的距离（米）
  calculateDistance: (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371e3; // 地球半径（米）
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  },

  // 计算区域边界
  calculateBounds: (
    points: Array<{ latitude: number; longitude: number }>
  ): {
    northEast: { latitude: number; longitude: number };
    southWest: { latitude: number; longitude: number };
  } => {
    if (points.length === 0) {
      return {
        northEast: { latitude: 0, longitude: 0 },
        southWest: { latitude: 0, longitude: 0 },
      };
    }

    let minLat = points[0].latitude;
    let maxLat = points[0].latitude;
    let minLng = points[0].longitude;
    let maxLng = points[0].longitude;

    points.forEach((point) => {
      minLat = Math.min(minLat, point.latitude);
      maxLat = Math.max(maxLat, point.latitude);
      minLng = Math.min(minLng, point.longitude);
      maxLng = Math.max(maxLng, point.longitude);
    });

    return {
      northEast: { latitude: maxLat, longitude: maxLng },
      southWest: { latitude: minLat, longitude: minLng },
    };
  },

  // 计算适合显示所有点的区域
  getRegionForCoordinates: (
    points: Array<{ latitude: number; longitude: number }>,
    padding = 0.1
  ): Region => {
    const bounds = mapUtils.calculateBounds(points);
    
    const latitudeDelta = Math.abs(bounds.northEast.latitude - bounds.southWest.latitude) * (1 + padding);
    const longitudeDelta = Math.abs(bounds.northEast.longitude - bounds.southWest.longitude) * (1 + padding);
    
    const latitude = (bounds.northEast.latitude + bounds.southWest.latitude) / 2;
    const longitude = (bounds.northEast.longitude + bounds.southWest.longitude) / 2;

    return {
      latitude,
      longitude,
      latitudeDelta: Math.max(latitudeDelta, 0.01),
      longitudeDelta: Math.max(longitudeDelta, 0.01),
    };
  },

  // 判断点是否在多边形内
  isPointInPolygon: (
    point: { latitude: number; longitude: number },
    polygon: Array<{ latitude: number; longitude: number }>
  ): boolean => {
    let inside = false;
    const x = point.latitude;
    const y = point.longitude;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].latitude;
      const yi = polygon[i].longitude;
      const xj = polygon[j].latitude;
      const yj = polygon[j].longitude;

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  },
};

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  webMapContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webMapPlaceholder: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'center',
  },
  webMapTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  webMapSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  mapControls: {
    position: 'absolute',
    right: 16,
    top: 100,
  },
});

export default EnhancedMapComponent;