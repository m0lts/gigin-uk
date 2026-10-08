import { useMemo, useState } from 'react';
import { GENRES, LOOKING_FOR, activeSets } from './useNewGigDraft';
import { dateChip } from './newGigBits';
import { FEATURES } from '../../../../config/features';

const FIND_STEPS = ['Start', 'Date & time', 'Fee & tickets', 'Listing', 'Review'];
const BOOKED_STEPS = ['Start', 'Date & time', "Who's playing", 'Review'];

export function NewGigWizard({ draft, patch, templates, contacts, gigs = [], submitting, onClose, onSaveDraft, onSaveTemplate, onPublish }) {
  const [step, setStep] = useState(0);
  const [month, setMonth] = useState(() => new Date());
  const booked = draft.kind === 'booked';
  const labels = (booked ? BOOKED_STEPS : FIND_STEPS).filter((label) => (
    label !== 'Fee & tickets' || FEATURES.payments || FEATURES.ticketing
  ));
  const safeStep = Math.min(step, labels.length - 1);
  const last = safeStep === labels.length - 1;
  const blocked = !canContinue(draft, labels[safeStep]);

  const cells = useMemo(() => monthCells(month), [month]);
  const gigDays = useMemo(() => {
    const map = {};
    gigs.forEach((group) => {
      const iso = gigIso(group);
      if (iso) map[iso] = group;
    });
    return map;
  }, [gigs]);

  const toggleDate = (iso) => {
    if (booked) {
      patch({ dates: [iso] });
      return;
    }
    patch({ dates: draft.dates.includes(iso) ? draft.dates.filter((item) => item !== iso) : [...draft.dates, iso].sort() });
  };

  return (
    <div className="ng-wizard">
      <aside className="ng-rail">
        <div className="ng-logo">gigin.</div>
        <div className="ng-kicker ng-kicker--light">New gig</div>
        <ol>
          {labels.map((label, index) => {
            const state = index < safeStep ? 'done' : index === safeStep ? 'current' : 'future';
            return (
              <li key={label}>
                <button type="button" disabled={index > step} onClick={() => index <= step && setStep(index)}>
                  <span className={`ng-step ${state}`}>{state === 'done' ? '✓' : index + 1}</span>
                  <span>
                    <strong>{label}</strong>
                    {state === 'done' && <em>{summaryFor(draft, label)}</em>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="ng-tip">
          <strong>First time?</strong>
          <p>{tipFor(labels[safeStep])}</p>
        </div>
      </aside>
      <div className="ng-wizard__main">
        <header>
          <span className="ng-mono">STEP {safeStep + 1} OF {labels.length}</span>
          <div className="ng-progress">{labels.map((label, index) => <span key={label} className={index <= safeStep ? 'is-on' : ''} />)}</div>
          <button type="button" className="ng-text ng-text--light" onClick={onSaveDraft}>Save draft</button>
          <button type="button" className="ng-icon ng-icon--light" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <div className="ng-wizard__body">
          {labels[safeStep] === 'Start' && (
            <Question title="How do you want to start?" sub="You can change this later.">
              {[
                ['find', 'Find an artist', 'Offer it to people you know, or publish a listing.'],
                ['booked', "I've already booked someone", 'Adds a confirmed gig to your calendar.'],
                ['template', 'Start from a template', 'Reuse times, fee and description.'],
              ].map(([key, titleText, desc]) => (
                <button key={key} type="button" className={`ng-radio-card${(key === 'template' ? !!draft.templateId : draft.kind === key && !draft.templateId) ? ' is-on' : ''}`} onClick={() => patch(key === 'template' ? { kind: 'find' } : { kind: key, templateId: '' })}>
                  <strong>{titleText}</strong>
                  <span>{desc}</span>
                </button>
              ))}
              <div className="ng-template-grid">
                {templates.map((template) => {
                  const id = template.templateId || template.id;
                  return (
                    <button key={id} type="button" className={draft.templateId === id ? 'is-on' : ''} onClick={() => patch({ applyTemplate: template, kind: 'find' })}>
                      {template.name || template.templateName}
                    </button>
                  );
                })}
              </div>
            </Question>
          )}
          {labels[safeStep] === 'Date & time' && (
            <Question title="When is it?" sub={booked ? 'Pick one night.' : 'Pick one night, or several.'}>
              <div className="ng-month-nav">
                <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
                <span>{month.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</span>
                <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
              </div>
              <div className="ng-month">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => <span key={`${label}${index}`} className="ng-dow">{label}</span>)}
                {cells.map((cell) => (
                  <button key={cell.key} type="button" className={`${cell.inMonth ? '' : 'is-out'}${draft.dates.includes(cell.key) ? ' is-on' : ''}${gigDays[cell.key] ? ' has-gig' : ''}`} onClick={() => cell.inMonth && toggleDate(cell.key)}>
                    {cell.date.getDate()}
                  </button>
                ))}
              </div>
              <div className="ng-dates">
                {draft.dates.map((iso) => <span key={iso}>{dateChip(iso)} <button type="button" onClick={() => patch({ dates: draft.dates.filter((item) => item !== iso) })}>×</button></span>)}
              </div>
              <div className="ng-three">
                <label className="ng-field"><span>Starts</span><input className="ng-input ng-mono" type="time" value={draft.start} onChange={(event) => patch({ start: event.target.value })} /></label>
                <label className="ng-field"><span>Ends</span><input className="ng-input ng-mono" type="time" value={draft.end} onChange={(event) => patch({ end: event.target.value })} /></label>
              </div>
              <div className="ng-pills">
                <OptionalTime label="Load-in" value={draft.loadIn} onChange={(loadIn) => patch({ loadIn })} />
                <OptionalTime label="Soundcheck" value={draft.soundcheck} onChange={(soundcheck) => patch({ soundcheck })} />
                <OptionalTime label="Vacate by" value={draft.vacateBy} onChange={(vacateBy) => patch({ vacateBy })} />
              </div>
              <div className="ng-segment">
                <button type="button" className={draft.sets.length < 2 ? 'is-on' : ''} onClick={() => patch({ sets: [] })}>One set</button>
                <button type="button" className={draft.sets.length > 1 ? 'is-on' : ''} onClick={() => patch({ sets: draft.sets.length > 1 ? draft.sets : [{ start: draft.start, end: draft.end, fee: draft.fee }, { start: '', end: '', fee: '' }] })}>Several sets</button>
              </div>
              {draft.sets.length > 1 && draft.sets.map((set, index) => (
                <div className="ng-three" key={index}>
                  <input className="ng-input ng-mono" type="time" value={set.start} onChange={(event) => patchSet(draft, patch, index, { start: event.target.value })} />
                  <input className="ng-input ng-mono" type="time" value={set.end} onChange={(event) => patchSet(draft, patch, index, { end: event.target.value })} />
                </div>
              ))}
              {draft.sets.length > 1 && <button type="button" className="ng-dashed" onClick={() => patch({ sets: [...draft.sets, { start: '', end: '', fee: draft.fee }] })}>+ Add another set</button>}
              <NightBar draft={draft} />
            </Question>
          )}
          {labels[safeStep] === 'Fee & tickets' && (
            <Question title="What are you paying?" sub="Artists see this on the listing.">
              {FEATURES.payments && (
                <div className="ng-kind">
                  <button type="button" className={draft.pay === 'fee' ? 'is-on' : ''} onClick={() => patch({ pay: 'fee' })}><strong>I'll pay a fee</strong><span>Paid when you confirm them.</span></button>
                  <button type="button" className={draft.pay === 'none' ? 'is-on' : ''} onClick={() => patch({ pay: 'none', fee: '0' })}><strong>No fee</strong><span>Open mic, or they take the door.</span></button>
                </div>
              )}
              {FEATURES.payments && draft.pay === 'fee' && activeSets(draft).map((set, index) => (
                <label key={index} className="ng-field"><span>Set {index + 1}</span><input className="ng-input ng-mono" value={set.fee ? `£${set.fee}` : ''} onChange={(event) => {
                  const fee = event.target.value.replace(/[^\d]/g, '');
                  if (draft.sets.length > 1) patchSet(draft, patch, index, { fee });
                  else patch({ fee });
                }} /></label>
              ))}
              {FEATURES.ticketing && (
                <div className="ng-kind ng-kind--3">
                  {[['free', 'Not ticketed'], ['venue', 'I sell tickets'], ['artist', 'Artist sells tickets']].map(([key, label]) => (
                    <button key={key} type="button" className={draft.tickets === key ? 'is-on' : ''} onClick={() => patch({ tickets: key })}><strong>{label}</strong></button>
                  ))}
                </div>
              )}
            </Question>
          )}
          {labels[safeStep] === "Who's playing" && (
            <Question title="Who's playing?" sub="They'll show as confirmed.">
              <div className="ng-contact-grid">
                {contacts.map((contact) => {
                  const id = contact.id || contact.artistId;
                  return (
                    <button key={id} type="button" className={draft.artistId === id ? 'is-on' : ''} onClick={() => patch({ artistId: id, artistName: contact.name })}>
                      <strong>{contact.name}</strong>
                    </button>
                  );
                })}
              </div>
              <input className="ng-input" placeholder="Search or type a name" value={draft.artistName} onChange={(event) => patch({ artistName: event.target.value, artistId: '' })} />
              {FEATURES.payments && <label className="ng-field"><span>Agreed fee</span><input className="ng-input ng-mono" value={draft.fee ? `£${draft.fee}` : ''} onChange={(event) => patch({ fee: event.target.value.replace(/[^\d]/g, ''), pay: 'fee' })} /></label>}
              <div className="ng-segment">
                {[['gigin', 'Through Gigin'], ['outside', 'Another way'], ['none', 'No fee']].map(([key, label]) => (
                  <button key={key} type="button" className={draft.paidVia === key ? 'is-on' : ''} onClick={() => patch({ paidVia: key, pay: key === 'none' ? 'none' : 'fee' })}>{label}</button>
                ))}
              </div>
            </Question>
          )}
          {labels[safeStep] === 'Listing' && (
            <Question title="What should the listing say?" sub="This is what artists read before they apply.">
              <input className="ng-input" placeholder="Title" value={draft.title} onChange={(event) => patch({ title: event.target.value })} />
              <textarea className="ng-input" maxLength={250} rows={4} placeholder="Description" value={draft.description} onChange={(event) => patch({ description: event.target.value.slice(0, 250) })} />
              <div className="ng-chips">{LOOKING_FOR.map((option) => <button key={option} type="button" className={draft.lookingFor.includes(option) ? 'is-on' : ''} onClick={() => patch({ lookingFor: draft.lookingFor.includes(option) ? draft.lookingFor.filter((item) => item !== option) : [...draft.lookingFor, option] })}>{option}</button>)}</div>
              <div className="ng-chips">{GENRES.map((option) => <button key={option} type="button" className={draft.genres.includes(option) ? 'is-on' : ''} onClick={() => patch({ genres: draft.genres.includes(option) ? draft.genres.filter((item) => item !== option) : [...draft.genres, option] })}>{option}</button>)}</div>
              <div className="ng-toggle-row"><span>Show on my venue profile</span><button type="button" className={`ng-switch${draft.showOnProfile ? ' is-on' : ''}`} onClick={() => patch({ showOnProfile: !draft.showOnProfile })} /></div>
            </Question>
          )}
          {labels[safeStep] === 'Review' && (
            <Question title="Ready to create it?" sub="You can still offer it or publish after this.">
              <div className="ng-summary">
                <Row label="When" value={draft.dates.map(dateChip).join(', ') || '—'} onEdit={() => setStep(1)} />
                <Row label="Time" value={`${draft.start || '—'}–${draft.end || '—'}`} onEdit={() => setStep(1)} />
                {booked ? <Row label="Artist" value={draft.artistName || '—'} onEdit={() => setStep(2)} /> : <Row label="Listing" value={draft.title || '—'} onEdit={() => setStep(3)} />}
              </div>
              {!booked && (
                <>
                  <label className="ng-checkrow"><input type="checkbox" checked={draft.publishListing} onChange={(event) => patch({ publishListing: event.target.checked, showOnProfile: event.target.checked })} /> Publish the listing</label>
                  <label className="ng-checkrow"><input type="checkbox" checked={draft.offerArtistIds.length > 0} onChange={(event) => patch({ offerArtistIds: event.target.checked ? contacts.slice(0, 1).map((contact) => contact.id) : [] })} /> Offer the gig to artists you know</label>
                  {draft.offerArtistIds.length > 0 && (
                    <div className="ng-chips">
                      {contacts.slice(0, 8).map((contact) => {
                        const id = contact.id;
                        const on = draft.offerArtistIds.includes(id);
                        return <button key={id} type="button" className={on ? 'is-on' : ''} onClick={() => patch({ offerArtistIds: on ? draft.offerArtistIds.filter((item) => item !== id) : [...draft.offerArtistIds, id] })}>{contact.name}</button>;
                      })}
                    </div>
                  )}
                </>
              )}
              <button type="button" className="ng-text" onClick={onSaveTemplate}>Save as template</button>
            </Question>
          )}
        </div>
        <footer>
          <button type="button" className="ng-ghost" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>Back</button>
          {blocked && <span className="ng-hint">{hintFor(labels[safeStep])}</span>}
          <button type="button" className={last ? 'ng-primary ng-primary--inline' : 'ng-dark'} disabled={blocked || submitting} onClick={() => (last ? onPublish() : setStep((current) => current + 1))}>
            {last ? (booked ? 'Add to calendar' : 'Publish gig') : 'Continue'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Question({ title, sub, children }) {
  return (
    <div className="ng-question">
      <h2>{title}</h2>
      <p>{sub}</p>
      {children}
    </div>
  );
}

function Row({ label, value, onEdit }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <button type="button" onClick={onEdit}>Edit</button>
    </div>
  );
}

function OptionalTime({ label, value, onChange }) {
  if (value == null) {
    return <button type="button" className="ng-dashed" onClick={() => onChange('')}>+ {label}</button>;
  }
  return <label className="ng-field"><span>{label}</span><input className="ng-input ng-mono" type="time" value={value || ''} onChange={(event) => onChange(event.target.value || null)} /></label>;
}

function NightBar({ draft }) {
  const start = toMin(draft.loadIn || draft.soundcheck || draft.start || '18:00');
  const end = toMin(draft.vacateBy || draft.end || '23:00');
  const span = Math.max(60, (end > start ? end : end + 1440) - start);
  const block = (from, to, className) => {
    if (from == null || to == null) return null;
    const left = ((from - start + 1440) % 1440) / span * 100;
    const width = Math.max(4, (((to - from + 1440) % 1440) || 30) / span * 100);
    return <span className={className} style={{ left: `${left}%`, width: `${width}%` }} />;
  };
  return (
    <div className="ng-night" aria-label="Your night">
      {block(toMin(draft.loadIn), toMin(draft.start), 'is-load')}
      {block(toMin(draft.soundcheck), toMin(draft.start), 'is-check')}
      {block(toMin(draft.start), toMin(draft.end), 'is-set')}
      {block(toMin(draft.end), toMin(draft.vacateBy), 'is-down')}
    </div>
  );
}

function gigIso(item) {
  if (!item) return '';
  if (typeof item.dateIso === 'string' && item.dateIso) return item.dateIso;
  if (item.primaryGig?.dateIso) return item.primaryGig.dateIso;
  const raw = item.date || item.primaryGig?.date;
  const date = raw?.toDate?.() || (raw instanceof Date ? raw : null);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toMin(time) {
  if (!time) return null;
  const [h, m] = String(time).split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (m || 0);
}

function monthCells(cursor) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const count = Math.ceil((offset + days) / 7) * 7;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month, 1 - offset + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { key, date, inMonth: date.getMonth() === month };
  });
}

function canContinue(draft, label) {
  if (label === 'Start') return true;
  if (label === 'Date & time') return draft.dates.length > 0 && draft.start && draft.end;
  if (label === 'Fee & tickets') return !FEATURES.payments || draft.pay === 'none' || String(draft.fee || '').length > 0;
  if (label === "Who's playing") return !!draft.artistName;
  if (label === 'Listing') return !!String(draft.title || '').trim();
  return true;
}

function hintFor(label) {
  if (label === 'Date & time') return 'Add a date and times to continue';
  if (label === "Who's playing") return 'Choose an artist to continue';
  if (label === 'Listing') return 'Add a title to continue';
  if (label === 'Fee & tickets') return 'Enter a fee or choose no fee';
  return 'Choose an option to continue';
}

function summaryFor(draft, label) {
  if (label === 'Start') return draft.kind === 'booked' ? 'Already booked' : 'Find an artist';
  if (label === 'Date & time') return draft.dates[0] ? dateChip(draft.dates[0]) : '';
  if (label === "Who's playing") return draft.artistName;
  if (label === 'Listing') return draft.title;
  return '';
}

function tipFor(label) {
  if (label === 'Start') return 'Most venues start with Find an artist, then offer it to a few people they already know.';
  if (label === 'Date & time') return 'A single set is enough. Split the night only when different artists play each set.';
  if (label === 'Fee & tickets') return 'A fee of £0 is fine. Artists still need to know whether the night is ticketed.';
  if (label === "Who's playing") return 'This adds them as confirmed. They won’t be asked to apply.';
  return 'You can leave the description for later and fill it in from the created screen.';
}

function patchSet(draft, patch, index, partial) {
  const sets = draft.sets.map((set, i) => (i === index ? { ...set, ...partial } : set));
  patch({ sets, start: sets[0]?.start || draft.start, end: sets[0]?.end || draft.end });
}
