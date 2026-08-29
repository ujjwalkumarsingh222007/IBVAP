import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, LoginCredentials, UserRole } from '../types';
import { authApi, TOKEN_STORAGE_KEY, USER_STORAGE_KEY, formatApiError } from '../api';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  role: UserRole | null;
  isAdmin: boolean;
  isOperator: boolean;
  isViewer: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const savedUser = localStorage.getItem(USER_STORAGE_KEY);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
    setToken(null);
    setError(null);
  }, []);

  // Check and refresh user profile on initial startup if token exists
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await authApi.getMe();
        setUser(currentUser);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
      } catch (err) {
        // Token invalid or expired
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth-expired event from axios interceptor
    const handleAuthExpired = () => {
      logout();
    };

    window.addEventListener('ibvap:auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('ibvap:auth-expired', handleAuthExpired);
    };
  }, [logout]);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.login(credentials);
      const access_token = response.access_token;

      localStorage.setItem(TOKEN_STORAGE_KEY, access_token);
      setToken(access_token);

      // Fetch full user profile
      const userProfile = await authApi.getMe();
      setUser(userProfile);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userProfile));
    } catch (err) {
      const formatted = formatApiError(err);
      setError(formatted);
      throw new Error(formatted);
    } finally {
      setIsLoading(false);
    }
  };

  const role = user?.role || null;
  const isAdmin = role === 'ADMIN';
  const isOperator = role === 'OPERATOR' || isAdmin;
  const isViewer = role === 'VIEWER' || isOperator;

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isLoading,
    error,
    login,
    logout,
    role,
    isAdmin,
    isOperator,
    isViewer,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
