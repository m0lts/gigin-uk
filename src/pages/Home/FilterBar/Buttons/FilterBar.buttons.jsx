import { SearchIcon } from '/components/Icons/Icons'
import './filter-bar.buttons.styles.css'

// Universal filter button
export const FilterButton = ({ filterName, showFilter, setShowFilter, filterFilled, setFilterFilled, otherFilter, setOtherFilter }) => {

    const handleShowFilter = () => {
        if (showFilter) {
            setShowFilter(false);
        } else {
            setShowFilter(true);
            setOtherFilter(false);
        }
    }

    const handleClearFilter = () => {
        setFilterFilled(false);
    }

    const isDate = (date) => {
        return Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date.getTime());
    };

    return (
        <button 
            className={`btn filter-button ${showFilter && 'active'}`}
            onClick={handleShowFilter}
        >   
            <span className={`filter-button-name ${filterFilled && 'filled'}`}>{filterName}</span>
            {filterFilled && (
                // If filterFilled is a date, then return the date formatted to desire.
                // If not a date, just render fitlerFilled.
                <div className='filter-button-filled' onClick={handleClearFilter}>
                    {isDate(new Date(filterFilled)) ? (
                        formatSelectedDate(filterFilled)
                    ) : (
                        filterFilled
                    )}
                </div>
            )}
        </button>
    )
}


// Apply filter button
export const ApplyFilterButton = ({ applyFilter }) => {

    // See FilterBar save button for reference
    const handleApply = () => {
        applyFilter(false);
    }

    return (
        <button 
            className='btn apply-button'
            onClick={handleApply}
        >
            Apply
        </button>
    )
}

// Search buttons
export const SearchButtonSmall = ({ clearItemOne, clearItemTwo }) => {

    const handleClearItems = () => {
        clearItemOne(null);
        clearItemTwo(null);
    }

    return (
        <button className='btn search-button-small' onClick={handleClearItems}>
            <SearchIcon />
        </button>
    )
}
export const SearchButtonBig = () => {
    return (
        <button className='btn search-button-big'>
            <span>Search</span>
            <SearchIcon />
        </button>
    )
}

export const EmptySubmitButton = () => {
    return (
        <button type="submit" className="next-footer-button btn">
            Submit
        </button>
    )
}