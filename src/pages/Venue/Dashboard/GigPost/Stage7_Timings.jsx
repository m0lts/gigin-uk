
export const GigTimings = ({ formData, handleInputChange }) => {

    const handleStartTimeChange = (time) => {
        handleInputChange({
            startTime: time,
        })
    }

    const handleDurationChange = (hours, minutes) => {
        const totalMinutes = (parseInt(hours) * 60) + parseInt(minutes);
        handleInputChange({
            duration: totalMinutes,
        });
    };

    const handleHoursChange = (e) => {
        const hours = e.target.value;
        const minutes = formData.duration % 60;
        handleDurationChange(hours, minutes);
    };

    const handleMinutesChange = (e) => {
        const minutes = e.target.value;
        const hours = Math.floor(formData.duration / 60);
        handleDurationChange(hours, minutes);
    };

    const formatTime = (timeString) => {
        const [hours, minutes] = timeString.split(':').map(Number);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    const calculateTime = (time, offset) => {
        const [hours, minutes] = time.split(':').map(Number);
        const totalMinutes = (hours * 60) + minutes + offset;
        const newHours = Math.floor((totalMinutes + 1440) % 1440 / 60);
        const newMinutes = totalMinutes % 60;
        return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    };

    const calculateEndTime = () => {
        return calculateTime(formData.startTime, formData.duration);
    };

    const startTimeMinusOneHour = formData.startTime ? calculateTime(formData.startTime, -60) : '00:00';
    const endTime = formData.startTime && formData.duration ? calculateEndTime() : '00:00';

    return (
        <>
            <div className="head">
                <h1 className="title">Choose your timings for the gig.</h1>
            </div>
            <div className="body timings">
                <div className="selections">
                    <div className="input-group">
                        <label htmlFor="startTime">Gig Start Time</label>
                        <input 
                            type="time" 
                            name="startTime" 
                            id="startTime"
                            onChange={(e) => handleStartTimeChange(e.target.value)}
                            value={formData.startTime}
                         />
                    </div>
                    <div className="input-group">
                        <label htmlFor="duration">Gig Duration</label>
                        <div className="duration-inputs">
                            <select name="hours" id="hours" onChange={handleHoursChange} value={Math.floor(formData.duration / 60)}>
                                {[...Array(6).keys()].map(i => (
                                    <option key={i } value={i}>{i}</option>
                                ))}
                            </select>
                            <span className="unit"> {formData.duration < 120 ? 'hr' : 'hrs'} </span>
                            <select name="minutes" id="minutes" onChange={handleMinutesChange} value={formData.duration % 60}>
                                {[0, 15, 30, 45].map(i => (
                                    <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                                ))}
                            </select>
                            <span className="unit"> mins </span>
                        </div>
                    </div>
                </div>
                <div className="timeline">
                    <div className="subtitle">
                        <h5 className="label">Gig Timeline</h5>
                        {formData.startTime === '' && (
                            <p>Fill out your timings to see a rough timeline of the evening.</p>
                        )}
                    </div>
                    {formData.startTime !== '' && (
                        <>
                            <div className="timeline-event">
                                <div className="timeline-time">{startTimeMinusOneHour !== '00:00' ? formatTime(startTimeMinusOneHour) : '00:00'}</div>
                                <div className="timeline-line"></div>
                                <div className="timeline-content">
                                    <div className="timeline-details">
                                        <h4>Musicians Arrive</h4>
                                    </div>
                                </div>
                            </div>
                            <div className="timeline-event">
                                <div className="timeline-time orange">{formData.startTime ? formatTime(formData.startTime) : '00:00'}</div>
                                <div className="timeline-line"></div>
                                <div className="timeline-content">
                                    <div className="timeline-details">
                                        <h4>Performance Starts</h4>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                    {(formData.startTime !== '' && formData.duration !== 0) && (
                        <>
                            {formData.duration > 60 && (
                                <div className="timeline-event">
                                    <div className="timeline-content">
                                        <div className="timeline-context">
                                            <p>* Musicians usually require a short break after an hour of performing.</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="timeline-event">
                                <div className="timeline-time orange">{endTime !== '00:00' ? formatTime(endTime) : '00:00'}</div>
                                <div className="timeline-line"></div>
                                <div className="timeline-content">
                                    <div className="timeline-details">
                                        <h4>Performance Ends</h4>
                                    </div>
                                </div>
                            </div>
                            <div className="timeline-event">
                                <div className="timeline-time">{endTime !== '00:00' ? formatTime(calculateTime(endTime, 60)) : '00:00'}</div>
                                <div className="timeline-line"></div>
                                <div className="timeline-content">
                                    <div className="timeline-details">
                                        <h4>Musicians Leave</h4>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    )
}