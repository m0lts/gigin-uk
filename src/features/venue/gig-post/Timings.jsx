import { toast } from "sonner";

export const GigTimings = ({
    formData,
    handleInputChange,
    error,
    extraSlots,
    setExtraSlots,
  }) => {
  
    const handleStartTimeChange = (index, value) => {
        if (index === 0) {
          handleInputChange({ startTime: value });
      
          if (extraSlots.length > 0) {
            const newStart = addMinutesToTime(value, formData.duration);
            updateSlot(0, { startTime: newStart });
          }
        } else {
          const prevSlot = index === 1
            ? { startTime: formData.startTime, duration: formData.duration }
            : extraSlots[index - 2];
      
          const minAllowed = addMinutesToTime(prevSlot.startTime, prevSlot.duration);
      
          if (value < minAllowed) {
            updateSlot(index - 1, { startTime: minAllowed }); // Clamp
            toast.error(`Start time cannot be before ${minAllowed}`);
            return;
          }
      
          updateSlot(index - 1, { startTime: value });
      
          // auto-fill next slot if it exists
          if (extraSlots[index]) {
            const newStart = addMinutesToTime(value, extraSlots[index - 1]?.duration || 30);
            updateSlot(index, { startTime: newStart });
          }
        }
      };
  
      const handleDurationChange = (index, hours, minutes) => {
        const totalMinutes = parseInt(hours) * 60 + parseInt(minutes);
      
        if (index === 0) {
          handleInputChange({ duration: totalMinutes });
      
          if (extraSlots.length > 0 && formData.startTime) {
            const newStart = addMinutesToTime(formData.startTime, totalMinutes);
            setExtraSlots((prev) => {
              const updated = [...prev];
              updated[0] = { ...updated[0], startTime: newStart };
              return updated;
            });
          }
        } else {
          updateSlot(index - 1, { duration: totalMinutes });
      
          // auto-update next slot’s startTime
          if (extraSlots[index]) {
            const currentSlot = extraSlots[index - 1];
            const startTime = currentSlot?.startTime || '';
            const newStart = addMinutesToTime(startTime, totalMinutes);
      
            updateSlot(index, { startTime: newStart });
          }
        }
      };
  
    const updateSlot = (slotIndex, updates) => {
      setExtraSlots((prev) => {
        const updated = [...prev];
        updated[slotIndex] = {
          ...updated[slotIndex],
          ...updates,
        };
        return updated;
      });
    };

    const addMinutesToTime = (timeStr, minutesToAdd) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':').map(Number);
        const base = new Date(0, 0, 0, h, m);
        base.setMinutes(base.getMinutes() + minutesToAdd);
        return base.toTimeString().slice(0, 5);
      };

    const removeGigSlot = (index) => {
      setExtraSlots((prev) => prev.filter((_, i) => i !== index));
    };
  
    const getHours = (duration) => Math.floor(duration / 60);
    const getMinutes = (duration) => duration % 60;
  
    const allSlots = [
        { startTime: formData.startTime, duration: formData.duration },
        ...extraSlots.map(s => s || { startTime: '', duration: '' }),
      ];

    const addOneHourToTime = (timeStr) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':').map(Number);
        const date = new Date(0, 0, 0, h, m);
        date.setHours(date.getHours() + 1);
        return date.toTimeString().slice(0, 5);
      };
      
    const addGigSlot = () => {
        const allSlots = [
          { startTime: formData.startTime, duration: formData.duration },
          ...extraSlots.map(s => s || { startTime: '', duration: '' }),
        ];
      
        const lastSlot = allSlots[allSlots.length - 1];
        const defaultStart = addMinutesToTime(lastSlot.startTime, lastSlot.duration);
        setExtraSlots(prev => [...prev, { startTime: defaultStart, duration: '' }]);
    };
  
    return (
      <>
        <div className="head">
          <h1 className="title">Set Your Gig Timings</h1>
          <p className="text">If you want more than one musician to play, add a gig slot. NB: Each 'slot' is posted as its own individual gig.</p>
        </div>
  
        <div className="body timings">
            <div className="gig-slots">
                {allSlots.map((slot, index) => (
                    <div key={index} className="gig-slot">
                        {allSlots.length > 1 && (
                            <h4>{index === 0 ? 'Slot 1' : `Slot ${index + 1}`}</h4>
                        )}
        
                    <div className="input-group">
                        <label className="label">Start Time</label>
                        <input
                            type="time"
                            value={slot.startTime}
                            min={index > 0
                                ? addMinutesToTime(allSlots[index - 1].startTime, allSlots[index - 1].duration)
                                : undefined
                            }
                            onChange={(e) => handleStartTimeChange(index, e.target.value)}
                        />
                    </div>
        
                    <div className="input-group">
                        <label className="label">Duration</label>
                        <div className="duration-inputs">
                        <select
                            value={getHours(slot.duration)}
                            onChange={(e) => handleDurationChange(index, e.target.value, getMinutes(slot.duration))}
                        >
                            {[...Array(6).keys()].map(h => (
                            <option key={h} value={h}>{h}</option>
                            ))}
                        </select>
                        <span className="unit">hr</span>
                        <select
                            value={getMinutes(slot.duration)}
                            onChange={(e) => handleDurationChange(index, getHours(slot.duration), e.target.value)}
                        >
                            {[0, 15, 30, 45].map(m => (
                            <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                            ))}
                        </select>
                        <span className="unit">mins</span>
                        </div>
                    </div>
        
                    {index !== 0 && (
                        <button className="btn small tertiary" onClick={() => removeGigSlot(index - 1)}>
                            Remove Slot
                        </button>
                    )}
                    </div>
                ))}
            </div>

          {formData.kind !== 'Ticketed Gig' && formData.kind !== 'Open Mic' && (
            <button type="button" className="btn primary" onClick={addGigSlot}>
                Add Gig Slot
            </button>
          )}
  
        <div className="extra-timings">
            <div className="input-group">
                <label className="label">Load In Time</label>
                <input
                type="time"
                value={formData.loadInTime || ''}
                onChange={(e) => handleInputChange({ loadInTime: e.target.value })}
                />
            </div>

            <div className="input-group">
                <label className="label">Sound Check Time</label>
                <input
                type="time"
                value={formData.soundCheckTime || ''}
                onChange={(e) => handleInputChange({ soundCheckTime: e.target.value })}
                />
            </div>
        </div>
  
          {error && (
            <div className="error-cont" style={{ width: 'fit-content', margin: '0.5rem auto' }}>
              <p className="error-message">{error}</p>
            </div>
          )}
        </div>
      </>
    );
};






