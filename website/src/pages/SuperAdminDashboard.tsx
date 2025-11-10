import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

interface Property {
  id: string;
  name: string;
  address: string;
  logo?: string;
}

interface Admin {
  id: string;
  username: string;
  email: string;
  managed_properties: string[];
}

export default function SuperAdminDashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [logoPropertyId, setLogoPropertyId] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [logoUploading, setLogoUploading] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem('admin_token');
  const profile = JSON.parse(localStorage.getItem('admin_profile') || '{}');

  useEffect(() => {
    if (!token || !profile.is_super_admin) {
      navigate('/admin/login');
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [propertiesRes, adminsRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/super/all-properties`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/api/admin/super/all-admins`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      setProperties(propertiesRes.data);
      setAdmins(adminsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAdmin = async () => {
    if (!selectedProperty || !selectedUser) {
      alert('Please select both property and user');
      return;
    }

    setAssignLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/admin/super/assign-hoa-admin`,
        null,
        {
          params: {
            target_user_id: selectedUser,
            property_id: selectedProperty
          },
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      alert('HOA Admin assigned successfully!');
      fetchData();
      setSelectedProperty('');
      setSelectedUser('');
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to assign admin');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('Image size should be less than 2MB');
        return;
      }
      
      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadLogo = async () => {
    if (!logoPropertyId || !logoFile) {
      alert('Please select a property and upload a logo image');
      return;
    }

    setLogoUploading(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Logo = reader.result as string;
        
        // Update property with logo
        await axios.put(
          `${API_URL}/api/properties/${logoPropertyId}`,
          { logo: base64Logo },
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );

        alert('Property logo updated successfully!');
        fetchData();
        setLogoPropertyId('');
        setLogoFile(null);
        setLogoPreview('');
      };
      reader.readAsDataURL(logoFile);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to upload logo');
    } finally {
      setLogoUploading(false);
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Assign Admin Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Assign HOA Admin to Property</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Property
              </label>
              <select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Choose Property --</option>
                {properties.map((prop) => (
                  <option key={prop.id} value={prop.id}>
                    {prop.name} - {prop.address}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select User (Enter User ID)
              </label>
              <input
                type="text"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                placeholder="User ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleAssignAdmin}
                disabled={assignLoading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {assignLoading ? 'Assigning...' : 'Assign Admin'}
              </button>
            </div>
          </div>
        </div>

        {/* Property Logo Management */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Property Logo Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Property
              </label>
              <select
                value={logoPropertyId}
                onChange={(e) => setLogoPropertyId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Choose Property --</option>
                {properties.map((prop) => (
                  <option key={prop.id} value={prop.id}>
                    {prop.name} - {prop.address}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Logo
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Max size: 2MB, PNG/JPG/JPEG</p>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleUploadLogo}
                disabled={logoUploading || !logoPropertyId || !logoFile}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
              >
                {logoUploading ? 'Uploading...' : 'Upload Logo'}
              </button>
            </div>
          </div>

          {/* Logo Preview */}
          {logoPreview && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo Preview
              </label>
              <div className="flex items-center space-x-4">
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="w-24 h-24 object-contain border border-gray-300 rounded-lg"
                />
                <button
                  onClick={() => {
                    setLogoFile(null);
                    setLogoPreview('');
                  }}
                  className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Properties List */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">All Properties ({properties.length})</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Logo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {properties.map((prop) => (
                  <tr key={prop.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {prop.logo ? (
                        <img
                          src={prop.logo}
                          alt={`${prop.name} logo`}
                          className="w-12 h-12 object-contain rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                          <span className="text-gray-400 text-xs">No Logo</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {prop.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {prop.address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {prop.id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Admins List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">HOA Admins ({admins.length})</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Managed Properties</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {admins.map((admin) => (
                  <tr key={admin.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {admin.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {admin.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {admin.managed_properties.length} properties
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}