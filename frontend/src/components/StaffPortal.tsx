import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  api,
  type Appointment,
  type AppointmentStaff,
  type AuditEvent,
  type AuthUser,
  type ClinicNotification,
  type Dashboard,
  type InventoryProduct,
  type MedicalRecord,
  type Owner,
  type Payment,
  type Pet,
  type StaffAccount,
} from '../api';
import {
  BrandLogo,
  CLINIC_HERO_IMG,
  ClinicIcon,
  EmptyState,
  Field,
  FormActions,
  PageHeading,
  PasswordField,
  PetAvatar,
  ReceiptModal,
  StatCard,
  StatusBadge,
  formatDateTime,
  localDateTime,
  money,
  optionalNumber,
  petSex,
  today,
  type ClinicIconName,
} from './ClinicUi';

const staffNavigation: { path: string; label: string; icon: ClinicIconName; adminOnly?: boolean }[] = [
  { path: '/staff/overview', label: 'Overview', icon: 'overview' },
  { path: '/staff/pets', label: 'Pets', icon: 'paw' },
  { path: '/staff/owners', label: 'Owners', icon: 'owners' },
  { path: '/staff/appointments', label: 'Appointments', icon: 'appointments' },
  { path: '/staff/records', label: 'Medical records', icon: 'records' },
  { path: '/staff/payments', label: 'Payments', icon: 'payments' },
  { path: '/staff/inventory', label: 'Inventory', icon: 'inventory' },
  { path: '/staff/settings', label: 'Account & staff', icon: 'settings' },
];

const emptyDashboard: Dashboard = {
  petCount: 0,
  ownerCount: 0,
  appointmentCount: 0,
  pendingAppointmentCount: 0,
  confirmedAppointmentCount: 0,
  unpaidPaymentCount: 0,
  outstandingAmount: 0,
  paidAmount: 0,
};

