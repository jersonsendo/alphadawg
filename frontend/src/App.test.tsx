import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const jsonResponse = (data: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response);

describe('clinic dashboard', () => {
  afterEach(() => {
    cleanup();
    document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
    vi.restoreAllMocks();
  });

  it('registers a user and sends the CSRF token with the request', async () => {
    document.cookie = 'XSRF-TOKEN=test-csrf-token; path=/';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) return jsonResponse({
        authenticated: false, email: null, displayName: null, role: null,
        passwordChangeRequired: false, registrationAvailable: true,
      });
      if (url.endsWith('/api/auth/csrf')) return jsonResponse({ token: 'masked-token' });
      if (url.endsWith('/api/auth/register')) {
        return jsonResponse({
          authenticated: true, email: 'staff@example.com', displayName: 'Clinic Staff', role: 'STAFF',
          passwordChangeRequired: false, registrationAvailable: false,
        });
      }
      if (url.endsWith('/api/dashboard')) return jsonResponse({
        petCount: 0,
        ownerCount: 0,
        appointmentCount: 0,
        pendingAppointmentCount: 0,
        confirmedAppointmentCount: 0,
        unpaidPaymentCount: 0,
        outstandingAmount: 0,
        paidAmount: 0,
      });
      if (url.endsWith('/api/pets') || url.endsWith('/api/appointments') || url.endsWith('/api/appointment-staff') || url.endsWith('/api/payments') || url.endsWith('/api/inventory')
        || url.endsWith('/api/owners') || url.endsWith('/api/notifications')) {
        return jsonResponse([]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create an account' }));
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Clinic Staff' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'staff@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'StrongPass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Good care starts here.')).toBeInTheDocument();
    const registrationRequest = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/auth/register'));
    expect(new Headers(registrationRequest?.[1]?.headers).get('X-CSRF-TOKEN')).toBe('test-csrf-token');
  });

  it('does not submit registration when password confirmation does not match', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).endsWith('/api/auth/me')) {
        return jsonResponse({
          authenticated: false,
          email: null,
          displayName: null,
          role: null,
          passwordChangeRequired: false,
          registrationAvailable: true,
        });
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create an account' }));
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Clinic Staff' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'staff@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'DifferentPass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.');
  });

  it('does not offer public registration after the clinic has an account', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).endsWith('/api/auth/me')) {
        return jsonResponse({
          authenticated: false,
          email: null,
          displayName: null,
          role: null,
          passwordChangeRequired: false,
          registrationAvailable: false,
        });
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });

    render(<App />);
    expect(await screen.findByText('Need an account? Contact a clinic administrator.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create an account' })).not.toBeInTheDocument();
  });

  it('places the forgot-password help under the password field on the login form', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).endsWith('/api/auth/me')) {
        return jsonResponse({
          authenticated: false,
          email: null,
          displayName: null,
          role: null,
          passwordChangeRequired: false,
          registrationAvailable: true,
        });
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });

    render(<App />);
    const password = await screen.findByLabelText('Password');
    const forgotPassword = screen.getByRole('button', { name: 'Forgot password?' });
    expect(password.compareDocumentPosition(forgotPassword) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(forgotPassword);
    expect(screen.getByRole('status')).toHaveTextContent('Contact a clinic administrator');
  });

  it('loads clinic totals and registered pets from the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({
          authenticated: true, email: 'staff@example.com', displayName: 'Clinic Staff', role: 'STAFF',
          passwordChangeRequired: false, registrationAvailable: false,
        });
      }
      if (url.endsWith('/api/dashboard')) {
        return jsonResponse({
          petCount: 1,
          ownerCount: 1,
          appointmentCount: 2,
          pendingAppointmentCount: 1,
          confirmedAppointmentCount: 1,
          unpaidPaymentCount: 1,
          outstandingAmount: 50,
          paidAmount: 0,
        });
      }
      if (url.endsWith('/api/pets')) {
        return jsonResponse([{
          id: 1,
          name: 'Bantay',
          species: 'Dog',
          breed: 'Aspin',
          ownerName: 'Maria Santos',
          label: 'Bantay (Maria Santos)',
          ownerId: 1,
          ownerEmail: null,
          ownerPhone: null,
          ownerAddress: null,
          archived: false,
        }]);
      }
      if (url.endsWith('/api/appointments') || url.endsWith('/api/appointment-staff') || url.endsWith('/api/payments') || url.endsWith('/api/inventory')
        || url.endsWith('/api/owners') || url.endsWith('/api/notifications')) return jsonResponse([]);
      if (url.endsWith('/api/pets/1/records')) return jsonResponse([]);
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);

    expect(await screen.findByText('Appointments to confirm')).toBeInTheDocument();
    expect(screen.getByText('Payments to collect')).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(navigation.querySelectorAll('svg[data-icon]')).toHaveLength(8);
    expect(navigation.querySelector('svg[data-icon="appointments"]')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Pets' }));
    expect(await screen.findByText('Bantay')).toBeInTheDocument();
  });

  it('shows stock levels and low-stock warnings in inventory', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) return jsonResponse({
        authenticated: true, email: 'staff@example.com', displayName: 'Clinic Staff', role: 'STAFF',
        passwordChangeRequired: false, registrationAvailable: false,
      });
      if (url.endsWith('/api/dashboard')) return jsonResponse({
        petCount: 0, ownerCount: 0, appointmentCount: 0, pendingAppointmentCount: 0,
        confirmedAppointmentCount: 0, unpaidPaymentCount: 0, outstandingAmount: 0, paidAmount: 0,
      });
      if (url.endsWith('/api/inventory')) return jsonResponse([{
        id: 8, sku: 'MED-001', name: 'Flea treatment', category: 'Medication',
        quantityOnHand: 2, reorderLevel: 3, unitPrice: 125.5, active: true, lowStock: true,
      }]);
      if (url.endsWith('/api/pets') || url.endsWith('/api/appointments')
        || url.endsWith('/api/appointment-staff') || url.endsWith('/api/payments')
        || url.endsWith('/api/owners') || url.endsWith('/api/notifications')) return jsonResponse([]);
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Inventory' }));

    expect(await screen.findByText('Flea treatment')).toBeInTheDocument();
    expect(screen.getByText('Reorder needed')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('shows a generated temporary password after an administrator resets a staff account', async () => {
    document.cookie = 'XSRF-TOKEN=test-csrf-token; path=/';
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({
          authenticated: true,
          email: 'admin@example.com',
          displayName: 'Clinic Admin',
          role: 'ADMIN',
          passwordChangeRequired: false,
          registrationAvailable: false,
        });
      }
      if (url.endsWith('/api/dashboard')) return jsonResponse({
        petCount: 0,
        ownerCount: 0,
        appointmentCount: 0,
        pendingAppointmentCount: 0,
        confirmedAppointmentCount: 0,
        unpaidPaymentCount: 0,
        outstandingAmount: 0,
        paidAmount: 0,
      });
      if (url.endsWith('/api/auth/csrf')) return jsonResponse({ token: 'masked-token' });
      if (url.endsWith('/api/staff')) return jsonResponse([{
        id: 2,
        email: 'staff@example.com',
        displayName: 'Clinic Staff',
        role: 'STAFF',
        active: true,
        createdAt: '2026-01-01T00:00:00',
      }]);
      if (url.endsWith('/api/audit')) return jsonResponse([{
        id: 1, actor: 'admin@example.com', method: 'POST',
        requestPath: '/api/pets', responseStatus: 201, occurredAt: '2026-01-01T12:00:00',
      }]);
      if (url.endsWith('/api/staff/2/password-reset')) {
        return jsonResponse({ temporaryPassword: 'one-time-password' });
      }
      if (url.endsWith('/api/pets') || url.endsWith('/api/appointments') || url.endsWith('/api/appointment-staff') || url.endsWith('/api/payments') || url.endsWith('/api/inventory')
        || url.endsWith('/api/owners') || url.endsWith('/api/notifications')) {
        return jsonResponse([]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Account & staff' }));
    expect(await screen.findByText('Recent activity')).toBeInTheDocument();
    expect(screen.getByText('/api/pets')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Reset password' }));

    expect(await screen.findByText('one-time-password')).toBeInTheDocument();
    expect(screen.getByText(/must be changed after sign-in/)).toBeInTheDocument();
  });

  it('opens an existing pet profile and edits the owner name', async () => {
    document.cookie = 'XSRF-TOKEN=test-csrf-token; path=/';
    let pet = {
      id: 1,
      name: 'Bantay',
      species: 'Dog',
      breed: 'Aspin',
      ownerName: 'Maria Santos',
      label: 'Bantay (Maria Santos)',
      ownerId: 1,
      ownerEmail: null,
      ownerPhone: null,
      ownerAddress: null,
      archived: false,
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({
          authenticated: true, email: 'staff@example.com', displayName: 'Clinic Staff', role: 'STAFF',
          passwordChangeRequired: false, registrationAvailable: false,
        });
      }
      if (url.endsWith('/api/dashboard')) return jsonResponse({
        petCount: 1,
        ownerCount: 1,
        appointmentCount: 0,
        pendingAppointmentCount: 0,
        confirmedAppointmentCount: 0,
        unpaidPaymentCount: 0,
        outstandingAmount: 0,
        paidAmount: 0,
      });
      if (url.endsWith('/api/pets/1') && init?.method === 'PUT') {
        const payload = JSON.parse(String(init.body)) as Omit<typeof pet, 'id' | 'label'>;
        pet = { ...payload, id: 1, label: `${payload.name} (${payload.ownerName})` };
        return jsonResponse(pet);
      }
      if (url.endsWith('/api/pets/1')) return jsonResponse(pet);
      if (url.endsWith('/api/pets')) return jsonResponse([pet]);
      if (url.endsWith('/api/appointments') || url.endsWith('/api/appointment-staff') || url.endsWith('/api/payments') || url.endsWith('/api/inventory')
        || url.endsWith('/api/owners') || url.endsWith('/api/notifications')) return jsonResponse([]);
      if (url.endsWith('/api/pets/1/records')) return jsonResponse([]);
      if (url.endsWith('/api/auth/csrf')) return jsonResponse({ token: 'masked-token' });
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pets' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View pet & owner details' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent('Maria Santos');
    expect(screen.getByRole('dialog')).toHaveTextContent('Aspin');
    fireEvent.click(screen.getByRole('button', { name: 'Edit pet & owner' }));
    fireEvent.change(screen.getByLabelText('Owner name'), { target: { value: 'Ana Reyes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('Ana Reyes'));
    const updateRequest = fetchMock.mock.calls.find(([url, init]) =>
      String(url).endsWith('/api/pets/1') && init?.method === 'PUT');
    expect(updateRequest).toBeDefined();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/pets/1'))).toBe(true);
  });

  it('edits owner contact information from the owner directory', async () => {
    document.cookie = 'XSRF-TOKEN=test-csrf-token; path=/';
    let owner = {
      id: 1,
      name: 'Maria Santos',
      email: 'maria@example.test',
      phone: '555-0100',
      address: 'Main Street',
      petCount: 2,
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({
          authenticated: true, email: 'staff@example.com', displayName: 'Clinic Staff', role: 'STAFF',
          passwordChangeRequired: false, registrationAvailable: false,
        });
      }
      if (url.endsWith('/api/dashboard')) return jsonResponse({
        petCount: 2,
        ownerCount: 1,
        appointmentCount: 0,
        pendingAppointmentCount: 0,
        confirmedAppointmentCount: 0,
        unpaidPaymentCount: 0,
        outstandingAmount: 0,
        paidAmount: 0,
      });
      if (url.endsWith('/api/owners/1') && init?.method === 'PUT') {
        owner = { ...owner, ...(JSON.parse(String(init.body)) as Omit<typeof owner, 'id' | 'petCount'>) };
        return jsonResponse(owner);
      }
      if (url.endsWith('/api/owners')) return jsonResponse([owner]);
      if (url.endsWith('/api/pets') || url.endsWith('/api/appointments') || url.endsWith('/api/appointment-staff') || url.endsWith('/api/payments') || url.endsWith('/api/inventory')
        || url.endsWith('/api/notifications')) return jsonResponse([]);
      if (url.endsWith('/api/auth/csrf')) return jsonResponse({ token: 'masked-token' });
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Owners' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '555-0199' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save owner' }));

    await waitFor(() => expect(screen.getByRole('table')).toHaveTextContent('555-0199'));
    const updateRequest = fetchMock.mock.calls.find(([url, init]) =>
      String(url).endsWith('/api/owners/1') && init?.method === 'PUT');
    expect(updateRequest).toBeDefined();
  });

  it('shows API errors instead of silently losing a failed request', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({
          authenticated: true, email: 'staff@example.com', displayName: 'Clinic Staff', role: 'STAFF',
          passwordChangeRequired: false, registrationAvailable: false,
        });
      }
      if (url.endsWith('/api/dashboard')) return jsonResponse({});
      if (url.endsWith('/api/pets')) return Promise.reject(new Error('Network unavailable'));
      if (url.endsWith('/api/appointments') || url.endsWith('/api/appointment-staff')) return jsonResponse([]);
      if (url.endsWith('/api/payments') || url.endsWith('/api/inventory')) return jsonResponse([]);
      return jsonResponse([]);
    });
    render(<App />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Network unavailable'));
  });
});
