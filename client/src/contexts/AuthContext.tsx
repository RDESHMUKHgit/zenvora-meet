import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile, UserStatus } from '../types';
import { authApi } from '../services';
import { setLocalCsrfToken } from '../services/api';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateStatus: (status: UserStatus) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const currentUser = await authApi.getMe();
      setUser(currentUser);
      if (currentUser) {
        authApi.getCsrf().then((token) => {
          if (token) setLocalCsrfToken(token);
        }).catch(() => {});
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authApi.login({ email, password });
    if (result.csrfToken) {
      setLocalCsrfToken(result.csrfToken);
    }
    setUser(result.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const result = await authApi.register({ name, email, password });
    if (result.csrfToken) {
      setLocalCsrfToken(result.csrfToken);
    }
    setUser(result.user);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  };

  const updateStatus = (status: UserStatus) => {
    setUser((prev) => (prev ? { ...prev, status } : null));
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateStatus,
        updateProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
