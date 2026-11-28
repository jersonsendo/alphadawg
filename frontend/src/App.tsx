import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, type AuthUser } from './api';
import {
  CustomerLoginPage,
  CustomerRegisterPage,
  ForcedPasswordChangePage,
  PortalChooserPage,
  StaffAuthPage,
} from './components/AuthPages';
import { CustomerPortal } from './components/CustomerPortal';
import { StaffPortal } from './components/StaffPortal';

function App() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'anonymous'>('checking');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [registrationAvailable, setRegistrationAvailable] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.currentUser().then((currentUser) => {
      if (!active) return;
      if (currentUser.authenticated) {
        setUser(currentUser);
        setAuthState('authenticated');
      } else {
        setRegistrationAvailable(currentUser.registrationAvailable);
        setAuthState('anonymous');
      }
    }).catch((requestError: unknown) => {
      if (!active) return;
      setError(requestError instanceof Error ? requestError.message : 'Could not verify your session.');
      setAuthState('anonymous');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setAuthState('anonymous');
      setError('Your session has expired. Please log in again.');
      navigate('/login', { replace: true });
    };
    const handlePasswordChangeRequired = () => {
      setUser((current) => current ? { ...current, passwordChangeRequired: true } : current);
      setError('');
    };
    window.addEventListener('clinic:unauthorized', handleUnauthorized);
    window.addEventListener('clinic:password-change-required', handlePasswordChangeRequired);
    return () => {
      window.removeEventListener('clinic:unauthorized', handleUnauthorized);
      window.removeEventListener('clinic:password-change-required', handlePasswordChangeRequired);
    };
  }, [navigate]);

  async function runAuth(action: () => Promise<AuthUser>, targetPath: string) {
    setError('');
    setAuthBusy(true);
    try {
      const signedIn = await action();
      setUser(signedIn);
      if (signedIn.role !== 'CUSTOMER') setRegistrationAvailable(false);
      setAuthState('authenticated');
      navigate(targetPath, { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not authenticate.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    const returnTo = user?.role === 'CUSTOMER' ? '/customer/login' : '/staff/login';
    try {
      await api.logout();
      setUser(null);
      setAuthState('anonymous');
      setError('');
      navigate(returnTo, { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not log out.');
    }
  }

  async function updatePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    setPasswordBusy(true);
    setError('');
    try {
      await api.changePassword({ currentPassword, newPassword });
      setUser((current) => current ? { ...current, passwordChangeRequired: false } : current);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update your password.');
      return false;
    } finally {
      setPasswordBusy(false);
    }
  }

  if (authState === 'checking') {
    return <div className="auth-loading">Checking your clinic account…</div>;
  }

  if (authState === 'anonymous') {
    return (
      <Routes>
        <Route path="/login" element={<PortalChooserPage registrationAvailable={registrationAvailable} />} />
        <Route
          path="/staff/login"
          element={
            <StaffAuthPage
              error={error}
              busy={authBusy}
              registrationAvailable={registrationAvailable}
              onClearError={() => setError('')}
              onLogin={(payload) => runAuth(() => api.staffLogin(payload), '/staff/overview')}
              onRegisterAdmin={(payload) => runAuth(() => api.register(payload), '/staff/overview')}
            />
          }
        />
        <Route
          path="/customer/login"
          element={
            <CustomerLoginPage
              error={error}
              busy={authBusy}
              onClearError={() => setError('')}
              onLogin={(payload) => runAuth(() => api.customerLogin(payload), '/portal/overview')}
            />
          }
        />
        <Route
          path="/customer/register"
          element={
            <CustomerRegisterPage
              error={error}
              busy={authBusy}
              onClearError={() => setError('')}
              onRegister={(payload) => runAuth(() => api.customerRegister(payload), '/portal/overview')}
            />
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (user?.passwordChangeRequired) {
    return (
      <ForcedPasswordChangePage
        displayName={user.displayName ?? user.email ?? 'your account'}
        error={error}
        busy={passwordBusy}
        onSignOut={signOut}
        onSubmit={async (currentPassword, newPassword) => {
          await updatePassword(currentPassword, newPassword);
        }}
      />
    );
  }

  if (user?.role === 'CUSTOMER') {
    return (
      <Routes>
        <Route
          path="/portal/*"
          element={
            <CustomerPortal
              user={user}
              onSignOut={signOut}
              onDisplayNameChanged={(displayName) => setUser((current) => current ? { ...current, displayName } : current)}
            />
          }
        />
        <Route path="*" element={<Navigate to="/portal/overview" replace />} />
      </Routes>
    );
  }

  if (user) {
    return (
      <Routes>
        <Route
          path="/staff/*"
          element={
            <StaffPortal
              user={user}
              onSignOut={signOut}
            />
          }
        />
        <Route path="*" element={<Navigate to="/staff/overview" replace />} />
      </Routes>
    );
  }

  return <Navigate to="/login" replace />;
}

export default App;
