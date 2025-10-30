import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const EMPTY_FILTERS = {
    genres: [],
    kind: '',
    musicianType: '',
    minBudget: null,
    maxBudget: null,
    startDate: null,
    endDate: null,
  };

export const FilterPanel = ({ filters, setFilters, pendingFilters, setPendingFilters, applyFilters, toggleFilters }) => {
    const musicianGenres = ['Pop', 'Rock', 'Classical', 'Jazz', 'Folk'];
    const djGenres = ['Club Classics', 'House', 'New Hits', 'Hip-Hop & RnB', 'Funk & Soul', 'Disco', 'Drum & Bass', 'Jungle', 'Rock', 'Chillout/Lounge'];
  
    const clearFilters = () => {
      setFilters(EMPTY_FILTERS);
      setPendingFilters(EMPTY_FILTERS);
      toggleFilters();
    };
  
    return (
      <div className="filters-container form">
        <div className="filters-body">
          <h2>Filters</h2>
  
          {/* Musician Type */}
          <div className="input-group">
            <label className="label">Musician Type</label>
            <div className="button-toggle-group">
              {['Musician/Band', 'DJ'].map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`btn ${pendingFilters.musicianType === type ? 'selected' : ''}`}
                  onClick={() => setPendingFilters(prev => ({
                    ...prev,
                    musicianType: prev.musicianType === type ? '' : type
                  }))}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
  
          {/* Gig Type */}
          <div className="input-group">
            <label className="label">Gig Type</label>
            <select
              value={pendingFilters.kind}
              onChange={(e) => setPendingFilters(prev => ({ ...prev, kind: e.target.value }))}
              className="select"
            >
              <option value="">All</option>
              <option value="Background Music">Background Music</option>
              <option value="Live Music">Live Music</option>
              <option value="Ticketed Gig">Ticketed Gig</option>
              <option value="House Party">House Party</option>
              <option value="Wedding">Wedding</option>
              <option value="Open Mic">Open Mic</option>
            </select>
          </div>
  
          {/* Genres */}
          {pendingFilters.musicianType && (
            <div className="input-group genres-select">
              <label className="label">Genres</label>
              <div className="button-toggle-group wrap">
                {(pendingFilters.musicianType === 'DJ' ? djGenres : musicianGenres).map((genre) => {
                  const isSelected = pendingFilters.genres.includes(genre);
                  return (
                    <button
                      key={genre}
                      className={`btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => setPendingFilters(prev => ({
                        ...prev,
                        genres: isSelected
                          ? prev.genres.filter(g => g !== genre)
                          : [...prev.genres, genre],
                      }))}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
  
          {/* Budget */}
          {/* {(pendingFilters.kind !== 'Ticketed Gig' && pendingFilters.kind !== 'Open Mic') && (
            <div className="input-group">
              <label className="label">Budget (£)</label>
              <input
                type="number"
                className="input"
                placeholder="Min"
                value={pendingFilters.minBudget || ''}
                onChange={(e) =>
                  setPendingFilters(prev => ({
                    ...prev,
                    minBudget: e.target.value ? parseInt(e.target.value) : null
                  }))
                }
              />
              <input
                type="number"
                className="input"
                placeholder="Max"
                value={pendingFilters.maxBudget || ''}
                onChange={(e) =>
                  setPendingFilters(prev => ({
                    ...prev,
                    maxBudget: e.target.value ? parseInt(e.target.value) : null
                  }))
                }
              />
            </div>
          )} */}
  
          {/* Date Range */}
          <div className="input-group calendar">
            <label className="label">Date Range</label>
            <DatePicker
              selectsRange
              inline
              startDate={pendingFilters.startDate}
              endDate={pendingFilters.endDate}
              onChange={([start, end]) =>
                setPendingFilters(prev => ({
                  ...prev,
                  startDate: start,
                  endDate: end
                }))
              }
              isClearable
              dateFormat="dd/MM/yyyy"
              calendarClassName="date-range-picker-calendar"
            />
          </div>
        </div>
        <div className="filter-buttons">
          <button className="btn secondary" onClick={clearFilters}>
            {pendingFilters === EMPTY_FILTERS ? 'Close' : 'Clear Filters'}
          </button>
          <button className="btn primary" onClick={applyFilters}>Apply Filters</button>
        </div>
      </div>
    );
  };