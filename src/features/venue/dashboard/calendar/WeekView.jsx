import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { addDays, formatDateKey, startOfWeekMonday } from './calendarRange';
import { WEEKDAYS, gigMatches } from './gigPresent';

const HOUR_PX = 62;
const DEFAULT_START = 14 * 60;
const DEFAULT_END = 25 * 60;

function eveningMinutes(mins) {
  if (mins == null) return null;
  return mins < 6 * 60 ? mins + 1440 : mins;
}

function layoutDay(gigs) {
  const items = gigs.map((gig) => ({
    gig,
    start: eveningMinutes(gig.startMin),
    end: eveningMinutes(gig.endMin <= gig.startMin ? gig.endMin + 1440 : gig.endMin),
  })).sort((a, b) => a.start - b.start || a.end - b.end);

  const placed = [];
  items.forEach((item) => {
    const overlap = placed.filter((other) => item.start < other.end && other.start < item.end);
    const used = new Set(overlap.map((other) => other.col));
    let col = 0;
    while (used.has(col)) col += 1;
    placed.push({ ...item, col });
  });
  placed.forEach((item) => {
    const cluster = placed.filter((other) => item.start < other.end && other.start < item.end);
    const cols = Math.max(...cluster.map((other) => other.col), item.col) + 1;
    item.cols = Math.max(item.cols || 1, cols);
    cluster.forEach((other) => { other.cols = Math.max(other.cols || 1, cols); });
  });
  return placed;
}

export function WeekView({
  cursor,
  gigs,
  filter,
  now,
  selectedId,
  onSelect,
  onAdd,
}) {
  const start = startOfWeekMonday(cursor);
  const todayKey = formatDateKey(now);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    const key = formatDateKey(date);
    return {
      key,
      date,
      label: WEEKDAYS[index],
      gigs: gigs.filter((gig) => gig.dateIso === key).sort((a, b) => a.start.localeCompare(b.start)),
      past: key < todayKey,
      today: key === todayKey,
    };
  });

  let gridStart = DEFAULT_START;
  let gridEnd = DEFAULT_END;
  days.forEach((day) => {
    day.gigs.forEach((gig) => {
      const gigStart = eveningMinutes(gig.startMin);
      const gigEnd = eveningMinutes(gig.endMin <= gig.startMin ? gig.endMin + 1440 : gig.endMin);
      if (gigStart != null) gridStart = Math.min(gridStart, Math.floor(gigStart / 60) * 60);
      if (gigEnd != null) gridEnd = Math.max(gridEnd, Math.ceil(gigEnd / 60) * 60);
    });
  });
  const hours = Math.max(1, Math.round((gridEnd - gridStart) / 60));
  const nowMins = eveningMinutes(now.getHours() * 60 + now.getMinutes());
  const showNow = nowMins >= gridStart && nowMins <= gridEnd;

  return (
    <div className="gigs-cal__card">
      <div className="gigs-cal__week-head">
        <span className="gigs-cal__gutter" />
        {days.map((day) => (
          <div key={day.key} className={`gigs-cal__week-day${day.today ? ' is-today' : ''}${day.past ? ' is-past' : ''}`}>
            <span className="gigs-cal__week-dow">{day.label}</span>
            <span className="gigs-cal__week-num">{day.date.getDate()}</span>
            {!day.past && (
              <button type="button" className="gigs-cal__add" aria-label={`New gig on ${day.key}`} onClick={() => onAdd(day.key)}>
                <FontAwesomeIcon icon={faPlus} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="gigs-cal__week-scroll">
        <div className="gigs-cal__week-body" style={{ height: hours * HOUR_PX }}>
          <div className="gigs-cal__hours">
            {Array.from({ length: hours }, (_, index) => (
              <span key={index} style={{ top: index === 0 ? 4 : index * HOUR_PX - 7 }}>
                {String(Math.floor((gridStart / 60 + index) % 24)).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {days.map((day) => {
            const placed = layoutDay(day.gigs);
            return (
              <div key={day.key} className={`gigs-cal__week-col${day.past ? ' is-past' : ''}`}>
                {Array.from({ length: hours }, (_, index) => (
                  <span key={index} className="gigs-cal__hour-line" style={{ top: index * HOUR_PX }} />
                ))}
                {day.today && showNow && (
                  <span className="gigs-cal__now" style={{ top: ((nowMins - gridStart) / 60) * HOUR_PX }} />
                )}
                {placed.map(({ gig, start: blockStart, end: blockEnd, col, cols }) => {
                  const top = ((blockStart - gridStart) / 60) * HOUR_PX + 2;
                  const height = Math.max(28, ((blockEnd - blockStart) / 60) * HOUR_PX - 4);
                  const width = `calc((100% - 8px) / ${cols})`;
                  const left = `calc(4px + ((100% - 8px) / ${cols}) * ${col})`;
                  return (
                    <button
                      key={gig.id}
                      type="button"
                      className={`gigs-cal__block${gig.id === selectedId ? ' is-selected' : ''}${gigMatches(gig, filter, now) ? '' : ' is-dim'}`}
                      style={{ top, height, left, width, background: gig.style.bg }}
                      onClick={() => onSelect(gig)}
                    >
                      <span className="gigs-cal__block-time" style={{ color: gig.style.text }}>
                        {gig.start}–{gig.end}
                      </span>
                      <span className="gigs-cal__block-title">{gig.title}</span>
                      {gig.fresh > 0 && <span className="gigs-cal__new">{gig.fresh} new</span>}
                      {gig.sets.map((set) => (
                        <span key={set.index} className="gigs-cal__set">
                          <span className="gigs-cal__set-dot" style={{ background: set.dot }} />
                          <span>
                            {set.hired
                              ? `Hired · ${set.artist}`
                              : `${gig.sets.length > 1 ? `Set ${set.index} · ` : ''}${set.artist || (set.kind === 'negotiating' && gig.withName ? `Offer · ${gig.withName}` : `${set.apps ?? gig.apps} application${(set.apps ?? gig.apps) === 1 ? '' : 's'}`)}`}
                          </span>
                        </span>
                      ))}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
