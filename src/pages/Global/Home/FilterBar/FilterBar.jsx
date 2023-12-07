import { GigFeeFilter } from '../../../../components/Global/Filters/GigFee/GigFeeFilter'
import { Calendar } from '../../../../components/Global/Calendar/Calendar'
import { FilterButton } from '../../../../components/Global/Buttons/Buttons'
import './filter-bar.styles.css'
import { SearchButtonSmall, SaveButton } from '../../../../components/Global/Buttons/Buttons'
import { useState } from 'react'

export const FilterBar = () => {

    // Show filter options
    const [showFilterOne, setShowFilterOne] = useState(false);
    const [showFilterTwo, setShowFilterTwo] = useState(false);

    // Get date selected from Calendar component
    const [dateSelected, setDateSelected] = useState();

    // Get min fee from GigFeeFilter component
    const [minimumFee, setMinimumFee] = useState();
    const [minFeeDisplay, setMinFeeDisplay] = useState();

    return (
        <div className={`filter-bar ${showFilterOne || showFilterTwo ? 'active' : ''}`}>
            <div className='filters'>
                <FilterButton 
                    filterName={dateSelected ? dateSelected : 'Date'}
                    showFilter={showFilterOne}
                    setShowFilter={setShowFilterOne}
                    filterFilled={dateSelected}
                    setFilterFilled={setDateSelected}
                />
                <span className='filter-break'></span>
                <FilterButton 
                    filterName={minFeeDisplay ? minFeeDisplay : 'Min Fee'}
                    showFilter={showFilterTwo}
                    setShowFilter={setShowFilterTwo}
                    filterFilled={minFeeDisplay}
                    setFilterFilled={setMinFeeDisplay}
                />
                <SearchButtonSmall />
            </div>
            {showFilterOne && (
                <>
                    <Calendar
                        dateSelected={dateSelected}
                        setDateSelected={setDateSelected}
                    />
                    <SaveButton 
                        saveItem={setShowFilterOne}
                    />
                </>
            )}
            {showFilterTwo && !showFilterOne && (
                <>
                    <GigFeeFilter
                        minimumFee={minimumFee}
                        setMinimumFee={setMinimumFee}
                        displayFee={minFeeDisplay}
                        setDisplayFee={setMinFeeDisplay}
                    />
                    <SaveButton
                        saveItem={setShowFilterTwo}
                    />
                </>
            )}
        </div>
    )
}