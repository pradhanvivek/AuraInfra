import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import AdminLogin from './pages/AdminLogin'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import HOAAdminDashboard from './pages/HOAAdminDashboard'
import UserApprovals from './pages/UserApprovals'
import CreatePaymentRequest from './pages/CreatePaymentRequest'
import CreateCommunityPost from './pages/CreateCommunityPost'
import AmenitiesManagement from './pages/AmenitiesManagement'
import MeetingsManagement from './pages/MeetingsManagement'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/super-dashboard" element={<SuperAdminDashboard />} />
        <Route path="/admin/dashboard" element={<HOAAdminDashboard />} />
        <Route path="/admin/approvals" element={<UserApprovals />} />
        <Route path="/admin/create-payment" element={<CreatePaymentRequest />} />
        <Route path="/admin/create-post" element={<CreateCommunityPost />} />
        <Route path="/admin/amenities" element={<AmenitiesManagement />} />
        <Route path="/admin/meetings" element={<MeetingsManagement />} />
      </Routes>
    </Router>
  )
}

export default App