export type Pet = {
  id: number;
  name: string;
  species: string;
  breed: string | null;
  ownerName: string;
  label: string;
  ownerId: number | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  ownerAddress: string | null;
  archived: boolean;
  birthDate: string | null;
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN' | null;
  color: string | null;
  microchipNumber: string | null;
  weightKg: number | null;
  allergies: string | null;
  medicalAlerts: string | null;
};

export type PetInput = {
  name: string;
  species: string;
  breed: string | null;
  ownerName: string;
  ownerId?: number | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  ownerAddress?: string | null;
  birthDate?: string | null;
  sex?: Pet['sex'];
  color?: string | null;
  microchipNumber?: string | null;
  weightKg?: number | null;
  allergies?: string | null;
  medicalAlerts?: string | null;
};

export type Owner = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  petCount: number;
};

export type Appointment = {
  id: number;
  petId: number;
  petLabel: string;
  appointmentTime: string;
  reason: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  staffId: number | null;
  staffName: string | null;
  durationMinutes: number;
  resource: string | null;
};

export type AppointmentStaff = {
  id: number;
  displayName: string;
  role: 'ADMIN' | 'STAFF';
};

export type MedicalRecord = {
  id: number;
  petId: number;
  diagnosis: string;
  treatment: string;
  notes: string | null;
  recordDate: string;
  weightKg: number | null;
  temperatureC: number | null;
  heartRateBpm: number | null;
  respiratoryRateBpm: number | null;
  medications: string | null;
  followUpDate: string | null;
};

export type Payment = {
  id: number;
  petId: number;
  petLabel: string;
  description: string;
  amount: number;
  status: 'UNPAID' | 'PAID';
  paymentMethod: string | null;
  paidAt: string | null;
  receiptNo: string | null;
  items: PaymentItem[];
};

export type PaymentItem = {
  id: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productId: number | null;
};

export type InventoryProduct = {
  id: number;
  sku: string;
  name: string;
  category: string | null;
  quantityOnHand: number;
  reorderLevel: number;
  unitPrice: number;
  active: boolean;
  lowStock: boolean;
};

export type Dashboard = {
  petCount: number;
  ownerCount: number;
  appointmentCount: number;
  pendingAppointmentCount: number;
  confirmedAppointmentCount: number;
  unpaidPaymentCount: number;
  outstandingAmount: number;
  paidAmount: number;
};

export type ClinicNotification = {
  type: string;
  title: string;
  message: string;
  timestamp: string;
};

export type AuthUser = {
  authenticated: boolean;
  email: string | null;
  displayName: string | null;
  role: 'ADMIN' | 'STAFF' | null;
  passwordChangeRequired: boolean;
  registrationAvailable: boolean;
};

export type StaffAccount = {
  id: number;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'STAFF';
  active: boolean;
  createdAt: string;
};

export type AuditEvent = {
  id: number;
  actor: string;
  method: string;
  requestPath: string;
  responseStatus: number;
  occurredAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? 'GET';
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    const csrf = await csrfToken();
    headers.set('X-CSRF-TOKEN', csrf);
  }

  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers,
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { message?: string; detail?: string };
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new Event('clinic:unauthorized'));
    }
    if (response.status === 403
      && error.message === 'Change your temporary password before continuing.') {
      window.dispatchEvent(new Event('clinic:password-change-required'));
    }
    throw new Error(error.message ?? error.detail ?? `Request failed (${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function csrfToken(): Promise<string> {
  const response = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Could not initialize secure request (${response.status}).`);
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('XSRF-TOKEN='));
  if (!cookie) throw new Error('The security token cookie was not set.');
  return decodeURIComponent(cookie.slice('XSRF-TOKEN='.length));
}

