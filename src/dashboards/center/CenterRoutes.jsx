import { Archive, ClipboardCheck, Inbox, LayoutDashboard, User } from 'lucide-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import PendingApplication from '../../components/PendingApplication'
import { useAuth } from '../../context/AuthContext'
import { APPROVAL_STATUS } from '../../utils/constants'
import CenterDashboard from './CenterDashboard'
import CenterInventory from './CenterInventory'
import CenterProfile from './CenterProfile'
import CenterRequests from './CenterRequests'
import CenterVerification from './CenterVerification'

const fullNav = [
  { to: '/center/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/center/requests', label: 'Incoming requests', icon: Inbox },
  { to: '/center/verification', label: 'Verification', icon: ClipboardCheck },
  { to: '/center/inventory', label: 'Inventory', icon: Archive },
  { to: '/center/profile', label: 'Profile', icon: User },
]

const pendingNav = [{ to: '/center/profile', label: 'Profile', icon: User, end: true }]

export default function CenterRoutes() {
  const { user } = useAuth()
  const isApproved = user.approvalStatus === APPROVAL_STATUS.APPROVED

  return (
    <Routes>
      <Route element={<DashboardLayout brand="Recycling center" navItems={isApproved ? fullNav : pendingNav} />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="profile" element={<CenterProfile />} />
        {isApproved ? (
          <>
            <Route path="dashboard" element={<CenterDashboard />} />
            <Route path="requests" element={<CenterRequests />} />
            <Route path="verification" element={<CenterVerification />} />
            <Route path="inventory" element={<CenterInventory />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </>
        ) : (
          <Route path="*" element={<PendingApplication roleLabel="recycling center" profilePath="/center/profile" />} />
        )}
      </Route>
    </Routes>
  )
}
