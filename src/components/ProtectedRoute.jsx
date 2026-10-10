import { Navigate, useLocation } from 'react-router-dom'
import { roleHomePath, useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ allowedRoles, children, loginPath = '/login' }) {
  const { user, session } = useAuth()
  const location = useLocation()

  if (!session || !user) {
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={roleHomePath(user.role)} replace />
  }

  return children
}
