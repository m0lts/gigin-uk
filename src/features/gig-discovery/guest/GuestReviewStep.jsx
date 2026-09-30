import { formatClock, slotEnd } from './guestFormat';

export function GuestReviewStep({ draft, slots, bookerName, patch, onJump, summary = false, readOnly = false }) {
  const chosen = slots.filter((slot) => draft.slotGigIds.includes(slot.gigId));
  const setLabel = chosen.map((slot, index) => `Set ${slots.indexOf(slot) + 1} · ${formatClock(slot.startTime)}${slotEnd(slot) ? `–${slotEnd(slot)}` : ''}`).join(', ') || 'No set chosen';
  const linkCount = Object.values(draft.links || {}).filter((value) => String(value || '').trim()).length;
  const photoBits = [
    draft.photo ? 'Press photo' : '',
    linkCount ? `${linkCount} link${linkCount === 1 ? '' : 's'}` : '',
    draft.assets.length ? `${draft.assets.length} file${draft.assets.length === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  const members = draft.members.filter((member) => member.name || member.instruments.length);
  return (
    <div className="ga-step">
      {!summary && <h2>Nearly done</h2>}
      {!summary && <label className="ga-field">
        <span>Note to {bookerName} <em>{draft.note.length}/500</em></span>
        <textarea maxLength={500} rows={4} value={draft.note} onChange={(event) => patch({ note: event.target.value.slice(0, 500) })} placeholder="Anything they should know before the night." />
      </label>}
      <div className="ga-review">
        <Row readOnly={readOnly} label="Act and contact" value={`${draft.actName || '—'} · ${draft.contactName || '—'}`} onEdit={() => onJump('who')} />
        <Row readOnly={readOnly} label="Set" value={setLabel} onEdit={() => onJump('who')} />
        <Row readOnly={readOnly} label="Photo and links" value={photoBits.length ? photoBits.join(' · ') : 'Skipped'} muted={!photoBits.length} onEdit={() => onJump('assets')} />
        <Row readOnly={readOnly} label="Tech rider" value={`${members.length} member${members.length === 1 ? '' : 's'}, using ${draft.needs.length} of the bar's items, bringing ${draft.bringOwn.length}`} onEdit={() => onJump('tech')} />
      </div>
      {!summary && <p className="ga-fine">{bookerName} will see everything above. We'll email you a copy with a private link to change or withdraw it.</p>}
    </div>
  );
}

function Row({ label, value, onEdit, muted, readOnly }) {
  return (
    <div className="ga-review__row">
      <span>{label}</span>
      <strong className={muted ? 'is-muted' : ''}>{value}</strong>
      {readOnly ? <span /> : <button type="button" onClick={onEdit}>Edit</button>}
    </div>
  );
}
