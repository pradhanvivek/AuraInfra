import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

interface Meeting {
  id: string;
  title: string;
  description: string;
  meeting_type: string;
  date: string;
  time: string;
  duration_minutes: number;
  location: string;
  organizer_name: string;
  max_attendees?: number;
}

export default function MeetingsManagement() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meeting_type: 'general',
    date: '',
    time: '18:00',
    duration_minutes: 60,
    location: '',
    max_attendees: 50,
    agenda: [''] as string[]
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem('admin_token');
  const profile = JSON.parse(localStorage.getItem('admin_profile') || '{}');
  const propertyId = profile.managed_properties?.[0] || '';

  const meetingTypes = [
    { id: 'general', name: 'General Meeting' },
    { id: 'agm', name: 'Annual General Meeting (AGM)' },
    { id: 'committee', name: 'Committee Meeting' },
    { id: 'emergency', name: 'Emergency Meeting' },
    { id: 'social', name: 'Social Event' }
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
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/properties/${propertyId}/meetings`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      setMeetings(response.data);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const meetingDate = new Date(`${formData.date}T${formData.time}:00`);
      
      await axios.post(
        `${API_URL}/api/properties/${propertyId}/meetings`,
        {
          property_id: propertyId,
          title: formData.title,
          description: formData.description,
          meeting_type: formData.meeting_type,
          date: meetingDate.toISOString(),
          time: formData.time,
          duration_minutes: formData.duration_minutes,
          location: formData.location,
          max_attendees: formData.max_attendees,
          agenda: formData.agenda.filter(item => item.trim() !== '')
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      alert('Meeting created successfully!');
      setShowForm(false);
      setFormData({
        title: '',
        description: '',
        meeting_type: 'general',
        date: '',
        time: '18:00',
        duration_minutes: 60,
        location: '',
        max_attendees: 50,
        agenda: ['']
      });
      fetchMeetings();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  const addAgendaItem = () => {
    setFormData({...formData, agenda: [...formData.agenda, '']});
  };

  const removeAgendaItem = (index: number) => {
    const newAgenda = formData.agenda.filter((_, i) => i !== index);
    setFormData({...formData, agenda: newAgenda});
  };

  const updateAgendaItem = (index: number, value: string) => {
    const newAgenda = [...formData.agenda];
    newAgenda[index] = value;
    setFormData({...formData, agenda: newAgenda});
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Meetings Management</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {showForm ? 'Cancel' : 'Schedule Meeting'}
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
            <h2 className="text-xl font-semibold mb-4">Schedule New Meeting</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meeting Type *
                </label>
                <select
                  value={formData.meeting_type}
                  onChange={(e) => setFormData({...formData, meeting_type: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {meetingTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="e.g., Clubhouse, Hall A"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time *
                </label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes) *
                </label>
                <input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Attendees
                </label>
                <input
                  type="number"
                  value={formData.max_attendees}
                  onChange={(e) => setFormData({...formData, max_attendees: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agenda Items
              </label>
              {formData.agenda.map((item, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateAgendaItem(index, e.target.value)}
                    placeholder={`Agenda item ${index + 1}`}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {formData.agenda.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAgendaItem(index)}
                      className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addAgendaItem}
                className="text-blue-600 text-sm hover:underline"
              >
                + Add Agenda Item
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:bg-gray-400"
            >
              {loading ? 'Scheduling...' : 'Schedule Meeting'}
            </button>
          </form>
        )}

        {/* Meetings List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Upcoming Meetings ({meetings.length})</h2>
          {meetings.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No meetings scheduled</p>
          ) : (
            <div className="space-y-4">
              {meetings.map((meeting) => (
                <div key={meeting.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-2">{meeting.title}</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <p><strong>Type:</strong> {meeting.meeting_type}</p>
                    <p><strong>Date:</strong> {new Date(meeting.date).toLocaleDateString()}</p>
                    <p><strong>Time:</strong> {meeting.time}</p>
                    <p><strong>Duration:</strong> {meeting.duration_minutes} min</p>
                    <p><strong>Location:</strong> {meeting.location}</p>
                    <p><strong>Organizer:</strong> {meeting.organizer_name}</p>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{meeting.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}