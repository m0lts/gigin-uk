import { useMemo, useState } from 'react';
import { normalizeTechRider } from '@features/venue/builder/techRiderConfig';
import { buildGuestTechRider, computeCompatibility } from '@services/utils/techRiderCompatibility';
import { bookerLine } from './guestFormat';

const INSTRUMENTS = ['Vocals', 'Guitar', 'Bass', 'Double bass', 'Drums', 'Keys', 'Sax', 'Violin', 'Other'];

export function GuestTechStep({ draft, patch, venue, hideVenueColumns = false }) {
  const [own, setOwn] = useState('');
  const bookerName = bookerLine(venue).name;
  const equipment = useMemo(() => normalizeTechRider(venue?.techRider).equipment || [], [venue]);
  const summary = useMemo(
    () => computeCompatibility(buildGuestTechRider(draft), venue?.techRider),
    [draft, venue],
  );

  const toggleNeed = (key) => {
    patch({ needs: draft.needs.includes(key) ? draft.needs.filter((item) => item !== key) : [...draft.needs, key] });
  };
  const toggleInstrument = (index, instrument) => {
    const members = draft.members.map((member, memberIndex) => {
      if (memberIndex !== index) return member;
      const instruments = member.instruments.includes(instrument)
        ? member.instruments.filter((item) => item !== instrument)
        : [...member.instruments, instrument];
      return { ...member, instruments };
    });
    patch({ members });
  };

  return (
    <div className="ga-step">
      {!hideVenueColumns && <h2>Tech rider</h2>}
      {!hideVenueColumns && <p className="ga-sub">Tell {bookerName} who is playing and what you need from the bar. Optional.</p>}
      {!hideVenueColumns && (
        <>
          <div className="ga-label">Who's in the band?</div>
          {draft.members.map((member, index) => (
            <div className="ga-member" key={index}>
              <input placeholder="Name, optional" value={member.name} onChange={(event) => patch({
                members: draft.members.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item),
              })} />
              <div className="ga-chips">
                {INSTRUMENTS.map((instrument) => (
                  <button key={instrument} type="button" className={member.instruments.includes(instrument) ? 'is-on' : ''} onClick={() => toggleInstrument(index, instrument)}>{instrument}</button>
                ))}
              </div>
              {draft.members.length > 1 && (
                <button type="button" className="ga-text" onClick={() => patch({ members: draft.members.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button>
              )}
            </div>
          ))}
          <button type="button" className="ga-dashed" onClick={() => patch({ members: [...draft.members, { name: '', instruments: [] }] })}>+ Add a member</button>
        </>
      )}
      <div className="ga-label">What do you need from the bar?</div>
      <div className="ga-needs">
        <div className="ga-needs__head"><span>Item</span>{!hideVenueColumns && <span>Bar has</span>}<span>We need</span></div>
        {equipment.map((item) => {
          const on = draft.needs.includes(item.key);
          const missing = on && !item.available && !hideVenueColumns;
          return (
            <button key={item.key} type="button" className={missing ? 'is-missing' : ''} onClick={() => toggleNeed(item.key)}>
              <span>{item.label}</span>
              {!hideVenueColumns && <span>{item.available ? (item.quantity ? `Yes · ${item.quantity}` : 'Yes') : 'No'}</span>}
              <span className={`ga-box${on ? ' is-on' : ''}`} />
            </button>
          );
        })}
      </div>
      <div className="ga-label">We'll bring our own</div>
      <div className="ga-own">
        {draft.bringOwn.map((item) => (
          <button key={item} type="button" onClick={() => patch({ bringOwn: draft.bringOwn.filter((entry) => entry !== item) })}>{item} ×</button>
        ))}
      </div>
      <div className="ga-add-own">
        <input value={own} placeholder="Keyboard, horn section…" onChange={(event) => setOwn(event.target.value)} />
        <button type="button" onClick={() => {
          const value = own.trim();
          if (!value) return;
          patch({ bringOwn: [...draft.bringOwn, value] });
          setOwn('');
        }}>Add</button>
      </div>
      {!hideVenueColumns && (
        <div className="ga-summary">
          <div className="ga-label">What {bookerName} will see</div>
          <Summary title="Provided by the bar" tone="ok" items={summary.providedByVenue} />
          <Summary title="Covered by your act" tone="dark" items={summary.coveredByArtist} />
          <Summary title="Needs a chat" tone="warn" items={summary.needsDiscussion} />
        </div>
      )}
    </div>
  );
}

function Summary({ title, tone, items }) {
  if (!items?.length) return null;
  return (
    <div className="ga-summary__group">
      <span className={`ga-status-dot is-${tone}`} />
      <div>
        <strong>{title}</strong>
        <p>{items.map((item) => item.label).join(', ')}</p>
      </div>
    </div>
  );
}
