const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

module.exports = ({ config }) => ({
  ...config,
  name: 'Operator',
  slug: 'operator',

  scheme: 'operator',

  plugins: [
    'expo-router',
    'expo-secure-store'
  ],

  extra: {
    API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.27:3000',
  },

  ios: { bundleIdentifier: 'com.yourco.operator' },
  android: { package: 'com.yourco.operator' },
});
