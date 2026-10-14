import { Navigate, useLocation } from 'react-router-dom'
import { normalizeRole, roleHomePath, useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ allowedRoles, children, loginPath = '/login' }) {
  const { user, session } = useAuth()
  const location = useLocation()

  if (!session || !user) {
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />
  }

  const normalizedUserRole = normalizeRole(user.role)
  if (allowedRoles && !allowedRoles.includes(normalizedUserRole)) {
    return <Navigate to={roleHomePath(normalizedUserRole)} replace />
  }

  return children
}
