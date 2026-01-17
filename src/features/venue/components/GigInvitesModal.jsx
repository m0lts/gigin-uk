import { useState, useEffect } from 'react';
import { InviteIconSolid } from '../../shared/ui/extras/Icons';
import { toast } from 'sonner';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import { getGigInvites, createGigInvite, updateGigInvite } from '../../../services/api/gigInvites';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import Portal from '../../shared/components/Portal';

const getOrdinalSuffix = (day) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
};

const formatLongDate = (date) => {
    if (!date) return null;
    try {
        let d;
        if (date.toDate && typeof date.toDate === 'function') {
            d = date.toDate();
        } else if (date._seconds || date.seconds) {
            // Firestore Timestamp serialized as {_seconds, _nanoseconds} or {seconds, nanoseconds}
            const seconds = date._seconds || date.seconds;
            const nanoseconds = date._nanoseconds || date.nanoseconds || 0;
            d = new Date(seconds * 1000 + nanoseconds / 1000000);
        } else {
            d = new Date(date);
        }
        if (isNaN(d.getTime())) return null;
        const day = d.getDate();
        const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
        const month = d.toLocaleDateString('en-GB', { month: 'long' });
        return `${weekday}, ${day}${getOrdinalSuffix(day)} ${month}`;
    } catch (error) {
        console.error('Error formatting long date:', error, date);
        return null;
    }
};

const formatShortDate = (date) => {
    if (!date) return null;
    try {
        let d;
        if (date.toDate && typeof date.toDate === 'function') {
            d = date.toDate();
        } else if (date._seconds || date.seconds) {
            // Firestore Timestamp serialized as {_seconds, _nanoseconds} or {seconds, nanoseconds}
            const seconds = date._seconds || date.seconds;
            const nanoseconds = date._nanoseconds || date.nanoseconds || 0;
            d = new Date(seconds * 1000 + nanoseconds / 1000000);
        } else if (typeof date === 'string') {
            // Handle date strings like "Thu Jan 15 2026 11:14:39 GMT+0000 (Greenwich Mean Time)"
            d = new Date(date);
        } else {
            d = new Date(date);
        }
        if (isNaN(d.getTime())) return null;
        return format(d, 'dd/MM/yyyy');
    } catch (error) {
        console.error('Error formatting short date:', error, date);
        return null;
    }
};

