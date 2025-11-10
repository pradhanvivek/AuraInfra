import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import AdminDashboard from '../admin/dashboard';

export default function AdminTab() {
  // This is just a wrapper to redirect to the admin dashboard
  return <AdminDashboard />;
}
