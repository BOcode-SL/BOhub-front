import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import { ProtectedRoute, PublicOnlyRoute } from '@/auth/RouteGuards'
import { AppLayout } from '@/components/layout/app-layout'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LoginPage } from '@/pages/LoginPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

export default function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<PlaceholderPage title="Inicio" />} />
                <Route
                  path="clients"
                  element={<PlaceholderPage title="Clientes" />}
                />
                <Route
                  path="projects"
                  element={<PlaceholderPage title="Proyectos" />}
                />
                <Route
                  path="billing"
                  element={<PlaceholderPage title="Facturación" />}
                />
                <Route
                  path="timer"
                  element={<PlaceholderPage title="Timer" />}
                />
                <Route
                  path="emails"
                  element={<PlaceholderPage title="Emails" />}
                />
                <Route
                  path="maintenance"
                  element={<PlaceholderPage title="Mantenimientos" />}
                />
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  )
}
