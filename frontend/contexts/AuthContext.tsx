import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || Constants.expoConfig?.extra?.apiUrl || '';

// Platform-specific storage helpers
const storage = {
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  },
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      return await AsyncStorage.getItem(key);
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  },
  clear: async () => {
    if (Platform.OS === 'web') {
      localStorage.clear();
    } else {
      await AsyncStorage.clear();
    }
  }
};

interface AuthContextType {
  token: string | null;
  userId: string | null;
  username: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<string>;
  register: (username: string, email: string, password: string, property_ids?: string[]) => Promise<void>;
  logout: () => Promise<void>;
  setToken: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await storage.getItem('token');
      const storedUserId = await storage.getItem('userId');
      const storedUsername = await storage.getItem('username');
      
      // Check for valid token (not null, not 'null' string, not empty)
      if (storedToken && storedToken !== 'null' && storedToken.trim().length > 0) {
        setToken(storedToken);
        setUserId(storedUserId && storedUserId !== 'null' ? storedUserId : null);
        setUsername(storedUsername && storedUsername !== 'null' ? storedUsername : null);
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<string> => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        username,
        password,
      });

      const { access_token, user_id, username: userName } = response.data;

      await storage.setItem('token', access_token);
      await storage.setItem('userId', user_id);
      await storage.setItem('username', userName);

      setToken(access_token);
      setUserId(user_id);
      setUsername(userName);
      
      return access_token;
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/register`, {
        username,
        email,
        password,
      });

      const { access_token, user_id, username: userName } = response.data;

      await storage.setItem('token', access_token);
      await storage.setItem('userId', user_id);
      await storage.setItem('username', userName);

      setToken(access_token);
      setUserId(user_id);
      setUsername(userName);
    } catch (error: any) {
      console.error('Register error:', error);
      throw new Error(error.response?.data?.detail || 'Registration failed');
    }
  };

  const logout = async () => {
    try {
      await storage.removeItem('token');
      await storage.removeItem('userId');
      await storage.removeItem('username');
      setToken(null);
      setUserId(null);
      setUsername(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const setTokenFunc = async (newToken: string) => {
    try {
      await storage.setItem('token', newToken);
      setToken(newToken);
    } catch (error) {
      console.error('SetToken error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ token, userId, username, loading, login, register, logout, setToken: setTokenFunc }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
