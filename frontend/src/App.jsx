import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';

// Layout & Pages
import AppLayout from './layouts/AppLayout';
import LandingPage from './pages/LandingPage';
import LoginRegister from './pages/LoginRegister';
import Dashboard from './pages/Dashboard';
import WhatsAppChecker from './pages/WhatsAppChecker';
import Settings from './pages/Settings';
import History from './pages/History';
import AdminPanel from './pages/AdminPanel';

const queryClient = new QueryClient();

// Shared loading spinner — theme-neutral
function LoadingScreen({ message = 'Loading...' }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] flex flex-col items-center justify-center gap-3 transition-colors">
      <div className="w-8 h-8 rounded-full border-2 border-cyber-green border-t-transparent animate-spin" />
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 font-mono">{message}</p>
    </div>
  );
}

// Route wrapper for authenticated users
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  if (isLoading) {
    return <LoadingScreen message="[CHECKING SESSION CREDENTIALS...]" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

// Route wrapper for admin-only users
function AdminRoute({ children }) {
  const { isAuthenticated, user, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  if (isLoading) {
    return <LoadingScreen message="[VERIFYING ADMINISTRATOR PRIVILEGES...]" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

// Simple Analytics placeholder (redirects to Dashboard)
function AnalyticsPage() {
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  const { checkAuth } = useAuthStore();

  // Apply persisted theme on initial load
  useEffect(() => {
    checkAuth();
    const savedTheme = localStorage.getItem('theme') || 'light';
    const root = document.documentElement;
    const body = document.body;
    if (savedTheme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginRegister />} />

          {/* Protected Client Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checker"
            element={
              <ProtectedRoute>
                <WhatsAppChecker />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            }
          />

          {/* Admin Restricted Routes */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPanel />
              </AdminRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
