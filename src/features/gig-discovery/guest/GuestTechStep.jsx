import { useMemo, useState } from 'react';
import { normalizeTechRider } from '@features/venue/builder/techRiderConfig';
import { providedKitPhrase } from './guestFormat';

const INSTRUMENTS = ['Vocals', 'Guitar', 'Bass', 'Double bass', 'Drums', 'Keys', 'Sax', 'Violin', 'Other'];

function venueNameOf(venue) {
  return String(venue?.name || venue?.venueName || '').trim() || 'the venue';
}

export function GuestTechStep({ draft, patch, venue, hideVenueColumns = false, lineupOnly = false }) {
  const [own, setOwn] = useState('');
  const showLineup = lineupOnly || !hideVenueColumns;
  const showNeeds = hideVenueColumns && !lineupOnly;
  const venueName = venueNameOf(venue);
  const equipment = useMemo(() => normalizeTechRider(venue?.techRider).equipment || [], [venue]);
  const provided = providedKitPhrase(equipment);
  const members = draft.members?.length ? draft.members : [{ name: '', instruments: [] }];

  const toggleNeed = (key) => {
    patch({ needs: draft.needs.includes(key) ? draft.needs.filter((item) => item !== key) : [...draft.needs, key] });
  };
  const toggleInstrument = (index, instrument) => {
    const next = members.map((member, memberIndex) => {
      if (memberIndex !== index) return member;
      const current = member.instruments || [];
      const instruments = current.includes(instrument)
        ? current.filter((item) => item !== instrument)
        : [...current, instrument];
      return { ...member, instruments };
    });
    patch({ members: next });
  };

  return (
    <div className="ga-step">
      {showLineup && !lineupOnly && <h2>Who&apos;s playing?</h2>}
      {showLineup && !lineupOnly && <p className="ga-sub">Add each person on stage. A name is optional.</p>}
      {showLineup && !lineupOnly && (
        <p className="ga-provides">{provided ? `${venueName} provides: ${provided}` : `Ask ${venueName} about sound and kit`}</p>
      )}
      {showLineup && members.map((member, index) => (
        <div className="ga-member" key={index}>
          <div className="ga-chips">
            {INSTRUMENTS.map((instrument) => (
              <button key={instrument} type="button" className={(member.instruments || []).includes(instrument) ? 'is-on' : ''} onClick={() => toggleInstrument(index, instrument)}>{instrument}</button>
            ))}
          </div>
          <label className="ga-field">
            <span>Name, optional</span>
            <input value={member.name || ''} onChange={(event) => patch({
              members: members.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item),
            })} />
          </label>
          {members.length > 1 && (
            <button type="button" className="ga-skip" onClick={() => patch({ members: members.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button>
          )}
        </div>
      ))}
      {showLineup && (
        <button type="button" className="ga-dashed" onClick={() => patch({ members: [...members, { name: '', instruments: [] }] })}>+ Add someone</button>
      )}
      {showLineup && !lineupOnly && (
        <>
          <div className="ga-label">Instagram and website</div>
          <p className="ga-fine">Optional. The first step already has Instagram as a way to reach you.</p>
          <label className="ga-field">
            <span>Instagram</span>
            <input value={draft.links?.instagram || ''} placeholder="https:// or @name" onChange={(event) => patch({ links: { ...draft.links, instagram: event.target.value } })} />
          </label>
          <label className="ga-field">
            <span>Website</span>
            <input value={draft.links?.website || ''} placeholder="https://" onChange={(event) => patch({ links: { ...draft.links, website: event.target.value } })} />
          </label>
        </>
      )}
      {showNeeds && (
        <>
          <div className="ga-label">What do you need?</div>
          <div className="ga-needs">
            <div className="ga-needs__head"><span>Item</span><span>We need</span></div>
            {equipment.map((item) => {
              const on = (draft.needs || []).includes(item.key);
              return (
                <button key={item.key} type="button" onClick={() => toggleNeed(item.key)}>
                  <span>{item.label}</span>
                  <span className={`ga-box${on ? ' is-on' : ''}`} />
                </button>
              );
            })}
          </div>
          <div className="ga-label">We&apos;ll bring our own</div>
          <div className="ga-own">
            {(draft.bringOwn || []).map((item) => (
              <button key={item} type="button" onClick={() => patch({ bringOwn: draft.bringOwn.filter((entry) => entry !== item) })}>{item} ×</button>
            ))}
          </div>
          <div className="ga-add-own">
            <input value={own} placeholder="Keyboard, horn section…" onChange={(event) => setOwn(event.target.value)} />
            <button type="button" onClick={() => {
              const value = own.trim();
              if (!value) return;
              patch({ bringOwn: [...(draft.bringOwn || []), value] });
              setOwn('');
            }}>Add</button>
          </div>
        </>
      )}
    </div>
  );
}
