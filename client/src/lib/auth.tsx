import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, User } from './api';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  readOnly: boolean;
  unlockSystem: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [readOnly, setReadOnly] = useState(false);
  const queryClient = useQueryClient();

  // Check if user is already logged in on mount.
  // sessionStorage is wiped when the browser closes — if the flag is missing
  // the user opened a fresh browser, so we force-logout the server session.
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await authApi.getMe();
        if (!sessionStorage.getItem('session_alive')) {
          await authApi.logout();
          setUser(null);
        } else {
          setUser(currentUser);
          // Check read-only status
          const statusRes = await fetch('/api/system/status', { credentials: 'include' });
          if (statusRes.ok) {
            const status = await statusRes.json();
            setReadOnly(status.readOnly);
          }
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const loggedInUser = await authApi.login({ username, password });
    sessionStorage.setItem('session_alive', '1');
    setUser(loggedInUser);
    queryClient.invalidateQueries();
    // Refresh read-only status after login
    const statusRes = await fetch('/api/system/status', { credentials: 'include' });
    if (statusRes.ok) setReadOnly((await statusRes.json()).readOnly);
  };

  const logout = async () => {
    await authApi.logout();
    sessionStorage.removeItem('session_alive');
    setUser(null);
    setReadOnly(false);
    queryClient.clear();
  };

  const unlockSystem = async () => {
    await fetch('/api/system/unlock', { method: 'POST', credentials: 'include' });
    setReadOnly(false);
    queryClient.invalidateQueries();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, readOnly, unlockSystem }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
