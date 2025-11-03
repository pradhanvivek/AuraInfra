import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

interface DashboardStats {
  property_id: string;
  total_users: number;
  pending_approvals: number;
  active_residents: number;
  payment_requests_sent: number;
  payments_received: number;
  unpaid_amount: number;
  recent_posts: number;
  upcoming_meetings: number;
}

interface Property {
  id: string;
  name: string;
  address: string;
}

export default function HOAAdminDashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const token = localStorage.getItem('admin_token');
  const profile = JSON.parse(localStorage.getItem('admin_profile') || '{}');

  useEffect(() => {
    if (!token || !profile.is_hoa_admin) {
      navigate('/admin/login');
      return;
    }
    fetchProperties();
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      fetchDashboardStats();
    }
  }, [selectedProperty]);

  const fetchProperties = async () => {
    try {
      // If super admin, get all properties
      if (profile.is_super_admin) {
        const response = await axios.get(`${API_URL}/api/admin/super/all-properties`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setProperties(response.data);
        if (response.data.length > 0) {
          setSelectedProperty(response.data[0].id);
        }
      } else {
        // Get managed properties from profile
        const managedPropertyIds = profile.managed_properties || [];
        if (managedPropertyIds.length > 0) {
          // Fetch property details
          const propertiesPromises = managedPropertyIds.map((id: string) =>
            axios.get(`${API_URL}/api/properties/${id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
          );
          const results = await Promise.all(propertiesPromises);
          const propertiesData = results.map(r => r.data);
          setProperties(propertiesData);
          setSelectedProperty(propertiesData[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/admin/properties/${selectedProperty}/dashboard`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">HOA Admin Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome, {profile.username}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Property Selector */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Property
          </label>
          <select
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {properties.map((prop) => (
              <option key={prop.id} value={prop.id}>
                {prop.name} - {prop.address}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <button
            onClick={() => navigate('/admin/approvals')}
            className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 text-center"
          >
            <div className="text-2xl font-bold mb-1">{stats?.pending_approvals || 0}</div>
            <div className="text-sm">Pending Approvals</div>
          </button>
          <button
            onClick={() => navigate('/admin/payments')}
            className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 text-center"
          >
            <div className="text-2xl font-bold mb-1">${stats?.unpaid_amount.toFixed(2) || 0}</div>
            <div className="text-sm">Unpaid Amount</div>
          </button>
          <button
            onClick={() => navigate('/admin/community')}
            className="bg-purple-600 text-white p-4 rounded-lg hover:bg-purple-700 text-center"
          >
            <div className="text-2xl font-bold mb-1">{stats?.recent_posts || 0}</div>
            <div className="text-sm">Recent Posts</div>
          </button>
          <button
            onClick={() => navigate('/admin/meetings')}
            className="bg-orange-600 text-white p-4 rounded-lg hover:bg-orange-700 text-center"
          >
            <div className="text-2xl font-bold mb-1">{stats?.upcoming_meetings || 0}</div>
            <div className="text-sm">Upcoming Meetings</div>
          </button>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Residents</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Users</span>
                  <span className="font-bold">{stats.total_users}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Residents</span>
                  <span className="font-bold">{stats.active_residents}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pending Approvals</span>
                  <span className="font-bold text-orange-600">{stats.pending_approvals}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Payments</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Requests Sent</span>
                  <span className="font-bold">{stats.payment_requests_sent}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Received</span>
                  <span className="font-bold text-green-600">{stats.payments_received}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Unpaid Amount</span>
                  <span className="font-bold text-red-600">${stats.unpaid_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Community</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Recent Posts (7d)</span>
                  <span className="font-bold">{stats.recent_posts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Upcoming Meetings</span>
                  <span className="font-bold">{stats.upcoming_meetings}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Management Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => navigate('/admin/create-payment')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition text-left"
          >
            <h3 className="text-lg font-semibold mb-2">Create Payment Request</h3>
            <p className="text-gray-600 text-sm">Send maintenance charges to residents</p>
          </button>

          <button
            onClick={() => navigate('/admin/create-post')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition text-left"
          >
            <h3 className="text-lg font-semibold mb-2">Create Announcement</h3>
            <p className="text-gray-600 text-sm">Post to community board</p>
          </button>

          <button
            onClick={() => navigate('/admin/amenities')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition text-left"
          >
            <h3 className="text-lg font-semibold mb-2">Manage Amenities</h3>
            <p className="text-gray-600 text-sm">Add or edit bookable amenities</p>
          </button>

          <button
            onClick={() => navigate('/admin/meetings')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition text-left"
          >
            <h3 className="text-lg font-semibold mb-2">Manage Meetings</h3>
            <p className="text-gray-600 text-sm">Schedule HOA meetings</p>
          </button>
        </div>
      </main>
    </div>
  );
}