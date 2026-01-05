// src/services/auth/index.js
// Export all auth services

export {
  getCurrentUser,
  login,
  logout,
  isAuthenticated,
  getUserId,
  updateUserProfile,
  onAuthStateChange,
  AUTH_PROVIDERS,
} from './authService';

export { default as authService } from './authService';
