import { Redirect } from 'expo-router';

export default function Index() {
  // Always land on the Home tab
  return <Redirect href="/home" />;
}
