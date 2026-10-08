import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dateChip, initials } from './newGigBits';
import { CloseButton } from './newGigBits';

const SETUP = [
  { id: 'description', label: 'Describe the night', sub: 'A sentence on the vibe and who it’s for.', section: 'listing' },
  { id: 'looking', label: "Who you're looking for", sub: 'Musician, DJ or promoter.', section: 'listing' },
  { id: 'timings', label: 'Load-in and soundcheck', sub: 'So the artist knows when to arrive.', section: 'when' },
  { id: 'sets', label: 'Split into sets', sub: 'Only if more than one act is playing.', section: 'when' },
];

export function NewGigCreatedPanel({
  draft,
  docs,
  contacts,
  offeredIds,
  published,
  onOffer,
  onPublish,
  onFinish,
  onClose,
  onSaveTemplate,
}) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const booked = draft.kind === 'booked';
  const primary = docs?.[0];
  const link = primary?.gigId ? `${window.location.origin}/gig/${primary.gigId}` : '';
  const remaining = SETUP.filter((row) => {
    if (row.id === 'description') return !String(draft.description || '').trim();
    if (row.id === 'looking') return !(draft.lookingFor || []).length;
    if (row.id === 'timings') return !draft.loadIn && !draft.soundcheck;
    if (row.id === 'sets') return draft.sets.length < 2;
    return false;
  });

  return (
    <div className="ng-backdrop ng-backdrop--drawer" onClick={onClose}>
      <aside className="ng-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Gig created">
        <header className="ng-drawer__head">
          <h2>{draft.title || primary?.gigName || 'New gig'}</h2>
          <CloseButton onClick={onClose} />
        </header>
        <div className="ng-drawer__body">
          <div className="ng-created">
            <span className="ng-check">✓</span>
            <h3>{booked ? 'Added to your calendar' : 'Gig created'}</h3>
            <p>
              {booked
                ? 'The details were saved on the gig.'
                : offeredIds.length
                  ? `Offered to ${offeredIds.length} artist${offeredIds.length === 1 ? '' : 's'}. Waiting for a reply.`
                  : published
                    ? 'The listing is live. Offer it to artists you know, or leave it open for applications.'
                    : 'Nobody can see it yet. Offer it or publish it below.'}
            </p>
            {draft.dates[0] && <span className="ng-mono">{dateChip(draft.dates[0])}</span>}
          </div>
          {!booked && (
            <section>
              <div className="ng-label">Offer the gig <em>First to accept gets it</em></div>
              {searching && (
                <input className="ng-input" placeholder="Search contacts" value={query} onChange={(event) => setQuery(event.target.value)} />
              )}
              <div className="ng-contacts">
                {(searching ? contacts : contacts.slice(0, 6)).filter((contact) => !query || String(contact.name || '').toLowerCase().includes(query.toLowerCase())).map((contact) => {
                  const id = contact.id;
                  const offered = offeredIds.includes(id);
                  return (
                    <div key={id} className="ng-offer-row">
                      <span className="ng-avatar">{initials(contact.name)}</span>
                      <span>
                        <strong>{contact.name}</strong>
                        <em>{[contact.genre, contact.lastGig].filter(Boolean).join(' · ')}</em>
                      </span>
                      <button type="button" className={offered ? 'is-offered' : ''} disabled={offered} onClick={() => onOffer(contact)}>
                        {offered ? 'Offered' : 'Offer'}
                      </button>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="ng-text" onClick={() => setSearching(true)}>Search all contacts</button>
            </section>
          )}
          {!booked && (
            <section>
              <div className="ng-toggle-row">
                <span>Publish the listing</span>
                <button type="button" className={`ng-switch${published ? ' is-on' : ''}`} onClick={() => onPublish(!published)} />
              </div>
              {published && link && (
                <div className="ng-link">
                  <span>{link.replace(/^https?:\/\//, '')}</span>
                  <button type="button" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1400); }}>{copied ? 'Copied' : 'Copy'}</button>
                </div>
              )}
            </section>
          )}
          {!!remaining.length && (
            <section>
              <div className="ng-label">Finish setting up</div>
              {remaining.map((row) => (
                <div key={row.id} className="ng-setup">
                  <span className="ng-tick" />
                  <span><strong>{row.label}</strong><em>{row.sub}</em></span>
                  <button type="button" onClick={() => onFinish(row.section)}>Add</button>
                </div>
              ))}
            </section>
          )}
          <button type="button" className="ng-text" onClick={onSaveTemplate}>Save as template</button>
        </div>
        <footer className="ng-drawer__foot ng-drawer__foot--row">
          <button type="button" className="ng-dark" onClick={() => {
            if (!primary) return;
            onClose();
            navigate('/venues/dashboard/gigs/gig-applications', { state: { gig: primary } });
          }}>Open gig page</button>
          <button type="button" className="ng-ghost" onClick={onClose}>Done</button>
        </footer>
      </aside>
    </div>
  );
}
