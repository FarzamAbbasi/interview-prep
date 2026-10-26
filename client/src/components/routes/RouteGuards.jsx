import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { HiOutlineShieldExclamation } from 'react-icons/hi';
import useAuth from '../../hooks/useAuth';
import PageLoader from '../ui/PageLoader';
import UpgradePrompt from './UpgradePrompt';

/**
 * Wrap routes in App.jsx:
 *   <Route element={<ProtectedRoute />}> ...logged-in pages... </Route>
 *   <Route element={<AdminRoute />}>     ...admin pages...     </Route>
 *   <Route element={<PaidRoute />}>      ...paid-only pages... </Route>  (inside ProtectedRoute)
 */

// Logged-in users only. Guests go to /login and come back here after logging in.
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

// Admins only. Guests go to /login; logged-in non-admins see "no access".
export function AdminRoute() {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <HiOutlineShieldExclamation size={56} className="text-red-500" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">No access</h1>
        <p className="mt-2 text-slate-500">This page is for admins only.</p>
        <Link
          to="/"
          className="mt-6 rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Go to home
        </Link>
      </div>
    );
  }
  return <Outlet />;
}

// Paid users (all or some languages, IPP-1704) and admins only. Others see the upgrade prompt.
export function PaidRoute() {
  const { hasAnyAccess, loading } = useAuth();
  if (loading) return <PageLoader />;
  return hasAnyAccess ? <Outlet /> : <UpgradePrompt />;
}
