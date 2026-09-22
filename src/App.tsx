import { Navigate, Route, Routes } from "react-router-dom"
import { RequireAuth, RequireAdmin } from "@/components/auth/RequireAuth"
import Layout from "@/components/Layout"
import Home from "@/pages/Home"
import Login from "@/pages/Login"
import Signup from "@/pages/Signup"
import Charities from "@/pages/Charities"
import CharityDetail from "@/pages/CharityDetail"
import Dashboard from "@/pages/Dashboard"
import AdminDashboard from "@/pages/AdminDashboard"
import NotFound from "@/pages/NotFound"

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/charities" element={<Charities />} />
        <Route path="/charities/:id" element={<CharityDetail />} />

        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>

        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  )
}
