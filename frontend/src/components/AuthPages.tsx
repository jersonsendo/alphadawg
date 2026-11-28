import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { BrandLogo, CLINIC_HERO_IMG, ClinicIcon, Field, PasswordField } from './ClinicUi';

function AuthShell({ children, subtitle }: { children: React.ReactNode; subtitle: string }) {
  return (
    <main className="auth-page">
      <div className="auth-split">
        <aside className="auth-showcase">
          <img className="auth-showcase-img" src={CLINIC_HERO_IMG} alt="Veterinarian caring for a dog and cat at Alpha Dawgs Veterinary Clinic" />
          <div className="auth-showcase-overlay">
            <div className="auth-showcase-brand">
              <BrandLogo size={42} />
              <div>
                <span>ALPHA <strong>DAWGS</strong></span>
                <small>VETERINARY CLINIC</small>
              </div>
            </div>
            <h2>Compassionate care, organized in one place.</h2>
            <p>{subtitle}</p>
          </div>
        </aside>
        <div className="auth-card-column">
          <section className="auth-card">{children}</section>
          <p className="auth-footer">
            Alpha Dawgs Veterinary Clinic · A little more care, every day.
          </p>
        </div>
      </div>
    </main>
  );
}

function PortalSwitcher() {
  const { pathname } = useLocation();
  const isCustomer = pathname.startsWith('/customer');
  const isStaff = pathname.startsWith('/staff');
  return (
    <nav className="portal-switcher" aria-label="Portal login switcher">
      <NavLink to="/customer/login" className={`portal-tab ${isCustomer ? 'active' : ''}`}>
        Customer / Pet Owner
      </NavLink>
      <NavLink to="/staff/login" className={`portal-tab ${isStaff ? 'active' : ''}`}>
        Staff / Admin
      </NavLink>
    </nav>
  );
}

export function PortalChooserPage({ registrationAvailable }: { registrationAvailable: boolean }) {
  return (
    <AuthShell subtitle="Choose your portal to manage clinic operations or track your pet's visits, medical records, and receipts.">
      <div className="auth-brand">
        <BrandLogo size={39} />
        <span>ALPHA <strong>DAWGS</strong><small>VETERINARY CLINIC</small></span>
      </div>
      <span className="eyebrow">CHOOSE YOUR PORTAL</span>
      <h1>Welcome to Alpha Dawgs.</h1>
      <p className="auth-intro">Select the sign-in portal that matches your role at the clinic.</p>
      <div className="portal-choice-grid">
        <article className="portal-choice-card">
          <div className="portal-choice-head">
            <span className="portal-choice-icon"><ClinicIcon name="paw" size={20} /></span>
            <div>
              <h2>Customer / Pet Owner</h2>
              <p>View your pets, book &amp; manage visits, read medical records, and download receipts.</p>
            </div>
          </div>
          <div className="portal-choice-actions">
            <Link className="button button-primary" to="/customer/login">Customer Log in</Link>
            <Link className="button button-light" to="/customer/register">Create account</Link>
          </div>
        </article>
        <article className="portal-choice-card">
          <div className="portal-choice-head">
            <span className="portal-choice-icon"><ClinicIcon name="clinic" size={20} /></span>
            <div>
              <h2>Clinic Staff &amp; Admin</h2>
              <p>Manage patient records, clinic schedules, billing, inventory, and staff accounts.</p>
            </div>
          </div>
          <div className="portal-choice-actions">
            <Link className="button button-primary" to="/staff/login">
              {registrationAvailable ? 'Staff / Admin Setup' : 'Staff / Admin Log in'}
            </Link>
          </div>
        </article>
      </div>
    </AuthShell>
  );
}