export const GigInvitesModal = ({ gig, venues, onClose, refreshGigs }) => {
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [selectedExpiryDate, setSelectedExpiryDate] = useState(null);
    const [editingInviteId, setEditingInviteId] = useState(null);
    const [creating, setCreating] = useState(false);
    const [updating, setUpdating] = useState(false);

    // Get gig date as a Date object for maxDate
    const gigDate = gig?.date ? (gig.date.toDate ? gig.date.toDate() : new Date(gig.date)) : null;

    useEffect(() => {
        loadInvites();
    }, [gig?.gigId]);

    const loadInvites = async () => {
        if (!gig?.gigId) return;
        setLoading(true);
        try {
            const gigInvites = await getGigInvites(gig.gigId);
            setInvites(gigInvites || []);
            setShowCreateForm(gigInvites?.length === 0);
        } catch (error) {
            console.error('Error loading invites:', error);
            toast.error('Failed to load invites');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateInvite = async () => {
        if (!gig?.gigId) return;
        setCreating(true);
        try {
            // Set time to end of day (23:59:59) if date is selected
            let expiresAt = null;
            if (selectedExpiryDate) {
                const date = new Date(selectedExpiryDate);
                date.setHours(23, 59, 59, 999);
                expiresAt = date;
            }
            const response = await createGigInvite({
                gigId: gig.gigId,
                expiresAt: expiresAt?.toISOString() || null
            });
            const inviteId = response?.inviteId;
            if (inviteId) {
                const inviteLink = `${window.location.origin}/gig/${gig.gigId}?inviteId=${inviteId}`;
                navigator.clipboard.writeText(inviteLink).then(() => {
                    toast.success('Invite created and link copied to clipboard');
                }).catch(() => {
                    toast.success('Invite created successfully');
                });
            } else {
                toast.success('Invite created successfully');
            }
            setSelectedExpiryDate(null);
            setShowCreateForm(false);
            await loadInvites();
            refreshGigs();
        } catch (error) {
            console.error('Error creating invite:', error);
            toast.error('Failed to create invite');
        } finally {
            setCreating(false);
        }
    };

    const handleToggleActive = async (inviteId, currentActive) => {
        setUpdating(true);
        try {
            await updateGigInvite({
                inviteId,
                active: !currentActive
            });
            toast.success(`Invite ${!currentActive ? 'activated' : 'deactivated'}`);
            await loadInvites();
        } catch (error) {
            console.error('Error updating invite:', error);
            toast.error('Failed to update invite');
        } finally {
            setUpdating(false);
        }
    };

    const handleEditInvite = (invite) => {
        if (invite.expiresAt) {
            let expiryDate;
            if (invite.expiresAt.toDate && typeof invite.expiresAt.toDate === 'function') {
                expiryDate = invite.expiresAt.toDate();
            } else if (invite.expiresAt._seconds || invite.expiresAt.seconds) {
                // Firestore Timestamp serialized as {_seconds, _nanoseconds} or {seconds, nanoseconds}
                const seconds = invite.expiresAt._seconds || invite.expiresAt.seconds;
                const nanoseconds = invite.expiresAt._nanoseconds || invite.expiresAt.nanoseconds || 0;
                expiryDate = new Date(seconds * 1000 + nanoseconds / 1000000);
            } else {
                expiryDate = new Date(invite.expiresAt);
            }
            // Validate the date before setting it
            if (expiryDate && !isNaN(expiryDate.getTime())) {
                setSelectedExpiryDate(expiryDate);
            } else {
                setSelectedExpiryDate(null);
            }
        } else {
            setSelectedExpiryDate(null);
        }
        setEditingInviteId(invite.inviteId);
        setShowCreateForm(true);
    };

    const handleSaveInvite = async () => {
        if (!editingInviteId) {
            // Creating new invite
            await handleCreateInvite();
            return;
        }
        
        // Updating existing invite
        setUpdating(true);
        try {
            let expiresAt = null;
            if (selectedExpiryDate) {
                const date = new Date(selectedExpiryDate);
                date.setHours(23, 59, 59, 999);
                expiresAt = date.toISOString();
            }
            await updateGigInvite({
                inviteId: editingInviteId,
                expiresAt: expiresAt
            });
            toast.success('Invite updated successfully');
            setSelectedExpiryDate(null);
            setEditingInviteId(null);
            setShowCreateForm(false);
            await loadInvites();
        } catch (error) {
            console.error('Error updating invite:', error);
            toast.error('Failed to update invite');
        } finally {
            setUpdating(false);
        }
    };

    const handleCancelEdit = () => {
        setSelectedExpiryDate(null);
        setEditingInviteId(null);
        // If there are no invites, close the modal instead of showing empty list
        if (invites.length === 0) {
            onClose();
        } else {
            setShowCreateForm(false);
        }
    };

    const copyInviteLink = (inviteId) => {
        const link = `${window.location.origin}/gig/${gig.gigId}?inviteId=${inviteId}`;
        navigator.clipboard.writeText(link).then(() => {
            toast.success('Invite link copied to clipboard');
        }).catch((err) => {
            toast.error('Failed to copy link');
            console.error('Failed to copy link:', err);
        });
    };

    return (
        <Portal>
            <div className="modal gig-invites" onClick={onClose}>
                <div className="modal-content scrollable" onClick={(e) => e.stopPropagation()}>
                    <button className="btn tertiary close" onClick={onClose}>
                        Close
                    </button>
                    <div className="modal-header">
                        <InviteIconSolid />
                        <h2>Gig Invites</h2>
                    </div>

                    {loading ? (
                        <div style={{ padding: '2rem' }}>
                            <LoadingSpinner />
                        </div>
                    ) : showCreateForm ? (
                        <div className="modal-body">
                            <div className="stage">
                                <div className="body date">
                                    <p style={{ marginBottom: '1rem' }}>
                                        Select a date if you want the gig to expire at a certain time.
                                    </p>
                                    <div className="calendar">
                                        <DatePicker
                                            selected={selectedExpiryDate}
                                            onChange={(date) => setSelectedExpiryDate(date)}
                                            inline
                                            minDate={new Date()}
                                            maxDate={gigDate || undefined}
                                            dayClassName={(date) => {
                                                const today = new Date().setHours(0, 0, 0, 0);
                                                const dateTime = date.getTime();
                                                if (dateTime < today) return 'past-date';
                                                if (gigDate && dateTime > gigDate.getTime()) return 'past-date';
                                                return undefined;
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="two-buttons">
                                <button
                                    className="btn secondary"
                                    onClick={handleCancelEdit}
                                    disabled={creating || updating}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn primary"
                                    onClick={handleSaveInvite}
                                    disabled={creating || updating}
                                >
                                    {creating ? 'Creating...' : updating ? 'Saving...' : editingInviteId ? 'Save' : 'Generate Invite'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="modal-body">
                            {invites.length > 0 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    {invites.map((invite) => {
                                        let expiryDate = null;
                                        if (invite.expiresAt) {
                                            if (invite.expiresAt.toDate && typeof invite.expiresAt.toDate === 'function') {
                                                expiryDate = invite.expiresAt.toDate();
                                            } else if (invite.expiresAt._seconds || invite.expiresAt.seconds) {
                                                const seconds = invite.expiresAt._seconds || invite.expiresAt.seconds;
                                                const nanoseconds = invite.expiresAt._nanoseconds || invite.expiresAt.nanoseconds || 0;
                                                expiryDate = new Date(seconds * 1000 + nanoseconds / 1000000);
                                            } else {
                                                expiryDate = new Date(invite.expiresAt);
                                            }
                                        }
                                        const isExpired = expiryDate && !isNaN(expiryDate.getTime()) && expiryDate < new Date();
                                        
                                        return (
                                            <div
                                                key={invite.inviteId}
                                                className="invite-card"
                                                style={{
                                                    border: '1px solid var(--gn-grey-300)',
                                                    borderRadius: '8px',
                                                    padding: '1rem',
                                                    marginBottom: '1rem',
                                                    cursor: 'pointer',
                                                    backgroundColor: isExpired ? 'var(--gn-grey-100)' : 'white'
                                                }}
                                                onClick={() => handleEditInvite(invite)}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ marginBottom: '0.5rem' }}>
                                                            {invite.artistName && (
                                                                <h4 style={{ 
                                                                    marginBottom: '0.5rem',
                                                                    fontWeight: 600
                                                                }}>
                                                                    {invite.artistName}
                                                                </h4>
                                                            )}
                                                            {invite.expiresAt ? (
                                                                <p style={{ 
                                                                    color: isExpired ? 'var(--gn-red-500)' : 'inherit',
                                                                    fontWeight: 500,
                                                                    marginBottom: '0.25rem'
                                                                }}>
                                                                    Expires: {formatLongDate(invite.expiresAt)}
                                                                </p>
                                                            ) : (
                                                                <h4 style={{ marginBottom: '0.25rem' }}>
                                                                    No Expiry Date
                                                                </h4>
                                                            )}
                                                            <p style={{ 
                                                                color: 'var(--gn-grey-700)',
                                                                fontSize: '0.9rem',
                                                                margin: 0,
                                                                marginBottom: '0.5rem'
                                                            }}>
                                                                Created: {formatShortDate(invite.createdAt) || 'Unknown'}
                                                            </p>
                                                            <button
                                                                className="btn tertiary"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    copyInviteLink(invite.inviteId);
                                                                }}
                                                                style={{ marginTop: '0.5rem' }}
                                                            >
                                                                Copy Invite Link
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div style={{ marginLeft: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                                        <label className="gigs-toggle-switch" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={invite.active || false}
                                                                onChange={(e) => {
                                                                    e.stopPropagation();
                                                                    handleToggleActive(invite.inviteId, invite.active);
                                                                }}
                                                                disabled={updating}
                                                            />
                                                            <span className="gigs-toggle-slider"></span>
                                                        </label>
                                                        <h6>
                                                            {invite.active ? 'Active' : 'Inactive'}
                                                        </h6>
                                                    </div>
                                                </div>

                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <button
                                className="btn primary"
                                onClick={() => {
                                    setEditingInviteId(null);
                                    setSelectedExpiryDate(null);
                                    setShowCreateForm(true);
                                }}
                                style={{ width: '100%' }}
                            >
                                Create New Invite
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </Portal>
    );
};
