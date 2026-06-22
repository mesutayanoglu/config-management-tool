import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import { LanguageProvider } from './i18n'

import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import DevicesPage from './pages/DevicesPage'
import ConfigsPage from './pages/ConfigsPage'
import SchedulersPage from './pages/SchedulersPage'
import OrganizationsPage from './pages/OrganizationsPage'
import SettingsPage from './pages/SettingsPage'
import ConfigletsPage from './pages/ConfigletsPage'
import TopologyPage from './pages/TopologyPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import Sidebar from './components/Layout/Sidebar'
import Navbar from './components/Layout/Navbar'

function PrivateRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  return token ? children : <Navigate to="/login" replace />
}

function AppLayout({ children }) {
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <LanguageProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/devices"
          element={
            <PrivateRoute>
              <AppLayout>
                <DevicesPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/configs"
          element={
            <PrivateRoute>
              <AppLayout>
                <ConfigsPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/schedulers"
          element={
            <PrivateRoute>
              <AppLayout>
                <SchedulersPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/organizations"
          element={
            <PrivateRoute>
              <AppLayout>
                <OrganizationsPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <AppLayout>
                <SettingsPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/configlets"
          element={
            <PrivateRoute>
              <AppLayout>
                <ConfigletsPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/topology"
          element={
            <PrivateRoute>
              <AppLayout>
                <TopologyPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </LanguageProvider>
  )
}
