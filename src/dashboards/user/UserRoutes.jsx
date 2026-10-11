import { Factory, Gift, LayoutDashboard, ListChecks, PlusCircle, User } from 'lucide-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import UserCenters from './UserCenters'
import UserDashboard from './UserDashboard'
import UserMyPickups from './UserMyPickups'
import UserProfile from './UserProfile'
import UserRewards from './UserRewards'
import UserSchedulePickup from './UserSchedulePickup'
import UserTrackPickup from './UserTrackPickup'

const nav = [
  { to: '/user/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/user/schedule-pickup', label: 'Schedule pickup', icon: PlusCircle },
  { to: '/user/my-pickups', label: 'My pickups', icon: ListChecks },
  { to: '/user/centers', label: 'Centers', icon: Factory },
  { to: '/user/rewards', label: 'Rewards', icon: Gift },
  { to: '/user/profile', label: 'Profile', icon: User },
]

export default function UserRoutes() {
  return (
    <Routes>
      <Route element={<DashboardLayout brand="Resident" navItems={nav} />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<UserDashboard />} />
        <Route path="schedule-pickup" element={<UserSchedulePickup />} />
        <Route path="my-pickups" element={<UserMyPickups />} />
        <Route path="track/:id" element={<UserTrackPickup />} />
        <Route path="rewards" element={<UserRewards />} />
        <Route path="centers" element={<UserCenters />} />
        <Route path="profile" element={<UserProfile />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  )
}
