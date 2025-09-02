import { FilterIconEmpty } from "../shared/ui/extras/Icons";

export const TopBanner = ({ gigCount, showFilters, toggleFilters, viewType, setViewType, gigMarkerDisplay, setGigMarkerDisplay }) => (
    <div className="top-banner">
      <div className="filter-header">
        <button className="btn tertiary filter-button" onClick={toggleFilters}>
          <FilterIconEmpty />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
        <h2>{gigCount} Results</h2>
      </div>
      <div className="results-header">
        {/* {viewType === 'map' && (
          <select
            value={gigMarkerDisplay}
            onChange={(e) => setGigMarkerDisplay(e.target.value)}
            className="select gig-marker-select"
          >
            <option value="budget">Show Venue Budget</option>
            <option value="kind">Show Gig Type</option>
          </select>
        )} */}
        {/* <button className="btn tertiary" onClick={() => setViewType(viewType === 'map' ? 'list' : 'map')}>
          {viewType === 'map' ? 'List View' : 'Map View'}
        </button> */}
      </div>
    </div>
  );