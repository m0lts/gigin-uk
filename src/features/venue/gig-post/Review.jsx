import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { EditIcon, CopyIcon } from '@features/shared/ui/extras/Icons';
import { saveGigTemplate } from '@services/gigs';
import { toast } from 'sonner';
import { ExclamationIcon, NewTabIcon } from '../../shared/ui/extras/Icons';

export const GigReview = ({ formData, handleInputChange, setStage, buildingForMusician, buildingForMusicianData }) => {

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
    const [repeatEnd, setRepeatEnd] = useState('never');
    const [endRepeatAfter, setEndRepeatAfter] = useState('');
    const [endRepeatDate, setEndRepeatDate] = useState('');
    const [privateApplicationsToken, setPrivateApplicationsToken] = useState(null);
    const [privateApplicationsLink, setPrivateApplicationsLink] = useState(null);

    useEffect(() => {
        if (formData.privateApplications && formData.gigId && !privateApplicationsToken) {
            const token = buildingForMusician
                ? buildingForMusicianData?.id
                : uuidv4();
    
            const link = `https://www.gigin.ltd/gig/${formData.gigId}?token=${token}`;
    
            setPrivateApplicationsToken(token);
            setPrivateApplicationsLink(link);
    
            handleInputChange({
                privateApplicationToken: token,
                privateApplicationsLink: link,
            });
        }
    }, [formData.privateApplications, formData.gigId]);


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
        if (!genres.length) return 'No Preferences';
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

    const getMaxRepeat = () => {
        switch (gigRepeat) {
            case 'daily':
                return 365;
            case 'weekly':
                return 52;
            case 'fortnightly':
                return 26;
            case 'monthly':
                return 12;
            default:
                return '';
        }
    };

    const handleEndRepeatAfterChange = (e) => {
        const max = getMaxRepeat();
        const value = e.target.value;
        if (value <= max) {
            setEndRepeatAfter(value);
        } else {
            setEndRepeatAfter(max);
        }
    };

    const handleRepeatDateChange = (e) => {
        const value = new Date(e.target.value);
        const gigDate = new Date(formData.date);
    
        if (value < gigDate) {
            toast.error('The repeat end date cannot be before the gig date.');
            return;
        } else {
            setEndRepeatDate(e.target.value);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(privateApplicationsLink).then(() => {
            toast.success('Link copied to clipboard');
        }).catch((err) => {
            toast.error('Failed to copy link. Please try again.')
            console.error('Failed to copy link: ', err);
        });
    };


    const handleSaveTemplate = async () => {
        setSaving(true);
        const templateId = uuidv4();
        const templateDataPacket = {
          ...formData,
          gigId: null,
          date: null,
          templateName: templateName,
          templateId: templateId,
        };
        try {
          await saveGigTemplate(templateDataPacket);
          setSaving(false);
          setSavedTemplate(true);
          toast.success('Template Saved.')
        } catch (error) {
          setSaving(false);
          toast.error('Failed to save template. Please try again.')
          console.error('Failed to save template:', error);
        }
      };

    return (
        <>
            <div className='head'>
                <h1 className='title'>Review and Post</h1>
            </div>
            <div className='stage review'>
                <div className='review-box'>
                    <h4 className='value'>{formData.venue.venueName}</h4>
                    <button className='btn text' onClick={() => setStage(2)}>
                        <EditIcon />
                    </button>
                </div>
                <div className='review-grid'>
                    <div className='review-left'>
                        <div className='review-box'>
                            <h4 className='value'>{formData.date ? formatDate(formData.date) : 'Date undecided'}</h4>
                            <button className='btn text' onClick={() => setStage(1)}>
                                <EditIcon />
                            </button>
                        </div>
                        <div className='review-box'>
                            <h4 className='value'>{formData.startTime}</h4>
                            <button className='btn text' onClick={() => setStage(7)}>
                                <EditIcon />
                            </button>
                        </div>
                        <div className='review-box'>
                            <h4 className='value'>{formatDuration(formData.duration)}</h4>
                            <button className='btn text' onClick={() => setStage(7)}>
                                <EditIcon />
                            </button>
                        </div>
                        <div className='review-box'>
                            <h4 className='value'>{formData.kind === 'Open Mic' || formData.kind === 'Ticketed Gig' ? '£0' : formData.budget}</h4>
                            <button className='btn text' onClick={() => setStage(8)}>
                                <EditIcon />
                            </button>
                        </div>
                        <div className='review-box'>
                            <h4 className='value'>{formData.privacy} {formData.kind}</h4>
                            <button className='btn text' onClick={() => setStage(3)}>
                                <EditIcon />
                            </button>
                        </div>
                        <div className='review-box'>
                            <h4 className='value'>{formatMusic(formData.genre)}</h4>
                            <button className='btn text' onClick={() => setStage(5)}>
                                <EditIcon />
                            </button>
                        </div>
                    </div>
                    <div className='review-right'>
                        {(formData.dateUndecided === false && !buildingForMusician) && (
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
                                                <option value='never'>Never End</option>
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
                                    <button className='btn primary-alt' onClick={handleSaveTemplate}>{saving ? 'Saving...' : 'Save Gig Template'}</button>
                                )}
                            </div>
                        )}
                        {buildingForMusician ? (
                            <div className='review-extra-option body'>
                                <div className="error-cont">
                                    <ExclamationIcon />
                                    <p className='error-message'>You're building this gig for "{buildingForMusicianData.name}".</p>
                                </div>
                                <div className='toggle-container'>
                                    <label htmlFor='private-applications' className='label warning'>Only allow "{buildingForMusicianData.name}" to apply?</label>
                                    <label className='switch'>
                                        <input
                                            type='checkbox'
                                            id='private-applications'
                                            checked={formData.privateApplications}
                                            onChange={(e) => handleInputChange({ privateApplications: e.target.checked })}
                                        />
                                        <span className='slider round'></span>
                                    </label>
                                </div>
                                {!formData.privateApplications ? (
                                    <p className='text'>
                                        Selecting this means only "{buildingForMusicianData.name}" can apply to this gig. Leave it unselected if you want to allow other musicians to apply.
                                    </p>
                                ) : (
                                    <p className='text'>
                                        This link will be sent to the musician so they can apply to your gig.
                                    </p>
                                )}
                                {formData.privateApplications && privateApplicationsLink && (
                                    <div className='private-link'>
                                        <p className='text'>{privateApplicationsLink}</p>
                                        <div className='icon' onClick={copyToClipboard}>
                                            <CopyIcon />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className='review-extra-option'>
                                <div className='toggle-container'>
                                    <label htmlFor='private-applications' className='label'>Make applications private?</label>
                                    <label className='switch'>
                                        <input
                                            type='checkbox'
                                            id='private-applications'
                                            checked={formData.privateApplications}
                                            onChange={(e) => handleInputChange({ privateApplications: e.target.checked })}
                                        />
                                        <span className='slider round'></span>
                                    </label>
                                </div>
                                {!formData.privateApplications && (
                                    <p className='text'>
                                        Selecting this means only musicians with your private gig link can apply. 
                                        Useful when inviting someone directly.
                                    </p>
                                )}
                                {formData.privateApplications && privateApplicationsLink && (
                                    <div className='private-link'>
                                        <p className='text'>{privateApplicationsLink}</p>
                                        <div className='icon' onClick={copyToClipboard}>
                                            <CopyIcon />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                {/* <button className="btn secondary" style={{ marginBottom: '1rem' }} onClick={() => handlePreviewGig()}>
                    <span style={{ marginRight: 5 }}>Preview Gig</span>
                    <NewTabIcon />
                </button> */}
            </div>
        </>
    )
}