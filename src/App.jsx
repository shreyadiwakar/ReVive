import { Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoutes from './dashboards/admin/AdminRoutes'
import CenterRoutes from './dashboards/center/CenterRoutes'
import DeliveryRoutes from './dashboards/delivery/DeliveryRoutes'
import UserRoutes from './dashboards/user/UserRoutes'
import AdminLogin from './pages/AdminLogin'
import Landing from './pages/Landing'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Register from './pages/Register'
import RegisterCenter from './pages/register/RegisterCenter'
import RegisterDelivery from './pages/register/RegisterDelivery'
import RegisterUser from './pages/register/RegisterUser'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/register" element={<Register />} />
      <Route path="/register/user" element={<RegisterUser />} />
      <Route path="/register/delivery" element={<RegisterDelivery />} />
      <Route path="/register/center" element={<RegisterCenter />} />

      <Route
        path="/user/*"
        element={
          <ProtectedRoute allowedRoles={['user']}>
            <UserRoutes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/delivery/*"
        element={
          <ProtectedRoute allowedRoles={['delivery']}>
            <DeliveryRoutes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/center/*"
        element={
          <ProtectedRoute allowedRoles={['center']}>
            <CenterRoutes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['admin']} loginPath="/admin/login">
            <AdminRoutes />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
