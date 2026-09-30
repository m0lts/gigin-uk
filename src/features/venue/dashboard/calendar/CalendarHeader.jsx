import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

const VIEWS = [
  { key: 'month', label: 'Month' },
  { key: 'week', label: 'Week' },
  { key: 'season', label: 'Season' },
];

const FILTERS = [
  { key: 'all', label: 'All', dot: 'all' },
  { key: 'attention', label: 'Needs action', dot: 'attention' },
  { key: 'awaiting', label: 'Awaiting payment', dot: 'awaiting' },
  { key: 'confirmed', label: 'Confirmed', dot: 'confirmed' },
];

export function CalendarHeader({
  title,
  view,
  filter,
  counts,
  onView,
  onFilter,
  onPrev,
  onNext,
  onToday,
}) {
  return (
    <div className="gigs-cal__header">
      <div className="gigs-cal__header-row">
        <div className="gigs-cal__header-left">
          <h2 className="gigs-cal__title">{title}</h2>
          <div className="gigs-cal__nav">
            <button type="button" className="gigs-cal__icon-btn" aria-label="Previous" onClick={onPrev}>
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
            <button type="button" className="gigs-cal__icon-btn" aria-label="Next" onClick={onNext}>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>
          <button type="button" className="gigs-cal__today" onClick={onToday}>Today</button>
        </div>
        <div className="gigs-cal__views" role="group" aria-label="Calendar view">
          {VIEWS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={view === item.key ? 'is-active' : ''}
              data-view={item.key}
              aria-pressed={view === item.key}
              onClick={() => onView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="gigs-cal__filters" role="group" aria-label="Filter gigs">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`gigs-cal__chip${filter === item.key ? ' is-selected' : ''}`}
            aria-pressed={filter === item.key}
            onClick={() => onFilter(item.key)}
          >
            <span className={`gigs-cal__chip-dot gigs-cal__chip-dot--${item.dot}`} />
            {item.label}
            <span className="gigs-cal__chip-count">{counts?.[item.key] ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
