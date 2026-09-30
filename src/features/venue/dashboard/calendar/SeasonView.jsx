import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { addDays, formatDateKey, startOfWeekMonday } from './calendarRange';
import { MONTHS_SHORT, WEEKDAYS, attentionScore, dayNumberLabel, gigMatches } from './gigPresent';

export function SeasonView({
  cursor,
  gigs,
  filter,
  now,
  regularNights,
  selectedId,
  onSelect,
  onAdd,
}) {
  const todayKey = formatDateKey(now);
  const start = startOfWeekMonday(cursor);
  let prevMonth = -1;
  const rows = Array.from({ length: 12 }, (_, week) => {
    const monday = addDays(start, week * 7);
    const cells = Array.from({ length: 7 }, (_, day) => {
      const date = addDays(monday, day);
      const key = formatDateKey(date);
      const dayGigs = gigs.filter((gig) => gig.dateIso === key);
      const past = key < todayKey;
      const featured = dayGigs.slice().sort((a, b) => attentionScore(b) - attentionScore(a) || a.start.localeCompare(b.start))[0] || null;
      return { key, date, day, past, dayGigs, featured, emptyRegular: !past && !dayGigs.length && regularNights.includes(date.getDay()) };
    });
    const sunday = addDays(monday, 6);
    const month = sunday.getMonth();
    const hasMonth = month !== prevMonth;
    prevMonth = month;
    return {
      key: formatDateKey(monday),
      monday,
      hasMonth,
      month: MONTHS_SHORT[month],
      first: week === 0,
      cells,
    };
  });

  return (
    <div className="gigs-cal__card">
      <div className="gigs-cal__season-head">
        <span className="gigs-cal__season-gutter" />
        {WEEKDAYS.map((label, index) => (
          <span key={label} className={index >= 4 ? 'is-weekend' : ''}>{label}</span>
        ))}
      </div>
      <div className="gigs-cal__season">
        {rows.map((row) => (
          <div
            key={row.key}
            className="gigs-cal__season-row"
            style={{ borderTop: row.first ? 'none' : (row.hasMonth ? '1px solid #E5E7EB' : '1px solid #F0F1F3') }}
          >
            <div className="gigs-cal__season-gutter">
              {row.hasMonth && <span className="gigs-cal__season-month">{row.month}</span>}
              <span className="gigs-cal__season-wc">W/C {String(row.monday.getDate()).padStart(2, '0')}</span>
            </div>
            {row.cells.map((cell) => {
              const weekend = cell.day >= 4;
              if (cell.featured) {
                const gig = cell.featured;
                const selected = cell.dayGigs.some((item) => item.id === selectedId);
                return (
                  <div key={cell.key} className={`gigs-cal__season-cell${weekend ? ' is-weekend' : ''}`}>
                    <button
                      type="button"
                      className={`gigs-cal__season-gig${selected ? ' is-selected' : ''}${gigMatches(gig, filter, now) ? '' : ' is-dim'}${cell.past ? ' is-past' : ''}`}
                      style={{ background: gig.style.bg }}
                      title={cell.dayGigs.map((item) => `${item.start} ${item.title}`).join(' · ')}
                      onClick={() => onSelect(gig)}
                    >
                      <span className="gigs-cal__season-top">
                        <span className="gigs-cal__gig-dot" style={{ background: gig.style.dot }} />
                        <span className="gigs-cal__season-num">{cell.dayGigs.length > 1 ? `${dayNumberLabel(cell.date)} ×${cell.dayGigs.length}` : dayNumberLabel(cell.date)}</span>
                        {gig.fresh > 0 && <span className="gigs-cal__new">{gig.fresh} new</span>}
                      </span>
                      <span className="gigs-cal__season-label">{gig.seasonLabel}</span>
                    </button>
                  </div>
                );
              }
              if (cell.emptyRegular) {
                return (
                  <div key={cell.key} className={`gigs-cal__season-cell${weekend ? ' is-weekend' : ''}`}>
                    <button type="button" className="gigs-cal__empty" onClick={() => onAdd(cell.key)}>
                      <span>{dayNumberLabel(cell.date)}</span>
                      <span><FontAwesomeIcon icon={faPlus} /> Empty</span>
                    </button>
                  </div>
                );
              }
              return (
                <div key={cell.key} className={`gigs-cal__season-cell${weekend ? ' is-weekend' : ''}`}>
                  <span className={`gigs-cal__season-blank${cell.past ? ' is-past' : ''}`}>{dayNumberLabel(cell.date)}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function emptyRegularNights(cursor, gigs, regularNights, now) {
  const todayKey = formatDateKey(now);
  const start = startOfWeekMonday(cursor);
  const taken = new Set(gigs.map((gig) => gig.dateIso));
  const nights = [];
  for (let i = 0; i < 84; i += 1) {
    const date = addDays(start, i);
    const key = formatDateKey(date);
    if (key < todayKey || taken.has(key) || !regularNights.includes(date.getDay())) continue;
    const weekday = WEEKDAYS[(date.getDay() + 6) % 7];
    nights.push({
      key,
      label: `${weekday} ${String(date.getDate()).padStart(2, '0')} ${MONTHS_SHORT[date.getMonth()]}`,
    });
  }
  return nights;
}
