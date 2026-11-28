import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const jsonResponse = (data: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response);

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

describe('clinic portals and routing', () => {
  afterEach(() => {
    cleanup();
    document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
    vi.restoreAllMocks();
  });

  it('shows separate Staff/Admin and Customer/Pet Owner portals with real images on /login', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).endsWith('/api/auth/me')) {
        return jsonResponse({
          authenticated: false,
          email: null,
          displayName: null,
          role: null,
          ownerId: null,
          passwordChangeRequired: false,
          registrationAvailable: false,
        });
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });

    renderApp('/');
    expect(await screen.findByText('Welcome to Alpha Dawgs.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Customer Log in' })).toHaveAttribute('href', '/customer/login');
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/customer/register');
    expect(screen.getByRole('link', { name: 'Staff / Admin Log in' })).toHaveAttribute('href', '/staff/login');
    expect(screen.getByAltText(/Veterinarian caring for a dog and cat/i)).toHaveAttribute('src', '/images/clinic-hero.jpg');
    expect(screen.getAllByAltText('Alpha Dawgs Veterinary Clinic logo')[0]).toHaveAttribute('src', '/images/clinic-logo.jpg');
  });

  it('registers the first admin on /staff/login and sends the CSRF token', async () => {
    document.cookie = 'XSRF-TOKEN=test-csrf-token; path=/';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) return jsonResponse({
        authenticated: false, email: null, displayName: null, role: null, ownerId: null,
        passwordChangeRequired: false, registrationAvailable: true,
      });
      if (url.endsWith('/api/auth/csrf')) return jsonResponse({ token: 'masked-token' });
      if (url.endsWith('/api/auth/register')) {
        return jsonResponse({
          authenticated: true, email: 'staff@example.com', displayName: 'Clinic Staff', role: 'STAFF', ownerId: null,
          passwordChangeRequired: false, registrationAvailable: false,
        });
      }
      if (url.endsWith('/api/dashboard')) return jsonResponse({
        petCount: 0, ownerCount: 0, appointmentCount: 0, pendingAppointmentCount: 0,
        confirmedAppointmentCount: 0, unpaidPaymentCount: 0, outstandingAmount: 0, paidAmount: 0,
      });
      if (url.endsWith('/api/pets') || url.endsWith('/api/appointments') || url.endsWith('/api/appointment-staff')
        || url.endsWith('/api/payments') || url.endsWith('/api/inventory')
        || url.endsWith('/api/owners') || url.endsWith('/api/notifications')) {
        return jsonResponse([]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderApp('/staff/login');
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

  it('does not submit admin registration when password confirmation does not match', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).endsWith('/api/auth/me')) {
        return jsonResponse({
          authenticated: false, email: null, displayName: null, role: null, ownerId: null,
          passwordChangeRequired: false, registrationAvailable: true,
        });
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });

    renderApp('/staff/login');
    fireEvent.click(await screen.findByRole('button', { name: 'Create an account' }));
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Clinic Staff' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'staff@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'DifferentPass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.');
  });

  it('does not offer public staff registration after an admin exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).endsWith('/api/auth/me')) {
        return jsonResponse({
          authenticated: false, email: null, displayName: null, role: null, ownerId: null,
          passwordChangeRequired: false, registrationAvailable: false,
        });
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });

    renderApp('/staff/login');
    expect(await screen.findByText('Need a staff account? Contact a clinic administrator.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create an account' })).not.toBeInTheDocument();
  });

  it('places the forgot-password help under the password field on /staff/login', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).endsWith('/api/auth/me')) {
        return jsonResponse({
          authenticated: false, email: null, displayName: null, role: null, ownerId: null,
          passwordChangeRequired: false, registrationAvailable: true,
        });
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });

    renderApp('/staff/login');
    const password = await screen.findByLabelText('Password');
    const forgotPassword = screen.getByRole('button', { name: 'Forgot password?' });
    expect(password.compareDocumentPosition(forgotPassword) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(forgotPassword);
    expect(screen.getByRole('status')).toHaveTextContent('Contact a clinic administrator');
  });

  it('registers a customer on /customer/register and loads the Customer Portal', async () => {
    document.cookie = 'XSRF-TOKEN=test-csrf-token; path=/';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) return jsonResponse({
        authenticated: false, email: null, displayName: null, role: null, ownerId: null,
        passwordChangeRequired: false, registrationAvailable: false,
      });
      if (url.endsWith('/api/auth/csrf')) return jsonResponse({ token: 'masked-token' });
      if (url.endsWith('/api/auth/customer/register')) return jsonResponse({
        authenticated: true, email: 'elena@example.com', displayName: 'Elena Cruz', role: 'CUSTOMER', ownerId: 5,
        passwordChangeRequired: false, registrationAvailable: false,
      });
      if (url.endsWith('/api/portal/overview')) return jsonResponse({
        ownerId: 5, ownerName: 'Elena Cruz', email: 'elena@example.com', phone: '09171234567', address: 'Cebu',
        petCount: 1, upcomingAppointmentCount: 0, pendingAppointmentCount: 0,
        unpaidPaymentCount: 0, outstandingAmount: 0, paidAmount: 500,
      });
      if (url.endsWith('/api/portal/pets')) return jsonResponse([{
        id: 11, name: 'Milo', species: 'Dog', breed: 'Beagle', ownerName: 'Elena Cruz',
        label: 'Milo (Elena Cruz)', ownerId: 5, ownerEmail: 'elena@example.com', ownerPhone: '09171234567',
        ownerAddress: 'Cebu', archived: false, birthDate: null, sex: 'MALE', color: null,
        microchipNumber: null, weightKg: 9.5, allergies: null, medicalAlerts: null,
      }]);
      if (url.endsWith('/api/portal/appointments') || url.endsWith('/api/portal/staff')
        || url.endsWith('/api/portal/payments') || url.endsWith('/api/portal/pets/11/records')) {
        return jsonResponse([]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderApp('/customer/register');
    fireEvent.change(await screen.findByLabelText('Full name'), { target: { value: 'Elena Cruz' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'elena@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'CustomerPass123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'CustomerPass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create customer account' }));

    expect(await screen.findByText('Welcome back, Elena Cruz.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/auth/customer/register'))).toBe(true);

    fireEvent.click(screen.getByRole('link', { name: 'My pets' }));
    expect(await screen.findByText('Milo')).toBeInTheDocument();
    expect(screen.getByAltText('Milo (Dog)')).toHaveAttribute('src', '/images/pet-dog.jpg');
  });

  it('guides a new customer with no pets to add a pet and book an appointment', async () => {
    document.cookie = 'XSRF-TOKEN=test-csrf-token; path=/';
    let petsList: Array<Record<string, unknown>> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) return jsonResponse({
        authenticated: true, email: 'new@example.com', displayName: 'New Owner', role: 'CUSTOMER', ownerId: 9,
        passwordChangeRequired: false, registrationAvailable: false,
      });
      if (url.endsWith('/api/auth/csrf')) return jsonResponse({ token: 'masked-token' });
      if (url.endsWith('/api/portal/overview')) return jsonResponse({
        ownerId: 9, ownerName: 'New Owner', email: 'new@example.com', phone: null, address: null,
        petCount: petsList.length, upcomingAppointmentCount: 0, pendingAppointmentCount: 0,
        unpaidPaymentCount: 0, outstandingAmount: 0, paidAmount: 0,
      });
      if (url.endsWith('/api/portal/pets') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { name: string; species: string };
        const created = {
          id: 21, name: body.name, species: body.species, breed: null, ownerName: 'New Owner',
          label: `${body.name} (New Owner)`, ownerId: 9, ownerEmail: 'new@example.com',
          ownerPhone: null, ownerAddress: null, archived: false, birthDate: null, sex: null,
          color: null, microchipNumber: null, weightKg: null, allergies: null, medicalAlerts: null,
        };
        petsList = [created];
        return jsonResponse(created);
      }
      if (url.endsWith('/api/portal/pets')) return jsonResponse(petsList);
      if (url.endsWith('/api/portal/appointments') || url.endsWith('/api/portal/staff')
        || url.endsWith('/api/portal/payments') || url.endsWith('/api/portal/pets/21/records')) {
        return jsonResponse([]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderApp('/portal/appointments');
    expect(await screen.findByText('Step 1: Add your pet to book an appointment')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Pet name'), { target: { value: 'Buddy' } });
    fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'Dog' } });
    fireEvent.click(screen.getByRole('button', { name: /Save pet/i }));

    expect(await screen.findByText('Book a clinic visit')).toBeInTheDocument();
  });

  it('loads staff totals, routed navigation links, and real pet avatars', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({
          authenticated: true, email: 'staff@example.com', displayName: 'Clinic Staff', role: 'STAFF', ownerId: null,
          passwordChangeRequired: false, registrationAvailable: false,
        });
      }
      if (url.endsWith('/api/dashboard')) {
        return jsonResponse({
          petCount: 2, ownerCount: 2, appointmentCount: 2, pendingAppointmentCount: 1,
          confirmedAppointmentCount: 1, unpaidPaymentCount: 1, outstandingAmount: 50, paidAmount: 0,
        });
      }
      if (url.endsWith('/api/pets')) {
        return jsonResponse([
          {
            id: 1, name: 'Bantay', species: 'Dog', breed: 'Aspin', ownerName: 'Maria Santos',
            label: 'Bantay (Maria Santos)', ownerId: 1, ownerEmail: 'maria@example.com', ownerPhone: '555-0100',
            ownerAddress: 'Cebu', archived: false, birthDate: null, sex: null, color: null,
            microchipNumber: null, weightKg: null, allergies: null, medicalAlerts: null,
          },
          {
            id: 2, name: 'Mingming', species: 'Cat', breed: 'Puspin', ownerName: 'Juan Dela Cruz',
            label: 'Mingming (Juan Dela Cruz)', ownerId: 2, ownerEmail: null, ownerPhone: null,
            ownerAddress: null, archived: false, birthDate: null, sex: null, color: null,
            microchipNumber: null, weightKg: null, allergies: null, medicalAlerts: null,
          },
        ]);
      }
      if (url.endsWith('/api/appointments') || url.endsWith('/api/appointment-staff') || url.endsWith('/api/payments')
        || url.endsWith('/api/inventory') || url.endsWith('/api/owners') || url.endsWith('/api/notifications')) {
        return jsonResponse([]);
      }
      if (url.endsWith('/api/pets/1/records')) return jsonResponse([]);
      throw new Error(`Unexpected request: ${url}`);
    });

    renderApp('/staff/overview');

    expect(await screen.findByText('Appointments to confirm')).toBeInTheDocument();
    expect(screen.getByText('Payments to collect')).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(navigation.querySelectorAll('a.nav-item')).toHaveLength(8);
    expect(navigation.querySelector('svg[data-icon="appointments"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Pets' }));
    expect(await screen.findByText('Bantay')).toBeInTheDocument();
    expect(screen.getByAltText('Bantay (Dog)')).toHaveAttribute('src', '/images/pet-dog.jpg');
    expect(screen.getByAltText('Mingming (Cat)')).toHaveAttribute('src', '/images/pet-cat.jpg');
  });

  it('shows stock levels and low-stock warnings in inventory via React Router', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) return jsonResponse({
        authenticated: true, email: 'staff@example.com', displayName: 'Clinic Staff', role: 'STAFF', ownerId: null,
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

    renderApp('/staff/overview');
    fireEvent.click(await screen.findByRole('link', { name: 'Inventory' }));

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
          authenticated: true, email: 'admin@example.com', displayName: 'Clinic Admin', role: 'ADMIN', ownerId: null,
          passwordChangeRequired: false, registrationAvailable: false,
        });
      }
      if (url.endsWith('/api/dashboard')) return jsonResponse({
        petCount: 0, ownerCount: 0, appointmentCount: 0, pendingAppointmentCount: 0,
        confirmedAppointmentCount: 0, unpaidPaymentCount: 0, outstandingAmount: 0, paidAmount: 0,
      });
      if (url.endsWith('/api/auth/csrf')) return jsonResponse({ token: 'masked-token' });
      if (url.endsWith('/api/staff')) return jsonResponse([{
        id: 2, email: 'staff@example.com', displayName: 'Clinic Staff', role: 'STAFF',
        active: true, createdAt: '2026-01-01T00:00:00',
      }]);
      if (url.endsWith('/api/audit')) return jsonResponse([{
        id: 1, actor: 'admin@example.com', method: 'POST',
        requestPath: '/api/pets', responseStatus: 201, occurredAt: '2026-01-01T12:00:00',
      }]);
      if (url.endsWith('/api/staff/2/password-reset')) {
        return jsonResponse({ temporaryPassword: 'one-time-password' });
      }
      if (url.endsWith('/api/pets') || url.endsWith('/api/appointments') || url.endsWith('/api/appointment-staff')
        || url.endsWith('/api/payments') || url.endsWith('/api/inventory')
        || url.endsWith('/api/owners') || url.endsWith('/api/notifications')) {
        return jsonResponse([]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderApp('/staff/overview');
    fireEvent.click(await screen.findByRole('link', { name: 'Account & staff' }));
    expect(await screen.findByText('Recent activity')).toBeInTheDocument();
    expect(screen.getByText('/api/pets')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Reset password' }));

    expect(await screen.findByText('one-time-password')).toBeInTheDocument();
    expect(screen.getByText(/must be changed after sign-in/)).toBeInTheDocument();
  });

  it('opens an existing pet profile and edits the owner name', async () => {
    document.cookie = 'XSRF-TOKEN=test-csrf-token; path=/';
    let pet = {
      id: 1, name: 'Bantay', species: 'Dog', breed: 'Aspin', ownerName: 'Maria Santos',
      label: 'Bantay (Maria Santos)', ownerId: 1, ownerEmail: 'maria@example.com', ownerPhone: '555-0100',
      ownerAddress: 'Cebu', archived: false, birthDate: null, sex: null, color: null,
      microchipNumber: null, weightKg: null, allergies: null, medicalAlerts: null,
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({
          authenticated: true, email: 'staff@example.com', displayName: 'Clinic Staff', role: 'STAFF', ownerId: null,
          passwordChangeRequired: false, registrationAvailable: false,
        });
      }
      if (url.endsWith('/api/dashboard')) return jsonResponse({
        petCount: 1, ownerCount: 1, appointmentCount: 0, pendingAppointmentCount: 0,
        confirmedAppointmentCount: 0, unpaidPaymentCount: 0, outstandingAmount: 0, paidAmount: 0,
      });
      if (url.endsWith('/api/pets/1') && init?.method === 'PUT') {
        const payload = JSON.parse(String(init.body)) as Omit<typeof pet, 'id' | 'label'>;
        pet = { ...payload, id: 1, label: `${payload.name} (${payload.ownerName})` };
        return jsonResponse(pet);
      }
      if (url.endsWith('/api/pets/1')) return jsonResponse(pet);
      if (url.endsWith('/api/pets')) return jsonResponse([pet]);
      if (url.endsWith('/api/appointments') || url.endsWith('/api/appointment-staff') || url.endsWith('/api/payments')
        || url.endsWith('/api/inventory') || url.endsWith('/api/owners') || url.endsWith('/api/notifications')) {
        return jsonResponse([]);
      }
      if (url.endsWith('/api/pets/1/records')) return jsonResponse([]);
      if (url.endsWith('/api/auth/csrf')) return jsonResponse({ token: 'masked-token' });
      throw new Error(`Unexpected request: ${url}`);
    });

    renderApp('/staff/pets');
    fireEvent.click(await screen.findByRole('button', { name: 'View pet & owner details' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent('Maria Santos');
    expect(screen.getByRole('dialog')).toHaveTextContent('maria@example.com');
    expect(screen.getByRole('dialog')).toHaveTextContent('Aspin');
    fireEvent.click(screen.getByRole('button', { name: 'Edit pet & owner' }));
    fireEvent.change(screen.getByLabelText('Owner name'), { target: { value: 'Ana Reyes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('Ana Reyes'));
    const updateRequest = fetchMock.mock.calls.find(([url, init]) =>
      String(url).endsWith('/api/pets/1') && init?.method === 'PUT');
    expect(updateRequest).toBeDefined();
  });

  it('shows API errors instead of silently losing a failed request', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({
          authenticated: true, email: 'staff@example.com', displayName: 'Clinic Staff', role: 'STAFF', ownerId: null,
          passwordChangeRequired: false, registrationAvailable: false,
        });
      }
      if (url.endsWith('/api/dashboard')) return jsonResponse({});
      if (url.endsWith('/api/pets')) return Promise.reject(new Error('Network unavailable'));
      return jsonResponse([]);
    });

    renderApp('/staff/overview');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Network unavailable'));
  });
});
