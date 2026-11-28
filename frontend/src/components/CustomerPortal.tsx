import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  api,
  type Appointment,
  type AppointmentStaff,
  type AuthUser,
  type MedicalRecord,
  type Payment,
  type Pet,
  type PortalOverview,
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

const portalNavigation: { path: string; label: string; icon: ClinicIconName }[] = [
  { path: '/portal/overview', label: 'Overview', icon: 'overview' },
  { path: '/portal/pets', label: 'My pets', icon: 'paw' },
  { path: '/portal/appointments', label: 'Appointments', icon: 'appointments' },
  { path: '/portal/records', label: 'Medical records', icon: 'records' },
  { path: '/portal/payments', label: 'Bills & receipts', icon: 'payments' },
  { path: '/portal/account', label: 'My account', icon: 'settings' },
];

const emptyOverview: PortalOverview = {
  ownerId: 0,
  ownerName: '',
  email: null,
  phone: null,
  address: null,
  petCount: 0,
  upcomingAppointmentCount: 0,
  pendingAppointmentCount: 0,
  unpaidPaymentCount: 0,
  outstandingAmount: 0,
  paidAmount: 0,
};

export function CustomerPortal({
  user,
  onSignOut,
  onDisplayNameChanged,
}: {
  user: AuthUser;
  onSignOut: () => Promise<void>;
  onDisplayNameChanged: (name: string) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [overview, setOverview] = useState<PortalOverview>(emptyOverview);
  const [pets, setPets] = useState<Pet[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinicStaff, setClinicStaff] = useState<AppointmentStaff[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [viewingPet, setViewingPet] = useState<Pet | null>(null);
  const [petFormOpen, setPetFormOpen] = useState(false);
  const [appointmentFormOpen, setAppointmentFormOpen] = useState(false);
  const [rescheduling, setRescheduling] = useState<number | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState(localDateTime());
  const [appointmentFilter, setAppointmentFilter] = useState('ALL');
  const [recordSearch, setRecordSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const loadRecords = useCallback(async (petId: number | '') => {
    if (!petId) {
      setRecords([]);
      return;
    }
    try {
      setRecords(await api.portal.records(petId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load medical records.');
    }
  }, []);

  const refresh = useCallback(async () => {
    setError('');
    setLoading(true);
    const results = await Promise.allSettled([
      api.portal.overview(),
      api.portal.pets(),
      api.portal.appointments(),
      api.portal.staff(),
      api.portal.payments(),
    ]);
    const [overviewResult, petsResult, appointmentsResult, staffResult, paymentsResult] = results;
    if (overviewResult.status === 'fulfilled') setOverview(overviewResult.value);
    if (petsResult.status === 'fulfilled') {
      setPets(petsResult.value);
      setSelectedPetId((current) => {
        const stillValid = petsResult.value.some((pet) => pet.id === current);
        return stillValid ? current : (petsResult.value[0]?.id ?? '');
      });
    }
    if (appointmentsResult.status === 'fulfilled') setAppointments(appointmentsResult.value);
    if (staffResult.status === 'fulfilled') setClinicStaff(staffResult.value);
    if (paymentsResult.status === 'fulfilled') setPayments(paymentsResult.value);

    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') {
      setError(failed.reason instanceof Error ? failed.reason.message : 'Could not load your portal data.');
    }
    setLoading(false);
  }, []);

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
    () => pets.find((pet) => pet.id === selectedPetId) ?? null,
    [pets, selectedPetId],
  );

  async function perform(action: () => Promise<unknown>, successMessage: string): Promise<boolean> {
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
      await refresh();
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The request could not be completed.');
      return false;
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

  const currentNav = portalNavigation.find((item) => location.pathname.startsWith(item.path)) ?? portalNavigation[0];

  function renderOverview() {
    const upcoming = appointments
      .filter((appointment) => appointment.status !== 'CANCELLED'
        && new Date(appointment.appointmentTime).getTime() >= Date.now())
      .slice(0, 4);

    return (
      <>
        <section className="welcome-card welcome-card-with-photo">
          <div className="welcome-copy">
            <span className="eyebrow">CUSTOMER &amp; PET OWNER PORTAL</span>
            <h2>Welcome back, {overview.ownerName || user.displayName}.</h2>
            <p>Track your companions’ upcoming visits, read clinic medical records, and download invoices or receipts anytime.</p>
            <div className="welcome-actions">
              <button
                className="button button-gold"
                onClick={() => {
                  setAppointmentFormOpen(true);
                  navigate('/portal/appointments');
                }}
              >
                Book appointment
              </button>
              <Link className="button button-ghost" to="/portal/pets">View my pets</Link>
            </div>
          </div>
          <div className="welcome-photo-frame">
            <img src={CLINIC_HERO_IMG} alt="Alpha Dawgs veterinarian caring for a dog and cat" />
          </div>
        </section>

        <div className="stat-grid">
          <StatCard label="My registered pets" value={overview.petCount} icon="paw" />
          <StatCard label="Upcoming visits" value={overview.upcomingAppointmentCount} icon="appointments" />
          <StatCard label="Pending confirmation" value={overview.pendingAppointmentCount} icon="clock" />
          <StatCard label="Outstanding balance" value={money(overview.outstandingAmount)} icon="payments" />
        </div>

        <section className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">MY SCHEDULE</span><h3>Upcoming appointments</h3></div>
            <Link className="button button-light" to="/portal/appointments">Manage appointments</Link>
          </div>
          {upcoming.length ? (
            <div className="appointment-preview">
              {upcoming.map((appointment) => (
                <div className="preview-row" key={appointment.id}>
                  <div className="date-tile">
                    <strong>{new Date(appointment.appointmentTime).getDate()}</strong>
                    <span>{new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(appointment.appointmentTime))}</span>
                  </div>
                  <div className="preview-info">
                    <strong>{appointment.petLabel}</strong>
                    <span>{appointment.reason}{appointment.staffName ? ` · ${appointment.staffName}` : ''}</span>
                  </div>
                  <span className="muted">{formatDateTime(appointment.appointmentTime)}</span>
                  <StatusBadge status={appointment.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No upcoming appointments yet. Book a visit whenever your pet needs care." />
          )}
        </section>

        {pets.length > 0 && (
          <section className="panel">
            <div className="panel-heading">
              <div><span className="eyebrow">MY COMPANIONS</span><h3>Your pets</h3></div>
              <Link className="button button-light" to="/portal/pets">All pets</Link>
            </div>
            <div className="pet-grid">
              {pets.slice(0, 3).map((pet) => (
                <article className="pet-card" key={pet.id}>
                  <PetAvatar species={pet.species} name={pet.name} />
                  <div className="pet-card-body">
                    <span className="eyebrow">{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</span>
                    <h3>{pet.name}</h3>
                    <p>{pet.weightKg != null ? `${pet.weightKg} kg` : 'Active patient profile'}</p>
                    <button
                      className="text-button"
                      onClick={() => {
                        setSelectedPetId(pet.id);
                        navigate('/portal/records');
                      }}
                    >
                      View medical records <ClinicIcon name="arrow" size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </>
    );
  }

  function renderCustomerPetForm({
    title,
    subtitle,
    onCancel,
    onAdded,
  }: {
    title: string;
    subtitle?: string;
    onCancel?: () => void;
    onAdded?: () => void;
  }) {
    return (
      <form
        className="form-panel"
        onSubmit={async (event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          const ok = await perform(
            () => api.portal.addPet({
              name: String(form.get('name')).trim(),
              species: String(form.get('species')).trim(),
              breed: String(form.get('breed') ?? '').trim() || null,
              birthDate: String(form.get('birthDate') ?? '').trim() || null,
              sex: petSex(form.get('sex')),
              color: String(form.get('color') ?? '').trim() || null,
              weightKg: optionalNumber(form.get('weightKg')),
              allergies: String(form.get('allergies') ?? '').trim() || null,
              medicalAlerts: String(form.get('medicalAlerts') ?? '').trim() || null,
            }),
            'Pet profile added to your account.',
          );
          if (ok) {
            formElement.reset();
            onAdded?.();
          }
        }}
      >
        <h3>{title}</h3>
        {subtitle && <p className="muted" style={{ marginBottom: 14 }}>{subtitle}</p>}
        <div className="form-grid">
          <Field label="Pet name"><input name="name" required maxLength={120} placeholder="e.g. Bantay" /></Field>
          <Field label="Species"><input name="species" required maxLength={80} placeholder="Dog, Cat, Rabbit..." /></Field>
          <Field label="Breed"><input name="breed" maxLength={120} placeholder="Optional" /></Field>
          <Field label="Date of birth"><input name="birthDate" type="date" max={today()} /></Field>
          <Field label="Sex">
            <select name="sex" defaultValue="">
              <option value="">Not recorded</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </Field>
          <Field label="Color / markings"><input name="color" maxLength={80} placeholder="Optional" /></Field>
          <Field label="Weight (kg)"><input name="weightKg" type="number" min="0.01" max="9999.99" step="0.01" placeholder="Optional" /></Field>
          <Field label="Allergies / medical notes"><input name="allergies" maxLength={1000} placeholder="Optional" /></Field>
        </div>
        {onCancel ? (
          <FormActions onCancel={onCancel} submit="Save pet" />
        ) : (
          <div className="form-actions">
            <button className="button button-primary">Save pet &amp; continue to booking</button>
          </div>
        )}
      </form>
    );
  }

  function renderPets() {
    return (
      <>
        <PageHeading
          title="My pets"
          subtitle="Register your companions or view profiles linked to your account."
          action={
            <button className="button button-primary" onClick={() => setPetFormOpen(!petFormOpen)}>
              <ClinicIcon name="plus" size={16} />Add a pet
            </button>
          }
        />
        {petFormOpen && renderCustomerPetForm({
          title: 'Register your pet',
          onCancel: () => setPetFormOpen(false),
          onAdded: () => setPetFormOpen(false),
        })}
        <section className="pet-grid">
          {pets.map((pet) => (
            <article className="pet-card" key={pet.id}>
              <PetAvatar species={pet.species} name={pet.name} size={56} />
              <div className="pet-card-body">
                <span className="eyebrow">{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</span>
                <h3>{pet.name}</h3>
                <p>{pet.birthDate ? `Born ${pet.birthDate}` : 'Patient profile'}</p>
                <button
                  className="text-button pet-details-button"
                  onClick={async () => {
                    setError('');
                    try {
                      setViewingPet(await api.portal.pet(pet.id));
                    } catch (requestError) {
                      setError(requestError instanceof Error ? requestError.message : 'Could not load pet profile.');
                    }
                  }}
                >
                  View pet details
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    setSelectedPetId(pet.id);
                    navigate('/portal/records');
                  }}
                >
                  View medical records <ClinicIcon name="arrow" size={15} />
                </button>
              </div>
            </article>
          ))}
          {!pets.length && !loading && !petFormOpen && (
            <EmptyState message="No pets added yet. Click 'Add a pet' above to register your pet and book appointments." />
          )}
        </section>

        {viewingPet && (
          <div className="modal-backdrop" role="presentation" onClick={() => setViewingPet(null)}>
            <section className="pet-details-card" role="dialog" aria-modal="true" aria-labelledby="portal-pet-title" onClick={(event) => event.stopPropagation()}>
              <button className="modal-close" aria-label="Close pet details" onClick={() => setViewingPet(null)}>
                <ClinicIcon name="close" size={18} />
              </button>
              <div className="pet-modal-head">
                <PetAvatar species={viewingPet.species} name={viewingPet.name} size={64} />
                <div>
                  <span className="eyebrow">PATIENT PROFILE · #{viewingPet.id}</span>
                  <h2 id="portal-pet-title">{viewingPet.name}</h2>
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
              </div>
              <div className="form-actions">
                <button
                  className="button button-light"
                  onClick={() => {
                    setSelectedPetId(viewingPet.id);
                    setViewingPet(null);
                    navigate('/portal/records');
                  }}
                >
                  View medical records
                </button>
                <button
                  className="button button-primary"
                  onClick={() => {
                    setViewingPet(null);
                    setAppointmentFormOpen(true);
                    navigate('/portal/appointments');
                  }}
                >
                  Book appointment
                </button>
              </div>
            </section>
          </div>
        )}
      </>
    );
  }

  function renderAppointments() {
    const filteredAppointments = appointments.filter(
      (appointment) => appointmentFilter === 'ALL' || appointment.status === appointmentFilter,
    );

    return (
      <>
        <PageHeading
          title="My appointments"
          subtitle="Request new visits, reschedule, or cancel upcoming appointments for your pets."
          action={
            <button
              className="button button-primary"
              onClick={() => setAppointmentFormOpen(!appointmentFormOpen)}
            >
              <ClinicIcon name="plus" size={16} />Book appointment
            </button>
          }
        />

        {!pets.length && !loading && renderCustomerPetForm({
          title: 'Step 1: Add your pet to book an appointment',
          subtitle: 'You don’t have a pet profile on your account yet. Add your pet below and you can book a visit right away.',
          onAdded: () => setAppointmentFormOpen(true),
        })}

        {appointmentFormOpen && pets.length > 0 && (
          <form
            key={pets.map((pet) => pet.id).join(',')}
            className="form-panel"
            onSubmit={async (event) => {
              event.preventDefault();
              const formElement = event.currentTarget;
              const form = new FormData(formElement);
              const ok = await perform(
                () => api.portal.addAppointment({
                  petId: Number(form.get('petId')),
                  appointmentTime: String(form.get('appointmentTime')),
                  reason: String(form.get('reason')).trim(),
                  staffId: Number(form.get('staffId')) || null,
                }),
                'Appointment requested. The clinic will confirm your slot shortly.',
              );
              if (ok) {
                formElement.reset();
                setAppointmentFormOpen(false);
              }
            }}
          >
            <h3>Book a clinic visit</h3>
            <div className="form-grid">
              <Field label="Pet">
                <select name="petId" required defaultValue={pets[0]?.id ?? ''}>
                  <option value="" disabled>Select your pet</option>
                  {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name} ({pet.species})</option>)}
                </select>
              </Field>
              <Field label="Preferred date and time">
                <input type="datetime-local" name="appointmentTime" min={localDateTime(0)} defaultValue={localDateTime()} required />
              </Field>
              <Field label="Preferred veterinarian / staff (optional)">
                <select name="staffId" defaultValue="">
                  <option value="">First available staff</option>
                  {clinicStaff.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
                </select>
              </Field>
              <Field label="Reason for visit">
                <input name="reason" required maxLength={500} placeholder="Check-up, vaccination, grooming..." />
              </Field>
            </div>
            <FormActions onCancel={() => setAppointmentFormOpen(false)} submit="Request appointment" disabled={!pets.length} />
          </form>
        )}

        <section className="panel pet-selector">
          <label htmlFor="portal-appointment-filter">Status</label>
          <select id="portal-appointment-filter" value={appointmentFilter} onChange={(event) => setAppointmentFilter(event.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <span className="count-pill">{filteredAppointments.length} of {appointments.length}</span>
        </section>

        <section className="panel table-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">VISIT SCHEDULE</span><h3>Your appointments</h3></div>
            <span className="count-pill">{filteredAppointments.length} visits</span>
          </div>
          {filteredAppointments.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Pet</th><th>Date &amp; time</th><th>Assigned staff</th><th>Visit reason</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filteredAppointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td><strong>{appointment.petLabel}</strong></td>
                      <td>{formatDateTime(appointment.appointmentTime)}</td>
                      <td>{appointment.staffName || 'Clinic team'}</td>
                      <td>{appointment.reason}</td>
                      <td><StatusBadge status={appointment.status} /></td>
                      <td>
                        <div className="action-row">
                          {appointment.status !== 'CANCELLED' && (
                            <button
                              className="small-button"
                              onClick={() => {
                                setRescheduling(appointment.id);
                                setRescheduleTime(appointment.appointmentTime.slice(0, 16));
                              }}
                            >
                              Reschedule
                            </button>
                          )}
                          {appointment.status !== 'CANCELLED' && (
                            <button
                              className="small-button danger"
                              onClick={() => void perform(() => api.portal.cancelAppointment(appointment.id), 'Appointment cancelled.')}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                        {rescheduling === appointment.id && (
                          <form
                            className="reschedule-form"
                            onSubmit={async (event) => {
                              event.preventDefault();
                              const ok = await perform(
                                () => api.portal.reschedule(appointment.id, rescheduleTime),
                                'Appointment rescheduled and awaiting confirmation.',
                              );
                              if (ok) setRescheduling(null);
                            }}
                          >
                            <input
                              aria-label="New appointment date and time"
                              type="datetime-local"
                              min={localDateTime(0)}
                              value={rescheduleTime}
                              onChange={(event) => setRescheduleTime(event.target.value)}
                              required
                            />
                            <button className="small-button positive">Save</button>
                            <button type="button" className="small-button" onClick={() => setRescheduling(null)}>Close</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message={pets.length ? 'No appointments match the selected filter.' : 'Your appointments will appear here once a pet is linked to your account.'} />
          )}
        </section>
      </>
    );
  }

  function renderRecords() {
    const filteredRecords = records.filter((record) => `${record.diagnosis} ${record.treatment} ${record.notes ?? ''} ${record.medications ?? ''}`
      .toLowerCase().includes(recordSearch.toLowerCase()));

    return (
      <>
        <PageHeading
          title="Medical records"
          subtitle="Read-only clinical records and downloadable PDF summaries for your pets."
        />
        <section className="panel pet-selector">
          <label htmlFor="portal-record-pet">Records for</label>
          <select id="portal-record-pet" value={selectedPetId} onChange={(event) => setSelectedPetId(Number(event.target.value) || '')}>
            {!pets.length && <option value="">No linked pets yet</option>}
            {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name} ({pet.species})</option>)}
          </select>
          {selectedPet && <p>{selectedPet.species}{selectedPet.breed ? ` · ${selectedPet.breed}` : ''}</p>}
          <button
            className="small-button"
            disabled={!selectedPet}
            onClick={() => {
              if (selectedPet) {
                void downloadDocument(
                  () => api.portal.downloadMedicalHistoryPdf(selectedPet.id),
                  'Medical history PDF downloaded.',
                );
              }
            }}
          >
            Download full history PDF
          </button>
        </section>

        <section className="panel pet-selector">
          <label htmlFor="portal-record-search">Search records</label>
          <input
            id="portal-record-search"
            value={recordSearch}
            onChange={(event) => setRecordSearch(event.target.value)}
            placeholder="Diagnosis, treatment, or medications"
          />
        </section>

        <section className="record-list">
          {filteredRecords.map((record) => (
            <article className="record-card" key={record.id}>
              <div className="record-date">
                {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${record.recordDate}T00:00:00`))}
              </div>
              <div className="record-content">
                <div><span className="eyebrow">DIAGNOSIS</span><p>{record.diagnosis}</p></div>
                <div><span className="eyebrow">TREATMENT</span><p>{record.treatment}</p></div>
                {record.notes && <div><span className="eyebrow">NOTES</span><p>{record.notes}</p></div>}
                {(record.weightKg != null || record.temperatureC != null || record.heartRateBpm != null || record.respiratoryRateBpm != null
                  || record.medications || record.followUpDate) && (
                  <div className="clinical-details">
                    <span className="eyebrow">VITALS &amp; FOLLOW-UP</span>
                    <p>{[
                      record.weightKg != null ? `${record.weightKg} kg` : null,
                      record.temperatureC != null ? `${record.temperatureC} °C` : null,
                      record.heartRateBpm != null ? `${record.heartRateBpm} bpm` : null,
                      record.respiratoryRateBpm != null ? `${record.respiratoryRateBpm} breaths/min` : null,
                      record.medications ? `Medication: ${record.medications}` : null,
                      record.followUpDate ? `Follow-up: ${record.followUpDate}` : null,
                    ].filter(Boolean).join(' · ')}</p>
                  </div>
                )}
              </div>
              {selectedPet && (
                <button
                  className="small-button"
                  onClick={() => void downloadDocument(
                    () => api.portal.downloadMedicalRecordPdf(selectedPet.id, record.id),
                    'Medical record PDF downloaded.',
                  )}
                >
                  Download PDF
                </button>
              )}
            </article>
          ))}
          {!filteredRecords.length && (
            <EmptyState
              message={!records.length
                ? (selectedPet ? 'No medical records recorded for this pet yet.' : 'Select a pet to view medical records.')
                : 'No medical records match your search.'}
            />
          )}
        </section>
      </>
    );
  }

  function renderPayments() {
    const filteredPayments = payments.filter((payment) => paymentFilter === 'ALL' || payment.status === paymentFilter);
    const paidTotal = filteredPayments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
    const unpaidTotal = filteredPayments.filter((p) => p.status === 'UNPAID').reduce((sum, p) => sum + p.amount, 0);

    return (
      <>
        <PageHeading
          title="Bills & receipts"
          subtitle="Review your clinic invoices, balances, and downloadable receipts."
        />
        <section className="stat-grid">
          <StatCard label="Paid total" value={money(paidTotal)} icon="check" />
          <StatCard label="Outstanding balance" value={money(unpaidTotal)} icon="payments" />
        </section>
        <section className="panel pet-selector">
          <label htmlFor="portal-payment-filter">Status</label>
          <select id="portal-payment-filter" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
            <option value="ALL">All bills</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PAID">Paid</option>
          </select>
        </section>
        <section className="panel table-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">BILLING HISTORY</span><h3>Invoices &amp; receipts</h3></div>
            <span className="count-pill">{filteredPayments.length} of {payments.length}</span>
          </div>
          {filteredPayments.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Pet</th><th>Description</th><th>Amount</th><th>Status</th><th>Documents</th></tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td><strong>{payment.petLabel}</strong></td>
                      <td>{payment.items?.length
                        ? payment.items.map((item) => `${item.description} × ${item.quantity}`).join(', ')
                        : payment.description}</td>
                      <td className="amount">{money(payment.amount)}</td>
                      <td><StatusBadge status={payment.status} /></td>
                      <td>
                        <div className="action-row">
                          <button
                            className="small-button"
                            onClick={() => void downloadDocument(
                              () => api.portal.downloadPaymentPdf(payment),
                              payment.status === 'PAID' ? 'Receipt PDF downloaded.' : 'Invoice PDF downloaded.',
                            )}
                          >
                            {payment.status === 'PAID' ? 'Download receipt PDF' : 'Download invoice PDF'}
                          </button>
                          {payment.status === 'PAID' && (
                            <button
                              className="text-button"
                              onClick={async () => {
                                setError('');
                                try {
                                  setReceipt(await api.portal.receipt(payment.id));
                                } catch (requestError) {
                                  setError(requestError instanceof Error ? requestError.message : 'Could not load receipt.');
                                }
                              }}
                            >
                              View receipt <ClinicIcon name="arrow" size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No bills or receipts recorded under your account yet." />
          )}
        </section>
        {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
      </>
    );
  }

  function renderAccount() {
    return (
      <>
        <PageHeading
          title="My account"
          subtitle="Keep your owner contact details and password up to date."
          action={<span className="count-pill">CUSTOMER</span>}
        />
        <form
          key={`${overview.ownerId}-${overview.ownerName}-${overview.phone ?? ''}-${overview.address ?? ''}`}
          className="form-panel"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setProfileBusy(true);
            setError('');
            setNotice('');
            try {
              const updated = await api.portal.updateProfile({
                name: String(form.get('name')).trim(),
                phone: String(form.get('phone') ?? '').trim() || null,
                address: String(form.get('address') ?? '').trim() || null,
              });
              onDisplayNameChanged(updated.name);
              setNotice('Contact profile updated.');
              await refresh();
            } catch (requestError) {
              setError(requestError instanceof Error ? requestError.message : 'Could not update your profile.');
            } finally {
              setProfileBusy(false);
            }
          }}
        >
          <h3>Owner contact details</h3>
          <div className="form-grid">
            <Field label="Full name">
              <input name="name" required maxLength={120} defaultValue={overview.ownerName || user.displayName || ''} />
            </Field>
            <Field label="Email address">
              <input value={user.email ?? ''} disabled readOnly />
            </Field>
            <Field label="Phone">
              <input name="phone" maxLength={32} defaultValue={overview.phone ?? ''} placeholder="09XX XXX XXXX" />
            </Field>
            <Field label="Address">
              <input name="address" maxLength={500} defaultValue={overview.address ?? ''} placeholder="Street, city" />
            </Field>
          </div>
          <div className="form-actions">
            <button className="button button-primary" disabled={profileBusy}>
              {profileBusy ? 'Saving…' : 'Save contact details'}
            </button>
          </div>
        </form>

        <form
          className="form-panel"
          onSubmit={async (event) => {
            event.preventDefault();
            const formElement = event.currentTarget;
            const form = new FormData(formElement);
            setPasswordBusy(true);
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
              setPasswordBusy(false);
            }
          }}
        >
          <h3>Change password</h3>
          <div className="form-grid">
            <PasswordField label="Current password" name="currentPassword" autoComplete="current-password" required />
            <PasswordField label="New password" name="newPassword" autoComplete="new-password" minLength={8} maxLength={72} required />
          </div>
          <div className="form-actions">
            <button className="button button-primary" disabled={passwordBusy}>
              {passwordBusy ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand-row">
          <Link className="brand" to="/portal/overview">
            <BrandLogo size={39} />
            <span>ALPHA <strong>DAWGS</strong><small>PET OWNER PORTAL</small></span>
          </Link>
          <button className="mobile-sign-out" onClick={() => void onSignOut()}>Log out</button>
        </div>
        <div className="nav-caption">MY PORTAL</div>
        <nav aria-label="Customer navigation">
          {portalNavigation.map((item) => (
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
          <small>{user.email} · CUSTOMER</small>
          <button className="sign-out-button" onClick={() => void onSignOut()}>Log out</button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">CUSTOMER PORTAL</span>
            <h1>{currentNav.label}</h1>
          </div>
          <div className="topbar-right">
            <span className="today-label">{new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date())}</span>
            <button className="icon-button" onClick={() => void refresh()} aria-label="Refresh data">
              <ClinicIcon name="refresh" size={18} />
            </button>
          </div>
        </header>
        {error && (
          <div className="alert alert-error" role="alert">
            <strong>Something went wrong.</strong> {error}
            <button aria-label="Dismiss error" onClick={() => setError('')}><ClinicIcon name="close" size={16} /></button>
          </div>
        )}
        {notice && (
          <div className="alert alert-success" role="status">
            {notice}
            <button aria-label="Dismiss message" onClick={() => setNotice('')}><ClinicIcon name="close" size={16} /></button>
          </div>
        )}
        {loading && !pets.length && !overview.ownerId ? (
          <div className="loading-state">Loading your pet portal…</div>
        ) : (
          <Routes>
            <Route path="overview" element={renderOverview()} />
            <Route path="pets" element={renderPets()} />
            <Route path="appointments" element={renderAppointments()} />
            <Route path="records" element={renderRecords()} />
            <Route path="payments" element={renderPayments()} />
            <Route path="account" element={renderAccount()} />
            <Route path="*" element={<Navigate to="/portal/overview" replace />} />
          </Routes>
        )}
        <footer className="page-footer">Alpha Dawgs Veterinary Clinic <span>·</span> Care for every companion</footer>
      </main>
    </div>
  );
}
