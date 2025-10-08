import * as dotenv from 'dotenv';
import { ExpoConfig } from 'expo/config';
import * as path from 'path';

// adjust path if your server folder is elsewhere
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

const config: ExpoConfig = {
  name: 'YourApp',
  slug: 'your-app',
  extra: {
    API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.27:3000',
  },
};

export default config;