export function StaffPortal({
  user,
  onSignOut,
}: {
  user: AuthUser;
  onSignOut: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [pets, setPets] = useState<Pet[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentStaff, setAppointmentStaff] = useState<AppointmentStaff[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [inventory, setInventory] = useState<InventoryProduct[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [notifications, setNotifications] = useState<ClinicNotification[]>([]);
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [reportFrom, setReportFrom] = useState(`${today().slice(0, 7)}-01`);
  const [reportTo, setReportTo] = useState(today());
  const [selectedPetId, setSelectedPetId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [petFormOpen, setPetFormOpen] = useState(false);
  const [appointmentFormOpen, setAppointmentFormOpen] = useState(false);
  const [recordFormOpen, setRecordFormOpen] = useState(false);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [inventoryFormOpen, setInventoryFormOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<InventoryProduct | null>(null);
  const [stockAdjustmentItem, setStockAdjustmentItem] = useState<InventoryProduct | null>(null);
  const [stockAdjustment, setStockAdjustment] = useState('1');
  const [stockAdjustmentReason, setStockAdjustmentReason] = useState('');
  const [viewingPet, setViewingPet] = useState<Pet | null>(null);
  const [editingPet, setEditingPet] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [rescheduling, setRescheduling] = useState<number | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState(localDateTime());
  const [showArchivedPets, setShowArchivedPets] = useState(false);
  const [petSearch, setPetSearch] = useState('');
  const [appointmentSearch, setAppointmentSearch] = useState('');
  const [appointmentFilter, setAppointmentFilter] = useState('ALL');
  const [recordSearch, setRecordSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [paymentMethods, setPaymentMethods] = useState<Record<number, string>>({});
  const [ownerFormOpen, setOwnerFormOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [newPetOwner, setNewPetOwner] = useState('');
  const [staffDrafts, setStaffDrafts] = useState<Record<number, { role: StaffAccount['role']; active: boolean }>>({});
  const [resettingStaffId, setResettingStaffId] = useState<number | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<{ displayName: string; value: string } | null>(null);

  const loadRecords = useCallback(async (petId: number | '') => {
    if (!petId) {
      setRecords([]);
      return;
    }
    try {
      setRecords(await api.records(petId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load medical records.');
    }
  }, []);

  const refresh = useCallback(async () => {
    setError('');
    setLoading(true);
    const results = await Promise.allSettled([
      api.dashboard(),
      api.pets(showArchivedPets),
      api.appointments(),
      api.appointmentStaff(),
      api.payments(),
      api.inventory(),
      api.owners(),
      api.notifications(),
    ]);
    const [dashboardResult, petsResult, appointmentResult, appointmentStaffResult,
      paymentResult, inventoryResult, ownersResult, notificationsResult] = results;
    if (dashboardResult.status === 'fulfilled') setDashboard(dashboardResult.value);
    if (petsResult.status === 'fulfilled') {
      setPets(petsResult.value);
      setSelectedPetId((current) => {
        const stillValid = petsResult.value.some((pet) => pet.id === current && !pet.archived);
        return stillValid ? current : (petsResult.value.find((pet) => !pet.archived)?.id ?? '');
      });
    }
    if (appointmentResult.status === 'fulfilled') setAppointments(appointmentResult.value);
    if (appointmentStaffResult.status === 'fulfilled') setAppointmentStaff(appointmentStaffResult.value);
    if (paymentResult.status === 'fulfilled') setPayments(paymentResult.value);
    if (inventoryResult.status === 'fulfilled') setInventory(inventoryResult.value);
    if (ownersResult.status === 'fulfilled') setOwners(ownersResult.value);
    if (notificationsResult.status === 'fulfilled') setNotifications(notificationsResult.value);

    const staffResult = user.role === 'ADMIN'
      ? await Promise.allSettled([api.staff(), api.audit()])
      : null;
    if (staffResult?.[0].status === 'fulfilled') setStaff(staffResult[0].value);
    if (staffResult?.[1].status === 'fulfilled') setAuditEvents(staffResult[1].value);
    const failed = [...results, ...(staffResult ?? [])].find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') {
      setError(failed.reason instanceof Error ? failed.reason.message : 'Could not load clinic data.');
    }
    setLoading(false);
  }, [showArchivedPets, user.role]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void loadRecords(selectedPetId);
  }, [selectedPetId, loadRecords]);

  useEffect(() => {
    setError('');
    setNotice('');
  }, [location.pathname]);

  const selectedPet = useMemo(
    () => pets.find((pet) => pet.id === selectedPetId && !pet.archived),
    [pets, selectedPetId],
  );
  const activePets = useMemo(() => pets.filter((pet) => !pet.archived), [pets]);
  const currentNav = staffNavigation.find((item) => location.pathname.startsWith(item.path)) ?? staffNavigation[0];

  async function perform(action: () => Promise<unknown>, successMessage: string): Promise<boolean> {
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
      await refresh();
      if (selectedPetId) await loadRecords(selectedPetId);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The request could not be completed.');
      return false;
    }
  }

  async function resetStaffPassword(member: StaffAccount) {
    if (!window.confirm(`Reset the password for ${member.displayName}? They will need to change it after signing in.`)) return;
    setResettingStaffId(member.id);
    setError('');
    setNotice('');
    setTemporaryPassword(null);
    try {
      const result = await api.resetStaffPassword(member.id);
      setTemporaryPassword({ displayName: member.displayName, value: result.temporaryPassword });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not reset the password.');
    } finally {
      setResettingStaffId(null);
    }
  }

  async function exportPaymentReport() {
    setError('');
    setNotice('');
    try {
      await api.downloadPaymentReport(reportFrom, reportTo);
      setNotice('Payment report downloaded.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not download the payment report.');
    }
  }

  async function createStaffAccount(email: string, displayName: string): Promise<boolean> {
    setAccountBusy(true);
    setError('');
    setNotice('');
    setTemporaryPassword(null);
    try {
      const created = await api.createStaff({ email, displayName });
      setTemporaryPassword({ displayName: created.staff.displayName, value: created.temporaryPassword });
      setNotice(`Account created for ${created.staff.displayName}.`);
      await refresh();
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create the staff account.');
      return false;
    } finally {
      setAccountBusy(false);
    }
  }

  async function downloadDocument(action: () => Promise<void>, successMessage: string) {
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not download the PDF.');
    }
  }

  function renderOverview() {
    const upcoming = appointments
      .filter((appointment) => appointment.status !== 'CANCELLED'
        && new Date(appointment.appointmentTime).getTime() >= Date.now())
      .slice(0, 4);
    return (
      <>
        <section className="welcome-card welcome-card-with-photo">
          <div className="welcome-copy">
            <span className="eyebrow">ALPHA DAWGS VETERINARY CLINIC</span>
            <h2>Good care starts here.</h2>
            <p>Your clinic at a glance. Keep every visit, record, and payment in good order.</p>
          </div>
          <div className="welcome-photo-frame">
            <img src={CLINIC_HERO_IMG} alt="Alpha Dawgs veterinarian caring for a dog and cat" />
          </div>
        </section>
        <div className="stat-grid">
          <StatCard label="Registered pets" value={dashboard.petCount} icon="paw" />
          <StatCard label="Registered owners" value={dashboard.ownerCount} icon="owners" />
          <StatCard label="Appointments to confirm" value={dashboard.pendingAppointmentCount} icon="clock" />
          <StatCard label="Payments to collect" value={dashboard.unpaidPaymentCount} icon="payments" />
        </div>
        <div className="stat-grid">
          <StatCard label="Confirmed appointments" value={dashboard.confirmedAppointmentCount} icon="check" />
          <StatCard label="Total appointments" value={dashboard.appointmentCount} icon="appointments" />
          <StatCard label="Outstanding balance" value={money(dashboard.outstandingAmount)} icon="payments" />
          <StatCard label="Payments collected" value={money(dashboard.paidAmount)} icon="payments" />
        </div>
        <section className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">YOUR SCHEDULE</span><h3>Upcoming appointments</h3></div>
            <Link className="button button-light" to="/staff/appointments">View schedule</Link>
          </div>
          {upcoming.length ? (
            <div className="appointment-preview">
              {upcoming.map((appointment) => (
                <div className="preview-row" key={appointment.id}>
                  <div className="date-tile">
                    <strong>{new Date(appointment.appointmentTime).getDate()}</strong>
                    <span>{new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(appointment.appointmentTime))}</span>
                  </div>
                  <div className="preview-info"><strong>{appointment.petLabel}</strong><span>{appointment.reason}</span></div>
                  <span className="muted">{formatDateTime(appointment.appointmentTime)}</span>
                  <StatusBadge status={appointment.status} />
                </div>
              ))}
            </div>
          ) : <EmptyState message="No appointments yet. Book a visit to get started." />}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">IN-APP REMINDERS</span><h3>Needs your attention</h3></div>
            <span className="count-pill">{notifications.length} reminders</span>
          </div>
          {notifications.length ? (
            <div className="reminder-list">
              {notifications.slice(0, 8).map((notification, index) => (
                <article className="reminder-row" key={`${notification.type}-${notification.timestamp}-${index}`}>
                  <span className="reminder-dot" />
                  <div><strong>{notification.title}</strong><p>{notification.message}</p></div>
                  <span className="reminder-type">{notification.type.startsWith('appointment') ? 'Appointment' : 'Billing'}</span>
                </article>
              ))}
            </div>
          ) : <EmptyState message="No appointment or billing reminders right now." />}
        </section>
      </>
    );
  }

  function renderPets() {
    const visiblePets = pets.filter((pet) => pet.archived === showArchivedPets
      && `${pet.name} ${pet.species} ${pet.breed ?? ''} ${pet.ownerName}`.toLowerCase().includes(petSearch.toLowerCase()));
    return (
      <>
        <PageHeading title="Your pets" subtitle="A little profile for every member of the family." action={
          <button className="button button-primary" onClick={() => setPetFormOpen(!petFormOpen)}><ClinicIcon name="plus" size={16} />Add a pet</button>
        } />
        {petFormOpen && (
          <form className="form-panel" onSubmit={async (event) => {
            event.preventDefault();
            const formElement = event.currentTarget;
            const form = new FormData(formElement);
            const ok = await perform(() => api.addPet({
              name: String(form.get('name')).trim(),
              species: String(form.get('species')).trim(),
              breed: String(form.get('breed')).trim() || null,
              ownerName: owners.find((owner) => owner.id === Number(form.get('ownerId')))?.name
                ?? String(form.get('ownerName')).trim(),
              ownerId: Number(form.get('ownerId')) || null,
              ownerEmail: String(form.get('ownerEmail') ?? '').trim() || null,
              ownerPhone: String(form.get('ownerPhone') ?? '').trim() || null,
              ownerAddress: String(form.get('ownerAddress') ?? '').trim() || null,
              birthDate: String(form.get('birthDate') ?? '').trim() || null,
              sex: petSex(form.get('sex')),
              color: String(form.get('color') ?? '').trim() || null,
              microchipNumber: String(form.get('microchipNumber') ?? '').trim() || null,
              weightKg: optionalNumber(form.get('weightKg')),
              allergies: String(form.get('allergies') ?? '').trim() || null,
              medicalAlerts: String(form.get('medicalAlerts') ?? '').trim() || null,
            }), 'Pet profile added.');
            if (ok) {
              formElement.reset();
              setNewPetOwner('');
              setPetFormOpen(false);
            }
          }}>
            <h3>New pet profile</h3>
            <div className="form-grid">
              <Field label="Pet name"><input name="name" required maxLength={120} placeholder="e.g. Bantay" /></Field>
              <Field label="Species"><input name="species" required maxLength={80} placeholder="Dog, cat, rabbit..." /></Field>
              <Field label="Breed"><input name="breed" maxLength={120} placeholder="Optional" /></Field>
              <Field label="Date of birth"><input name="birthDate" type="date" max={today()} /></Field>
              <Field label="Sex"><select name="sex" defaultValue=""><option value="">Not recorded</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="UNKNOWN">Unknown</option></select></Field>
              <Field label="Color / markings"><input name="color" maxLength={80} /></Field>
              <Field label="Microchip number"><input name="microchipNumber" maxLength={80} /></Field>
              <Field label="Current weight (kg)"><input name="weightKg" type="number" min="0.01" max="9999.99" step="0.01" /></Field>
              <Field label="Allergies"><input name="allergies" maxLength={1000} placeholder="Optional" /></Field>
              <Field label="Medical alerts"><input name="medicalAlerts" maxLength={1000} placeholder="Optional" /></Field>
              <Field label="Existing owner">
                <select name="ownerId" value={newPetOwner} onChange={(event) => setNewPetOwner(event.target.value)}>
                  <option value="">Create a new owner</option>
                  {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} · {owner.petCount} pets</option>)}
                </select>
              </Field>
              {!newPetOwner && <>
                <Field label="Owner name"><input name="ownerName" required maxLength={120} placeholder="Pet owner's name" /></Field>
                <Field label="Owner email"><input name="ownerEmail" type="email" maxLength={254} placeholder="Optional (links customer portal)" /></Field>
                <Field label="Phone"><input name="ownerPhone" maxLength={32} placeholder="Optional" /></Field>
                <Field label="Address"><input name="ownerAddress" maxLength={500} placeholder="Optional" /></Field>
              </>}
            </div>
            <FormActions onCancel={() => setPetFormOpen(false)} submit="Save pet" />
          </form>
        )}
        <section className="panel pet-selector">
          <label htmlFor="pet-search">Search pets</label>
          <input id="pet-search" value={petSearch} onChange={(event) => setPetSearch(event.target.value)} placeholder="Name, species, breed, or owner" />
          <label className="checkbox-field"><input type="checkbox" checked={showArchivedPets} onChange={(event) => setShowArchivedPets(event.target.checked)} /> Show archived</label>
          <span className="count-pill">{visiblePets.length} {showArchivedPets ? 'archived' : 'active'}</span>
        </section>
        <section className="pet-grid">
          {visiblePets.map((pet) => (
            <article className="pet-card" key={pet.id}>
              <PetAvatar species={pet.species} name={pet.name} />
              <div className="pet-card-body">
                <span className="eyebrow">{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</span>
                <h3>{pet.name}</h3>
                <p>Beloved by {pet.ownerName}</p>
                <button className="text-button pet-details-button" onClick={async () => {
                  setError('');
                  try {
                    setViewingPet(await api.pet(pet.id));
                    setEditingPet(false);
                  } catch (requestError) {
                    setError(requestError instanceof Error ? requestError.message : 'Could not load pet details.');
                  }
                }}>View pet &amp; owner details</button>
                <button className="text-button" onClick={() => {
                  setSelectedPetId(pet.id);
                  navigate('/staff/records');
                }}>View medical records <ClinicIcon name="arrow" size={15} /></button>
                {pet.archived
                  ? <button className="small-button positive" onClick={() => void perform(() => api.restorePet(pet.id), 'Pet profile restored.')}>Restore pet</button>
                  : <button className="small-button danger" onClick={() => void perform(() => api.archivePet(pet.id), 'Pet profile archived.')}>Archive pet</button>}
              </div>
            </article>
          ))}
          {!visiblePets.length && !loading && <EmptyState message={pets.length ? 'No pets match the current search and archive filter.' : 'No pets registered yet. Add your first pet profile.'} />}
        </section>
        {viewingPet && (
          <div className="modal-backdrop" role="presentation" onClick={() => {
            setViewingPet(null);
            setEditingPet(false);
          }}>
            <section className="pet-details-card" role="dialog" aria-modal="true" aria-labelledby="pet-details-title" onClick={(event) => event.stopPropagation()}>
              <button className="modal-close" aria-label="Close pet details" onClick={() => {
                setViewingPet(null);
                setEditingPet(false);
              }}><ClinicIcon name="close" size={18} /></button>
              {!editingPet ? (
                <>
                  <div className="pet-modal-head">
                    <PetAvatar species={viewingPet.species} name={viewingPet.name} size={60} />
                    <div>
                      <span className="eyebrow">PET PROFILE · #{viewingPet.id}</span>
                      <h2 id="pet-details-title">{viewingPet.name}</h2>
                    </div>
                  </div>
                  <div className="pet-detail-grid">
                    <div><span>Species</span><strong>{viewingPet.species}</strong></div>
                    <div><span>Breed</span><strong>{viewingPet.breed || 'Not provided'}</strong></div>
                    <div><span>Date of birth</span><strong>{viewingPet.birthDate || 'Not recorded'}</strong></div>
                    <div><span>Sex</span><strong>{viewingPet.sex || 'Not recorded'}</strong></div>
                    <div><span>Color / markings</span><strong>{viewingPet.color || 'Not recorded'}</strong></div>
                    <div><span>Microchip</span><strong>{viewingPet.microchipNumber || 'Not recorded'}</strong></div>
                    <div><span>Current weight</span><strong>{viewingPet.weightKg == null ? 'Not recorded' : `${viewingPet.weightKg} kg`}</strong></div>
                    <div><span>Allergies</span><strong>{viewingPet.allergies || 'None recorded'}</strong></div>
                    <div><span>Medical alerts</span><strong>{viewingPet.medicalAlerts || 'None recorded'}</strong></div>
                    <div><span>Owner</span><strong>{viewingPet.ownerName}</strong></div>
                    <div><span>Owner email</span><strong>{viewingPet.ownerEmail || 'Not provided'}</strong></div>
                    <div><span>Owner phone</span><strong>{viewingPet.ownerPhone || 'Not provided'}</strong></div>
                    <div><span>Owner address</span><strong>{viewingPet.ownerAddress || 'Not provided'}</strong></div>
                  </div>
                  <div className="form-actions">
                    <button className="button button-light" disabled={viewingPet.archived} onClick={() => {
                      setSelectedPetId(viewingPet.id);
                      setViewingPet(null);
                      navigate('/staff/records');
                    }}>View medical records</button>
                    <button className="button button-primary" onClick={() => setEditingPet(true)}>Edit pet &amp; owner</button>
                  </div>
                </>
              ) : (
                <>
                  <span className="eyebrow">UPDATE PET PROFILE</span>
                  <h2 id="pet-details-title">Edit {viewingPet.name}</h2>
                  <form className="auth-form" onSubmit={async (event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    setError('');
                    setNotice('');
                    try {
                      const ownerId = Number(form.get('ownerId')) || null;
                      const selectedOwner = owners.find((owner) => owner.id === ownerId);
                      const updatedPet = await api.updatePet(viewingPet.id, {
                        name: String(form.get('name')).trim(),
                        species: String(form.get('species')).trim(),
                        breed: String(form.get('breed')).trim() || null,
                        ownerName: selectedOwner?.name ?? String(form.get('ownerName')).trim(),
                        ownerId,
                        ownerEmail: String(form.get('ownerEmail')).trim() || null,
                        ownerPhone: String(form.get('ownerPhone')).trim() || null,
                        ownerAddress: String(form.get('ownerAddress')).trim() || null,
                        birthDate: String(form.get('birthDate') ?? '').trim() || null,
                        sex: petSex(form.get('sex')),
                        color: String(form.get('color') ?? '').trim() || null,
                        microchipNumber: String(form.get('microchipNumber') ?? '').trim() || null,
                        weightKg: optionalNumber(form.get('weightKg')),
                        allergies: String(form.get('allergies') ?? '').trim() || null,
                        medicalAlerts: String(form.get('medicalAlerts') ?? '').trim() || null,
                      });
                      setViewingPet(updatedPet);
                      setEditingPet(false);
                      setNotice('Pet and owner information updated.');
                      await refresh();
                    } catch (requestError) {
                      setError(requestError instanceof Error ? requestError.message : 'Could not update pet details.');
                    }
                  }}>
                    <Field label="Pet name"><input name="name" required maxLength={120} defaultValue={viewingPet.name} /></Field>
                    <Field label="Species"><input name="species" required maxLength={80} defaultValue={viewingPet.species} /></Field>
                    <Field label="Breed"><input name="breed" maxLength={120} defaultValue={viewingPet.breed ?? ''} /></Field>
                    <Field label="Date of birth"><input name="birthDate" type="date" max={today()} defaultValue={viewingPet.birthDate ?? ''} /></Field>
                    <Field label="Sex"><select name="sex" defaultValue={viewingPet.sex ?? ''}><option value="">Not recorded</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="UNKNOWN">Unknown</option></select></Field>
                    <Field label="Color / markings"><input name="color" maxLength={80} defaultValue={viewingPet.color ?? ''} /></Field>
                    <Field label="Microchip number"><input name="microchipNumber" maxLength={80} defaultValue={viewingPet.microchipNumber ?? ''} /></Field>
                    <Field label="Current weight (kg)"><input name="weightKg" type="number" min="0.01" max="9999.99" step="0.01" defaultValue={viewingPet.weightKg ?? ''} /></Field>
                    <Field label="Allergies"><input name="allergies" maxLength={1000} defaultValue={viewingPet.allergies ?? ''} /></Field>
                    <Field label="Medical alerts"><input name="medicalAlerts" maxLength={1000} defaultValue={viewingPet.medicalAlerts ?? ''} /></Field>
                    <Field label="Link to another owner">
                      <select name="ownerId" defaultValue="">
                        <option value="">Keep current owner</option>
                        {owners.filter((owner) => owner.id !== viewingPet.ownerId).map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Owner name"><input name="ownerName" required maxLength={120} defaultValue={viewingPet.ownerName} /></Field>
                    <Field label="Owner email"><input name="ownerEmail" type="email" maxLength={254} defaultValue={viewingPet.ownerEmail ?? ''} /></Field>
                    <Field label="Phone"><input name="ownerPhone" maxLength={32} defaultValue={viewingPet.ownerPhone ?? ''} /></Field>
                    <Field label="Address"><input name="ownerAddress" maxLength={500} defaultValue={viewingPet.ownerAddress ?? ''} /></Field>
                    <FormActions onCancel={() => setEditingPet(false)} submit="Save changes" />
                  </form>
                </>
              )}
            </section>
          </div>
        )}
      </>
    );
  }

  function renderOwners() {
    return (
      <>
        <PageHeading title="Pet owners" subtitle="Maintain owner contact details and see their linked pets." action={
          <button className="button button-primary" onClick={() => {
            setEditingOwner(null);
            setOwnerFormOpen(!ownerFormOpen);
          }}><ClinicIcon name="plus" size={16} />Add owner</button>
        } />
        {ownerFormOpen && (
          <form key={editingOwner?.id ?? 'new-owner'} className="form-panel" onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const payload = {
              name: String(form.get('name')).trim(),
              email: String(form.get('email')).trim() || null,
              phone: String(form.get('phone')).trim() || null,
              address: String(form.get('address')).trim() || null,
            };
            const ok = await perform(
              () => editingOwner ? api.updateOwner(editingOwner.id, payload) : api.addOwner(payload),
              editingOwner ? 'Owner information updated.' : 'Owner added.',
            );
            if (ok) {
              setOwnerFormOpen(false);
              setEditingOwner(null);
            }
          }}>
            <h3>{editingOwner ? 'Update owner' : 'New owner'}</h3>
            <div className="form-grid">
              <Field label="Full name"><input name="name" required maxLength={120} defaultValue={editingOwner?.name ?? ''} /></Field>
              <Field label="Email"><input name="email" type="email" maxLength={254} defaultValue={editingOwner?.email ?? ''} /></Field>
              <Field label="Phone"><input name="phone" maxLength={32} defaultValue={editingOwner?.phone ?? ''} /></Field>
              <Field label="Address"><input name="address" maxLength={500} defaultValue={editingOwner?.address ?? ''} /></Field>
            </div>
            <FormActions onCancel={() => { setOwnerFormOpen(false); setEditingOwner(null); }} submit={editingOwner ? 'Save owner' : 'Add owner'} />
          </form>
        )}
        <section className="panel table-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">OWNER DIRECTORY</span><h3>Contact information</h3></div>
            <span className="count-pill">{owners.length} owners</span>
          </div>
          {owners.length ? <div className="table-scroll"><table>
            <thead><tr><th>Name</th><th>Contact</th><th>Address</th><th>Pets</th><th>Actions</th></tr></thead>
            <tbody>{owners.map((owner) => (
              <tr key={owner.id}>
                <td><strong>{owner.name}</strong></td>
                <td>{owner.email || owner.phone || 'No contact details'}{owner.email && owner.phone ? <><br />{owner.phone}</> : null}</td>
                <td>{owner.address || '—'}</td>
                <td>{pets.filter((pet) => pet.ownerId === owner.id && !pet.archived).map((pet) => pet.name).join(', ') || 'No active pets'}</td>
                <td><button className="small-button" onClick={() => {
                  setEditingOwner(owner);
                  setOwnerFormOpen(true);
                }}>Edit</button></td>
              </tr>
            ))}</tbody>
          </table></div> : <EmptyState message="No owners saved yet. Add an owner or create one while registering a pet." />}
        </section>
      </>
    );
  }

  function renderAppointments() {
    const filteredAppointments = appointments.filter((appointment) => (
      (appointmentFilter === 'ALL' || appointment.status === appointmentFilter)
      && `${appointment.petLabel} ${appointment.reason} ${appointment.status} ${appointment.staffName ?? ''} ${appointment.resource ?? ''}`
        .toLowerCase().includes(appointmentSearch.toLowerCase())
    ));
    return (
      <>
        <PageHeading title="Appointments" subtitle="Book visits and keep the clinic schedule up to date." action={
          <button className="button button-primary" onClick={() => setAppointmentFormOpen(!appointmentFormOpen)}><ClinicIcon name="plus" size={16} />Book appointment</button>
        } />
        {appointmentFormOpen && (
          <form className="form-panel" onSubmit={async (event) => {
            event.preventDefault();
            const formElement = event.currentTarget;
            const form = new FormData(formElement);
            const ok = await perform(() => api.addAppointment({
              petId: Number(form.get('petId')),
              appointmentTime: String(form.get('appointmentTime')),
              reason: String(form.get('reason')).trim(),
              staffId: Number(form.get('staffId')) || null,
              durationMinutes: Number(form.get('durationMinutes')),
              resource: String(form.get('resource')).trim() || null,
            }), 'Appointment booked. It is waiting for clinic confirmation.');
            if (ok) {
              formElement.reset();
              setAppointmentFormOpen(false);
            }
          }}>
            <h3>Book a visit</h3>
            <div className="form-grid">
              <Field label="Pet">
                <select name="petId" required defaultValue=""><option value="" disabled>Select a pet</option>{activePets.map((pet) => <option key={pet.id} value={pet.id}>{pet.label}</option>)}</select>
              </Field>
              <Field label="Date and time"><input type="datetime-local" name="appointmentTime" min={localDateTime(0)} defaultValue={localDateTime()} required /></Field>
              <Field label="Assigned staff member"><select name="staffId" defaultValue=""><option value="">Unassigned</option>{appointmentStaff.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></Field>
              <Field label="Duration"><select name="durationMinutes" defaultValue="30"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></select></Field>
              <Field label="Room / resource"><input name="resource" maxLength={80} placeholder="Optional, e.g. Exam Room 1" /></Field>
              <Field label="Reason for visit"><input name="reason" required maxLength={500} placeholder="Check-up, vaccination..." /></Field>
            </div>
            <FormActions onCancel={() => setAppointmentFormOpen(false)} submit="Book visit" disabled={!activePets.length} />
          </form>
        )}
        <section className="panel pet-selector">
          <label htmlFor="appointment-search">Search</label>
          <input id="appointment-search" value={appointmentSearch} onChange={(event) => setAppointmentSearch(event.target.value)} placeholder="Pet, owner, or visit reason" />
          <label htmlFor="appointment-filter">Status</label>
          <select id="appointment-filter" value={appointmentFilter} onChange={(event) => setAppointmentFilter(event.target.value)}>
            <option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="CONFIRMED">Confirmed</option><option value="CANCELLED">Cancelled</option>
          </select>
        </section>
        <section className="panel table-panel">
          <div className="panel-heading"><div><span className="eyebrow">CLINIC SCHEDULE</span><h3>All appointments</h3></div><span className="count-pill">{filteredAppointments.length} of {appointments.length}</span></div>
          {filteredAppointments.length ? <div className="table-scroll"><table>
            <thead><tr><th>Pet &amp; owner</th><th>Date &amp; time</th><th>Assigned staff</th><th>Duration / room</th><th>Visit reason</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{filteredAppointments.map((appointment) => (
              <tr key={appointment.id}>
                <td><strong>{appointment.petLabel}</strong></td>
                <td>{formatDateTime(appointment.appointmentTime)}</td>
                <td>{appointment.staffName || 'Unassigned'}</td>
                <td>{appointment.durationMinutes} min{appointment.resource ? ` · ${appointment.resource}` : ''}</td>
                <td>{appointment.reason}</td>
                <td><StatusBadge status={appointment.status} /></td>
                <td><div className="action-row">
                  {appointment.status === 'PENDING' && <button className="small-button positive" onClick={() => void perform(() => api.confirmAppointment(appointment.id), 'Appointment confirmed.')}>Confirm</button>}
                  {appointment.status !== 'CANCELLED' && <button className="small-button" onClick={() => {
                    setRescheduling(appointment.id);
                    setRescheduleTime(appointment.appointmentTime.slice(0, 16));
                  }}>Reschedule</button>}
                  {appointment.status !== 'CANCELLED' && <button className="small-button danger" onClick={() => void perform(() => api.cancelAppointment(appointment.id), 'Appointment cancelled.')}>Cancel</button>}
                </div>
                {rescheduling === appointment.id && (
                  <form className="reschedule-form" onSubmit={async (event) => {
                    event.preventDefault();
                    const ok = await perform(() => api.reschedule(appointment.id, rescheduleTime), 'Appointment rescheduled.');
                    if (ok) setRescheduling(null);
                  }}>
                    <input aria-label="New appointment date and time" type="datetime-local" min={localDateTime(0)} value={rescheduleTime} onChange={(event) => setRescheduleTime(event.target.value)} required />
                    <button className="small-button positive">Save</button>
                    <button type="button" className="small-button" onClick={() => setRescheduling(null)}>Close</button>
                  </form>
                )}
                </td>
              </tr>
            ))}</tbody>
          </table></div> : <EmptyState message={appointments.length ? 'No appointments match the selected filters.' : 'There are no appointments on the schedule yet.'} />}
        </section>
      </>
    );
  }

  function renderRecords() {
    const filteredRecords = records.filter((record) => `${record.diagnosis} ${record.treatment} ${record.notes ?? ''} ${record.medications ?? ''}`
      .toLowerCase().includes(recordSearch.toLowerCase()));
    return (
      <>
        <PageHeading title="Medical records" subtitle="Keep each pet's diagnosis and care notes together." action={
          <button className="button button-primary" disabled={!selectedPet} onClick={() => {
            setEditingRecord(null);
            setRecordFormOpen(!recordFormOpen);
          }}><ClinicIcon name="plus" size={16} />New record</button>
        } />
        <section className="panel pet-selector">
          <label htmlFor="record-pet">Records for</label>
          <select id="record-pet" value={selectedPetId} onChange={(event) => setSelectedPetId(Number(event.target.value) || '')}>
            {!activePets.length && <option value="">Register an active pet first</option>}
            {activePets.map((pet) => <option key={pet.id} value={pet.id}>{pet.label}</option>)}
          </select>
          {selectedPet && <p>{selectedPet.species}{selectedPet.breed ? ` · ${selectedPet.breed}` : ''} · Owner: {selectedPet.ownerName}</p>}
          <button className="small-button" disabled={!selectedPet} onClick={() => {
            if (selectedPet) void downloadDocument(
              () => api.downloadMedicalHistoryPdf(selectedPet.id),
              'Medical history PDF downloaded.',
            );
          }}>Download full history PDF</button>
        </section>
        <section className="panel pet-selector">
          <label htmlFor="record-search">Search records</label>
          <input id="record-search" value={recordSearch} onChange={(event) => setRecordSearch(event.target.value)} placeholder="Diagnosis, treatment, or notes" />
        </section>
        {recordFormOpen && selectedPet && (
          <form key={editingRecord?.id ?? 'new-record'} className="form-panel" onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const payload = {
              diagnosis: String(form.get('diagnosis')).trim(),
              treatment: String(form.get('treatment')).trim(),
              notes: String(form.get('notes')).trim() || null,
              recordDate: String(form.get('recordDate')),
              weightKg: optionalNumber(form.get('weightKg')),
              temperatureC: optionalNumber(form.get('temperatureC')),
              heartRateBpm: optionalNumber(form.get('heartRateBpm')),
              respiratoryRateBpm: optionalNumber(form.get('respiratoryRateBpm')),
              medications: String(form.get('medications')).trim() || null,
              followUpDate: String(form.get('followUpDate')).trim() || null,
            };
            const save = editingRecord
              ? () => api.updateRecord(editingRecord.id, payload)
              : () => api.addRecord(Number(selectedPetId), payload);
            const ok = await perform(save, editingRecord ? 'Medical record updated.' : 'Medical record saved.');
            if (ok) {
              setRecordFormOpen(false);
              setEditingRecord(null);
            }
          }}>
            <h3>{editingRecord ? 'Update record' : 'New medical record'}</h3>
            <div className="form-grid">
              <Field label="Record date"><input name="recordDate" type="date" defaultValue={editingRecord?.recordDate ?? today()} required /></Field>
              <Field label="Diagnosis"><textarea name="diagnosis" defaultValue={editingRecord?.diagnosis ?? ''} required maxLength={1000} rows={2} /></Field>
              <Field label="Treatment"><textarea name="treatment" defaultValue={editingRecord?.treatment ?? ''} required maxLength={1000} rows={2} /></Field>
              <Field label="Notes"><textarea name="notes" defaultValue={editingRecord?.notes ?? ''} maxLength={1000} rows={2} /></Field>
              <Field label="Weight (kg)"><input name="weightKg" type="number" min="0.01" max="9999.99" step="0.01" defaultValue={editingRecord?.weightKg ?? ''} /></Field>
              <Field label="Temperature (°C)"><input name="temperatureC" type="number" min="20" max="50" step="0.1" defaultValue={editingRecord?.temperatureC ?? ''} /></Field>
              <Field label="Heart rate (bpm)"><input name="heartRateBpm" type="number" min="1" max="500" step="1" defaultValue={editingRecord?.heartRateBpm ?? ''} /></Field>
              <Field label="Respiratory rate (breaths/min)"><input name="respiratoryRateBpm" type="number" min="1" max="300" step="1" defaultValue={editingRecord?.respiratoryRateBpm ?? ''} /></Field>
              <Field label="Medications"><textarea name="medications" defaultValue={editingRecord?.medications ?? ''} maxLength={2000} rows={2} /></Field>
              <Field label="Follow-up date"><input name="followUpDate" type="date" defaultValue={editingRecord?.followUpDate ?? ''} /></Field>
            </div>
            <FormActions onCancel={() => { setRecordFormOpen(false); setEditingRecord(null); }} submit={editingRecord ? 'Save changes' : 'Save record'} />
          </form>
        )}
        <section className="record-list">
          {filteredRecords.map((record) => (
            <article className="record-card" key={record.id}>
              <div className="record-date">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${record.recordDate}T00:00:00`))}</div>
              <div className="record-content">
                <div><span className="eyebrow">DIAGNOSIS</span><p>{record.diagnosis}</p></div>
                <div><span className="eyebrow">TREATMENT</span><p>{record.treatment}</p></div>
                {record.notes && <div><span className="eyebrow">NOTES</span><p>{record.notes}</p></div>}
                {(record.weightKg != null || record.temperatureC != null || record.heartRateBpm != null || record.respiratoryRateBpm != null
                  || record.medications || record.followUpDate) && <div className="clinical-details">
                    <span className="eyebrow">VITALS &amp; FOLLOW-UP</span>
                    <p>{[
                      record.weightKg != null ? `${record.weightKg} kg` : null,
                      record.temperatureC != null ? `${record.temperatureC} °C` : null,
                      record.heartRateBpm != null ? `${record.heartRateBpm} bpm` : null,
                      record.respiratoryRateBpm != null ? `${record.respiratoryRateBpm} breaths/min` : null,
                      record.medications ? `Medication: ${record.medications}` : null,
                      record.followUpDate ? `Follow-up: ${record.followUpDate}` : null,
                    ].filter(Boolean).join(' · ')}</p>
                  </div>}
              </div>
              <div className="record-actions">
                {selectedPet && <button className="small-button" onClick={() => void downloadDocument(
                  () => api.downloadMedicalRecordPdf(selectedPet.id, record.id),
                  'Medical record PDF downloaded.',
                )}>Download PDF</button>}
                <button className="small-button" onClick={() => { setEditingRecord(record); setRecordFormOpen(true); }}>Edit</button>
              </div>
            </article>
          ))}
          {!filteredRecords.length && <EmptyState message={!records.length ? (selectedPet ? 'No medical records for this pet yet.' : 'Choose a pet to view medical records.') : 'No medical records match your search.'} />}
        </section>
      </>
    );
  }

  function renderInventory() {
    const lowStockCount = inventory.filter((item) => item.lowStock).length;
    return (
      <>
        <PageHeading title="Inventory" subtitle="Track clinic stock and the catalog prices used on invoices." action={
          <button className="button button-primary" onClick={() => {
            setEditingInventory(null);
            setInventoryFormOpen((open) => !open);
          }}><ClinicIcon name="plus" size={16} />Add item</button>
        } />
        <section className="stat-grid">
          <StatCard label="Catalog items" value={inventory.filter((item) => item.active).length} icon="inventory" />
          <StatCard label="At or below reorder level" value={lowStockCount} icon="clock" />
        </section>
        {inventoryFormOpen && (
          <form key={editingInventory?.id ?? 'new-inventory'} className="form-panel" onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const sku = String(form.get('sku')).trim();
            const details = {
              sku,
              name: String(form.get('name')).trim(),
              category: String(form.get('category')).trim() || null,
              reorderLevel: Number(form.get('reorderLevel')),
              unitPrice: Number(form.get('unitPrice')),
            };
            const save = editingInventory
              ? () => api.updateInventoryProduct(editingInventory.id, {
                ...details,
                active: form.get('active') === 'on',
              })
              : () => api.addInventoryProduct({
                ...details,
                quantityOnHand: Number(form.get('quantityOnHand')),
              });
            const ok = await perform(save, editingInventory ? 'Inventory item updated.' : 'Inventory item added.');
            if (ok) {
              setInventoryFormOpen(false);
              setEditingInventory(null);
            }
          }}>
            <h3>{editingInventory ? 'Edit inventory item' : 'New inventory item'}</h3>
            <div className="form-grid">
              <Field label="SKU"><input name="sku" required maxLength={64} defaultValue={editingInventory?.sku ?? ''} /></Field>
              <Field label="Name"><input name="name" required maxLength={120} defaultValue={editingInventory?.name ?? ''} /></Field>
              <Field label="Category"><input name="category" maxLength={80} defaultValue={editingInventory?.category ?? ''} placeholder="Medication, supplies..." /></Field>
              <Field label="Unit price (PHP)"><input name="unitPrice" type="number" min="0" max="99999999.99" step="0.01" required defaultValue={editingInventory?.unitPrice ?? ''} /></Field>
              <Field label="Reorder level"><input name="reorderLevel" type="number" min="0" max="1000000" step="1" required defaultValue={editingInventory?.reorderLevel ?? 0} /></Field>
              {!editingInventory && <Field label="Starting quantity"><input name="quantityOnHand" type="number" min="0" max="1000000" step="1" required defaultValue="0" /></Field>}
              {editingInventory && <Field label="Item status"><label className="checkbox-field"><input name="active" type="checkbox" defaultChecked={editingInventory.active} /> Active for billing</label></Field>}
            </div>
            <FormActions onCancel={() => { setInventoryFormOpen(false); setEditingInventory(null); }} submit={editingInventory ? 'Save changes' : 'Add item'} />
          </form>
        )}
        {stockAdjustmentItem && (
          <form className="form-panel" onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const amount = Number(form.get('adjustment'));
            const delta = form.get('direction') === 'REMOVE' ? -amount : amount;
            const ok = await perform(() => api.adjustStock(stockAdjustmentItem.id, delta,
              String(form.get('reason')).trim()), 'Stock quantity updated.');
            if (ok) setStockAdjustmentItem(null);
          }}>
            <h3>Adjust stock · {stockAdjustmentItem.name}</h3>
            <div className="form-grid">
              <Field label="Adjustment type"><select name="direction" defaultValue="ADD"><option value="ADD">Receive stock</option><option value="REMOVE">Remove stock</option></select></Field>
              <Field label="Quantity"><input name="adjustment" type="number" min="1" max="1000000" step="1" required value={stockAdjustment} onChange={(event) => setStockAdjustment(event.target.value)} /></Field>
              <Field label="Reason"><input name="reason" maxLength={300} value={stockAdjustmentReason} onChange={(event) => setStockAdjustmentReason(event.target.value)} placeholder="Delivery, correction, damaged stock..." /></Field>
            </div>
            <FormActions onCancel={() => setStockAdjustmentItem(null)} submit="Apply adjustment" />
          </form>
        )}
        <section className="panel table-panel">
          <div className="panel-heading"><div><span className="eyebrow">STOCK CONTROL</span><h3>Clinic inventory</h3></div><span className="count-pill">{inventory.length} items · {lowStockCount} low</span></div>
          {inventory.length ? <div className="table-scroll"><table>
            <thead><tr><th>SKU</th><th>Item</th><th>Category</th><th>On hand / reorder</th><th>Unit price</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{inventory.map((item) => (
              <tr key={item.id}>
                <td>{item.sku}</td><td><strong>{item.name}</strong></td><td>{item.category || '—'}</td>
                <td>{item.quantityOnHand} / {item.reorderLevel}</td><td>{money(item.unitPrice)}</td>
                <td>{!item.active ? 'Inactive' : item.lowStock ? 'Reorder needed' : 'In stock'}</td>
                <td className="table-actions">
                  <button className="small-button" onClick={() => {
                    setEditingInventory(item);
                    setInventoryFormOpen(true);
                  }}>Edit</button>
                  <button className="small-button positive" onClick={() => {
                    setStockAdjustmentItem(item);
                    setStockAdjustment('1');
                    setStockAdjustmentReason('');
                  }}>Adjust stock</button>
                </td>
              </tr>
            ))}</tbody>
          </table></div> : <EmptyState message="No inventory items yet. Add your first product or medication." />}
        </section>
      </>
    );
  }

  function renderPayments() {
    const filteredPayments = payments.filter((payment) => paymentFilter === 'ALL' || payment.status === paymentFilter);
    const filteredPaidAmount = filteredPayments.filter((payment) => payment.status === 'PAID')
      .reduce((sum, payment) => sum + payment.amount, 0);
    const filteredOutstandingAmount = filteredPayments.filter((payment) => payment.status === 'UNPAID')
      .reduce((sum, payment) => sum + payment.amount, 0);
    return (
      <>
        <PageHeading title="Payments" subtitle="Create bills, record payments, and find receipts." action={
          <button className="button button-primary" onClick={() => setPaymentFormOpen(!paymentFormOpen)}><ClinicIcon name="plus" size={16} />Create bill</button>
        } />
        {paymentFormOpen && <InvoiceForm
          pets={activePets}
          products={inventory.filter((item) => item.active)}
          onCancel={() => setPaymentFormOpen(false)}
          onSubmit={async (payload) => {
            const ok = await perform(() => api.addPayment(payload), 'Itemized bill created and marked unpaid.');
            if (ok) setPaymentFormOpen(false);
          }}
        />}
        <section className="stat-grid">
          <StatCard label="Filtered paid total" value={money(filteredPaidAmount)} icon="check" />
          <StatCard label="Filtered outstanding" value={money(filteredOutstandingAmount)} icon="payments" />
        </section>
        <section className="panel pet-selector">
          <label htmlFor="payment-filter">Payment status</label>
          <select id="payment-filter" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
            <option value="ALL">All payments</option><option value="UNPAID">Unpaid</option><option value="PAID">Paid</option>
          </select>
        </section>
        <section className="panel table-panel">
          <div className="panel-heading"><div><span className="eyebrow">BILLING</span><h3>Payment history</h3></div><span className="count-pill">{filteredPayments.length} of {payments.length} bills</span></div>
          {filteredPayments.length ? <div className="table-scroll"><table>
            <thead><tr><th>Pet &amp; owner</th><th>Description</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{filteredPayments.map((payment) => {
              const selectedMethod = paymentMethods[payment.id] ?? 'Cash';
              return (
                <tr key={payment.id}>
                  <td><strong>{payment.petLabel}</strong></td>
                  <td>{payment.items?.length
                    ? payment.items.map((item) => `${item.description} × ${item.quantity}`).join(', ')
                    : payment.description}</td>
                  <td className="amount">{money(payment.amount)}</td>
                  <td><StatusBadge status={payment.status} /></td>
                  <td>{payment.status === 'UNPAID' ? (
                    <div className="action-row">
                      <select
                        aria-label={`Payment method for ${payment.petLabel}`}
                        value={selectedMethod}
                        onChange={(event) => setPaymentMethods((current) => ({ ...current, [payment.id]: event.target.value }))}
                      >
                        <option>Cash</option><option>GCash</option><option>Card</option>
                      </select>
                      <button className="small-button" onClick={() => void downloadDocument(
                        () => api.downloadPaymentPdf(payment),
                        'Invoice PDF downloaded.',
                      )}>Download invoice</button>
                      <button className="small-button positive" onClick={() => {
                        void perform(async () => setReceipt(await api.pay(payment.id, selectedMethod)), 'Payment processed. Receipt is ready.');
                      }}>Pay</button>
                    </div>
                  ) : <div className="action-row">
                    <button className="small-button" onClick={() => void downloadDocument(
                      () => api.downloadPaymentPdf(payment),
                      'Receipt PDF downloaded.',
                    )}>Download receipt PDF</button>
                    <button className="text-button" onClick={() => void perform(async () => setReceipt(await api.receipt(payment.id)), 'Receipt loaded.')}>View receipt <ClinicIcon name="arrow" size={15} /></button>
                  </div>}</td>
                </tr>
              );
            })}</tbody>
          </table></div> : <EmptyState message={payments.length ? 'No payments match this status.' : 'No bills yet. Create a bill to start tracking payments.'} />}
        </section>
        {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
      </>
    );
  }

  function renderSettings() {
    return (
      <>
        <PageHeading title="Account & staff" subtitle="Update your password and manage clinic access." action={<span className="count-pill">{user.role ?? 'STAFF'}</span>} />
        <form className="form-panel" onSubmit={async (event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          setAccountBusy(true);
          setError('');
          setNotice('');
          try {
            await api.changePassword({
              currentPassword: String(form.get('currentPassword')),
              newPassword: String(form.get('newPassword')),
            });
            formElement.reset();
            setNotice('Password updated successfully.');
          } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Could not update your password.');
          } finally {
            setAccountBusy(false);
          }
        }}>
          <h3>Change password</h3>
          <div className="form-grid">
            <PasswordField label="Current password" name="currentPassword" autoComplete="current-password" required />
            <PasswordField label="New password" name="newPassword" autoComplete="new-password" minLength={8} maxLength={72} required />
          </div>
          <div className="form-actions"><button className="button button-primary" disabled={accountBusy}>{accountBusy ? 'Updating…' : 'Update password'}</button></div>
        </form>
        {user.role === 'ADMIN' && <>
          <section className="form-panel">
            <div><span className="eyebrow">ADMINISTRATOR</span><h3>Financial report</h3></div>
            <p className="muted">Export paid invoices within a date range as a CSV file.</p>
            <form className="form-grid" onSubmit={(event) => {
              event.preventDefault();
              void exportPaymentReport();
            }}>
              <Field label="From"><input type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} required /></Field>
              <Field label="To"><input type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} required /></Field>
              <div className="form-actions report-actions"><button className="button button-primary">Download CSV</button></div>
            </form>
          </section>
          <section className="panel table-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">ADMINISTRATOR</span><h3>Recent activity</h3></div>
              <span className="count-pill">Latest {auditEvents.length} events</span>
            </div>
            {auditEvents.length ? <div className="table-scroll"><table>
              <thead><tr><th>Time</th><th>Account</th><th>Action</th><th>Route</th><th>Result</th></tr></thead>
              <tbody>{auditEvents.map((event) => (
                <tr key={event.id}>
                  <td>{formatDateTime(event.occurredAt)}</td>
                  <td>{event.actor}</td>
                  <td>{event.method}</td>
                  <td><code>{event.requestPath}</code></td>
                  <td>{event.responseStatus}</td>
                </tr>
              ))}</tbody>
            </table></div> : <EmptyState message="No API changes have been recorded yet." />}
          </section>
          <section className="panel table-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">ADMINISTRATOR</span><h3>Staff accounts</h3></div>
              <span className="count-pill">{staff.length} accounts</span>
            </div>
            {temporaryPassword && <div className="alert alert-success" role="status">
              <strong>Temporary password for {temporaryPassword.displayName}:</strong>{' '}
              <code>{temporaryPassword.value}</code>
              <p>Share it securely. It is shown only once, and must be changed after sign-in.</p>
              <button className="small-button" onClick={() => setTemporaryPassword(null)}>Dismiss</button>
            </div>}
            <form className="staff-create-form" onSubmit={async (event) => {
              event.preventDefault();
              const formElement = event.currentTarget;
              const form = new FormData(formElement);
              const ok = await createStaffAccount(
                String(form.get('email')).trim(),
                String(form.get('displayName')).trim(),
              );
              if (ok) formElement.reset();
            }}>
              <h4>Create staff account</h4>
              <div className="form-grid">
                <Field label="Staff member name"><input name="displayName" required maxLength={100} /></Field>
                <Field label="Email address"><input name="email" type="email" required maxLength={254} /></Field>
              </div>
              <div className="form-actions">
                <button className="button button-primary" disabled={accountBusy}>
                  {accountBusy ? 'Creating…' : 'Create staff account'}
                </button>
              </div>
            </form>
            {staff.length ? <div className="table-scroll"><table>
              <thead><tr><th>Staff member</th><th>Email</th><th>Role</th><th>Access</th><th>Actions</th></tr></thead>
              <tbody>{staff.map((member) => {
                const draft = staffDrafts[member.id] ?? { role: member.role, active: member.active };
                const isCurrentUser = member.email === user.email;
                return <tr key={member.id}>
                  <td><strong>{member.displayName}</strong></td>
                  <td>{member.email}</td>
                  <td><select aria-label={`Role for ${member.email}`} value={draft.role} disabled={isCurrentUser} onChange={(event) => {
                    setStaffDrafts((current) => ({ ...current, [member.id]: {
                      ...draft,
                      role: event.target.value === 'ADMIN' ? 'ADMIN' : 'STAFF',
                    } }));
                  }}><option value="STAFF">Staff</option><option value="ADMIN">Admin</option></select></td>
                  <td><label className="checkbox-field"><input aria-label={`Active access for ${member.email}`} type="checkbox" checked={draft.active} disabled={isCurrentUser} onChange={(event) => {
                    setStaffDrafts((current) => ({ ...current, [member.id]: { ...draft, active: event.target.checked } }));
                  }} /> Active</label></td>
                  <td className="table-actions">
                    <button className="small-button positive" onClick={() => void perform(
                      () => api.updateStaff(member.id, draft),
                      `Access updated for ${member.displayName}.`,
                    )} disabled={isCurrentUser}>Save</button>
                    <button className="small-button" onClick={() => void resetStaffPassword(member)}
                      disabled={isCurrentUser || resettingStaffId === member.id}>
                      {resettingStaffId === member.id ? 'Resetting…' : 'Reset password'}
                    </button>
                  </td>
                </tr>;
              })}</tbody>
            </table></div> : <EmptyState message="No staff accounts found." />}
          </section>
        </>}
        {user.role !== 'ADMIN' && <section className="panel"><p className="muted">Staff roles and account access can only be managed by a clinic administrator.</p></section>}
      </>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand-row">
          <Link className="brand" to="/staff/overview">
            <BrandLogo size={39} />
            <span>ALPHA <strong>DAWGS</strong><small>VETERINARY CLINIC</small></span>
          </Link>
          <button className="mobile-sign-out" onClick={() => void onSignOut()}>Log out</button>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {staffNavigation.filter((item) => !item.adminOnly || user.role === 'ADMIN').map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon"><ClinicIcon name={item.icon} size={18} /></span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer account-footer">
          <span className="online-dot" />
          <strong>{user.displayName}</strong>
          <small>{user.email} · {user.role ?? 'STAFF'}</small>
          <button className="sign-out-button" onClick={() => void onSignOut()}>Log out</button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div><span className="eyebrow">CLINIC MANAGEMENT</span><h1>{currentNav.label}</h1></div>
          <div className="topbar-right">
            <span className="today-label">{new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date())}</span>
            <button className="icon-button" onClick={() => void refresh()} aria-label="Refresh data"><ClinicIcon name="refresh" size={18} /></button>
          </div>
        </header>
        {error && <div className="alert alert-error" role="alert"><strong>Something went wrong.</strong> {error}<button aria-label="Dismiss error" onClick={() => setError('')}><ClinicIcon name="close" size={16} /></button></div>}
        {notice && <div className="alert alert-success" role="status">{notice}<button aria-label="Dismiss message" onClick={() => setNotice('')}><ClinicIcon name="close" size={16} /></button></div>}
        {loading && !pets.length ? (
          <div className="loading-state">Loading clinic information…</div>
        ) : (
          <Routes>
            <Route path="overview" element={renderOverview()} />
            <Route path="pets" element={renderPets()} />
            <Route path="owners" element={renderOwners()} />
            <Route path="appointments" element={renderAppointments()} />
            <Route path="records" element={renderRecords()} />
            <Route path="payments" element={renderPayments()} />
            <Route path="inventory" element={renderInventory()} />
            <Route path="settings" element={renderSettings()} />
            <Route path="*" element={<Navigate to="/staff/overview" replace />} />
          </Routes>
        )}
        <footer className="page-footer">Alpha Dawgs Veterinary Clinic <span>·</span> Care for every companion</footer>
      </main>
    </div>
  );
}

function InvoiceForm({
  pets,
  products,
  onCancel,
  onSubmit,
}: {
  pets: Pet[];
  products: InventoryProduct[];
  onCancel: () => void;
  onSubmit: (payload: {
    petId: number;
    items: { description: string; quantity: number; unitPrice: number | null; productId: number | null }[];
  }) => Promise<void> | void;
}) {
  const [lines, setLines] = useState([{ description: '', quantity: '1', unitPrice: '', productId: '' }]);
  const [petId, setPetId] = useState('');
  const total = lines.reduce((sum, line) => (
    sum + Number(line.quantity || 0) * Number(line.unitPrice || 0)
  ), 0);

  function updateLine(index: number, patch: Partial<(typeof lines)[number]>) {
    setLines((current) => current.map((line, lineIndex) => (
      lineIndex === index ? { ...line, ...patch } : line
    )));
  }

  return (
    <form className="form-panel" onSubmit={(event) => {
      event.preventDefault();
      void onSubmit({
        petId: Number(petId),
        items: lines.map((line) => ({
          description: line.description.trim(),
          quantity: Number(line.quantity),
          unitPrice: line.unitPrice === '' ? null : Number(line.unitPrice),
          productId: Number(line.productId) || null,
        })),
      });
    }}>
      <h3>Generate an itemized bill</h3>
      <div className="form-grid">
        <Field label="Pet"><select required value={petId} onChange={(event) => setPetId(event.target.value)}><option value="" disabled>Select a pet</option>{pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.label}</option>)}</select></Field>
      </div>
      {lines.map((line, index) => (
        <section className="invoice-line" key={index}>
          <div className="form-grid">
            <Field label={`Inventory item ${index + 1}`}>
              <select value={line.productId} onChange={(event) => {
                const productId = event.target.value;
                const product = products.find((candidate) => candidate.id === Number(productId));
                updateLine(index, {
                  productId,
                  description: product?.name ?? '',
                  unitPrice: product ? product.unitPrice.toFixed(2) : '',
                });
              }}>
                <option value="">Service / custom item</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.quantityOnHand} available</option>)}
              </select>
            </Field>
            <Field label="Description"><input value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} required maxLength={300} /></Field>
            <Field label="Quantity"><input type="number" min="1" max="100000" step="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} required /></Field>
            <Field label="Unit price (PHP)"><input type="number" min="0" max="99999999.99" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.target.value })} disabled={Boolean(line.productId)} required /></Field>
          </div>
          <div className="invoice-line-footer">
            <span>Line total: <strong>{money(Number(line.quantity || 0) * Number(line.unitPrice || 0))}</strong></span>
            {lines.length > 1 && <button type="button" className="small-button danger" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>Remove line</button>}
          </div>
        </section>
      ))}
      <button type="button" className="small-button" onClick={() => setLines((current) => [...current, {
        description: '', quantity: '1', unitPrice: '', productId: '',
      }])}>Add line item</button>
      <div className="invoice-total">Invoice total <strong>{money(total)}</strong></div>
      <FormActions onCancel={onCancel} submit="Create unpaid bill" disabled={!pets.length || total <= 0} />
    </form>
  );
}
