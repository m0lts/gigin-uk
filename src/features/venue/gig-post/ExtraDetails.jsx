
export const GigExtraDetails = ({ formData, handleInputChange }) => {

    const handleTechnicalInfoChange = (info) => {
      handleInputChange({ technicalInformation: info });
    };
  
    return (
      <>
        <div className='head'>
          <h1 className='title'>Final Details</h1>
          <p className='text'>Is there anything else you’d like the musicians to know?</p>
        </div>
  
        <div className='body extra-details'>
          <div className='input-group'>
            <label htmlFor='technicalInformation' className="label">Any other technical notes?</label>
            <textarea
              name='technicalInformation'
              id='extraInformation'
              onChange={(e) => handleTechnicalInfoChange(e.target.value)}
              value={formData.technicalInformation}
              placeholder='Add information about sound technician requirements or other technical points...'
              maxLength={250}
            ></textarea>
          </div>
          </div>
      </>
    );
  };