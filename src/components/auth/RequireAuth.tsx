import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <Outlet />
}

export function RequireAdmin() {
  const { isAdmin, loading } = useAuth()

  if (loading) return <FullPageSpinner />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
      Loading...
    </div>
  )
}
