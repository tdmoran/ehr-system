import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ToastContainer from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Patients = lazy(() => import('./pages/Patients'));
const PatientChart = lazy(() => import('./pages/PatientChart'));
const Calendar = lazy(() => import('./pages/Calendar'));
const SecretaryDashboard = lazy(() => import('./pages/SecretaryDashboard'));
const Documents = lazy(() => import('./pages/Documents'));

function PageLoader() {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-navy-500 font-body">Loading...</span>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinical-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-navy-500 font-body">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <ErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/patients" element={<Patients />} />
                      <Route path="/patients/:id" element={<PatientChart />} />
                      <Route path="/documents" element={<Documents />} />
                      <Route path="/calendar" element={<Calendar />} />
                      <Route path="/schedule" element={<SecretaryDashboard />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
      <ToastContainer />
    </ToastProvider>
  );
}
