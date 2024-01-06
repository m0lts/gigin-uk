import { GigFeeFilter } from '/components/Filters/GigFee/GigFeeFilter'
import { Calendar } from '/components/Calendar/Calendar'
import { ApplyFilterButton, FilterButton } from '/pages/Home/Buttons/home.buttons.jsx'
import { SearchButtonSmall } from '/components/Buttons/Buttons'
import { useState } from 'react'
import './home.filter-bar.styles.css'

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