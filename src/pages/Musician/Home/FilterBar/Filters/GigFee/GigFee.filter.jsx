// Styles
    import './gig-fee-filter.styles.css'


export const GigFeeFilter = ({ minimumFee, setMinimumFee, displayFee, setDisplayFee }) => {

    const handleMinFeeSelect = (fee, stringFee) => {
        setMinimumFee(fee);
        setDisplayFee(stringFee);
    }

    return (
        <ul className='gig-fee-filter'>
            <li onClick={() => handleMinFeeSelect(0, 'No minimum')}>No minimum</li>
            <li onClick={() => handleMinFeeSelect(50, '£50+')}>£50+</li>
            <li onClick={() => handleMinFeeSelect(100, '£100+')}>£100+</li>
            <li onClick={() => handleMinFeeSelect(250, '£250+')}>£250+</li>
            <li onClick={() => handleMinFeeSelect(500, '£500+')}>£500+</li>
        </ul>
    )
}