import { toast } from "sonner";

export const GigTimings = ({
    formData,
    handleInputChange,
    error,
    extraSlots,
    setExtraSlots,
  }) => {

    const recalcFrom = (slots, startIdx) => {
      // slots = [{ startTime, duration }, ...extraSlots...]
      for (let i = startIdx + 1; i < slots.length; i++) {
        const prev = slots[i - 1];
        const prevStart = prev?.startTime || '';
        const prevDur = Number(prev?.duration) || 0;
        slots[i] = {
          ...slots[i],
          startTime: prevStart ? addMinutesToTime(prevStart, prevDur) : slots[i]?.startTime || '',
        };
      }
      return slots;
    };
  

    const handleStartTimeChange = (index, value) => {
      if (!value) return;
    
      if (index === 0) {
        // Update base startTime
        handleInputChange({ startTime: value });
        // Cascade all extra slots from the base
        setExtraSlots((prev) => {
          const slots = [{ startTime: value, duration: formData.duration }, ...prev.map(s => s || { startTime: '', duration: '' })];
          recalcFrom(slots, 0);
          return slots.slice(1);
        });
      } else {
        // Guard: min allowed is previous slot's end
        const prevSlot = index === 1
          ? { startTime: formData.startTime, duration: formData.duration }
          : extraSlots[index - 2];
    
        const minAllowed = addMinutesToTime(prevSlot?.startTime || '', Number(prevSlot?.duration) || 0);
        const newValue = (minAllowed && value < minAllowed) ? minAllowed : value;
    
        if (minAllowed && value < minAllowed) {
          toast.error(`Start time cannot be before ${minAllowed}`);
        }
    
        setExtraSlots((prev) => {
          const slots = [{ startTime: formData.startTime, duration: formData.duration }, ...prev.map(s => s || { startTime: '', duration: '' })];
          // Update the changed slot (index maps to extraSlots[index-1])
          slots[index] = { ...slots[index], startTime: newValue };
          // Recompute everything after this slot
          recalcFrom(slots, index);
          return slots.slice(1);
        });
      }
    };
    
    const handleDurationChange = (index, hours, minutes) => {
      const totalMinutes = (parseInt(hours, 10) || 0) * 60 + (parseInt(minutes, 10) || 0);
    
      if (index === 0) {
        // Update base duration
        handleInputChange({ duration: totalMinutes });
        // Cascade all extra slots from the base
        setExtraSlots((prev) => {
          const slots = [{ startTime: formData.startTime, duration: totalMinutes }, ...prev.map(s => s || { startTime: '', duration: '' })];
          recalcFrom(slots, 0);
          return slots.slice(1);
        });
      } else {
        setExtraSlots((prev) => {
          const slots = [{ startTime: formData.startTime, duration: formData.duration }, ...prev.map(s => s || { startTime: '', duration: '' })];
          // Update the changed slot’s duration (index maps to extraSlots[index-1])
          slots[index] = { ...slots[index], duration: totalMinutes };
          // Recompute everything after this slot
          recalcFrom(slots, index);
          return slots.slice(1);
        });
      }
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
          {formData.kind === 'Open Mic' ? (
            <p className="text">When does the Open Mic start?</p>
          ) : (
            <p className="text">If you want more than one musician to play, add a gig slot. NB: Each 'slot' is posted as its own individual gig.</p>
          )}
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