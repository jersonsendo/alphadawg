import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import type { Payment, Pet } from '../api';

export type ClinicIconName =
  | 'overview'
  | 'pets'
  | 'owners'
  | 'appointments'
  | 'records'
  | 'payments'
  | 'inventory'
  | 'settings'
  | 'clinic'
  | 'paw'
  | 'clock'
  | 'check'
  | 'plus'
  | 'arrow'
  | 'close'
  | 'refresh'
  | 'eye'
  | 'eye-off';

export const CLINIC_LOGO_IMG = '/images/clinic-logo.jpg';
export const CLINIC_HERO_IMG = '/images/clinic-hero.jpg';

export function petAvatarImage(species: string | null | undefined): string {
  const normalized = (species ?? '').trim().toLowerCase();
  if (normalized.includes('cat') || normalized.includes('feline') || normalized.includes('kitten')) {
    return '/images/pet-cat.jpg';
  }
  if (normalized.includes('dog') || normalized.includes('canine') || normalized.includes('pup')) {
    return '/images/pet-dog.jpg';
  }
  return '/images/pet-other.jpg';
}

export function BrandLogo({ size = 39 }: { size?: number }) {
  return (
    <span className="brand-mark brand-mark-image" style={{ width: size, height: size }}>
      <img src={CLINIC_LOGO_IMG} alt="Alpha Dawgs Veterinary Clinic logo" width={size} height={size} />
    </span>
  );
}

export function PetAvatar({ species, name, size = 52 }: { species: string; name: string; size?: number }) {
  return (
    <div className="pet-avatar pet-avatar-photo" style={{ width: size, height: size, flexBasis: size }}>
      <img src={petAvatarImage(species)} alt={`${name} (${species})`} width={size} height={size} loading="lazy" />
    </div>
  );
}

export function ClinicIcon({ name, size = 20 }: { name: ClinicIconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      data-icon={name}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {name === 'overview' && <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /></>}
      {(name === 'paw' || name === 'pets') && <><ellipse cx="7.4" cy="8" rx="1.8" ry="2.4" fill="currentColor" stroke="none" /><ellipse cx="16.6" cy="8" rx="1.8" ry="2.4" fill="currentColor" stroke="none" /><ellipse cx="4.7" cy="13" rx="1.6" ry="2.1" fill="currentColor" stroke="none" /><ellipse cx="19.3" cy="13" rx="1.6" ry="2.1" fill="currentColor" stroke="none" /><path d="M12 12.5c-2.9 0-5.7 4.2-4.3 6.2 1 1.5 2.7.3 4.3.3s3.3 1.2 4.3-.3c1.4-2-1.4-6.2-4.3-6.2Z" fill="currentColor" stroke="none" /></>}
      {name === 'owners' && <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 8v6m-3-3h6" /></>}
      {name === 'appointments' && <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /><path d="m9 15 2 2 4-4" /></>}
      {name === 'records' && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h8" /><path d="M10 9h.01" /></>}
      {name === 'payments' && <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /><circle cx="17" cy="15" r="1" /></>}
      {name === 'inventory' && <><path d="m3 7 9-4 9 4-9 4-9-4Z" /><path d="M3 7v10l9 4 9-4V7M12 11v10" /></>}
      {name === 'settings' && <><path d="M4 7h10M18 7h2M4 17h2m4 0h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>}
      {name === 'clinic' && <><path d="M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" /><path d="M12 8v7M8.5 11.5h7" /></>}
      {name === 'clock' && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
      {name === 'check' && <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>}
      {name === 'plus' && <><path d="M12 5v14M5 12h14" /></>}
      {name === 'arrow' && <><path d="M5 12h14M13 6l6 6-6 6" /></>}
      {name === 'close' && <><path d="m6 6 12 12M18 6 6 18" /></>}
      {name === 'refresh' && <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" /></>}
      {name === 'eye' && <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>}
      {name === 'eye-off' && <><path d="m3 3 18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a14 14 0 0 1-3 3.8M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10.7 10.7 0 0 0 2.1-.2" /></>}
    </svg>
  );
}

export function localDateTime(daysAhead = 1) {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  if (daysAhead === 0) date.setMinutes(date.getMinutes() + 1, 0, 0);
  else date.setMinutes(0, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function money(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
}

export function optionalNumber(value: FormDataEntryValue | null): number | null {
  if (value == null || String(value).trim() === '') return null;
  return Number(value);
}

export function petSex(value: FormDataEntryValue | null): Pet['sex'] {
  return value === 'MALE' || value === 'FEMALE' || value === 'UNKNOWN' ? value : null;
}

export function StatCard({ label, value, icon }: { label: string; value: number | string; icon: ClinicIconName }) {
  return (
    <article className="stat-card">
      <div className="stat-icon"><ClinicIcon name={icon} size={20} /></div>
      <div><span>{label}</span><strong>{value}</strong></div>
    </article>
  );
}

export function PageHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

export function PasswordField({ label, ...inputProps }: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const inputId = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <span className="password-control">
        <input {...inputProps} id={inputId} type={visible ? 'text' : 'password'} />
        <button
          type="button"
          className="password-visibility-toggle"
          aria-controls={inputId}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <ClinicIcon name={visible ? 'eye-off' : 'eye'} size={16} />
        </button>
      </span>
    </div>
  );
}

export function FormActions({ onCancel, submit, disabled = false }: { onCancel: () => void; submit: string; disabled?: boolean }) {
  return (
    <div className="form-actions">
      <button type="button" className="button button-light" onClick={onCancel}>Cancel</button>
      <button className="button button-primary" disabled={disabled}>{submit}</button>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="empty-state">
      <img className="empty-logo" src={CLINIC_LOGO_IMG} alt="" width={40} height={40} />
      <p>{message}</p>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${status.toLowerCase()}`}><span />{status.toLowerCase().replace('_', ' ')}</span>;
}

export function ReceiptModal({ receipt, onClose }: { receipt: Payment; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="receipt-card" role="dialog" aria-modal="true" aria-labelledby="receipt-title" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" aria-label="Close receipt" onClick={onClose}><ClinicIcon name="close" size={18} /></button>
        <div className="receipt-header">
          <BrandLogo size={34} />
          <div>
            <span className="eyebrow">ALPHA DAWGS VETERINARY CLINIC</span>
            <h2 id="receipt-title">Payment receipt</h2>
          </div>
        </div>
        <p className="receipt-number">{receipt.receiptNo}</p>
        <div className="receipt-line"><span>Pet / owner</span><strong>{receipt.petLabel}</strong></div>
        {receipt.items?.length ? (
          <div className="receipt-items">
            <span className="eyebrow">ITEMIZED CHARGES</span>
            {receipt.items.map((item, index) => (
              <div className="receipt-line" key={item.id ?? index}>
                <span>{item.description} × {item.quantity}</span>
                <strong>{money(item.lineTotal)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="receipt-line"><span>Service</span><strong>{receipt.description}</strong></div>
        )}
        <div className="receipt-line"><span>Payment method</span><strong>{receipt.paymentMethod}</strong></div>
        <div className="receipt-line"><span>Paid on</span><strong>{receipt.paidAt ? formatDateTime(receipt.paidAt) : '—'}</strong></div>
        <div className="receipt-total"><span>Total paid</span><strong>{money(receipt.amount)}</strong></div>
        <button className="button button-primary full-width" onClick={() => window.print()}>Print receipt</button>
      </section>
    </div>
  );
}
