import { useState, useEffect } from 'react';
import axios from 'axios';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await axios.get('/api/auth/status', { withCredentials: true });
        setUser(response.data.user);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (credentials) => {
    try {
      const response = await axios.post('/api/auth/login', credentials, { withCredentials: true });
      setUser(response.data.user);
    } catch (error) {
      console.error('Login failed', error);
      setUser(null);
    }
  };

  const signup = async (credentials) => {
    try {
      const response = await axios.post('/api/auth/signup', credentials, { withCredentials: true });
      setUser(response.data.user);
    } catch (error) {
      console.error('Signup failed', error);
      setUser(null);
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout', {}, { withCredentials: true });
      setUser(null);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return {
    user,
    loading,
    login,
    signup,
    logout,
  };
};
