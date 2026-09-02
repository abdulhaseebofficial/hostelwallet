import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute, { PublicOnlyRoute } from './components/layout/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import { PageSpinner } from './components/ui/Spinner';

// Auth screens load eagerly - they are the first thing most visitors see.
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// The rest is code-split so the initial bundle stays small on a phone.
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Income = lazy(() => import('./pages/Income'));
const Goals = lazy(() => import('./pages/Goals'));
const Budget = lazy(() => import('./pages/Budget'));
const AIAdvisor = lazy(() => import('./pages/AIAdvisor'));
const Reports = lazy(() => import('./pages/Reports'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              {/* Signed out only */}
              <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
              </Route>

              {/* Signed in, but before the wizard is finished */}
              <Route element={<ProtectedRoute requireOnboarding={false} />}>
                <Route path="/onboarding" element={<Onboarding />} />
              </Route>

              {/* The app proper */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/expenses" element={<Expenses />} />
                  <Route path="/income" element={<Income />} />
                  <Route path="/goals" element={<Goals />} />
                  <Route path="/budget" element={<Budget />} />
                  <Route path="/advisor" element={<AIAdvisor />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>

          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3500,
              className:
                '!bg-canvas-card !text-slate-800 !border !border-slate-200 !rounded-xl !text-sm !shadow-lift !max-w-md dark:!bg-canvas-darkCard dark:!text-slate-100 dark:!border-slate-800',
              success: { iconTheme: { primary: '#2f7d4f', secondary: '#fff' } },
              error: { iconTheme: { primary: '#b3261e', secondary: '#fff' }, duration: 5000 },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
