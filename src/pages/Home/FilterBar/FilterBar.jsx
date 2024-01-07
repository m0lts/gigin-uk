import { useState } from 'react'
import { GigFeeFilter } from '/pages/Home/FilterBar/Filters/GigFee/GigFee.filter.jsx'
import { Calendar } from '/components/Calendar/Calendar'
import { ApplyFilterButton, FilterButton, SearchButtonSmall } from '/pages/Home/FilterBar/Buttons/FilterBar.buttons.jsx'
import './filter-bar.styles.css'

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
            <div className={`filters-box ${showFilterOne || showFilterTwo ? 'active' : ''}`}>
                <div className='filters'>
                    <FilterButton 
                        filterName={'Date'}
                        showFilter={showFilterOne}
                        setShowFilter={setShowFilterOne}
                        filterFilled={dateSelected}
                        setFilterFilled={setDateSelected}
                        otherFilter={showFilterTwo}
                        setOtherFilter={setShowFilterTwo}
                    />
                    <FilterButton 
                        filterName={'Min Fee'}
                        showFilter={showFilterTwo}
                        setShowFilter={setShowFilterTwo}
                        filterFilled={minFeeDisplay}
                        setFilterFilled={setMinFeeDisplay}
                        otherFilter={showFilterOne}
                        setOtherFilter={setShowFilterOne}
                    />
                    <SearchButtonSmall 
                        clearItemOne={setShowFilterOne}
                        clearItemTwo={setShowFilterTwo}
                    />
                </div>
                {showFilterOne && (
                    <>
                        <Calendar
                            dateSelected={dateSelected}
                            setDateSelected={setDateSelected}
                        />
                        <ApplyFilterButton 
                            applyFilter={setShowFilterOne}
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
                        <ApplyFilterButton
                            applyFilter={setShowFilterTwo}
                        />
                    </>
                )}
            </div>
        </div>
    )
}