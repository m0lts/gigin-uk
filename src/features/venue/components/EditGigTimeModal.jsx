import { useState, useEffect } from 'react';
import { CloseIcon } from '@features/shared/ui/extras/Icons';
import { updateGigDocument } from '@services/api/gigs';
import { getOrCreateConversation } from '@services/api/conversations';
import { sendMessage } from '@services/api/messages';
import { getArtistProfileById, getMusicianProfileByMusicianId } from '@services/client-side/artists';
import { getVenueProfileById } from '@services/client-side/venues';
import { formatDate } from '@services/utils/dates';
import { toast } from 'sonner';

const getHours = (duration) => {
    if (!duration) return 0;
    const num = typeof duration === 'string' ? parseInt(duration) : duration;
    return Math.floor(num / 60);
};

const getMinutes = (duration) => {
    if (!duration) return 0;
    const num = typeof duration === 'string' ? parseInt(duration) : duration;
    return num % 60;
};

const durationToMinutes = (hours, minutes) => {
    return (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);
};

export const EditGigTimeModal = ({ gig, allSlots, onClose, refreshGigs, user, editMode = 'both' }) => {
    // editMode can be 'name', 'timings', or 'both'
    const [activeTab, setActiveTab] = useState(0);
    const [gigName, setGigName] = useState(gig?.gigName || '');
    const [slots, setSlots] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (allSlots && allSlots.length > 0) {
            const sortedSlots = [...allSlots].sort((a, b) => {
                if (!a.startTime || !b.startTime) return 0;
                const [aH, aM] = a.startTime.split(':').map(Number);
                const [bH, bM] = b.startTime.split(':').map(Number);
                return (aH * 60 + aM) - (bH * 60 + bM);
            });
            setSlots(sortedSlots);
            if (!gigName && sortedSlots[0]) {
                setGigName(sortedSlots[0].gigName?.replace(/\s*\(Set\s+\d+\)\s*$/, '') || '');
            }
        }
    }, [allSlots, gig]);

    const handleStartTimeChange = (index, value) => {
        setSlots(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                startTime: value
            };
            return updated;
        });
    };

    const handleDurationChange = (index, hours, minutes) => {
        const duration = durationToMinutes(hours, minutes);
        setSlots(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                duration: duration
            };
            return updated;
        });
    };

    const hasChanges = () => {
        if (!gig || !slots.length) return false;
        
        const isNameOnly = editMode === 'name';
        const isTimingsOnly = editMode === 'timings';
        
        // Check if name changed (only if editing name)
        if (!isTimingsOnly) {
            const baseName = gig.gigName?.replace(/\s*\(Set\s+\d+\)\s*$/, '') || '';
            if (gigName !== baseName) return true;
        }
        
        // Check if any slot time/duration changed (only if editing timings)
        if (!isNameOnly) {
            const sortedOriginal = [...allSlots].sort((a, b) => {
                if (!a.startTime || !b.startTime) return 0;
                const [aH, aM] = a.startTime.split(':').map(Number);
                const [bH, bM] = b.startTime.split(':').map(Number);
                return (aH * 60 + aM) - (bH * 60 + bM);
            });
            
            for (let i = 0; i < slots.length; i++) {
                const original = sortedOriginal[i];
                const updated = slots[i];
                if (!original || !updated) continue;
                
                if (original.startTime !== updated.startTime) return true;
                if (original.duration !== updated.duration) return true;
            }
        }
        
        return false;
    };

    const notifyMusician = async (slotGig, oldStartTime, oldDuration, newStartTime, newDuration) => {
        if (!slotGig || !Array.isArray(slotGig.applicants)) return null;
        
        const confirmedApplicant = slotGig.applicants.find(app => 
            ['confirmed', 'paid'].includes(app.status)
        );
        
        if (!confirmedApplicant) return null;
        
        try {
            // Get profile (artist or musician) by ID
            let musicianProfile = await getArtistProfileById(confirmedApplicant.id);
            const isArtistProfile = !!musicianProfile;
            if (!musicianProfile) {
                musicianProfile = await getMusicianProfileByMusicianId(confirmedApplicant.id);
            }
            if (!musicianProfile) return null;
            
            // Normalize profile structure
            musicianProfile = {
                ...musicianProfile,
                musicianId: musicianProfile.id || musicianProfile.profileId || musicianProfile.musicianId,
                profileId: musicianProfile.id || musicianProfile.profileId || musicianProfile.musicianId,
            };
            
            const venueProfile = await getVenueProfileById(slotGig.venueId);
            if (!venueProfile) return null;
            
            const { conversationId } = await getOrCreateConversation({
                musicianProfile: musicianProfile,
                gigData: slotGig,
                venueProfile,
                type: 'message'
            });
            
            const formatTime = (time) => {
                if (!time) return 'N/A';
                return time;
            };
            
            const formatDuration = (duration) => {
                if (!duration) return 'N/A';
                const hours = Math.floor(duration / 60);
                const minutes = duration % 60;
                if (hours === 0) return `${minutes} minutes`;
                if (minutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
                return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`;
            };
            
            const timeChanged = oldStartTime !== newStartTime;
            const durationChanged = oldDuration !== newDuration;
            
            let messageText = `Hi ${musicianProfile.name}, we've updated the gig timings for ${slotGig.gigName?.replace(/\s*\(Set\s+\d+\)\s*$/, '') || 'the gig'} at ${slotGig.venue?.venueName || 'the venue'} on ${formatDate(slotGig.date, 'short')}.`;
            
            if (timeChanged && durationChanged) {
                messageText += ` The start time has changed from ${formatTime(oldStartTime)} to ${formatTime(newStartTime)}, and the duration has changed from ${formatDuration(oldDuration)} to ${formatDuration(newDuration)}.`;
            } else if (timeChanged) {
                messageText += ` The start time has changed from ${formatTime(oldStartTime)} to ${formatTime(newStartTime)}.`;
            } else if (durationChanged) {
                messageText += ` The duration has changed from ${formatDuration(oldDuration)} to ${formatDuration(newDuration)}.`;
            }
            
            messageText += ' Please let us know if this causes any issues.';
            
            await sendMessage({
                conversationId,
                message: {
                    senderId: user.uid,
                    text: messageText
                }
            });
            
            return messageText; // Return the message text so it can be displayed
        } catch (error) {
            console.error('Error notifying musician:', error);
            // Don't throw - we still want to save the changes
            return null;
        }
    };

    const handleSave = async () => {
        if (!hasChanges()) {
            toast.info('No changes to save');
            return;
        }
        
        setSaving(true);
        try {
            const sortedOriginal = [...allSlots].sort((a, b) => {
                if (!a.startTime || !b.startTime) return 0;
                const [aH, aM] = a.startTime.split(':').map(Number);
                const [bH, bM] = b.startTime.split(':').map(Number);
                return (aH * 60 + aM) - (bH * 60 + bM);
            });
            
            const isNameOnly = editMode === 'name';
            const isTimingsOnly = editMode === 'timings';
            
            // Update name if changed (only if editing name)
            if (!isTimingsOnly && gigName !== (gig.gigName?.replace(/\s*\(Set\s+\d+\)\s*$/, '') || '')) {
                // Update all slots with new name
                for (const slot of sortedOriginal) {
                    const slotNumber = sortedOriginal.indexOf(slot) + 1;
                    const newName = sortedOriginal.length > 1 
                        ? `${gigName} (Set ${slotNumber})`
                        : gigName;
                    await updateGigDocument({
                        gigId: slot.gigId,
                        action: 'gigs.update',
                        updates: { gigName: newName }
                    });
                }
            }
            
            // Update times/durations and notify musicians (only if editing timings)
            const sentMessages = [];
            if (!isNameOnly) {
                for (let i = 0; i < slots.length; i++) {
                const original = sortedOriginal[i];
                const updated = slots[i];
                
                if (!original || !updated) continue;
                
                const timeChanged = original.startTime !== updated.startTime;
                const durationChanged = original.duration !== updated.duration;
                
                if (timeChanged || durationChanged) {
                    const updates = {};
                    if (timeChanged) updates.startTime = updated.startTime;
                    if (durationChanged) updates.duration = updated.duration;
                    
                    await updateGigDocument({
                        gigId: original.gigId,
                        action: 'gigs.update',
                        updates
                    });
                    
                    // Notify confirmed musician if time/duration changed
                    const messageText = await notifyMusician(
                        original,
                        original.startTime,
                        original.duration,
                        updated.startTime,
                        updated.duration
                    );
                    
                    if (messageText) {
                        sentMessages.push(messageText);
                    }
                }
            }
            }
            
            toast.success('Gig details updated');
            refreshGigs();
            onClose();
        } catch (error) {
            console.error('Error updating gig:', error);
            toast.error('Failed to update gig details. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (!slots.length) return null;

    const currentSlot = slots[activeTab];
    const isNameOnly = editMode === 'name';
    const isTimingsOnly = editMode === 'timings';

    return (
        <div className='modal' onClick={onClose}>
            <div className='modal-content' onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <button className='btn tertiary close' onClick={onClose} style={{ padding: '0.5rem' }}>
                    Close
                </button>
                <div className='modal-header' style={{ marginBottom: '1.5rem' }}>
                    <h2>
                        {isNameOnly ? 'Edit Gig Name' : (slots.length > 1 ? 'Edit Gig Timings' : 'Edit Gig Time')}
                    </h2>
                </div>
                
                       {/* Gig Name Input - only show if editing name or both */}
                       {(isNameOnly || editMode === 'both') && (
                           <div className="body budget" style={{ marginBottom: '1.5rem' }}>
                               <div className="input-group">
                                   <input
                                       type="text"
                                       value={gigName}
                                       onChange={(e) => setGigName(e.target.value)}
                                       autoComplete="off"
                                       placeholder="Enter gig name"
                                   />
                               </div>
                           </div>
                       )}
                
                {/* Tabs for multiple slots - only show if editing timings */}
                {!isNameOnly && slots.length > 1 && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--gn-grey-300)', justifyContent: 'center' }}>
                        {slots.map((slot, index) => (
                            <button
                                key={index}
                                onClick={() => setActiveTab(index)}
                                style={{
                                    padding: '0.75rem 1rem',
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: activeTab === index ? '2px solid var(--gn-off-black)' : '2px solid transparent',
                                    cursor: 'pointer',
                                    fontWeight: activeTab === index ? 600 : 400,
                                    color: activeTab === index ? 'var(--gn-off-black)' : 'var(--gn-grey-700)'
                                }}
                            >
                                Slot {index + 1}
                            </button>
                        ))}
                    </div>
                )}
                
                {/* Time and Duration Inputs - only show if editing timings */}
                {!isNameOnly && currentSlot && (
                    <div>
                        <div className="input-group" style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <label className="label">Start Time</label>
                            <input
                                type="time"
                                value={currentSlot.startTime || ''}
                                onChange={(e) => handleStartTimeChange(activeTab, e.target.value)}
                                className="input"
                                style={{ textAlign: 'center', fontWeight: 500 }}
                            />
                        </div>
                        
                        <div className="input-group" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <label className="label">Duration</label>
                            <div className="duration-inputs" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <select
                                    value={getHours(currentSlot.duration)}
                                    onChange={(e) => handleDurationChange(activeTab, e.target.value, getMinutes(currentSlot.duration))}
                                    className="input"
                                    style={{ width: '80px', textAlign: 'center', fontWeight: 500 }}
                                >
                                    {[...Array(6).keys()].map(h => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                                <span className="unit">hr</span>
                                <select
                                    value={getMinutes(currentSlot.duration)}
                                    onChange={(e) => handleDurationChange(activeTab, getHours(currentSlot.duration), e.target.value)}
                                    className="input"
                                    style={{ width: '80px', textAlign: 'center', fontWeight: 500 }}
                                >
                                    {[0, 15, 30, 45].map(m => (
                                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                                    ))}
                                </select>
                                <span className="unit">mins</span>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className='two-buttons' style={{ marginTop: '2rem' }}>
                    <button className='btn tertiary' onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button className='btn primary' onClick={handleSave} disabled={saving || !hasChanges()}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};
