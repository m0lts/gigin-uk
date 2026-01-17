import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { EditIcon } from '@features/shared/ui/extras/Icons';
import { toast } from 'sonner';
import { ExclamationIcon } from '../../shared/ui/extras/Icons';
import { saveGigTemplate } from '../../../services/api/venues';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export const GigReview = ({ formData, handleInputChange, setStage, buildingForMusician, buildingForMusicianData, extraSlots, inviteExpiryDate, setInviteExpiryDate }) => {

    const [saving, setSaving] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [savedTemplate, setSavedTemplate] = useState(false);
    const [repeatData, setRepeatData] = useState({
        repeat: '',
        end: '',
        endAfter: '',
        endDate: ''
    })
    const [gigRepeat, setGigRepeat] = useState('no');
    const [repeatEnd, setRepeatEnd] = useState('after');
    const [endRepeatAfter, setEndRepeatAfter] = useState('');
    const [endRepeatDate, setEndRepeatDate] = useState('');
    const {isMdUp} = useBreakpoint();


    useEffect(() => {
        setRepeatData({
            repeat: gigRepeat,
            end: repeatEnd,
            endAfter: endRepeatAfter,
            endDate: endRepeatDate
        })
    }, [gigRepeat, repeatEnd, endRepeatAfter, endRepeatDate])

    useEffect(() => {
        handleInputChange({
            repeatData
        })
    }, [repeatData])

    const formatMusic = (genres) => {
        if (!genres.length) return 'No Genre Preference';
        if (genres.length === 1) return `${genres[0]}`;
        if (genres.length === 2) return `${genres[0]} and ${genres[1]}`;
        return `${genres.slice(0, -1).join(', ')} and ${genres[genres.length - 1]}`;
    };

    const formatDuration = (duration) => {
        if (duration < 60) return `${duration}mins`;
        if (duration === 60) return `1 hour`;
        if (duration > 60 && duration < 120) return `1 hour ${duration - 60}mins`;
        if (duration === 120) return `2 hours`;
        if (duration > 120 && duration < 180) return `2 hour ${duration - 120}mins`;
        if (duration === 180) return `3 hours`;
        if (duration > 180 && duration < 240) return `3 hour ${duration - 180}mins`;
        if (duration === 240) return `4 hours`;
        if (duration > 240 && duration < 300) return `4 hour ${duration - 240}mins`;
        if (duration === 300) return `5 hours`;
    }
    
    const getOrdinalSuffix = (day) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
        const month = date.toLocaleDateString('en-GB', { month: 'long' });
        return `${weekday} ${day}${getOrdinalSuffix(day)} ${month}`;
    };

    const HARD_CAP = 10;

    const getMaxRepeat = () => {
        const byFreq =
          gigRepeat === 'daily' ? 365 :
          gigRepeat === 'weekly' ? 52 :
          gigRepeat === 'fortnightly' ? 26 :
          gigRepeat === 'monthly' ? 12 :
          0;
        return Math.min(HARD_CAP, byFreq || HARD_CAP);
    };

    const addOccurrence = (date, freq) => {
        const d = new Date(date);
        if (freq === 'daily') d.setDate(d.getDate() + 1);
        else if (freq === 'weekly') d.setDate(d.getDate() + 7);
        else if (freq === 'fortnightly') d.setDate(d.getDate() + 14);
        else if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
        return d;
    };
    
    const nthOccurrenceDate = (start, freq, n) => {
        let d = new Date(start);
        for (let i = 1; i < n; i++) d = addOccurrence(d, freq);
        return d;
    };
      
    const countOccurrencesUpTo = (start, end, freq, cap = HARD_CAP) => {
        let count = 1;
        let d = new Date(start);
        while (count < cap) {
          d = addOccurrence(d, freq);
          if (d > end) break;
          count++;
        }
        return count;
    };

    const handleEndRepeatAfterChange = (e) => {
        const max = getMaxRepeat();
        let value = parseInt(e.target.value || '0', 10);
        if (!Number.isFinite(value) || value < 1) value = 1;
        if (value > max) value = max;
        setRepeatEnd('after');
        setEndRepeatAfter(String(value));
    };

    const handleRepeatDateChange = (e) => {
        const chosen = new Date(e.target.value);
        const start = new Date(formData.date);
        if (chosen < start) {
          toast.error('The repeat end date cannot be before the gig date.');
          return;
        }
        if (gigRepeat === 'no') {
          setEndRepeatDate(e.target.value);
          return;
        }
        const occ = countOccurrencesUpTo(start, chosen, gigRepeat, HARD_CAP + 1);
        if (occ > HARD_CAP) {
          const tenth = nthOccurrenceDate(start, gigRepeat, HARD_CAP);
          const iso = tenth.toISOString().slice(0, 10);
          setEndRepeatDate(iso);
          toast('Capped to the first 10 repeats.');
        } else {
          setEndRepeatDate(e.target.value);
        }
      };


    const handleSaveTemplate = async () => {
        setSaving(true);
        const templateId = uuidv4();
        const allSlots = [
          { startTime: formData.startTime, duration: formData.duration },
          ...extraSlots,
        ];
      
        // Clone formData and strip unwanted fields
        const {
          applicants,     // remove
          gigId,          // remove
          date,           // remove
          createdAt,      // remove
          ...rest
        } = formData;
      
        const templateDataPacket = {
          ...rest,
          gigId: null,
          date: null,
          templateName,
          templateId,
          gigSlots: allSlots,
          status: "open",
          createdAt: Date.now(),
        };
      
        try {
          await saveGigTemplate({ templateData: templateDataPacket });
          setSaving(false);
          setSavedTemplate(true);
          toast.success("Template Saved.");
        } catch (error) {
          setSaving(false);
          toast.error("Failed to save template. Please try again.");
          console.error("Failed to save template:", error);
        }
      };

    // Get gig date as a Date object for maxDate
    const gigDate = formData?.date ? (formData.date instanceof Date ? formData.date : new Date(formData.date)) : null;

    return (
        <>
            <div className='head'>
                <h1 className='title'>Review Gig Details</h1>
            </div>
            <div className='body review'>
                <div className='review-box-top'>
                    <h4 className='value'>{formData.venue.venueName}</h4>
                    <button className='btn text' onClick={() => setStage(1)}>
                        <EditIcon />
                    </button>
                </div>
                <div className='review-grid'>
                    <div className='review-left'>
                        <div className='review-box'>
                            <h4 className='value'>{formData.date ? formatDate(formData.date) : 'Date undecided'}</h4>
                            <button className='btn text' onClick={() => setStage(2)}>
                                <EditIcon />
                            </button>
                        </div>
                        <div className='review-box'>
                            <h4 className='value'>{formData.startTime}</h4>
                            <button className='btn text' onClick={() => setStage(2)}>
                                <EditIcon />
                            </button>
                        </div>
                        <div className='review-box'>
                            <h4 className='value'>{formatDuration(formData.duration)}</h4>
                            <button className='btn text' onClick={() => setStage(2)}>
                                <EditIcon />
                            </button>
                        </div>
                        <div className='review-box'>
                            <h4 className='value'>{formData.kind === 'Open Mic' || formData.kind === 'Ticketed Gig' ? formData.kind : extraSlots.length && formData.budget === '£' ? 'Multiple Budgets' : formData.budget === '£' ? 'No Fee' : formData.budget}</h4>
                            <button className='btn text' onClick={() => setStage(8)}>
                                <EditIcon />
                            </button>
                        </div>
                        <div className='review-box'>
                            <h4 className='value'>{formData.privacy} {formData.kind}</h4>
                            <button className='btn text' onClick={() => setStage(4)}>
                                <EditIcon />
                            </button>
                        </div>
                        <div className='review-box'>
                            <h4 className='value'>{formatMusic(formData.genre)}</h4>
                            <button className='btn text' onClick={() => setStage(6)}>
                                <EditIcon />
                            </button>
                        </div>
                        {extraSlots.length > 0 && (
                            <div className="review-box">
                                <div className="value">
                                    <h4 style={{ marginBottom: 6 }}>
                                        {extraSlots.length < 1 ? (
                                            "Single performer (no slot split)"
                                        ) : (
                                            `Multiple performers: ${extraSlots.length + 1 || 0} slots`
                                        )}
                                    </h4>
                                </div>
                                <button className="btn text" onClick={() => setStage(7)}>
                                    <EditIcon />
                                </button>
                            </div>                            
                        )}
                        {!isMdUp && !buildingForMusician && (
                            <div className='review-extra-option'>
                                <div className='toggle-container'>
                                    <label htmlFor='invite-only' className='label'>Invite only?</label>
                                    <label className='switch'>
                                        <input
                                            type='checkbox'
                                            id='invite-only'
                                            checked={formData.private || false}
                                            onChange={(e) => handleInputChange({ private: e.target.checked })}
                                        />
                                        <span className='slider round'></span>
                                    </label>
                                </div>
                                {!formData.private ? (
                                    <p className='text' style={{ maxWidth: '300px'}}>
                                        When enabled, this gig will only accept applications from artists with an invite link. 
                                        You can create invite links after posting the gig.
                                        You can change the gig status at any time.
                                    </p>
                                ) : (
                                    <p className='text'>
                                        This gig is invite only. Create invite links from the gig table after posting.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                    {isMdUp && (
                        <div className='review-right'>
                            {buildingForMusician ? (
                                <div className='review-extra-option'>
                                    <div className='toggle-container'>
                                        <label htmlFor='invite-only' className='label'>Invite only?</label>
                                        <label className='switch'>
                                            <input
                                                type='checkbox'
                                                id='invite-only'
                                                checked={formData.private || false}
                                                onChange={(e) => handleInputChange({ private: e.target.checked })}
                                            />
                                            <span className='slider round'></span>
                                        </label>
                                    </div>
                                    <p className='text' style={{ maxWidth: '500px', marginTop: '0.5rem' }}>
                                        The gig will be set as private by default. {buildingForMusicianData?.name || 'The artist'} will be sent an invite to the gig.
                                    </p>
                                    {formData.private && (
                                        <div style={{ marginTop: '1.5rem' }}>
                                            <p style={{ marginBottom: '1rem' }}>
                                                Select a date if you want the invite to expire at a certain time.
                                            </p>
                                            <div className="calendar">
                                                {gigDate && (
                                                    <DatePicker
                                                        selected={inviteExpiryDate}
                                                        onChange={(date) => setInviteExpiryDate(date)}
                                                        inline
                                                        minDate={new Date()}
                                                        maxDate={gigDate}
                                                        dayClassName={(date) => {
                                                            const today = new Date().setHours(0, 0, 0, 0);
                                                            const dateTime = date.getTime();
                                                            if (dateTime < today) return 'past-date';
                                                            if (gigDate && dateTime > gigDate.getTime()) return 'past-date';
                                                            return undefined;
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {(formData.dateUndecided === false) && (
                                        <div className='review-extra-option'>
                                            <h4 className='label'>Do you want this to be a repeating gig?</h4>
                                            <div className='repeat-group'>
                                                <select name='gigRepeat' id='gigRepeat' onChange={(e) => setGigRepeat(e.target.value)}>
                                                    <option value='no'>No</option>
                                                    <option value='daily'>Repeat daily</option>
                                                    <option value='weekly'>Repeat weekly</option>
                                                    <option value='fortnightly'>Repeat fornightly</option>
                                                    <option value='monthly'>Repeat monthly</option>
                                                </select>
                                                {gigRepeat !== 'no' && (
                                                    <>
                                                        <select name='repeatEnd' id='repeatEnd' onChange={(e) => {setRepeatEnd(e.target.value); if (e.target.value === 'after') {setEndRepeatDate('')}; if (e.target.value === 'date') {setEndRepeatAfter('')} }}>
                                                            <option value='after'>End After</option>
                                                            <option value='date'>End Date</option>
                                                        </select>
                                                        {repeatEnd === 'after' && (
                                                            <div className='end-repeat-after-cont'>
                                                                <input
                                                                type='number'
                                                                name='endRepeatAfter'
                                                                id='endRepeatAfter'
                                                                onChange={handleEndRepeatAfterChange}
                                                                value={endRepeatAfter}
                                                                min={1}
                                                                max={getMaxRepeat()}
                                                                />
                                                                <p>gigs.</p>
                                                            </div>
                                                        )}
                                                        {repeatEnd === 'date' && (
                                                            <input 
                                                                type='date' 
                                                                name='endRepeatDate' 
                                                                id='endRepeatDate'
                                                                onChange={handleRepeatDateChange}
                                                                value={endRepeatDate}
                                                            />
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {!savedTemplate && (
                                        <div className='review-extra-option template'>
                                            <div className='input-group'>
                                                <label htmlFor='templateName' className='label'>Enter a name below to save the gig as a template:</label>
                                                <input 
                                                    type='text' 
                                                    name='templateName' 
                                                    className='input'
                                                    id='templateName'
                                                    placeholder='E.g. Friday Night Jazz'
                                                    value={templateName}
                                                    onChange={(e) => setTemplateName(e.target.value)}
                                                />
                                            </div>
                                            {templateName && (
                                                <button className='btn primary' onClick={handleSaveTemplate}>{saving ? 'Saving...' : 'Save Gig Template'}</button>
                                            )}
                                        </div>
                                    )}
                                    <div className='review-extra-option'>
                                        <div className='toggle-container'>
                                            <label htmlFor='invite-only' className='label'>Invite only?</label>
                                            <label className='switch'>
                                                <input
                                                    type='checkbox'
                                                    id='invite-only'
                                                    checked={formData.private || false}
                                                    onChange={(e) => handleInputChange({ private: e.target.checked })}
                                                />
                                                <span className='slider round'></span>
                                            </label>
                                        </div>
                                        {!formData.private ? (
                                            <p className='text' style={{ maxWidth: '500px'}}>
                                                When enabled, this gig will only accept applications from artists with an invite link.
                                                You can create invite links after posting the gig.
                                                You can change the gig status at any time.
                                            </p>
                                        ) : (
                                            <p className='text'>
                                                This gig is invite only. Create invite links from the gig table after posting.
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}