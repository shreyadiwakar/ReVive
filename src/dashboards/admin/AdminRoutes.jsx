import { Factory, Gift, LayoutDashboard, MessageSquare, Package, Truck, Users } from 'lucide-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import AdminCenters from './AdminCenters'
import AdminComplaints from './AdminComplaints'
import AdminDashboard from './AdminDashboard'
import AdminDeliveryPartners from './AdminDeliveryPartners'
import AdminPickups from './AdminPickups'
import AdminRewards from './AdminRewards'
import AdminUsers from './AdminUsers'

const nav = [
  { to: '/admin/dashboard', label: 'Platform', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/delivery-partners', label: 'Delivery partners', icon: Truck },
  { to: '/admin/centers', label: 'Centers', icon: Factory },
  { to: '/admin/pickups', label: 'Pickups', icon: Package },
  { to: '/admin/complaints', label: 'Complaints', icon: MessageSquare },
  { to: '/admin/rewards', label: 'Rewards & config', icon: Gift },
]

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<DashboardLayout brand="Administrator" navItems={nav} />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="delivery-partners" element={<AdminDeliveryPartners />} />
        <Route path="centers" element={<AdminCenters />} />
        <Route path="pickups" element={<AdminPickups />} />
        <Route path="complaints" element={<AdminComplaints />} />
        <Route path="rewards" element={<AdminRewards />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  )
}
