
export const GigExtraDetails = ({ formData, handleInputChange }) => {

    const handleTechnicalInfoChange = (info) => {
      handleInputChange({ technicalInformation: info });
    };
  
    const handleSoundTechChange = (value) => {
      handleInputChange({ soundTechnicianRequired: value });
    };
  
    return (
      <>
        <div className='head'>
          <h1 className='title'>Additional details</h1>
          <p className='text'>Is there anything else you’d like the musicians to know?</p>
        </div>
  
        <div className='body extra-details'>
  
          <div className='input-group'>
            <label htmlFor='soundTech' className="label">Will the musician need a sound technician?</label>
            <div className='toggle-buttons'>
              <button
                className={`card small black ${formData.soundTechnicianRequired === true ? 'selected' : ''}`}
                onClick={() => handleSoundTechChange(true)}
                type='button'
              >
                Yes
              </button>
              <button
                className={`card small black ${formData.soundTechnicianRequired === false ? 'selected' : ''}`}
                onClick={() => handleSoundTechChange(false)}
                type='button'
              >
                No
              </button>
            </div>
          </div>
  
          <div className='input-group'>
            <label htmlFor='technicalInformation' className="label">Any other technical notes?</label>
            <textarea
              name='technicalInformation'
              id='extraInformation'
              onChange={(e) => handleTechnicalInfoChange(e.target.value)}
              value={formData.technicalInformation}
              placeholder='Add any extra information about your equipment or technical requirements...'
            ></textarea>
          </div>
          </div>
      </>
    );
  };