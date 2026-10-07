import { preferenceReview } from './guestFormat';

export function GuestReviewStep({ draft, slots, bookerName, patch, onJump, summary = false, readOnly = false, editLabel = 'Edit', rowTags = null, noteHint = '' }) {
  const ids = draft.preferredSlotGigIds || draft.slotGigIds || [];
  const setLabel = preferenceReview(slots, ids);
  const oneSet = slots.length < 2;
  const linkCount = Object.values(draft.links || {}).filter((value) => String(value || '').trim()).length;
  const photoBits = [
    draft.photo ? 'Press photo' : '',
    linkCount ? `${linkCount} link${linkCount === 1 ? '' : 's'}` : '',
    draft.assets.length ? `${draft.assets.length} file${draft.assets.length === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  const members = draft.members.filter((member) => member.name || member.instruments.length);
  const techEmpty = members.length === 0 && draft.needs.length === 0 && draft.bringOwn.length === 0;
  const techSummary = techEmpty
    ? 'None'
    : `${members.length} member${members.length === 1 ? '' : 's'}, using ${draft.needs.length} of the bar's items, bringing ${draft.bringOwn.length}`;
  return (
    <div className="ga-step">
      {!summary && <h2>Nearly done</h2>}
      {!summary && <label className="ga-field">
        <span>Note to {bookerName} <em>{draft.note.length}/500</em></span>
        <textarea maxLength={500} rows={4} value={draft.note} onChange={(event) => patch({ note: event.target.value.slice(0, 500) })} placeholder="Anything they should know before the night." />
        {noteHint && <small>{noteHint}</small>}
      </label>}
      <div className="ga-review">
        <Row readOnly={readOnly} editLabel={editLabel} tag={rowTags?.who} label="Act and contact" value={`${draft.actName || '—'} · ${draft.contactName || '—'}`} onEdit={() => onJump('who')} />
        {!oneSet && <Row readOnly={readOnly} editLabel={editLabel} label="Set preference" value={setLabel} muted={!ids.length} onEdit={() => onJump('who')} />}
        <Row readOnly={readOnly} editLabel={editLabel} tag={rowTags?.assets} label="Photo and links" value={photoBits.length ? photoBits.join(' · ') : 'Skipped'} muted={!photoBits.length} onEdit={() => onJump('assets')} />
        <Row readOnly={readOnly} editLabel={editLabel} tag={rowTags?.tech} label="Tech rider" value={techSummary} muted={techEmpty} onEdit={() => onJump('tech')} />
      </div>
      {!summary && <p className="ga-fine">{bookerName} will see everything above. We'll email you a copy with a private link to change or withdraw it.</p>}
    </div>
  );
}

function Row({ label, value, onEdit, muted, readOnly, editLabel, tag }) {
  return (
    <div className="ga-review__row">
      <span>{label}</span>
      <strong className={muted ? 'is-muted' : ''}>{value}{tag ? ` · ${tag}` : ''}</strong>
      {readOnly ? <span /> : <button type="button" onClick={onEdit}>{editLabel}</button>}
    </div>
  );
}