export function StaffAuthPage({
  error,
  busy,
  registrationAvailable,
  onClearError,
  onLogin,
  onRegisterAdmin,
}: {
  error: string;
  busy: boolean;
  registrationAvailable: boolean;
  onClearError: () => void;
  onLogin: (payload: { email: string; password: string }) => Promise<void>;
  onRegisterAdmin: (payload: { email: string; displayName: string; password: string }) => Promise<void>;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showResetHelp, setShowResetHelp] = useState(false);
  const [validationError, setValidationError] = useState('');
  const registering = registrationAvailable && mode === 'register';
  const visibleError = validationError || error;

  return (
    <AuthShell subtitle="Clinic staff and administrators manage patient charts, daily schedules, inventory, and billing.">
      <div className="auth-brand">
        <BrandLogo size={39} />
        <span>ALPHA <strong>DAWGS</strong><small>STAFF &amp; ADMIN PORTAL</small></span>
      </div>
      <PortalSwitcher />
      <span className="eyebrow">{registering ? 'INITIAL ADMIN SETUP' : 'CLINIC STAFF & ADMIN'}</span>
      <h1>{registering ? 'Create clinic admin.' : 'Staff sign in.'}</h1>
      <p className="auth-intro">
        {registering
          ? 'Create the first administrator account to unlock clinic management.'
          : 'Log in with your staff or administrator account to manage the clinic.'}
      </p>
      {visibleError && <div className="alert alert-error" role="alert">{visibleError}</div>}
      <form className="auth-form" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const password = String(form.get('password'));
        if (registering && password !== String(form.get('confirmPassword'))) {
          setValidationError('Passwords do not match.');
          return;
        }
        setValidationError('');
        if (registering) {
          void onRegisterAdmin({
            email: String(form.get('email')).trim(),
            displayName: String(form.get('displayName')).trim(),
            password,
          });
        } else {
          void onLogin({
            email: String(form.get('email')).trim(),
            password,
          });
        }
      }}>
        {registering && (
          <Field label="Your name">
            <input name="displayName" autoComplete="name" required maxLength={100} placeholder="Clinic administrator name" />
          </Field>
        )}
        <Field label="Email address">
          <input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@clinic.com" />
        </Field>
        <PasswordField
          label="Password"
          name="password"
          autoComplete={registering ? 'new-password' : 'current-password'}
          required
          minLength={registering ? 8 : 1}
          maxLength={72}
          placeholder={registering ? 'At least 8 characters' : 'Enter your password'}
        />
        {!registering && (
          <div className="forgot-password-help">
            <button
              type="button"
              className="forgot-password-link"
              aria-expanded={showResetHelp}
              aria-controls="forgot-password-copy"
              onClick={() => setShowResetHelp((show) => !show)}
            >
              Forgot password?
            </button>
            {showResetHelp && (
              <p className="forgot-password-copy" id="forgot-password-copy" role="status">
                Contact a clinic administrator to get a one-time temporary password. You’ll be asked to change it after signing in.
              </p>
            )}
          </div>
        )}
        {registering && (
          <PasswordField
            label="Confirm password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
          />
        )}
        <button className="button button-primary auth-submit" disabled={busy}>
          {busy ? 'Please wait…' : registering ? 'Create account' : 'Log in'}
        </button>
      </form>
      <p className="auth-switch">
        {registrationAvailable ? (
          <>
            {registering ? 'Already have an account?' : 'First time setting up the clinic?'}
            <button
              type="button"
              onClick={() => {
                setMode(registering ? 'login' : 'register');
                setValidationError('');
                onClearError();
              }}
            >
              {registering ? 'Log in' : 'Create an account'}
            </button>
          </>
        ) : (
          'Need a staff account? Contact a clinic administrator.'
        )}
      </p>
      <p className="auth-back-link">
        <Link to="/login" onClick={onClearError}>Back to portal selection</Link>
      </p>
    </AuthShell>
  );
}

export function CustomerLoginPage({
  error,
  busy,
  onClearError,
  onLogin,
}: {
  error: string;
  busy: boolean;
  onClearError: () => void;
  onLogin: (payload: { email: string; password: string }) => Promise<void>;
}) {
  return (
    <AuthShell subtitle="Pet parents can book visits, view medical records & PDFs, and check invoices anytime.">
      <div className="auth-brand">
        <BrandLogo size={39} />
        <span>ALPHA <strong>DAWGS</strong><small>CUSTOMER &amp; PET PORTAL</small></span>
      </div>
      <PortalSwitcher />
      <span className="eyebrow">CUSTOMER / PET OWNER PORTAL</span>
      <h1>Good to see you.</h1>
      <p className="auth-intro">Sign in to view your pets, manage appointments, and access medical records and receipts.</p>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <form className="auth-form" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void onLogin({
          email: String(form.get('email')).trim(),
          password: String(form.get('password')),
        });
      }}>
        <Field label="Email address">
          <input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" />
        </Field>
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          minLength={1}
          maxLength={72}
          placeholder="Enter your password"
        />
        <button className="button button-primary auth-submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Customer Log in'}
        </button>
      </form>
      <p className="auth-switch">
        New pet owner at Alpha Dawgs?
        <Link className="auth-inline-link" to="/customer/register" onClick={onClearError}>Create a customer account</Link>
      </p>
      <p className="auth-back-link">
        <Link to="/login" onClick={onClearError}>Back to portal selection</Link>
      </p>
    </AuthShell>
  );
}

