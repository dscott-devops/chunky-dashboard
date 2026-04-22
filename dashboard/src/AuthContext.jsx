import { createContext, useContext, useEffect, useState } from 'react';
import { debug } from './debug.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    debug.auth('Checking session via /auth/me');
    fetch('/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          debug.auth('Session valid', { email: d.email, env: d.env });
          setUser(d);
        } else {
          debug.auth('No active session', d);
          setUser(null);
        }
      })
      .catch(err => {
        debug.error('AuthContext /auth/me fetch', err);
        setUser(null);
      });
  }, []);

  const login = (userData) => {
    debug.auth('Login state set', { email: userData.email, env: userData.env });
    setUser(userData);
  };

  const logout = async () => {
    debug.auth('Logout initiated');
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    debug.auth('Logout complete');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
