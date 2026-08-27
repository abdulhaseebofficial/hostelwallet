import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageSpinner } from '../ui/Spinner';

/**
 * Gate for every authenticated route.
 *  - while the session is being restored, show a spinner (never a flash of
 *    the login page for an already-signed-in student);
 *  - not signed in -> /login, remembering where they were headed;
 *  - signed in but onboarding unfinished -> /onboarding.
 */
export default function ProtectedRoute({ requireOnboarding = true }) {
  const { isAuthenticated, loading, needsOnboarding } = useAuth();
  const location = useLocation();

  if (loading) return <PageSpinner label="Getting your wallet ready" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireOnboarding && needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

/** Inverse gate: keeps a signed-in student off /login and /register. */
export function PublicOnlyRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <PageSpinner label="Loading" />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
