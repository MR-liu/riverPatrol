/**
 * OpenStreetMap地图组件
 * 使用Leaflet和OpenStreetMap提供免费开源的地图服务
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

interface OSMapViewProps {
  style?: any;
  onLocationChange?: (location: { 
    latitude: number; 
    longitude: number;
    accuracy?: number;
    address?: string;
  }) => void;
  markers?: Array<{
    id: string;
    latitude: number;
    longitude: number;
    title: string;
    description?: string;
    status?: string;
    type?: 'workorder' | 'device' | 'user';
  }>;
  showUserLocation?: boolean;
  onMarkerPress?: (markerId: string) => void;
}

const OSMapView: React.FC<OSMapViewProps> = ({
  style,
  onLocationChange,
  markers = [],
  showUserLocation = true,
  onMarkerPress,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // 获取当前位置
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限提示', '需要位置权限来获取当前位置');
        return;
      }

      console.log('[OSMapView] 开始获取位置...');
      
      // 使用高精度定位，并设置超时
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
        timeInterval: 5000,
        distanceInterval: 5,
      });
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      };
      
      console.log('[OSMapView] 获取到位置:', {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        provider: location.coords.provider || 'unknown',
        timestamp: location.timestamp,
      });
      
      setUserLocation(coords);
      onLocationChange?.(coords);

      // 更新地图中心点和用户标记
      if (mapReady) {
        const jsCode = `
          if (window.map) {
            // 移动地图到当前位置
            map.setView([${coords.latitude}, ${coords.longitude}], 16);
            
            // 更新或创建用户位置标记
            if (window.userMarker) {
              window.userMarker.setLatLng([${coords.latitude}, ${coords.longitude}]);
            } else {
              // 创建自定义图标
              var userIcon = L.divIcon({
                html: '<div style="background: #4285F4; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [22, 22],
                className: 'user-location-icon'
              });
              
              window.userMarker = L.marker([${coords.latitude}, ${coords.longitude}], {
                icon: userIcon,
                zIndexOffset: 1000
              }).addTo(map);
              
              // 添加精度圆圈
              if (${coords.accuracy}) {
                window.accuracyCircle = L.circle([${coords.latitude}, ${coords.longitude}], {
                  radius: ${coords.accuracy},
                  color: '#4285F4',
                  fillColor: '#4285F4',
                  fillOpacity: 0.15,
                  weight: 1
                }).addTo(map);
              }
              
              window.userMarker.bindPopup('<b>我的位置</b><br>精度: ${coords.accuracy?.toFixed(0) || '未知'}米').openPopup();
            }
            
            console.log('位置更新成功');
          }
          true;
        `;
        webViewRef.current?.injectJavaScript(jsCode);
      }

      // 静默处理，不显示弹窗
    } catch (error) {
      console.error('获取位置失败:', error);
      Alert.alert('定位失败', '无法获取当前位置，请检查GPS设置');
    }
  };

  useEffect(() => {
    if (showUserLocation && mapReady) {
      getCurrentLocation();
    }
  }, [showUserLocation, mapReady]);

  // 更新标记点
  useEffect(() => {
    if (mapReady && markers.length > 0) {
      const jsCode = `
        // 清除旧的工单标记
        if (window.workorderMarkers) {
          window.workorderMarkers.forEach(function(marker) {
            map.removeLayer(marker);
          });
        }
        window.workorderMarkers = [];
        
        // 添加新标记
        var markers = ${JSON.stringify(markers)};
        var bounds = [];
        
        markers.forEach(function(markerData) {
          // 根据状态选择颜色
          var color = '#6B7280';
          switch(markerData.status) {
            case '待接收': color = '#EF4444'; break;
            case '处理中': color = '#F59E0B'; break;
            case '已完成': color = '#10B981'; break;
            case '待审核': color = '#8B5CF6'; break;
          }
          
          // 创建自定义图标
          var icon = L.divIcon({
            html: '<div style="background: ' + color + '; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">' + (window.workorderMarkers.length + 1) + '</div>',
            iconSize: [30, 30],
            className: 'custom-marker'
          });
          
          var marker = L.marker([markerData.latitude, markerData.longitude], {
            icon: icon
          }).addTo(map);
          
          // 添加弹出窗口
          var popupContent = '<div style="min-width: 150px;">' +
            '<b>' + markerData.title + '</b><br>' +
            (markerData.description ? markerData.description + '<br>' : '') +
            (markerData.status ? '<span style="color: ' + color + ';">状态: ' + markerData.status + '</span>' : '') +
            '</div>';
          marker.bindPopup(popupContent);
          
          // 添加点击事件
          marker.on('click', function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'markerClick',
                data: { id: markerData.id }
              }));
            }
          });
          
          window.workorderMarkers.push(marker);
          bounds.push([markerData.latitude, markerData.longitude]);
        });
        
        // 调整地图视野以显示所有标记
        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
        
        console.log('添加了 ' + markers.length + ' 个标记');
        true;
      `;
      webViewRef.current?.injectJavaScript(jsCode);
    }
  }, [markers, mapReady]);

  // 生成OpenStreetMap HTML
  const generateMapHTML = () => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>OpenStreetMap</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; }
    #map { height: 100vh; width: 100%; }
    
    /* 自定义控件样式 */
    .leaflet-control-container .leaflet-top.leaflet-left {
      top: 10px;
      left: 10px;
    }
    
    .custom-marker {
      background: none !important;
      border: none !important;
    }
    
    .user-location-icon {
      background: none !important;
      border: none !important;
    }
    
    /* 加载提示 */
    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 1000;
      text-align: center;
    }
    
    /* 地图标识 */
    .map-brand {
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(255, 255, 255, 0.9);
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: bold;
      color: #333;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="loading" class="loading">正在加载地图...</div>
  <div class="map-brand">🗺️ OpenStreetMap</div>
  
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = null;
    var userMarker = null;
    var accuracyCircle = null;
    var workorderMarkers = [];
    
    function hideLoading() {
      var loading = document.getElementById('loading');
      if (loading) {
        loading.style.display = 'none';
      }
    }
    
    function initMap() {
      try {
        // 初始化地图，默认中心在上海
        var defaultCenter = [31.230416, 121.473701];  // 上海坐标
        console.log('初始化地图，中心点:', defaultCenter);
        
        map = L.map('map', {
          center: defaultCenter,
          zoom: 13,
          zoomControl: true,
          attributionControl: true
        });
        
        // 添加OpenStreetMap图层
        window.currentTileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        window.currentLayerType = 'street';  // 记录当前图层类型
        
        // 添加缩放控件
        L.control.scale({
          position: 'bottomleft',
          metric: true,
          imperial: false
        }).addTo(map);
        
        // 隐藏加载提示
        hideLoading();
        
        // 通知React Native地图准备就绪
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'mapReady'
          }));
        }
        
        console.log('OpenStreetMap初始化成功');
      } catch (error) {
        console.error('地图初始化失败:', error);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'mapError',
            data: { message: error.message }
          }));
        }
      }
    }
    
    // 页面加载完成后初始化地图
    window.onload = function() {
      initMap();
    };
    
    // 添加地图点击事件（可选）
    function onMapClick(e) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'mapClick',
          data: { 
            latitude: e.latlng.lat,
            longitude: e.latlng.lng
          }
        }));
      }
    }
  </script>
