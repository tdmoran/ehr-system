import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, User } from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.getMe().then(({ data, error }) => {
        if (data && !error) {
          setUser(data);
        } else {
          localStorage.removeItem('token');
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await api.login(email, password);

    if (error) {
      return { error };
    }

    if (data) {
      localStorage.setItem('token', data.token);
      setUser(data.user);
    }

    return {};
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
