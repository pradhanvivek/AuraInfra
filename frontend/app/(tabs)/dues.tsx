import { Redirect } from 'expo-router';

// Redirect to the dues index screen
export default function DuesTab() {
  return <Redirect href="/dues/index" />;
}
