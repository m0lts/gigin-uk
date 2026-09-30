import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { WEEKDAYS, attentionScore, dayNumberLabel, gigMatches, monthCells } from './gigPresent';

export function MonthView({
  cursor,
  gigs,
  filter,
  now,
  selectedId,
  onSelect,
  onAdd,
}) {
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const cells = monthCells(cursor);

  return (
    <div className="gigs-cal__card">
      <div className="gigs-cal__dow">
        {WEEKDAYS.map((label, index) => (
          <span key={label} className={index >= 4 ? 'is-weekend' : ''}>{label}</span>
        ))}
      </div>
      <div className="gigs-cal__month" style={{ gridTemplateRows: `repeat(${cells.length / 7}, minmax(0, 1fr))` }}>
        {cells.map((cell) => {
          const dayGigs = gigs
            .filter((gig) => gig.dateIso === cell.key)
            .sort((a, b) => a.start.localeCompare(b.start) || attentionScore(b) - attentionScore(a));
          const past = cell.key < todayKey;
          const today = cell.key === todayKey;
          const compact = dayGigs.length >= 2;
          const shown = dayGigs.length > 2 ? dayGigs.slice(0, 2) : dayGigs;
          const extra = dayGigs.length - shown.length;
          const canAdd = !past && dayGigs.length === 0;
          return (
            <div
              key={cell.key}
              className={`gigs-cal__day${past || !cell.inMonth ? ' is-muted' : ''}`}
            >
              <div className="gigs-cal__day-top">
                <span className={`gigs-cal__date${today ? ' is-today' : ''}${past || !cell.inMonth ? ' is-faded' : ''}`}>
                  {dayNumberLabel(cell.date)}
                </span>
                {canAdd && (
                  <button type="button" className="gigs-cal__add" aria-label={`New gig on ${cell.key}`} onClick={() => onAdd(cell.key)}>
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                )}
              </div>
              {shown.map((gig) => (
                <GigChip
                  key={gig.id}
                  gig={gig}
                  compact={compact}
                  selected={gig.id === selectedId}
                  dim={!gigMatches(gig, filter, now)}
                  onSelect={onSelect}
                />
              ))}
              {extra > 0 && (
                <button type="button" className="gigs-cal__more" onClick={() => onSelect(dayGigs[0])}>
                  +{extra} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GigChip({ gig, compact, selected, dim, onSelect }) {
  return (
    <button
      type="button"
      className={`gigs-cal__gig${compact ? ' is-compact' : ''}${selected ? ' is-selected' : ''}${dim ? ' is-dim' : ''}`}
      style={{ background: gig.style.bg }}
      onClick={() => onSelect(gig)}
    >
      <span className="gigs-cal__gig-top">
        <span className="gigs-cal__gig-dot" style={{ background: gig.style.dot }} />
        <span className="gigs-cal__gig-time" style={{ color: gig.style.text }}>{gig.start || '—'}</span>
        {gig.fresh > 0 && <span className="gigs-cal__new">{gig.fresh} new</span>}
      </span>
      <span className="gigs-cal__gig-title">{gig.title}</span>
      {!compact && (
        <span className="gigs-cal__gig-sub">
          {gig.sets.length > 1 && (
            <span className="gigs-cal__bars" aria-hidden="true">
              {gig.sets.map((set) => (
                <span key={set.index} className={set.kind === 'booked' ? 'is-booked' : ''} />
              ))}
            </span>
          )}
          <span>{gig.sub}</span>
        </span>
      )}
    </button>
  );
}
