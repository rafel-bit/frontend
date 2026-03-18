import React, { createContext, useState, useEffect } from "react";
import { flushSync } from "react-dom";
import apiClient from "../services/apiClient";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("authToken");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await apiClient.get("/api/auth/userinfo");
        const userData = response.data.user || response.data;
        setUser(userData);
      } catch (err) {
        localStorage.removeItem("authToken");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const signup = async (email, password, firstName, lastName) => {
    try {
      setError(null);
      const response = await apiClient.post("/api/auth/signup", {
        email,
        password,
        firstName,
        lastName,
      });
      
      // Backend stores JWT in HTTPOnly cookie, so we don't need to save it
      // Response contains either { user: {...} } or just the user object
      const user = response.data.user || response.data;
      localStorage.setItem("authToken", "session");
      setUser(user);
      return response.data;
    } catch (err) {
      // Handle both axios-style errors and plain rejection objects
      let errorMsg = null;
      if (err && typeof err === 'object' && err.response) {
        errorMsg = err.response.data?.message || err.response.data?.error || err.message;
      } else if (err && typeof err === 'object' && err.message) {
        errorMsg = err.message;
      } else {
        errorMsg = String(err);
      }
      // Use flushSync to ensure state update is synchronously flushed
      flushSync(() => setError(errorMsg));
      throw err;
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await apiClient.post("/api/auth/login", {
        email,
        password,
      });
      
      // Backend stores JWT in HTTPOnly cookie
      // Response contains either { user: {...} } or just the user object
      const user = response.data.user || response.data;
      localStorage.setItem("authToken", "session");
      setUser(user);
      return response.data;
    } catch (err) {
      // Handle both axios-style errors and plain rejection objects
      let errorMsg = null;
      if (err && typeof err === 'object' && err.response) {
        errorMsg = err.response.data?.message || err.response.data?.error || err.message;
      } else if (err && typeof err === 'object' && err.message) {
        errorMsg = err.message;
      } else {
        errorMsg = String(err);
      }
      // Use flushSync to ensure state update is synchronously flushed
      flushSync(() => setError(errorMsg));
      throw err;
    }
  };

  const logout = async () => {
    try {
      await apiClient.post("/api/auth/logout");
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      localStorage.removeItem("authToken");
      setUser(null);
    }
  };

  const updateProfile = async (firstName, lastName) => {
    try {
      setError(null);
      const response = await apiClient.post("/api/auth/update-profile", {
        firstName,
        lastName,
      });

      const returned = response.data.user || response.data;
      setUser((prev) => ({ ...prev, ...returned, firstName, lastName }));
      return response.data;
    } catch (err) {
      // Handle both axios errors and objects
      let errorMsg = null;
      if (err && typeof err === 'object' && err.response) {
        errorMsg = err.response.data?.message || err.response.data?.error || err.message;
      } else if (err && typeof err === 'object' && err.message) {
        errorMsg = err.message;
      } else {
        errorMsg = String(err);
      }
      flushSync(() => setError(errorMsg));
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signup,
        login,
        logout,
        updateProfile,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
