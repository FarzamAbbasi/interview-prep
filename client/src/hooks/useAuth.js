import { useContext } from 'react';
import { AuthContext } from '../context/authContext';

/**
 * Read login state anywhere:
 *   const { user, loading, isAdmin, hasFullAccess, login, logout } = useAuth();
 */
export default function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
