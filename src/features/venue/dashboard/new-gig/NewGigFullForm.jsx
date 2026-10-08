import { useEffect, useState } from 'react';
import { BookNewEventListingPreview } from '../BookNewEventListingPreview';
import { LOOKING_FOR, draftToFormGig, feeDigits } from './useNewGigDraft';
import { CloseButton, FeeField, TimeField, dateChip, initials, paymentsOn, ticketingOn } from './newGigBits';

export function NewGigFullForm({
  draft,
  patch,
  check,
  venue,
  venues,
  onVenue,
  templates,
  contacts,
  submitting,
  scrollTo,
  onClose,
  onSaveTemplate,
  onCreate,
  onOffer,
}) {
  const [templateOpen, setTemplateOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [extraDate, setExtraDate] = useState('');
  const gig = draftToFormGig(draft, venue);
  const template = templates.find((item) => (item.templateId || item.id) === draft.templateId);
  const split = draft.sets.length > 1;

  useEffect(() => {
    if (!scrollTo) return;
    document.querySelector(`[data-section="${scrollTo}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scrollTo]);

  const addDate = () => {
    if (!extraDate || draft.dates.includes(extraDate)) return;
    patch({ dates: [...draft.dates, extraDate].sort() });
    setExtraDate('');
  };

  return (
    <div className="ng-backdrop" onClick={onClose}>
      <div className="ng-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="New gig">
        <header className="ng-modal__head">
          <h2>New gig</h2>
          <div className="ng-segment" role="group">
            <button type="button" className={draft.kind === 'find' ? 'is-on' : ''} onClick={() => patch({ kind: 'find' })}>Finding an artist</button>
            <button type="button" className={draft.kind === 'booked' ? 'is-on' : ''} onClick={() => patch({ kind: 'booked' })}>Already booked</button>
          </div>
          <div className="ng-template">
            <button type="button" onClick={() => setTemplateOpen((open) => !open)}>
              Template <strong>{template?.name || template?.templateName || 'None'}</strong> ▾
            </button>
            {templateOpen && (
              <div className="ng-menu">
                <button type="button" onClick={() => { patch({ templateId: '', applyTemplate: null }); setTemplateOpen(false); }}>Blank gig</button>
                {templates.map((item) => (
                  <button key={item.templateId || item.id} type="button" onClick={() => { patch({ applyTemplate: item }); setTemplateOpen(false); }}>
                    <strong>{item.name || item.templateName}</strong>
                    <span className="ng-mono">{item.timingMusicStartTime || item.startTime || 'Saved setup'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <CloseButton onClick={onClose} />
        </header>
        <div className="ng-modal__body">
          <div className="ng-form">
            {venues.length > 1 && (
              <label className="ng-field">
                <span>Venue</span>
                <select className="ng-input" value={venue?.venueId || ''} onChange={(event) => onVenue(event.target.value)}>
                  {venues.map((item) => <option key={item.venueId} value={item.venueId}>{item.name}</option>)}
                </select>
              </label>
            )}
            <Section id="when" title="When" done={check.rows.find((row) => row.id === 'when')?.ok}>
              <div className="ng-when">
                <label className="ng-field">
                  <span>Date</span>
                  <input className="ng-input ng-mono" type="date" value={draft.dates[0] || ''} onChange={(event) => patch({ dates: event.target.value ? [event.target.value, ...draft.dates.slice(1)] : draft.dates.slice(1) })} />
                </label>
                <TimeField label="Starts" value={draft.start} onChange={(start) => patch({ start })} />
                <TimeField label="Ends" value={draft.end} onChange={(end) => patch({ end })} />
              </div>
              {draft.dates.length > 1 && (
                <div className="ng-dates">
                  {draft.dates.map((iso) => (
                    <span key={iso}>{dateChip(iso)} <button type="button" aria-label={`Remove ${iso}`} onClick={() => patch({ dates: draft.dates.filter((item) => item !== iso) })}>×</button></span>
                  ))}
                </div>
              )}
              <button type="button" className="ng-dashed" onClick={() => setRepeatOpen((open) => !open)}>+ Repeat on more dates</button>
              {repeatOpen && (
                <div className="ng-repeat">
                  <input type="date" value={extraDate} onChange={(event) => setExtraDate(event.target.value)} />
                  <button type="button" onClick={addDate}>Add date</button>
                </div>
              )}
              <div className="ng-toggle-row">
                <span>Split the night into sets</span>
                <button type="button" className={`ng-switch${split ? ' is-on' : ''}`} aria-pressed={split} onClick={() => patch({ sets: split ? [] : [{ start: draft.start, end: draft.end, fee: draft.fee }, { start: '', end: '', fee: draft.fee }] })} />
              </div>
              {split && draft.sets.map((set, index) => (
                <div className="ng-three" key={index}>
                  <TimeField label={`Set ${index + 1} starts`} value={set.start} onChange={(start) => updateSet(draft, patch, index, { start })} />
                  <TimeField label="Ends" value={set.end} onChange={(end) => updateSet(draft, patch, index, { end })} />
                  {paymentsOn() && <FeeField label="Fee" value={set.fee} onChange={(fee) => updateSet(draft, patch, index, { fee })} />}
                </div>
              ))}
            </Section>
            {draft.kind === 'find' && (paymentsOn() || ticketingOn()) && (
              <Section id="fee" title="Fee and tickets" done={check.rows.find((row) => row.id === 'fee')?.ok}>
                {paymentsOn() && (
                  <FeeField label="Fee per set" value={draft.fee} onChange={(fee) => patch({ fee, sets: draft.sets.map((set) => ({ ...set, fee })) })} />
                )}
                {paymentsOn() && <p className="ng-help">Set 0 for no fee.</p>}
                {ticketingOn() && (
                  <div className="ng-segment">
                    {[['free', 'Not ticketed'], ['venue', 'I sell'], ['artist', 'Artist sells']].map(([key, label]) => (
                      <button key={key} type="button" className={draft.tickets === key ? 'is-on' : ''} onClick={() => patch({ tickets: key })}>{label}</button>
                    ))}
                  </div>
                )}
              </Section>
            )}
            {draft.kind === 'find' && (
              <Section id="listing" title="Listing" done={!!draft.title}>
                <label className="ng-field">
                  <span>Title</span>
                  <input className="ng-input" value={draft.title} placeholder={venue?.name ? `Gig at ${venue.name}` : 'Gig title'} onChange={(event) => patch({ title: event.target.value })} />
                </label>
                <label className="ng-field">
                  <span>Description <em>{draft.description.length}/250</em></span>
                  <textarea className="ng-input" maxLength={250} rows={4} value={draft.description} onChange={(event) => patch({ description: event.target.value.slice(0, 250) })} />
                </label>
                <div className="ng-chips">
                  {LOOKING_FOR.map((option) => {
                    const on = draft.lookingFor.includes(option);
                    return (
                      <button key={option} type="button" className={on ? 'is-on' : ''} onClick={() => patch({ lookingFor: on ? draft.lookingFor.filter((item) => item !== option) : [...draft.lookingFor, option] })}>
                        {option}
                      </button>
                    );
                  })}
                </div>
                <div className="ng-toggle-row">
                  <span>Show on my venue profile</span>
                  <button type="button" className={`ng-switch${draft.showOnProfile ? ' is-on' : ''}`} aria-pressed={draft.showOnProfile} onClick={() => patch({ showOnProfile: !draft.showOnProfile })} />
                </div>
              </Section>
            )}
            {draft.kind === 'booked' && (
              <Section id="who" title="Who's playing" done={!!draft.artistName}>
                <div className="ng-contact-grid">
                  {contacts.slice(0, 8).map((contact) => {
                    const id = contact.id || contact.artistId;
                    const on = draft.artistId === id;
                    return (
                      <button key={id} type="button" className={on ? 'is-on' : ''} onClick={() => patch({ artistId: id, artistName: contact.name })}>
                        <span className="ng-avatar">{initials(contact.name)}</span>
                        <span>{contact.name}</span>
                      </button>
                    );
                  })}
                </div>
                <label className="ng-field">
                  <span>Or type a name</span>
                  <input className="ng-input" value={draft.artistName} onChange={(event) => patch({ artistName: event.target.value, artistId: '' })} />
                </label>
                {paymentsOn() && <FeeField label="Agreed fee" value={draft.fee} onChange={(fee) => patch({ fee })} />}
                <label className="ng-checkrow">
                  <input type="checkbox" checked={draft.paidVia === 'gigin'} onChange={(event) => patch({ paidVia: event.target.checked ? 'gigin' : 'outside' })} />
                  Pay through Gigin
                </label>
                <label className="ng-field">
                  <span>Note to the artist</span>
                  <textarea className="ng-input" rows={3} value={draft.note} onChange={(event) => patch({ note: event.target.value })} />
                </label>
              </Section>
            )}
          </div>
          <aside className="ng-side">
            <BookNewEventListingPreview compact kind={draft.kind} gig={{ ...gig, gigName: String(draft.title || '').trim() }} venue={venue} dateIso={draft.dates[0] ? dateChip(draft.dates[0]) : ''} artistName={draft.artistName} />
            <div className="ng-ready">
              <div className="ng-ready__title"><span>Ready to publish</span><span className="ng-mono">{check.done}/{check.total}</span></div>
              {check.rows.map((row) => (
                <div key={row.id} className="ng-ready__row">
                  <span className={`ng-tick${row.ok ? ' is-on' : ''}`}>{row.ok ? '✓' : ''}</span>
                  <span>{row.label}</span>
                  {!row.ok ? <em>{row.tone}</em> : null}
                </div>
              ))}
            </div>
          </aside>
        </div>
        <footer className="ng-modal__foot">
          <button type="button" className="ng-text" onClick={onSaveTemplate}>Save as template</button>
          <div>
            <button type="button" className="ng-ghost" onClick={onClose}>Cancel</button>
            {draft.kind === 'find' && (
              <button type="button" className="ng-outline" disabled={submitting} aria-disabled={!check.ready} onClick={onOffer}>Create & offer the gig</button>
            )}
            <button type="button" className="ng-primary ng-primary--inline" disabled={submitting} aria-disabled={!check.ready} onClick={onCreate}>
              {draft.kind === 'booked' ? 'Add to calendar' : 'Publish gig'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Section({ id, title, done, children }) {
  return (
    <section className="ng-card" data-section={id}>
      <h3><span className={`ng-dot${done ? ' is-on' : ''}`}>{done ? '✓' : ''}</span>{title}</h3>
      {children}
    </section>
  );
}

function updateSet(draft, patch, index, partial) {
  const sets = draft.sets.map((set, i) => (i === index ? { ...set, ...partial } : set));
  const first = sets[0] || {};
  patch({ sets, start: first.start || draft.start, end: first.end || draft.end, fee: feeDigits(first.fee ?? draft.fee) });
}
