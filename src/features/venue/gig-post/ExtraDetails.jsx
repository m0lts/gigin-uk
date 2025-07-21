
export const GigExtraDetails = ({ formData, handleInputChange }) => {
    
    const handleExtraInfoChange = (info) => {
        handleInputChange({
            extraInformation: info,
        })
    }

    return (
        <>
            <div className='head'>
                <h1 className='title'>Any additional details?</h1>
                <p className='text'>Is there anything else you’d like the musicians to know? </p>
            </div>
            <div className='body extra-details'>
                <div className='input-group'>
                    <textarea 
                        name='extraInformation' 
                        id='extraInformation' 
                        onChange={(e) => handleExtraInfoChange(e.target.value)}
                        value={formData.extraInformation}
                        placeholder='Do you mind if the musicians play some of their original songs? Add any special song requests, extra details on what kind of experience you’re after etc.'
                    ></textarea>
                </div>
            </div>
        </>
    );
};