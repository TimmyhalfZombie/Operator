// app.config.js
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, './.env') });

module.exports = ({ config }) => ({
  name: 'Operator',
  slug: 'Operator',
  version: '1.0.0',
  owner: 'timmy1111',
  scheme: 'operator',

  // ✅ Disable web by limiting platforms
  platforms: ['android', 'ios'],

  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: false,
  icon: './assets/images/icon.png',
  assetBundlePatterns: ['assets/**/*'],
  splash: {
    image: './assets/images/icon.png',
    resizeMode: 'contain',
    backgroundColor: '#000000',
  },

  plugins: [
    'expo-router',
    'expo-secure-store',
    ['@maplibre/maplibre-react-native'],
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 34,
          minSdkVersion: 24,
          packagingOptions: {
            pickFirst: ['META-INF/AL2.0', 'META-INF/LGPL2.1'],
            exclude: ['META-INF/LICENSE*', 'META-INF/NOTICE*'],
          },
        },
      },
    ],
  ],

  extra: {
    router: {},
    API_URL: process.env.EXPO_PUBLIC_API_URL,
    GEOAPIFY_KEY: process.env.EXPO_PUBLIC_GEOAPIFY_KEY || '',
    eas: { projectId: '7c38d5e4-763b-4d6c-b934-6ae6cd0a86f5' },
  },

  ios: {
    bundleIdentifier: 'com.yourco.operator',
    supportsTablet: true,
    infoPlist: {
      NSAppTransportSecurity: { NSAllowsArbitraryLoads: true },

      // 🔵 Existing permissions
      NSBluetoothAlwaysUsageDescription:
        'This app uses Bluetooth to scan and connect to your vulcanizer device.',
      NSBluetoothPeripheralUsageDescription:
        'This app uses Bluetooth to communicate with your vulcanizer device.',
      NSLocationWhenInUseUsageDescription:
        'We use your location one time during signup to set up your account and improve Activity features.',

      // ✅ Image picker / camera permissions
      NSPhotoLibraryUsageDescription:
        'We need access to your photo library so you can send images in chat.',
      NSPhotoLibraryAddUsageDescription:
        'We need permission to save photos to your library when you take pictures in chat.',
      NSCameraUsageDescription:
        'We need access to your camera so you can take and send photos in chat.',
    },
  },

  android: {
    package: 'com.shemuuu.operator',
    edgeToEdgeEnabled: true,
    usesCleartextTraffic: true,
    permissions: [
      // 🔵 Existing permissions
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',

      // ✅ Image picker / camera permissions
      'android.permission.CAMERA',
      // Android 13+ scoped media permission (images only)
      'android.permission.READ_MEDIA_IMAGES',
      // Pre-Android 13 legacy read permission (safe fallback)
      'android.permission.READ_EXTERNAL_STORAGE',
    ],
    adaptiveIcon: {
      foregroundImage: './assets/images/icon.png',
      backgroundColor: '#000000',
    },
    splash: {
      image: './assets/images/icon.png',
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },
    navigationBar: {
      visible: 'immersive',
      backgroundColor: '#000000',
      barStyle: 'dark-content',
    },
    softwareKeyboardLayoutMode: 'pan',
  },
});
