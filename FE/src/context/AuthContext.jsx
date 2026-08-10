import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../apiConfig';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('buihui_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const login = async (username, password) => {
    const res = await axios.post(getApiUrl('/api/Auth/login'), { username, password });
    if (res.data) {
      setUser(res.data);
      localStorage.setItem('buihui_user', JSON.stringify(res.data));
      return res.data;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('buihui_user');
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
