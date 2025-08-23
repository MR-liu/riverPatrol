import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface MapComponentProps {
  region: any;
  onRegionChangeComplete: (region: any) => void;
  children?: React.ReactNode;
}

// 延迟加载react-native-maps的辅助函数
const loadMapModule = () => {
  if (Platform.OS === 'web') {
    return null;
  }
  
  try {
    // 使用eval来避免Metro在web上解析这个模块
    const moduleName = 'react-native-maps';
    const RNMaps = eval(`require('${moduleName}')`);
    return RNMaps;
  } catch (error) {
    console.warn('React Native Maps not available:', error);
    return null;
  }
};

const MapComponent: React.FC<MapComponentProps> = ({ 
  region, 
  onRegionChangeComplete, 
  children 
}) => {
  // Web fallback
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webMapContainer}>
        <MaterialIcons name="map" size={64} color="#9CA3AF" />
        <Text style={styles.webMapText}>地图功能</Text>
        <Text style={styles.webMapSubtext}>在移动设备上可显示真实地图</Text>
        {children}
      </View>
    );
  }

  // Native map implementation
  const RNMaps = loadMapModule();
  
  if (!RNMaps) {
    return (
      <View style={styles.webMapContainer}>
        <MaterialIcons name="map" size={64} color="#9CA3AF" />
        <Text style={styles.webMapText}>地图功能不可用</Text>
        <Text style={styles.webMapSubtext}>请在移动设备上使用</Text>
        {children}
      </View>
    );
  }

  const MapView = RNMaps.default;
  const PROVIDER_GOOGLE = RNMaps.PROVIDER_GOOGLE;
  
  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={styles.map}
      region={region}
      onRegionChangeComplete={onRegionChangeComplete}
      showsUserLocation={true}
      showsMyLocationButton={false}
      showsCompass={true}
      showsScale={true}
      zoomEnabled={true}
      scrollEnabled={true}
      pitchEnabled={true}
      rotateEnabled={true}
    >
      {children}
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  webMapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 20,
  },
  webMapText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
  },
  webMapSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default MapComponent;