import 'dotenv/config';

export default {
  expo: {
    name: "RiverPatrol",
    slug: "riverpatrol",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "riverpatrol",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      bundleIdentifier: "com.riverpatrol.app",
      supportsTablet: true
    },
    android: {
      package: "com.riverpatrol.app",
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      usesCleartextTraffic: true,
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "WAKE_LOCK",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE"
      ]
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "此应用需要位置权限来记录巡查轨迹和获取当前位置。"
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "此应用需要访问相册来选择和上传照片。",
          cameraPermission: "此应用需要相机权限来拍摄现场照片。"
        }
      ],
      "./plugins/withJPush.cjs"
    ],
    experiments: {
      typedRoutes: true
    }
  }
};