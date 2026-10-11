import { DollarSign, LayoutDashboard, Package, User } from 'lucide-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import PendingApplication from '../../components/PendingApplication'
import { useAuth } from '../../context/AuthContext'
import { APPROVAL_STATUS } from '../../utils/constants'
import DeliveryDashboard from './DeliveryDashboard'
import DeliveryEarnings from './DeliveryEarnings'
import DeliveryJobDetail from './DeliveryJobDetail'
import DeliveryJobs from './DeliveryJobs'
import DeliveryProfile from './DeliveryProfile'

const fullNav = [
  { to: '/delivery/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/delivery/jobs', label: 'Jobs', icon: Package },
  { to: '/delivery/earnings', label: 'Earnings', icon: DollarSign },
  { to: '/delivery/profile', label: 'Profile', icon: User },
]

const pendingNav = [{ to: '/delivery/profile', label: 'Profile', icon: User, end: true }]

export default function DeliveryRoutes() {
  const { user } = useAuth()
  const isApproved = user.approvalStatus === APPROVAL_STATUS.APPROVED

  return (
    <Routes>
      <Route element={<DashboardLayout brand="Delivery partner" navItems={isApproved ? fullNav : pendingNav} />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="profile" element={<DeliveryProfile />} />
        {isApproved ? (
          <>
            <Route path="dashboard" element={<DeliveryDashboard />} />
            <Route path="jobs" element={<DeliveryJobs />} />
            <Route path="jobs/:id" element={<DeliveryJobDetail />} />
            <Route path="earnings" element={<DeliveryEarnings />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </>
        ) : (
          <Route
            path="*"
            element={<PendingApplication roleLabel="delivery partner" profilePath="/delivery/profile" />}
          />
        )}
      </Route>
    </Routes>
  )
}
