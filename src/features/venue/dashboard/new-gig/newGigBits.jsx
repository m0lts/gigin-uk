import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FEATURES } from '../../../../config/features';
import { feeDigits } from './useNewGigDraft';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function dateChip(iso) {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  const weekday = WEEKDAYS[(date.getDay() + 6) % 7];
  return `${weekday} ${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]}`;
}

export function CloseButton({ onClick, label = 'Close' }) {
  return (
    <button type="button" className="ng-icon" aria-label={label} onClick={onClick}>
      <FontAwesomeIcon icon={faXmark} />
    </button>
  );
}

export function TimeField({ label, value, onChange }) {
  return (
    <label className="ng-field">
      <span>{label}</span>
      <input className="ng-input ng-mono" type="time" value={value || ''} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function FeeField({ label, value, onChange }) {
  return (
    <label className="ng-field">
      <span>{label}</span>
      <input
        className="ng-input ng-mono"
        inputMode="numeric"
        placeholder="£"
        value={value === '' || value == null ? '' : `£${feeDigits(value)}`}
        onChange={(event) => onChange(feeDigits(event.target.value))}
      />
    </label>
  );
}

export function KindCards({ kind, onChange }) {
  return (
    <div className="ng-kind">
      <button type="button" className={kind === 'find' ? 'is-on' : ''} onClick={() => onChange('find')}>
        <strong>No, find an artist</strong>
        <span>Offer it to artists you know, or let artists apply.</span>
      </button>
      <button type="button" className={kind === 'booked' ? 'is-on' : ''} onClick={() => onChange('booked')}>
        <strong>Yes, add them</strong>
        <span>Adds a confirmed gig to your calendar.</span>
      </button>
    </div>
  );
}

export function ContactRadios({ contacts, artistId, onPick }) {
  const rows = contacts.slice(0, 4);
  if (!rows.length) return <p className="ng-quiet">No contacts yet. You can add the name in the full form.</p>;
  return (
    <div className="ng-contacts">
      {rows.map((contact) => {
        const id = contact.id || contact.artistId;
        const on = artistId === id;
        return (
          <button key={id} type="button" className={on ? 'is-on' : ''} onClick={() => onPick(contact)}>
            <span className="ng-avatar">{initials(contact.name)}</span>
            <span>{contact.name}</span>
            <span className={`ng-radio${on ? ' is-on' : ''}`} />
          </button>
        );
      })}
    </div>
  );
}

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
}

export function paymentsOn() {
  return FEATURES.payments;
}

export function ticketingOn() {
  return FEATURES.ticketing;
}
