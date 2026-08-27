import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import authService from '../services/authService';
import { getAccessToken, setSessionExpiredHandler, getErrorMessage } from '../services/api';

const AuthContext = createContext(null);

/**
 * Owns the signed-in student. On boot it tries to restore the session:
 * an access token in localStorage is verified with /auth/me, and if that
 * fails the httpOnly refresh cookie gets one chance via /auth/refresh.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
  }, []);

  // The axios interceptor calls this when a refresh attempt finally fails.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearSession();
      toast.error('Your session expired. Please log in again.');
    });
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      try {
        if (getAccessToken()) {
          const me = await authService.me();
          if (!cancelled) setUser(me);
        } else {
          // No access token, but the refresh cookie may still be valid.
          const refreshed = await authService.refresh();
          if (!cancelled) setUser(refreshed);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const loggedIn = await authService.login(credentials);
    setUser(loggedIn);
    toast.success(`Welcome back, ${loggedIn.name.split(' ')[0]}!`);
    return loggedIn;
  }, []);

  const register = useCallback(async (payload) => {
    const created = await authService.register(payload);
    setUser(created);
    toast.success('Account created. Let us set things up.');
    return created;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    toast.success('Logged out');
  }, []);

  /** Merge a partial update (profile edit, onboarding) into the cached user. */
  const updateUser = useCallback((patch) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await authService.me();
      setUser(me);
      return me;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      needsOnboarding: Boolean(user) && !user.onboardingCompleted,
      currency: user ? user.currency : 'INR',
      login,
      register,
      logout,
      updateUser,
      refreshUser,
    }),
    [user, loading, login, register, logout, updateUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
};

export default AuthContext;
