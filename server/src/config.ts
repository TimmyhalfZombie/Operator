import 'dotenv/config';

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  mongoUri: must('MONGODB_URI'),
  // Auth DB (users)
  authDbName: process.env.DB_AUTH_NAME || process.env.DB_NAME || 'appdb',
  // Customer DB (assistrequests, conversations, etc.)
  customerDbName: process.env.DB_CUSTOMER_NAME || 'customer',
  appName: process.env.APP_NAME || 'Server',
  jwtSecret: must('JWT_SECRET'),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:19006',
};