</body>
</html>
    `;
  };

  const handleMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'mapReady':
          setIsLoading(false);
          setMapReady(true);
          console.log('[OSMapView] ✅ 地图准备就绪');
          break;
          
        case 'mapError':
          console.error('[OSMapView] ❌ 地图错误:', message.data?.message);
          setIsLoading(false);
          Alert.alert('地图加载失败', message.data?.message || '未知错误');
          break;
          
        case 'markerClick':
          if (message.data && onMarkerPress) {
            onMarkerPress(message.data.id);
          }
          break;
          
        case 'mapClick':
          console.log('[OSMapView] 地图点击:', message.data);
          break;
      }
    } catch (error) {
      console.error('[OSMapView] 处理消息失败:', error);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHTML() }}
        style={styles.webview}
        onMessage={handleMessage}
        onError={(error) => {
          console.error('[OSMapView] WebView错误:', error);
          setIsLoading(false);
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        originWhitelist={['*']}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
      />
      
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1890ff" />
          <Text style={styles.loadingText}>正在加载地图...</Text>
        </View>
      )}
      
      {showUserLocation && mapReady && (
        <TouchableOpacity
          style={styles.locationButton}
          onPress={getCurrentLocation}
          activeOpacity={0.8}
        >
          <MaterialIcons name="my-location" size={24} color="#1890ff" />
        </TouchableOpacity>
      )}
      
      {/* 地图类型切换按钮 */}
      <TouchableOpacity
        style={styles.layerButton}
        onPress={() => {
          const jsCode = `
            // 切换地图图层
            if (!window.currentLayerType) {
              window.currentLayerType = 'street';
            }
            
            // 移除当前图层
            if (window.currentTileLayer) {
              map.removeLayer(window.currentTileLayer);
            }
            
            if (window.currentLayerType === 'street') {
              // 切换到卫星图层
              window.currentTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 19,
                attribution: '卫星图 © Esri'
              }).addTo(map);
              window.currentLayerType = 'satellite';
              
              // 更新标识
              document.querySelector('.map-brand').innerHTML = '🛰️ 卫星地图';
            } else {
              // 切换回OpenStreetMap街道图层
              window.currentTileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
              }).addTo(map);
              window.currentLayerType = 'street';
              
              // 更新标识
              document.querySelector('.map-brand').innerHTML = '🗺️ OpenStreetMap';
            }
            true;
          `;
          webViewRef.current?.injectJavaScript(jsCode);
        }}
        activeOpacity={0.8}
      >
        <MaterialIcons name="layers" size={24} color="#666" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#374151',
  },
  locationButton: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  layerButton: {
    position: 'absolute',
    right: 16,
    bottom: 160,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default OSMapView;