import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import api, { setAuthToken, onTokenRefreshed } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  function updateToken(token) {
    setAccessToken(token);
    setAuthToken(token);
  }

  async function refreshSession() {
    try {
      const response = await api.post("/auth/refresh");
      setUser(response.data.user);
      updateToken(response.data.accessToken);
      return response.data.accessToken;
    } catch {
      setUser(null);
      updateToken(null);
      return null;
    }
  }

  async function login(email, password) {
    const response = await api.post("/auth/login", {
      email,
      password,
    });

    setUser(response.data.user);
    updateToken(response.data.accessToken);

    return response.data;
  }

  async function signup(name, email, password) {
    const response = await api.post("/auth/signup", {
      name,
      email,
      password,
    });

    return response.data;
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      updateToken(null);
    }
  }

  useEffect(() => {
    const unsubscribe = onTokenRefreshed((refreshedUser, token) => {
      if (refreshedUser) setUser(refreshedUser);
      setAccessToken(token);
    });

    refreshSession().finally(() => {
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        login,
        signup,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
