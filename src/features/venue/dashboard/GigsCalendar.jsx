import React, { useState, useMemo } from 'react';
import '@styles/host/gigs-calendar.styles.css';
import {
  format,
  startOfMonth,
  endOfMonth,
  getDay,
  addDays,
  subDays,
  differenceInCalendarDays,
  isSameMonth,
  isSameDay,
  getDate,
} from 'date-fns';

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function buildMonthGrid(monthDate) {
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const startWeekday = getDay(start); // 0 = Sunday
  const firstCell = subDays(start, startWeekday);
  const totalDays = differenceInCalendarDays(end, firstCell) + 1;
  const numRows = Math.ceil(totalDays / 7);
  const grid = [];
  for (let row = 0; row < numRows; row++) {
    const rowDays = [];
    for (let col = 0; col < 7; col++) {
      const day = addDays(firstCell, row * 7 + col);
      rowDays.push(day);
    }
    grid.push(rowDays);
  }
  return grid;
}

function getGigCalendarLabel(gig) {
  const time = gig.startTime || '—';
  const confirmed = gig.applicants?.some((a) => a.status === 'confirmed');
  if (confirmed) {
    const names = (gig.applicants || [])
      .filter((a) => a.status === 'confirmed')
      .map((a) => a.name || a.musicianName || 'Artist')
      .filter(Boolean);
    const label = names.length ? names.join(', ') : 'Confirmed';
    return { time, label };
  }
  const statusLabels = {
    upcoming: 'Pending',
    closed: 'Closed',
    'awaiting payment': 'Awaiting payment',
    past: 'Past',
    confirmed: 'Confirmed',
    'in dispute': 'In dispute',
  };
  const label = statusLabels[gig.status] || gig.status || 'Pending';
  return { time, label };
}

export function GigsCalendar({ gigs = [] }) {
  const [viewDate, setViewDate] = useState(new Date());
  const today = useMemo(() => new Date(), []);

  const grid = useMemo(() => buildMonthGrid(viewDate), [viewDate]);

  const gigsByDate = useMemo(() => {
    const flat = Array.isArray(gigs) ? gigs.flatMap((g) => (g.allGigs ? g.allGigs : [g.primaryGig || g])) : [];
    const byDate = {};
    flat.forEach((gig) => {
      const iso = gig.dateIso;
      if (!iso) return;
      if (!byDate[iso]) byDate[iso] = [];
      byDate[iso].push(gig);
    });
    return byDate;
  }, [gigs]);

  const goPrevMonth = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1));
  };

  const goNextMonth = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1));
  };

  return (
    <div className="gigs-calendar-custom">
      <div className="gigs-calendar-custom__navigation">
        <button type="button" className="gigs-calendar-custom__nav-btn" onClick={goPrevMonth} aria-label="Previous month">
          ‹
        </button>
        <span className="gigs-calendar-custom__title">
          {format(viewDate, 'MMMM yyyy')}
        </span>
        <button type="button" className="gigs-calendar-custom__nav-btn" onClick={goNextMonth} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="gigs-calendar-custom__weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="gigs-calendar-custom__weekday">
            {label}
          </div>
        ))}
      </div>

      <div className="gigs-calendar-custom__grid">
        {grid.map((row, rowIndex) =>
          row.map((day, colIndex) => {
            const isCurrentMonth = isSameMonth(day, viewDate);
            const isToday = isSameDay(day, today);
            const dayNum = getDate(day);
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayGigs = gigsByDate[dateKey] || [];
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`gigs-calendar-custom__day ${!isCurrentMonth ? 'gigs-calendar-custom__day--other-month' : ''}`}
              >
                <span className={`gigs-calendar-custom__day-num ${isToday ? 'gigs-calendar-custom__day-num--today' : ''}`}>
                  {dayNum}
                </span>
                <div className="gigs-calendar-custom__day-gigs">
                  {dayGigs.map((gig) => {
                    const { time, label } = getGigCalendarLabel(gig);
                    const confirmed = gig.applicants?.some((a) => a.status === 'confirmed');
                    const isPast = gig.dateIso && gig.dateIso < format(today, 'yyyy-MM-dd');
                    const isPastUnbooked = isPast && !confirmed;
                    return (
                      <div
                        key={gig.gigId}
                        className={`gigs-calendar-custom__day-gig ${isPastUnbooked ? 'gigs-calendar-custom__day-gig--past-unbooked' : ''}`}
                      >
                        {isPastUnbooked ? (
                          <span className="gigs-calendar-custom__day-gig-single">
                            {time} • Unbooked
                          </span>
                        ) : (
                          <>
                            <span className="gigs-calendar-custom__day-gig-time">{time}</span>
                            <span className="gigs-calendar-custom__day-gig-label">{label}</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="gigs-calendar-custom__day-add"
                  aria-label="Add"
                  onClick={(e) => e.preventDefault()}
                >
                  +
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
