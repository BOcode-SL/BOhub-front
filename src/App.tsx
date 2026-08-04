import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { AdminRoute, BillingRoute, OpsRoute, ProtectedRoute, PublicOnlyRoute } from '@/auth/RouteGuards';
import { AppLayout } from '@/components/layout/app-layout';
import { Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LoginPage } from '@/pages/LoginPage';
import { ClientsPage } from '@/pages/clients/ClientsPage';
import { ProjectsPage } from '@/pages/projects/ProjectsPage';
import { ProjectDetailPage } from '@/pages/projects/ProjectDetailPage';
import { BillingSummaryPage } from '@/pages/billing/BillingSummaryPage';
import { IncomePage } from '@/pages/billing/IncomePage';
import { ExpensesPage } from '@/pages/billing/ExpensesPage';
import { TimerPage } from '@/pages/timer/TimerPage';
import { MaintenancePage } from '@/pages/maintenance/MaintenancePage';
import { HomePage } from '@/pages/home/HomePage';
import { EmailsPage } from '@/pages/emails/EmailsPage';
import { EmailMessagesPage } from '@/pages/emails/EmailMessagesPage';
import { UsersPage } from '@/pages/users/UsersPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

/** Bookmarks: /app and /app/* → /dashboard/* */
function LegacyAppRedirect() {
    const { pathname, search, hash } = useLocation();
    const rest = pathname.replace(/^\/app/, '');
    return <Navigate to={`/dashboard${rest}${search}${hash}`} replace />;
}

export default function App() {
    return (
        <AuthProvider>
            <TooltipProvider>
                <Toaster >
                    <BrowserRouter>
                        <Routes>
                        <Route element={<PublicOnlyRoute />}>
                            <Route path="/login" element={<LoginPage />} />
                        </Route>

                        <Route element={<ProtectedRoute />}>
                            <Route path="/dashboard" element={<AppLayout />}>
                                <Route element={<OpsRoute />}>
                                    <Route index element={<HomePage />} />
                                    <Route path="clients" element={<ClientsPage />} />
                                    <Route path="projects" element={<ProjectsPage />} />
                                    <Route path="projects/:id" element={<ProjectDetailPage />} />
                                    <Route path="timer" element={<TimerPage />} />
                                    <Route path="maintenance" element={<MaintenancePage />} />
                                </Route>

                                <Route element={<BillingRoute />}>
                                    <Route path="billing" element={<BillingSummaryPage />} />
                                    <Route path="billing/income" element={<IncomePage />} />
                                    <Route path="billing/expenses" element={<ExpensesPage />} />
                                </Route>

                                <Route element={<AdminRoute />}>
                                    <Route path="emails" element={<EmailsPage />} />
                                    <Route path="emails/messages" element={<EmailMessagesPage />} />
                                    <Route path="users" element={<UsersPage />} />
                                </Route>

                                <Route path="settings" element={<SettingsPage />} />
                            </Route>
                        </Route>

                        <Route path="/app/*" element={<LegacyAppRedirect />} />
                        <Route path="/app" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                    </BrowserRouter>
                </Toaster>
            </TooltipProvider>
        </AuthProvider>
    );
}
