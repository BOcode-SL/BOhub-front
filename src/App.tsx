import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import { ProtectedRoute, PublicOnlyRoute } from '@/auth/RouteGuards'
import { AppLayout } from '@/components/layout/app-layout'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LoginPage } from '@/pages/LoginPage'
import { ClientsPage } from '@/pages/clients/ClientsPage'
import { ProjectsPage } from '@/pages/projects/ProjectsPage'
import { ProjectDetailPage } from '@/pages/projects/ProjectDetailPage'
import { BillingSummaryPage } from '@/pages/billing/BillingSummaryPage'
import { IncomePage } from '@/pages/billing/IncomePage'
import { ExpensesPage } from '@/pages/billing/ExpensesPage'
import { TimerPage } from '@/pages/timer/TimerPage'
import { MaintenancePage } from '@/pages/maintenance/MaintenancePage'
import { HomePage } from '@/pages/home/HomePage'
import { EmailsPage } from '@/pages/emails/EmailsPage'
import { EmailMessagesPage } from '@/pages/emails/EmailMessagesPage'

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
                <Route index element={<HomePage />} />
                <Route path="clients" element={<ClientsPage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="projects/:id" element={<ProjectDetailPage />} />
                <Route path="billing" element={<BillingSummaryPage />} />
                <Route path="billing/income" element={<IncomePage />} />
                <Route path="billing/expenses" element={<ExpensesPage />} />
                <Route path="timer" element={<TimerPage />} />
                <Route path="emails" element={<EmailsPage />} />
                <Route path="emails/messages" element={<EmailMessagesPage />} />
                <Route path="maintenance" element={<MaintenancePage />} />
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
