import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import DesktopBackground from '../components/DesktopBackground';
import MarketClashLogo from '../components/MarketClashLogo';
import { useCooldown } from '../hooks/useCooldown';

/**
 * Human-readable Firebase Auth error messages
 */
const getAuthErrorMessage = (error) => {
  const code = error?.code || '';
  switch (code) {
    case 'auth/user-not-found': return 'No account found with this email';
    case 'auth/wrong-password': return 'Incorrect password';
    case 'auth/invalid-credential': return 'Invalid email or password';
    case 'auth/email-already-in-use': return 'An account with this email already exists';
    case 'auth/weak-password': return 'Password must be at least 6 characters';
    case 'auth/invalid-email': return 'Please enter a valid email address';
    case 'auth/too-many-requests': return 'Too many attempts. Please try again later';
    case 'auth/popup-closed-by-user': return 'Sign-in was cancelled';
    case 'auth/network-request-failed': return 'Network error. Check your connection';
    default: return error?.message || 'Something went wrong. Please try again';
  }
};

const HomeScreen = ({
  containerStyle,
  isDesktop,
  login,
  register,
  loginWithGoogle,
  forgotPassword,
  setScreen,
}) => {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const { isOnCooldown, trigger, remainingSeconds } = useCooldown(3000);

  const handleLogin = async () => {
    await trigger(async () => {
      try {
        setError(null);
        setIsLoading(true);
        await login(email.trim(), password);
        setScreen('dashboard');
      } catch (err) {
        setError(getAuthErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    });
  };

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    await trigger(async () => {
      try {
        setError(null);
        setIsLoading(true);
        await register(email.trim(), password, username.trim());
        setScreen('dashboard');
      } catch (err) {
        setError(getAuthErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    });
  };

  const handleGoogleSignIn = async () => {
    await trigger(async () => {
      try {
        setError(null);
        setIsLoading(true);
        await loginWithGoogle();
        setScreen('dashboard');
      } catch (err) {
        setError(getAuthErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    });
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    try {
      setError(null);
      setIsLoading(true);
      await forgotPassword(email.trim());
      setForgotSent(true);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (mode === 'login') handleLogin();
    else if (mode === 'register') handleRegister();
    else if (mode === 'forgot') handleForgotPassword();
  };

  const canSubmit = (() => {
    if (isLoading || isOnCooldown) return false;
    if (mode === 'login') return email.trim() && password;
    if (mode === 'register') return email.trim() && password && confirmPassword && username.trim();
    if (mode === 'forgot') return email.trim();
    return false;
  })();

  const inputStyle = (hasValue) => ({
    width: '100%',
    padding: '14px 16px 14px 44px',
    fontSize: '14px',
    backgroundColor: '#0d1117',
    border: `2px solid ${hasValue ? '#00d9ff' : '#21262d'}`,
    borderRadius: '8px',
    color: '#ffffff',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  });

  const iconStyle = {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '18px',
    height: '18px',
    color: '#6e7681',
  };

  return (
    <div style={containerStyle}>
      <DesktopBackground isDesktop={isDesktop} />

      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0d1117',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* LOGO */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <MarketClashLogo size="large" />
        </div>

        {/* AUTH FORM CARD */}
        <div style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: '#1a1f2e',
          border: '2px solid #21262d',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
        }}>

          {/* Title */}
          <h2 style={{
            fontSize: '20px',
            fontWeight: 700,
            color: '#ffffff',
            textAlign: 'center',
            marginBottom: '24px',
            marginTop: 0,
          }}>
            {mode === 'login' && 'Sign In'}
            {mode === 'register' && 'Create Account'}
            {mode === 'forgot' && 'Reset Password'}
          </h2>

          {/* Error display */}
          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(255, 85, 85, 0.1)',
              border: '1px solid rgba(255, 85, 85, 0.3)',
              borderRadius: '8px',
              color: '#ff5555',
              fontSize: '13px',
              marginBottom: '16px',
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          {/* Forgot password success */}
          {mode === 'forgot' && forgotSent && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(0, 217, 255, 0.1)',
              border: '1px solid rgba(0, 217, 255, 0.3)',
              borderRadius: '8px',
              color: '#00d9ff',
              fontSize: '13px',
              marginBottom: '16px',
              textAlign: 'center',
            }}>
              Password reset email sent. Check your inbox.
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Username (register only) */}
            {mode === 'register' && (
              <div style={{ marginBottom: '16px', position: 'relative' }}>
                <User style={iconStyle} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  autoComplete="username"
                  disabled={isLoading}
                  style={inputStyle(username)}
                />
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom: '16px', position: 'relative' }}>
              <Mail style={iconStyle} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                autoComplete="email"
                disabled={isLoading}
                style={inputStyle(email)}
              />
            </div>

            {/* Password (not in forgot mode) */}
            {mode !== 'forgot' && (
              <div style={{ marginBottom: '16px', position: 'relative' }}>
                <Lock style={iconStyle} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  disabled={isLoading}
                  style={{ ...inputStyle(password), paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: '#6e7681',
                  }}
                >
                  {showPassword
                    ? <EyeOff style={{ width: '18px', height: '18px' }} />
                    : <Eye style={{ width: '18px', height: '18px' }} />}
                </button>
              </div>
            )}

            {/* Confirm Password (register only) */}
            {mode === 'register' && (
              <div style={{ marginBottom: '16px', position: 'relative' }}>
                <Lock style={iconStyle} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  disabled={isLoading}
                  style={inputStyle(confirmPassword)}
                />
              </div>
            )}

            {/* Forgot password link (login only) */}
            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null); setForgotSent(false); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#00d9ff',
                    fontSize: '13px',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: 'bold',
                color: canSubmit ? '#0d1117' : '#6e7681',
                background: canSubmit
                  ? 'linear-gradient(90deg, #00d9ff 0%, #0099cc 100%)'
                  : '#21262d',
                border: 'none',
                borderRadius: '8px',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: canSubmit ? '0 4px 12px rgba(0, 217, 255, 0.3)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? 'Please wait...' : (
                <>
                  {mode === 'login' && 'Enter Arena'}
                  {mode === 'register' && 'Create Account'}
                  {mode === 'forgot' && 'Send Reset Email'}
                  {!isLoading && mode !== 'forgot' && (
                    <ArrowRight style={{ width: '20px', height: '20px' }} />
                  )}
                </>
              )}
            </button>

            {isOnCooldown && remainingSeconds > 0 && (
              <div style={{
                textAlign: 'center',
                fontSize: '12px',
                color: '#6e7681',
                marginTop: '8px',
              }}>
                Please wait {remainingSeconds}s...
              </div>
            )}
          </form>

          {/* Divider (login/register modes only) */}
          {mode !== 'forgot' && (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                margin: '24px 0',
                gap: '12px',
              }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#21262d' }} />
                <span style={{ fontSize: '12px', color: '#6e7681', textTransform: 'uppercase', letterSpacing: '1px' }}>or</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#21262d' }} />
              </div>

              {/* Google Sign-In */}
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading || isOnCooldown}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#ffffff',
                  backgroundColor: '#21262d',
                  border: '1px solid #30363d',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  transition: 'background-color 0.2s',
                  opacity: isLoading ? 0.7 : 1,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Continue with Google
              </button>
            </>
          )}

          {/* Mode toggle */}
          <div style={{
            textAlign: 'center',
            marginTop: '20px',
            fontSize: '13px',
            color: '#6e7681',
          }}>
            {mode === 'login' && (
              <>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(null); }}
                  style={{ background: 'none', border: 'none', color: '#00d9ff', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                >
                  Sign up
                </button>
              </>
            )}
            {mode === 'register' && (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  style={{ background: 'none', border: 'none', color: '#00d9ff', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                >
                  Sign in
                </button>
              </>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setForgotSent(false); }}
                style={{ background: 'none', border: 'none', color: '#00d9ff', cursor: 'pointer', fontSize: '13px', padding: 0 }}
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