{/* <div className='timeline'>
    <div className='subtitle'>
        <h5 className='label'>Gig Timeline</h5>
        {formData.startTime === '' && (
            <p>Fill out your timings to see a rough timeline of the evening.</p>
        )}
    </div>
    {formData.startTime !== '' && (
        <>
            <div className='timeline-event'>
                <div className='timeline-time'>{startTimeMinusOneHour !== '00:00' ? formatTime(startTimeMinusOneHour) : '00:00'}</div>
                <div className='timeline-line'></div>
                <div className='timeline-content'>
                    <div className='timeline-details'>
                        <h4>Musicians Arrive</h4>
                    </div>
                </div>
            </div>
            <div className='timeline-event'>
                <div className='timeline-time orange'>{formData.startTime ? formatTime(formData.startTime) : '00:00'}</div>
                <div className='timeline-line'></div>
                <div className='timeline-content'>
                    <div className='timeline-details'>
                        <h4>Performance Starts</h4>
                    </div>
                </div>
            </div>
        </>
    )}
    {(formData.startTime !== '' && formData.duration !== 0) && (
        <>
            {(formData.duration > 60 && formData.kind !== 'Open Mic') && (
                <div className='timeline-event'>
                    <div className='timeline-content'>
                        <div className='timeline-context'>
                            <p>* Musicians usually require a short break after an hour of performing.</p>
                        </div>
                    </div>
                </div>
            )}
            <div className='timeline-event'>
                <div className='timeline-time orange'>{endTime !== '00:00' ? formatTime(endTime) : '00:00'}</div>
                <div className='timeline-line'></div>
                <div className='timeline-content'>
                    <div className='timeline-details'>
                        <h4>Performance Ends</h4>
                    </div>
                </div>
            </div>
            <div className='timeline-event'>
                <div className='timeline-time'>{endTime !== '00:00' ? formatTime(calculateTime(endTime, 30)) : '00:00'}</div>
                <div className='timeline-line'></div>
                <div className='timeline-content'>
                    <div className='timeline-details'>
                        <h4>Musicians Leave</h4>
                    </div>
                </div>
            </div>
        </>
    )}
</div> */}