async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await fetch(path, { credentials: 'same-origin' });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { message?: string; detail?: string };
    if (response.status === 401) window.dispatchEvent(new Event('clinic:unauthorized'));
    if (response.status === 403
      && error.message === 'Change your temporary password before continuing.') {
      window.dispatchEvent(new Event('clinic:password-change-required'));
    }
    throw new Error(error.message ?? error.detail ?? `Request failed (${response.status})`);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  currentUser: () => request<AuthUser>('/api/auth/me'),
  register: (payload: { email: string; displayName: string; password: string }) =>
    request<AuthUser>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload: { email: string; password: string }) =>
    request<AuthUser>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    request<void>('/api/account/password', { method: 'PUT', body: JSON.stringify(payload) }),
  staff: () => request<StaffAccount[]>('/api/staff'),
  createStaff: (payload: { email: string; displayName: string }) =>
    request<{ staff: StaffAccount; temporaryPassword: string }>('/api/staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateStaff: (id: number, payload: { role: StaffAccount['role']; active: boolean }) =>
    request<StaffAccount>(`/api/staff/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  resetStaffPassword: (id: number) =>
    request<{ temporaryPassword: string }>(`/api/staff/${id}/password-reset`, { method: 'POST' }),
  audit: () => request<AuditEvent[]>('/api/audit'),
  downloadPaymentReport: (from: string, to: string) =>
    downloadFile(`/api/reports/payments.csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      `clinic-payments-${from}-to-${to}.csv`),
  dashboard: () => request<Dashboard>('/api/dashboard'),
  notifications: () => request<ClinicNotification[]>('/api/notifications'),
  pets: (includeArchived = false) =>
    request<Pet[]>(`/api/pets${includeArchived ? '?includeArchived=true' : ''}`),
  pet: (id: number) => request<Pet>(`/api/pets/${id}`),
  addPet: (payload: PetInput) =>
    request<Pet>('/api/pets', { method: 'POST', body: JSON.stringify(payload) }),
  updatePet: (id: number, payload: PetInput) =>
    request<Pet>(`/api/pets/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  archivePet: (id: number) =>
    request<Pet>(`/api/pets/${id}/archive`, { method: 'PATCH' }),
  restorePet: (id: number) =>
    request<Pet>(`/api/pets/${id}/restore`, { method: 'PATCH' }),
  owners: () => request<Owner[]>('/api/owners'),
  addOwner: (payload: Omit<Owner, 'id' | 'petCount'>) =>
    request<Owner>('/api/owners', { method: 'POST', body: JSON.stringify(payload) }),
  updateOwner: (id: number, payload: Omit<Owner, 'id' | 'petCount'>) =>
    request<Owner>(`/api/owners/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  appointments: () => request<Appointment[]>('/api/appointments'),
  appointmentStaff: () => request<AppointmentStaff[]>('/api/appointment-staff'),
  addAppointment: (payload: { petId: number; appointmentTime: string; reason: string;
    staffId?: number | null; durationMinutes?: number; resource?: string | null }) =>
    request<Appointment>('/api/appointments', { method: 'POST', body: JSON.stringify(payload) }),
  reschedule: (id: number, appointmentTime: string) =>
    request<Appointment>(`/api/appointments/${id}/reschedule`, {
      method: 'PUT',
      body: JSON.stringify({ appointmentTime }),
    }),
  confirmAppointment: (id: number) =>
    request<Appointment>(`/api/appointments/${id}/confirm`, { method: 'PATCH' }),
  cancelAppointment: (id: number) =>
    request<Appointment>(`/api/appointments/${id}/cancel`, { method: 'PATCH' }),
  records: (petId: number) => request<MedicalRecord[]>(`/api/pets/${petId}/records`),
  downloadMedicalRecordPdf: (petId: number, recordId: number) =>
    downloadFile(`/api/pets/${petId}/records/${recordId}/pdf`, `medical-record-${recordId}.pdf`),
  downloadMedicalHistoryPdf: (petId: number) =>
    downloadFile(`/api/pets/${petId}/records/pdf`, `medical-history-pet-${petId}.pdf`),
  addRecord: (petId: number, payload: Omit<MedicalRecord, 'id' | 'petId'>) =>
    request<MedicalRecord>(`/api/pets/${petId}/records`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRecord: (id: number, payload: Omit<MedicalRecord, 'id' | 'petId'>) =>
    request<MedicalRecord>(`/api/records/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  payments: () => request<Payment[]>('/api/payments'),
  addPayment: (payload: { petId: number; items: {
    description: string;
    quantity: number;
    unitPrice: number | null;
    productId: number | null;
  }[] }) =>
    request<Payment>('/api/payments', { method: 'POST', body: JSON.stringify(payload) }),
  inventory: () => request<InventoryProduct[]>('/api/inventory'),
  addInventoryProduct: (payload: Omit<InventoryProduct, 'id' | 'active' | 'lowStock'>) =>
    request<InventoryProduct>('/api/inventory', { method: 'POST', body: JSON.stringify(payload) }),
  updateInventoryProduct: (id: number, payload: Omit<InventoryProduct, 'id' | 'quantityOnHand' | 'lowStock'>) =>
    request<InventoryProduct>(`/api/inventory/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  adjustStock: (id: number, adjustment: number, reason: string) =>
    request<InventoryProduct>(`/api/inventory/${id}/adjustment`, {
      method: 'POST',
      body: JSON.stringify({ adjustment, reason }),
    }),
  pay: (id: number, method: string) =>
    request<Payment>(`/api/payments/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ method }),
    }),
  receipt: (id: number) => request<Payment>(`/api/payments/${id}/receipt`),
  downloadPaymentPdf: (payment: Pick<Payment, 'id' | 'status'>) =>
    downloadFile(`/api/payments/${payment.id}/pdf`,
      `${payment.status === 'PAID' ? 'receipt' : 'invoice'}-${payment.id}.pdf`),
};
