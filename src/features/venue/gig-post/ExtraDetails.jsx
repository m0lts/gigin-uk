
export const GigExtraDetails = ({ formData, handleInputChange }) => {

    const handleTechnicalInfoChange = (info) => {
      handleInputChange({ technicalInformation: info });
    };
  
    return (
      <>
        <div className='head'>
          <h1 className='title'>Gig Description</h1>
          <p className='text'>Describe the gig's vibe and any additional details.</p>
        </div>
  
        <div className='body extra-details'>
          <div className='input-group'>
            <textarea
              name='technicalInformation'
              id='extraInformation'
              onChange={(e) => handleTechnicalInfoChange(e.target.value)}
              value={formData.technicalInformation}
              placeholder='An intimate candlelit gig. We have a sound technician...'
              maxLength={250}
            ></textarea>
          </div>
          </div>
      </>
    );
  };