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
    API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.27:3000',
    GEOAPIFY_KEY: process.env.EXPO_PUBLIC_GEOAPIFY_KEY || '',
    eas: { projectId: '7c38d5e4-763b-4d6c-b934-6ae6cd0a86f5' },
  },

  ios: {
    bundleIdentifier: 'com.yourco.operator',
    supportsTablet: true,
    infoPlist: {
      NSBluetoothAlwaysUsageDescription:
        'This app uses Bluetooth to scan and connect to your vulcanizer device.',
      NSBluetoothPeripheralUsageDescription:
        'This app uses Bluetooth to communicate with your vulcanizer device.',
      NSLocationWhenInUseUsageDescription:
        'We use your location one time during signup to set up your account and improve Activity features.',
    },
  },

  android: {
    package: 'com.shemuuu.operator',
    edgeToEdgeEnabled: true,
    permissions: [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
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

  // ❌ Removed the "web" block entirely
});
