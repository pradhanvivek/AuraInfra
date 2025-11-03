import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

interface PendingApproval {
  id: string;
  user_id: string;
  username: string;
  email: string;
  property_id: string;
  property_name: string;
  requested_role: string;
  documents: string[];
  document_names: string[];
  status: string;
  created_at: string;
}

export default function UserApprovals() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem('admin_token');
  const profile = JSON.parse(localStorage.getItem('admin_profile') || '{}');
  const propertyId = profile.managed_properties?.[0] || '';

  useEffect(() => {
    if (!token) {
      navigate('/admin/login');
      return;
    }
    fetchApprovals();
  }, []);

  const fetchApprovals = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/admin/properties/${propertyId}/pending-approvals`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      setApprovals(response.data);
    } catch (error) {
      console.error('Error fetching approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selectedApproval) return;

    setActionLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/admin/properties/${propertyId}/approve-user`,
        {
          approval_id: selectedApproval.id,
          action: action,
          admin_notes: adminNotes
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      alert(`User ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      setSelectedApproval(null);
      setAdminNotes('');
      fetchApprovals();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">User Approvals</h1>
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {approvals.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No pending approvals</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Approvals List */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Pending Requests ({approvals.length})</h2>
              <div className="space-y-3">
                {approvals.map((approval) => (
                  <button
                    key={approval.id}
                    onClick={() => setSelectedApproval(approval)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition ${
                      selectedApproval?.id === approval.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold">{approval.username}</div>
                    <div className="text-sm text-gray-600">{approval.email}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      Role: <span className="font-medium">{approval.requested_role}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(approval.created_at).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Details Panel */}
            {selectedApproval && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Approval Details</h2>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Username</label>
                    <p className="text-lg">{selectedApproval.username}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Email</label>
                    <p>{selectedApproval.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Requested Role</label>
                    <p className="font-medium">{selectedApproval.requested_role.toUpperCase()}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Property</label>
                    <p>{selectedApproval.property_name}</p>
                  </div>
                </div>

                {/* Documents */}
                <div className="mb-6">
                  <h3 className="font-semibold mb-3">Submitted Documents</h3>
                  <div className="space-y-3">
                    {selectedApproval.documents.map((doc, index) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="text-sm font-medium mb-2">
                          {selectedApproval.document_names[index] || `Document ${index + 1}`}
                        </div>
                        <img
                          src={doc}
                          alt={`Document ${index + 1}`}
                          className="w-full h-48 object-contain bg-gray-50 rounded"
                        />
                        <a
                          href={doc}
                          download={`document_${index + 1}.jpg`}
                          className="text-blue-600 text-sm mt-2 inline-block"
                        >
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Admin Notes */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Notes (Optional)
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Add notes about this approval decision..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAction('approve')}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:bg-gray-400"
                  >
                    {actionLoading ? 'Processing...' : 'Approve User'}
                  </button>
                  <button
                    onClick={() => handleAction('reject')}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:bg-gray-400"
                  >
                    {actionLoading ? 'Processing...' : 'Reject User'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}