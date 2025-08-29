import { useEffect, useState } from 'react';
import { createBandInvite, getBandMembers } from '@services/bands';
import { CopyIcon } from '@features/shared/ui/extras/Icons';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { updateBandMemberSplits, updateBandMemberPermissions, removeBandMember, updateBandAdmin } from '@services/bands';
import { AddMember, KeyIcon, PasswordIcon, PeopleGroupIconSolid, PlusIconSolid, RemoveMemberIcon } from '../../shared/ui/extras/Icons';
import { openInNewTab } from '@services/utils/misc';
import { toast } from 'sonner';
import { useMusicianDashboard } from '../../../context/MusicianDashboardContext';
import Portal from '@features/shared/components/Portal'
import { sendBandInviteEmail } from '../../../services/emails';

export const BandMembersTab = ({ band, bandMembers, setBandMembers, musicianId, viewing = false, bandAdmin }) => {

    const {
        refreshSingleBand
      } = useMusicianDashboard();

    const [loading, setLoading] = useState(false);
    const [inviteLink, setInviteLink] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);
    const [emailToInvite, setEmailToInvite] = useState('');
    const [emailSuccess, setEmailSuccess] = useState(false);
    const [isEditingSplits, setIsEditingSplits] = useState(false);
    const [splitEdits, setSplitEdits] = useState({});
    const [isEditingPermissions, setIsEditingPermissions] = useState(false);
    const [permissionEdits, setPermissionEdits] = useState({});
    const [newAdminCandidate, setNewAdminCandidate] = useState(null);
    const [showAdminConfirmModal, setShowAdminConfirmModal] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState(null);
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [error, setError] = useState('');
    const [memberModal, setMemberModal] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        const isLoaded = !!band?.bandInfo;
        setLoading(!isLoaded);
      }, [band]);

    if (loading) {
        return <LoadingThreeDots />
    }

    const generateInviteLink = async () => {
        const inviteId = await createBandInvite(band.id, band.bandInfo.admin.musicianId);
        return `${window.location.origin}/dashboard/bands/join?invite=${inviteId}`;
    };

    const handleCreateInvite = async () => {
        try {
            const link = await generateInviteLink();
            setInviteLink(link);
        } catch (error) {
            console.error('Error creating invite:', error);
        }
    };

    const handleCopy = async (value) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopySuccess(true);
            toast.success('Copied to clipboard.')
            setTimeout(() => setCopySuccess(false), 2000);
        } catch {
            console.error('Copy failed');
        }
    };

    const handleSendEmailInvite = async () => {
        try {
            if (!emailToInvite) return;
            const link = await generateInviteLink();
            await sendBandInviteEmail({
                to: emailToInvite,
                band: band.name,
                link: link,
            });
            setEmailToInvite('');
            toast.success('Email Sent!')
        } catch (err) {
            console.error('Error sending invite email:', err);
            toast.error('Failed to send invite. Please try again.')
        }
    };
    
    // const handleConfirmSplits = async () => {
    //     if (band.bandInfo.admin.musicianId !== musicianId) return;
    //     const values = Object.values(splitEdits);
    //     const total = values.reduce((acc, val) => acc + val, 0);
    //     if (total !== 100) {
    //         window.alert('Total split must equal 100%.');
    //         return;
    //     }
    //     try {
    //         setLoading(true);
    //         await updateBandMemberSplits(band.id, splitEdits);
    //         const updatedMembers = bandMembers.map(m => ({
    //             ...m,
    //             split: splitEdits[m.musicianProfileId] ?? m.split,
    //         }));
    //         setBandMembers(updatedMembers);
    //         setIsEditingSplits(false);
    //         setError('');
    //         toast.success('Splits confirmed.')
    //     } catch (err) {
    //         console.error('Failed to update splits:', err);
    //         setError('Something went wrong.');
    //         toast.error('Error confirming splits. Please try again.')
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    // const handleSplitChange = (musicianProfileId, value) => {
    //     const percent = Math.max(0, Math.min(100, Number(value)));
    //     setSplitEdits(prev => ({
    //         ...prev,
    //         [musicianProfileId]: percent,
    //     }));
    // };


    const handlePermissionChange = (musicianProfileId, memberUserId, field, value) => {
        if (field === 'isAdmin') {
          if (value === true) {
            const updatedPermissions = {};
      
            bandMembers.forEach((m) => {
              const isThisMember = m.musicianProfileId === musicianProfileId;
              const previous = permissionEdits[m.musicianProfileId] || {};
              const originalRole = previous.role || m.role;
      
              updatedPermissions[m.musicianProfileId] = {
                ...previous,
                isAdmin: isThisMember,
                role: isThisMember && originalRole === 'Band Member' ? 'Band Leader' : originalRole,
              };
            });
      
            setPermissionEdits(updatedPermissions);
            setNewAdminCandidate({
              musicianProfileId,
              memberUserId,
            });
          } else {
            const currentAdmins = bandMembers.filter(
              (m) => permissionEdits[m.musicianProfileId]?.isAdmin ?? m.isAdmin
            );
      
            if (currentAdmins.length <= 1) {
              toast.info('There must be at least one admin.');
              return;
            }
      
            setPermissionEdits((prev) => ({
              ...prev,
              [musicianProfileId]: {
                ...prev[musicianProfileId],
                isAdmin: false,
              },
            }));
          }
        } else {
          setPermissionEdits((prev) => ({
            ...prev,
            [musicianProfileId]: {
              ...prev[musicianProfileId],
              [field]: value,
            },
          }));
        }
      };

    const handleConfirmPermissions = async () => {
        try {
            setLoading(true);

            const hasAdmin = bandMembers.some(
            (m) => permissionEdits[m.musicianProfileId]?.isAdmin ?? m.isAdmin
            );

            if (!hasAdmin) {
                setError('You must assign at least one admin.');
                setLoading(false);
                return;
            }
            let updatedMembers = [];
            if (!newAdminCandidate) {
                const updatePromises = Object.entries(permissionEdits).map(
                    ([musicianProfileId, updates]) =>
                    updateBandMemberPermissions(band.id, musicianProfileId, updates)
                );
                updatedMembers = await Promise.all(updatePromises);
            } else {
                updatedMembers = await updateBandAdmin(band.id, newAdminCandidate, permissionEdits);
            }
            setIsEditingPermissions(false);
            setPermissionEdits({});
            setNewAdminCandidate(null);
            setError('');
            await refreshSingleBand(band.id)
            toast.success('Band permissions edited.')
        } catch (err) {
            console.error('Failed to update permissions:', err);
            setError(err.message || 'Something went wrong.');
            toast.error('Error changing band permissions. Please try again.')
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="band-members-tab"><LoadingThreeDots /></div>;
    }

    return (
        <>
        <div className="band-members-tab">
            <div className="members-header">
                <div className="action-buttons">
                    {musicianId === band?.bandInfo?.admin?.musicianId && (
                        <button className="btn tertiary" onClick={() => setMemberModal(true)}>
                            Add Band Members
                        </button>
                    )}
                    {bandMembers?.length > 1 && musicianId === band?.bandInfo?.admin?.musicianId && (
                        <>
                            {/* {!isEditingSplits && (
                                <button className="btn tertiary" onClick={() => {
                                    const initialSplits = {};
                                    bandMembers.forEach(m => {
                                        initialSplits[m.musicianProfileId] = m.split || 0;
                                    });
                                    setSplitEdits(initialSplits);
                                    setIsEditingSplits(true);
                                }}>
                                    Change Gig Fee Splits
                                </button>
                            )}
                            {isEditingSplits && (
                                <button className="btn primary" onClick={handleConfirmSplits}>
                                    Confirm Split Changes
                                </button>
                            )} */}

                            {!isEditingPermissions && (
                                <button className="btn tertiary" onClick={() => {
                                    const initial = {};
                                    bandMembers.forEach((m) => {
                                        initial[m.musicianProfileId] = {
                                            role: m.role,
                                            isAdmin: m.isAdmin || false,
                                            userId: m.memberUserId,
                                        };
                                    });
                                    setPermissionEdits(initial);
                                    setIsEditingPermissions(true);
                                }}>
                                    Edit Member Permissions
                                </button>
                            )}
                            {isEditingPermissions && (
                                <>
                                    <button
                                        className="btn danger"
                                        onClick={() => {
                                            setIsEditingPermissions(false)
                                        }}
                                    >
                                        Cancel Permission Changes
                                    </button>
                                    {error && <p className="error">{error}</p>}
                                </>
                            )}
                        </>
                    )}
                </div>
                <div className="decision-buttons">
                    {isEditingPermissions && (
                        <>
                            <button
                                className="btn primary"
                                onClick={() => {
                                if (newAdminCandidate && newAdminCandidate !== band.bandInfo.admin.musicianId) {
                                    setShowAdminConfirmModal(true);
                                } else {
                                    handleConfirmPermissions();
                                }
                                }}
                            >
                                Confirm Permission Changes
                            </button>
                            {error && <p className="error">{error}</p>}
                        </>
                    )}
                </div>
            </div>

            <ul className="members-list">
                {bandMembers?.map((member) => (
                    viewing ? (
                        <li key={member.musicianProfileId} className="member-card" onClick={(e) => openInNewTab(`/${member.musicianProfileId}/null`, e)} style={{ cursor: 'pointer'}}>
                            <div className="left-side">
                                <img src={member.memberImg} alt={member.memberName} className="member-img" />
                                <div className="member-info">
                                    <h2>{member.memberName}</h2>
                                </div>
                            </div>
                        </li>
                    ) : (
                        <li key={member.musicianProfileId} className="member-card">
                            <div className="left-side">
                                <img src={member.memberImg} alt={member.memberName} className="member-img" />
                                <div className="member-info">
                                    <h2>{member.memberName}</h2>
                                    {isEditingPermissions ? (
                                        <div className='member-permissions'>
                                            {member.musicianProfileId !== band.bandInfo.admin.musicianId ? (
                                                <div className='input-container'>
                                                    <label htmlFor="bandRole" className='label'>Member Role</label>
                                                    <select
                                                        value={permissionEdits[member.musicianProfileId]?.role || member.role}
                                                        onChange={(e) =>
                                                            handlePermissionChange(member.musicianProfileId, member.memberUserId, 'role', e.target.value)
                                                        }
                                                        className='input'
                                                        name='bandRole'
                                                        id='bandRole'
                                                    >
                                                        <option value="Band Member">Band Member</option>
                                                        <option value="Band Leader">Band Leader</option>
                                                    </select>
                                                </div>
                                            ) : (
                                                <h4 className="role-tag">{member.role}</h4>
                                            )}
                                            <label className="admin-toggle">
                                                <input
                                                    type="checkbox"
                                                    className='checkbox'
                                                    checked={permissionEdits[member.musicianProfileId]?.isAdmin ?? member.isAdmin}
                                                    onChange={(e) =>
                                                        handlePermissionChange(member.musicianProfileId, member.memberUserId, 'isAdmin', e.target.checked)
                                                    }
                                                />
                                                Admin
                                            </label>
                                        </div>
                                    ) : (
                                        <h4 className="role-tag">{member.role}{member.isAdmin ? ' (Admin)' : ''}</h4>
                                    )}
                                </div>
                            </div>
                            <div className="right-side">
                                {/* <span className="fee-split">
                                    <h6>Gig Fee Split</h6>
                                    {isEditingSplits ? (
                                        <span className="split-input-container">
                                            <input
                                                type="number"
                                                value={splitEdits[member.musicianProfileId] ?? member.split ?? 0}
                                                onInput={(e) => {
                                                    if (e.target.value.length > 2) {
                                                    e.target.value = e.target.value.slice(0, 2);
                                                    }
                                                }}
                                                onChange={(e) =>
                                                    handleSplitChange(member.musicianProfileId, e.target.value)
                                                }
                                                className="split-input"
                                                min={0}
                                                max={100}
                                                step={1}
                                            />
                                            %
                                        </span>
                                    ) : (
                                        `${member.split ?? 0}%`
                                    )}
                                </span> */}
                                {band?.bandInfo?.admin?.musicianId === musicianId &&
                                    bandMembers.length > 1 &&
                                    member.musicianProfileId !== musicianId && (
                                    <button
                                        className="btn danger"
                                        onClick={() => {
                                            setMemberToRemove(member);
                                            setShowRemoveModal(true);
                                        }}
                                    >
                                        Remove Member
                                    </button>
                                )}
                            </div>
                        </li>
                    )
                ))}
            </ul>
        </div>
        {showAdminConfirmModal && (
            <div className="modal" onClick={() => setShowAdminConfirmModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <KeyIcon />
                        <h2>Transfer Admin Role?</h2>
                        <p>
                            You're about to transfer admin rights to{' '}
                            <strong>
                                {bandMembers.find((m) => m.musicianProfileId === newAdminCandidate.musicianProfileId)?.memberName}
                            </strong>
                            . You will be removed as the band's admin. Are you sure you want to proceed?
                        </p>
                    </div>
                <div className="modal-actions">
                    <button className="btn tertiary" onClick={() => setShowAdminConfirmModal(false)}>
                        Cancel
                    </button>
                    <button
                        className="btn danger"
                        onClick={() => {
                            setShowAdminConfirmModal(false);
                            handleConfirmPermissions();
                        }}
                    >
                        Yes, Transfer Admin Rights
                    </button>
                </div>
                </div>
            </div>
        )}
        {showRemoveModal && memberToRemove && (
            <div className="modal" onClick={() => setShowRemoveModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <RemoveMemberIcon />
                        <h2>Remove Member?</h2>
                        <p>
                            Are you sure you want to remove <strong>{memberToRemove.memberName}</strong> from the band?
                        </p>
                    </div>
                <div className="modal-actions">
                    <button className="btn secondary" onClick={() => setShowRemoveModal(false)}>
                    Cancel
                    </button>
                    <button
                    className="btn danger"
                    onClick={async () => {
                        try {
                            setLoading(true);
                            if (bandMembers.length < 1) return;
                            const updated = await removeBandMember(band.id, memberToRemove.musicianProfileId, memberToRemove.memberUserId);
                            setBandMembers(updated);
                            setShowRemoveModal(false);
                            setMemberToRemove(null);
                        } catch (err) {
                            console.error('Failed to remove member:', err);
                        } finally {
                            setLoading(false);
                        }
                    }}
                    >
                    Yes, Remove Member
                    </button>
                </div>
                </div>
            </div>
        )}
        {memberModal && (
            <Portal>
            <div className="modal members" onClick={() => setMemberModal(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <PeopleGroupIconSolid />
                        <h2>Adding Band Members</h2>
                        <p>
                            You have three options when adding band members:
                        </p>
                    </div>
                    <div className="modal-options">
                        <div className="option">
                            <h3>Share Band Password</h3>
                            <p>Send the band password to your members. Make sure to keep this password secure.</p>
                            <div className="option-cont">
                                <button className="btn tertiary password" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? (
                                        'Hide Password'
                                    ) : (
                                        'Show Password'
                                    )}
                                </button>
                                {!showPassword ? (
                                    <div className="password-value">
                                        <PasswordIcon />
                                    </div>
                                ) : (
                                    <button className="btn secondary password-value" onClick={() => handleCopy(band.bandInfo.joinPassword)}>
                                        <h4>{band.bandInfo.joinPassword}</h4>
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="option">
                            <h3>Share an Invite Link</h3>
                            <p>Band members can join using this secure link. You must create one link per member.</p>
                            <div className="option-cont">
                                <button className="btn tertiary" onClick={handleCreateInvite}>
                                    Generate Invite Link
                                </button>
                                {inviteLink && (
                                    <div className="btn secondary invite-link" onClick={() => handleCopy(inviteLink)}>
                                        {inviteLink}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="option">
                            <h3>Invite Via Email</h3>
                            <p>Know your member's email addresses? Enter them below and we'll handle the rest.</p>
                            <div className="option-cont">
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    value={emailToInvite}
                                    onChange={(e) => setEmailToInvite(e.target.value)}
                                    className="input"
                                />
                                <button className="btn tertiary email" onClick={handleSendEmailInvite}>
                                    Send Invite
                                </button>
                            </div>
                        </div>
                    </div>
                    <button className="btn close tertiary" onClick={() => setMemberModal(false)}>
                        Close
                    </button>
                </div>
            </div>
            </Portal>
        )}
        </>
    );
};