import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api, { tokenStorage, setUnauthorizedHandler, TOKEN_KEY } from '../api/axios';
import { AuthContext } from './authContext';
import { clearActiveQuiz } from '../utils/activeQuiz';

/**
 * Global login state for the whole app.
 *   user    -> null (guest) or { _id, name, email, role, isPaid, accessScope, paidLanguages, isVerified, ... }
 *   hasFullAccess -> every language unlocked (paid "all languages" or admin)
 *   hasAnyAccess  -> at least one language unlocked (IPP-1704)
 *   canAccess(languageId) -> this language unlocked?
 *   paidLanguages -> [{ _id, name, slug }] when only some languages are unlocked
 *   loading -> true while checking a saved token on page load
 *   login(email, password), logout(), refreshUser()
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Only "loading" if there is a saved token to check
  const [loading, setLoading] = useState(() => Boolean(tokenStorage.get()));

  const logout = useCallback((message) => {
    tokenStorage.clear();
    clearActiveQuiz(); // an unfinished quiz belongs to this user only
    setUser(null);
    if (message) toast(message, { id: 'auth-message' }); // same id = shown once
  }, []);

  // Ask the server who is logged in (uses the saved token)
  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.data.user);
    return data.data.user;
  }, []);

  // On page load: restore the session from the saved token
  useEffect(() => {
    if (!tokenStorage.get()) return;
    api
      .get('/auth/me')
      .then(({ data }) => setUser(data.data.user))
      .catch((err) => {
        tokenStorage.clear(); // bad/expired token: stay a guest
        // Blocked account: say why instead of silently logging out
        if (err.response?.status === 403) toast.error(err.response.data?.message, { id: 'auth-message' });
      })
      .finally(() => setLoading(false));
  }, []);

  // Any logged-in request that gets 401 -> log out with the server's message
  useEffect(() => {
    setUnauthorizedHandler((message) =>
      logout(message || 'Your session has expired. Please log in again')
    );
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Logout in one browser tab logs out the other tabs too
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === TOKEN_KEY && !e.newValue) setUser(null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Throws on wrong password etc.; the login page shows the error (IPP-603)
  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    tokenStorage.set(data.data.token);
    setUser(data.data.user);
    return data.data.user;
  }, []);

  // IPP-1704: access can be for all languages or only some
  const access = useMemo(() => {
    const all = Boolean(user && (user.role === 'admin' || (user.isPaid && user.accessScope !== 'some')));
    const paidLanguages = user?.isPaid && !all ? (user.paidLanguages || []).filter((l) => l && l._id) : [];
    const ids = new Set(paidLanguages.map((l) => String(l._id)));
    return {
      hasFullAccess: all,
      hasAnyAccess: all || ids.size > 0,
      paidLanguages,
      canAccess: (languageId) => all || ids.has(String(languageId?._id || languageId)),
      accessKey: all ? 'all' : [...ids].sort().join(','), // changes when access changes (refetch keys)
    };
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'admin',
      ...access,
      login,
      logout,
      refreshUser,
    }),
    [user, loading, access, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
