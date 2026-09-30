import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faXmark } from '@fortawesome/free-solid-svg-icons';
import { dateLabel } from './gigPresent';

const NIGHTS = [
  { label: 'Mon', day: 1 },
  { label: 'Tue', day: 2 },
  { label: 'Wed', day: 3 },
  { label: 'Thu', day: 4 },
  { label: 'Fri', day: 5 },
  { label: 'Sat', day: 6 },
  { label: 'Sun', day: 0 },
];

export function CalendarSidePanel({
  view,
  rangeGigs,
  now,
  actions,
  emptyNights,
  regularNights,
  onToggleNight,
  onAdd,
  onSelect,
  selected,
  onClose,
  copied,
  onCopy,
  onOpen,
  onEdit,
  onInvite,
  canInvite,
  canUpdate,
  menuItems,
  onSaveField,
}) {
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const upcoming = rangeGigs.filter((gig) => gig.dateIso >= todayKey);
  const sets = upcoming.filter((gig) => !gig.hire).flatMap((gig) => gig.sets.map((set) => ({ booked: set.kind === 'booked' || set.kind === 'awaiting' })));
  const booked = sets.filter((set) => set.booked).length;
  const bars = sets.length > 24
    ? Array.from({ length: 24 }, (_, index) => index < Math.round((booked / Math.max(sets.length, 1)) * 24))
    : sets.map((set) => set.booked);
  const confirmed = upcoming.filter((gig) => gig.booking === 'confirmed').length;
  const rangeLabel = view === 'week' ? 'This week' : view === 'season' ? 'These 12 weeks' : 'This month';

  return (
    <aside className="gigs-cal__panel">
      {selected ? (
        <SelectedGig
          gig={selected}
          onClose={onClose}
          copied={copied}
          onCopy={onCopy}
          onOpen={onOpen}
          onEdit={onEdit}
          onInvite={onInvite}
          canInvite={canInvite}
          canUpdate={canUpdate}
          menuItems={menuItems}
          onSaveField={onSaveField}
        />
      ) : (
        <div className="gigs-cal__summary">
          <section>
            <div className="gigs-cal__section-title">
              <span>{rangeLabel}</span>
              <span>{booked} OF {sets.length} SETS BOOKED</span>
            </div>
            <div className="gigs-cal__bars-row">
              {(bars.length ? bars : [false]).map((filled, index) => (
                <span key={index} className={filled ? 'is-booked' : ''} />
              ))}
            </div>
            <p className="gigs-cal__range-line">{upcoming.length} upcoming gigs · {confirmed} confirmed</p>
          </section>
          {view === 'season' && (
            <>
              <section>
                <div className="gigs-cal__night-label">Regular nights</div>
                <div className="gigs-cal__nights">
                  {NIGHTS.map((night) => {
                    const on = regularNights.includes(night.day);
                    return (
                      <button key={night.day} type="button" className={on ? 'is-on' : ''} onClick={() => onToggleNight(night.day)}>
                        {night.label}
                      </button>
                    );
                  })}
                </div>
              </section>
              <section>
                <div className="gigs-cal__section-title">
                  <span>Empty regular nights</span>
                  <span>{emptyNights.length} NIGHTS</span>
                </div>
                <div className="gigs-cal__list">
                  {emptyNights.slice(0, 5).map((night) => (
                    <div key={night.key} className="gigs-cal__empty-row">
                      <span>{night.label}</span>
                      <button type="button" onClick={() => onAdd(night.key)}>Add gig</button>
                    </div>
                  ))}
                  {emptyNights.length > 5 && <p className="gigs-cal__more-nights">and {emptyNights.length - 5} more</p>}
                  {emptyNights.length === 0 && <p className="gigs-cal__quiet">No empty regular nights in this range.</p>}
                </div>
              </section>
            </>
          )}
          <section>
            <div className="gigs-cal__section-title">
              <span>Needs action</span>
              <span>{actions.length}</span>
            </div>
            {actions.length === 0 ? (
              <p className="gigs-cal__quiet">Nothing waiting on you.</p>
            ) : (
              <div className="gigs-cal__list">
                {actions.slice(0, 6).map((gig) => (
                  <button key={gig.id} type="button" className="gigs-cal__action" onClick={() => onSelect(gig, true)}>
                    <span className="gigs-cal__action-top">
                      <span>{gig.title}</span>
                      <span>{dateLabel(gig.dateIso)}</span>
                    </span>
                    <span className="gigs-cal__action-why" style={{ color: gig.action?.color }}>
                      <span className="gigs-cal__gig-dot" style={{ background: gig.action?.dot }} />
                      {gig.action?.text}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}

function SelectedGig({
  gig,
  onClose,
  copied,
  onCopy,
  onOpen,
  onEdit,
  onInvite,
  canInvite,
  canUpdate,
  menuItems,
  onSaveField,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const when = `${dateLabel(gig.dateIso)} · ${gig.start || '—'}${gig.end ? `–${gig.end}` : ''}`;
  const lineupLabel = gig.hire ? 'Booking' : `Line-up · ${gig.bookedCount}/${gig.setCount} booked`;

  return (
    <div className="gigs-cal__selected">
      <div className="gigs-cal__selected-body">
        <div className="gigs-cal__selected-head">
          <span>{when}</span>
          <button type="button" aria-label="Close gig" onClick={onClose}><FontAwesomeIcon icon={faXmark} /></button>
        </div>
        <h2>{gig.title}</h2>
        <div className="gigs-cal__status-row">
          <span className="gigs-cal__status" style={{ color: gig.style.text, background: gig.style.bg }}>
            <span className="gigs-cal__gig-dot" style={{ background: gig.style.dot }} />
            {gig.style.label}
          </span>
          <span>{gig.visibility}</span>
        </div>
        <section>
          <div className="gigs-cal__kicker">{lineupLabel}</div>
          <div className="gigs-cal__list">
            {gig.hire ? (
              <>
                <LineRow kicker="HIRED BY" value={gig.hirer || '—'} dot={gig.style.dot} />
                <LineRow kicker="DEPOSIT" value={gig.deposit} dot={gig.deposit.startsWith('Paid') ? 'oklch(0.66 0.14 150)' : 'oklch(0.72 0.15 70)'} />
                <LineRow kicker="BALANCE" value={gig.balance} dot={gig.balance.startsWith('Paid') ? 'oklch(0.66 0.14 150)' : 'oklch(0.72 0.15 70)'} />
              </>
            ) : gig.sets.map((set) => (
              <LineRow
                key={set.index}
                kicker={gig.sets.length > 1 ? `SET ${set.index} · ${set.start}` : set.start}
                value={set.kind === 'booked' ? (set.artist || 'Artist') : set.kind === 'negotiating' ? `Offer out · ${set.artist || gig.withName || 'artist'}` : set.kind === 'awaiting' ? (set.artist || 'Awaiting payment') : 'Open'}
                muted={set.kind === 'open'}
                dot={set.dot}
              />
            ))}
          </div>
        </section>
        {gig.openForApps && (
          <div className="gigs-cal__apps">
            <span className="gigs-cal__apps-count">{gig.apps}</span>
            <span>applications</span>
            {gig.fresh > 0 && <span className="gigs-cal__new">{gig.fresh} new</span>}
            <button type="button" onClick={onOpen}>Review</button>
          </div>
        )}
        {gig.openForApps && (
          <div className="gigs-cal__share">
            {!gig.private && (
              <div className="gigs-cal__link">
                <span>{typeof window !== 'undefined' ? `${window.location.host}/gig/${gig.group.primaryGig.gigId}` : ''}</span>
                <button type="button" onClick={onCopy}>{copied ? 'Copied' : 'Copy'}</button>
              </div>
            )}
            <button type="button" className="gigs-cal__invite" disabled={!canInvite} onClick={onInvite}>
              <FontAwesomeIcon icon={faEnvelope} /> Offer gig to artist
            </button>
          </div>
        )}
        <EditableField label="Sound manager" value={gig.soundManager} canUpdate={canUpdate} field="sound" onSave={onSaveField} />
        <EditableField label="Notes" value={gig.notes} canUpdate={canUpdate} field="notes" onSave={onSaveField} />
      </div>
      <footer className="gigs-cal__footer">
        <button type="button" className="gigs-cal__open" onClick={onOpen}>Open gig</button>
        <button type="button" className="gigs-cal__edit" onClick={onEdit} disabled={!canUpdate}>Edit</button>
        <div className="gigs-cal__menu" ref={menuRef}>
          <button type="button" className="gigs-cal__more-btn" aria-label="More actions" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>⋯</button>
          {menuOpen && (
            <div className="gigs-cal__menu-pop">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={item.danger ? 'is-danger' : ''}
                  disabled={item.disabled}
                  onClick={() => { setMenuOpen(false); item.onClick(); }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

function LineRow({ kicker, value, dot, muted }) {
  return (
    <div className="gigs-cal__line">
      <span>{kicker || '—'}</span>
      <span className={muted ? 'is-muted' : ''}>
        <span className="gigs-cal__gig-dot" style={{ background: dot }} />
        {value}
      </span>
    </div>
  );
}

function EditableField({ label, value, canUpdate, field, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  useEffect(() => { setDraft(value || ''); setEditing(false); }, [value]);
  return (
    <div className="gigs-cal__field">
      <div className="gigs-cal__kicker">{label}</div>
      {editing ? (
        <textarea
          className="gigs-cal__field-input"
          value={draft}
          rows={field === 'notes' ? 3 : 2}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => { onSave?.(field, draft); setEditing(false); }}
          onKeyDown={(event) => { if (event.key === 'Escape') setEditing(false); }}
        />
      ) : (
        <button type="button" className={`gigs-cal__field-value${canUpdate ? ' is-editable' : ''}`} disabled={!canUpdate} onClick={() => canUpdate && setEditing(true)}>
          {value || '—'}
        </button>
      )}
    </div>
  );
}
