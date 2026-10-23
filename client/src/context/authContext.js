import { createContext } from 'react';

// The value is provided by <AuthProvider> (AuthContext.jsx) and read with useAuth()
export const AuthContext = createContext(null);
