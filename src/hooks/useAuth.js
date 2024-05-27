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

  const checkCredentials = async (credentials) => {
    try {
      const response = await axios.post('/api/auth/checkCredentials', credentials, { withCredentials: true });
      return response.data.user;
    } catch (error) {
      if (error.response) {
        throw { message: '* Email or phone number already in use.', status: error.response.status, data: error.response.data };
      } else {
        throw { message: 'Check failed', status: 500, data: { error: 'Internal server error' } };
      }
    }
  };

  const login = async (credentials) => {
    try {
      const response = await axios.post('/api/auth/login', credentials, { withCredentials: true });
      setUser(response.data.user);
    } catch (error) {
      setUser(null);
      if (error.response) {
        throw { message: 'Login failed', status: error.response.status, data: error.response.data };
      } else {
        throw { message: 'Login failed', status: 500, data: { error: 'Internal server error' } };
      }
    }
  };

  const checkUser = async (email, phoneNumber) => {
    try {
      const response = await axios.post('/api/auth/checkUser', { email, phoneNumber });
      return response.data.message;
    } catch (error) {
      if (error.response) {
        throw { message: '* Email or phone number already in use.', status: error.response.status, data: error.response.data };
      } else {
        throw { message: 'Check failed', status: 500, data: { error: 'Internal server error' } };
      }
    }
  };

  const signup = async (credentials) => {
    try {
      const response = await axios.post('/api/auth/signup', credentials, { withCredentials: true });
      setUser(response.data.user);
    } catch (error) {
      setUser(null);
      if (error.response) {
        throw { message: '* Sorry, we are experiencing an issue. If this issue persists, please contact us.', status: error.response.status, data: error.response.data };
      } else {
        throw { message: '* Sorry, we are experiencing an issue. If this issue persists, please contact us.', status: 500, data: { error: 'Internal server error' } };
      }
    }
  };

  const requestOtp = async (email, name) => {
    try {
      const response = await axios.post('/api/auth/sendOtp', { email, name });
      return response.data.otpId;
    } catch (error) {
      if (error.response) {
        throw { message: 'Failed to send OTP', status: error.response.status, data: error.response.data };
      } else {
        throw { message: 'Failed to send OTP', status: 500, data: { error: 'Internal server error' } };
      }
    }
  };

  const verifyOtp = async (otpId, otp) => {
    try {
      const response = await axios.post('/api/auth/verifyOtp', { otpId, otp });
      return response.data; // Return any relevant data from the verification
    } catch (error) {
      if (error.response) {
        throw { message: '* Incorrect verification code.', status: error.response.status, data: error.response.data };
      } else {
        throw { message: 'Failed to verify OTP', status: 500, data: { error: 'Internal server error' } };
      }
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
    checkCredentials,
    login,
    checkUser,
    signup,
    requestOtp,
    verifyOtp,
    logout,
  };
};