export function CustomerRegisterPage({
  error,
  busy,
  onClearError,
  onRegister,
}: {
  error: string;
  busy: boolean;
  onClearError: () => void;
  onRegister: (payload: {
    email: string;
    displayName: string;
    phone: string | null;
    address: string | null;
    password: string;
  }) => Promise<void>;
}) {
  const [validationError, setValidationError] = useState('');
  const visibleError = validationError || error;

  return (
    <AuthShell subtitle="Register with the email you use at Alpha Dawgs to automatically link your pets and clinic history.">
      <div className="auth-brand">
        <BrandLogo size={39} />
        <span>ALPHA <strong>DAWGS</strong><small>CUSTOMER &amp; PET PORTAL</small></span>
      </div>
      <PortalSwitcher />
      <span className="eyebrow">CUSTOMER REGISTRATION</span>
      <h1>Create your pet portal account.</h1>
      <p className="auth-intro">Use the same email registered with the clinic to automatically link your pets.</p>
      {visibleError && <div className="alert alert-error" role="alert">{visibleError}</div>}
      <form className="auth-form" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const password = String(form.get('password'));
        if (password !== String(form.get('confirmPassword'))) {
          setValidationError('Passwords do not match.');
          return;
        }
        setValidationError('');
        void onRegister({
          displayName: String(form.get('displayName')).trim(),
          email: String(form.get('email')).trim(),
          phone: String(form.get('phone') ?? '').trim() || null,
          address: String(form.get('address') ?? '').trim() || null,
          password,
        });
      }}>
        <Field label="Full name">
          <input name="displayName" autoComplete="name" required maxLength={100} placeholder="e.g. Maria Santos" />
        </Field>
        <Field label="Email address">
          <input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" />
        </Field>
        <div className="auth-two-col">
          <Field label="Phone (optional)">
            <input name="phone" autoComplete="tel" maxLength={32} placeholder="09XX XXX XXXX" />
          </Field>
          <Field label="Address (optional)">
            <input name="address" autoComplete="street-address" maxLength={500} placeholder="City / address" />
          </Field>
        </div>
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          placeholder="At least 8 characters"
        />
        <PasswordField
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          placeholder="Re-enter your password"
        />
        <button className="button button-primary auth-submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Create customer account'}
        </button>
      </form>
      <p className="auth-switch">
        Already have a customer account?
        <Link className="auth-inline-link" to="/customer/login" onClick={onClearError}>Log in</Link>
      </p>
      <p className="auth-back-link">
        <Link to="/login" onClick={onClearError}>Back to portal selection</Link>
      </p>
    </AuthShell>
  );
}

export function ForcedPasswordChangePage({
  displayName,
  error,
  busy,
  onSignOut,
  onSubmit,
}: {
  displayName: string;
  error: string;
  busy: boolean;
  onSignOut: () => Promise<void>;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
}) {
  return (
    <AuthShell subtitle="Keep your clinic account secure by replacing your one-time temporary password.">
      <div className="auth-brand">
        <BrandLogo size={39} />
        <span>ALPHA <strong>DAWGS</strong><small>VETERINARY CLINIC</small></span>
      </div>
      <span className="eyebrow">PASSWORD RESET REQUIRED</span>
      <h1>Set a new password.</h1>
      <p className="auth-intro">
        Welcome, {displayName}. Enter the temporary password from your administrator, then choose a new password to continue.
      </p>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <form className="auth-form" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void onSubmit(String(form.get('currentPassword')), String(form.get('newPassword')));
      }}>
        <PasswordField label="Temporary password" name="currentPassword" autoComplete="current-password" required />
        <PasswordField label="New password" name="newPassword" autoComplete="new-password" minLength={8} maxLength={72} required />
        <p className="password-hint">Use at least 8 characters. Your new password must be different from the temporary password.</p>
        <button className="button button-primary auth-submit" disabled={busy}>
          {busy ? 'Updating…' : 'Set new password'}
        </button>
      </form>
      <p className="auth-switch">
        <button type="button" onClick={() => void onSignOut()}>Log out</button>
      </p>
    </AuthShell>
  );
}
