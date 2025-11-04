import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

interface Amenity {
  id: string;
  name: string;
  description: string;
  amenity_type: string;
  capacity: number;
  booking_fee: number;
  available: boolean;
  operating_hours_start: string;
  operating_hours_end: string;
}

export default function AmenitiesManagement() {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amenity_type: 'clubhouse',
    capacity: 0,
    booking_fee: 0,
    operating_hours_start: '09:00',
    operating_hours_end: '18:00'
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem('admin_token');
  const profile = JSON.parse(localStorage.getItem('admin_profile') || '{}');
  const propertyId = profile.managed_properties?.[0] || '';

  const amenityTypes = [
    { id: 'clubhouse', name: 'Clubhouse' },
    { id: 'gym', name: 'Gym' },
    { id: 'pool', name: 'Swimming Pool' },
    { id: 'sports_court', name: 'Sports Court' },
    { id: 'party_hall', name: 'Party Hall' },
    { id: 'playground', name: 'Playground' },
    { id: 'other', name: 'Other' }
  ];

  useEffect(() => {
    if (!token) {
      navigate('/admin/login');
      return;
    }
    if (!propertyId) {
      alert('No property assigned. Please contact super admin.');
      navigate('/admin/dashboard');
      return;
    }
    fetchAmenities();
  }, []);

  const fetchAmenities = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/properties/${propertyId}/amenities`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      setAmenities(response.data);
    } catch (error) {
      console.error('Error fetching amenities:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(
        `${API_URL}/api/properties/${propertyId}/amenities`,
        {
          property_id: propertyId,
          ...formData
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      alert('Amenity created successfully!');
      setShowForm(false);
      setFormData({
        name: '',
        description: '',
        amenity_type: 'clubhouse',
        capacity: 0,
        booking_fee: 0,
        operating_hours_start: '09:00',
        operating_hours_end: '18:00'
      });
      fetchAmenities();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to create amenity');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Amenities Management</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {showForm ? 'Cancel' : 'Add Amenity'}
            </button>
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Back
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Create New Amenity</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type *
                </label>
                <select
                  value={formData.amenity_type}
                  onChange={(e) => setFormData({...formData, amenity_type: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {amenityTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacity *
                </label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Booking Fee ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.booking_fee}
                  onChange={(e) => setFormData({...formData, booking_fee: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Opening Time *
                </label>
                <input
                  type="time"
                  value={formData.operating_hours_start}
                  onChange={(e) => setFormData({...formData, operating_hours_start: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Closing Time *
                </label>
                <input
                  type="time"
                  value={formData.operating_hours_end}
                  onChange={(e) => setFormData({...formData, operating_hours_end: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:bg-gray-400"
            >
              {loading ? 'Creating...' : 'Create Amenity'}
            </button>
          </form>
        )}

        {/* Amenities List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">All Amenities ({amenities.length})</h2>
          {amenities.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No amenities added yet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {amenities.map((amenity) => (
                <div key={amenity.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-2">{amenity.name}</h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p><strong>Type:</strong> {amenity.amenity_type}</p>
                    <p><strong>Capacity:</strong> {amenity.capacity} people</p>
                    <p><strong>Fee:</strong> ${amenity.booking_fee}</p>
                    <p><strong>Hours:</strong> {amenity.operating_hours_start} - {amenity.operating_hours_end}</p>
                    <p className="text-xs mt-2">{amenity.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}