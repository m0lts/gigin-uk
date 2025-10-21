import { useState } from "react";
import { sendVenueInviteEmail } from "../../../services/client-side/emails";
import { toast } from "sonner";
import { LoadingSpinner } from "../../shared/ui/loading/Loading";
import { AddMember } from "../../shared/ui/extras/Icons";
import { PERMS_DISPLAY, PERM_DEFAULTS, PERM_KEYS, hasVenuePerm } from "../../../services/utils/permissions";
import { useVenueDashboard } from "../../../context/VenueDashboardContext";
import { createVenueInviteCF } from "../../../services/function-calls/venues";

export const AddStaffModal = ({user, venue, onClose}) => {
    const {venueProfiles} = useVenueDashboard();
    const [emailToInvite, setEmailToInvite] = useState('');
    const [loading, setLoading] = useState(false);
    const [permissions, setPermissions] = useState(PERM_DEFAULTS);
    const [showPermissions, setShowPermissions] = useState(false);

    const togglePerm = (key) => setPermissions((p) => ({ ...p, [key]: !p[key] }));

    const generateInviteLink = async () => {
        setLoading(true);
        try {
          const inviteId = await createVenueInviteCF({
            venueId: venue.id,
            email: emailToInvite,
            permissionsInput: permissions,
            invitedByName: user?.name || null,
          });
          if (!inviteId) {
            toast.error("Failed to create invite");
            return null;
          }
          return `${window.location.origin}/join-venue?invite=${inviteId}`;
        } finally {
          setLoading(false);
        }
      };

    const handleSendEmailInvite = async () => {
        try {
            if (!user) return;
            if (!hasVenuePerm(venueProfiles, venue.venueId, 'members.invite')) {
                toast.error('You do not have permission to update member permissions.');
                return;
              }        
            if (emailToInvite === user.email) {
                toast.error('You cannot invite yourself.');
                return;
            }
            setLoading(true);
            if (!emailToInvite) return;
            const link = await generateInviteLink();
            await sendVenueInviteEmail({
                to: emailToInvite,
                venue: venue,
                link: link,
            });
            setEmailToInvite('');
            toast.success('Email Sent!')
        } catch (err) {
            console.error('Error sending invite email:', err);
            toast.error('Failed to send invite. Please try again.')
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal add-staff" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <AddMember />
                    <h2>Add Staff To {venue.name}</h2>
                    <p>Your staff member will receive an email to join the venue. The email invite will expire in 7 days.</p>
                </div>
                <div className="modal-body">
                    {loading ? (
                        <LoadingSpinner marginTop={'1rem'} />
                    ) : (
                        <>
                            <input
                                type="email"
                                placeholder="Enter Email Address"
                                value={emailToInvite}
                                onChange={(e) => setEmailToInvite(e.target.value)}
                                className="input"
                            />

                            <button className="btn text" onClick={() => setShowPermissions(!showPermissions)}>
                                {showPermissions ? 'Hide Permissions' : 'Edit Member Permissions'}
                            </button>

                            {showPermissions && (
                                <div className="permissions-list">
                                    <label className="permission">
                                        <input type="checkbox" checked readOnly disabled />
                                        View gigs
                                    </label>
    
                                    {/* Selectable perms */}
                                    {Object.keys(PERMS_DISPLAY).map((key) => (
                                        <label key={key} className="permission">
                                            <input
                                            type="checkbox"
                                            checked={!!permissions[key]}
                                            onChange={() => togglePerm(key)}
                                            />
                                            {PERMS_DISPLAY[key]}
                                        </label>
                                    ))}
                                </div>
                            )}
                            
                            <button className="btn primary email" onClick={handleSendEmailInvite} disabled={!hasVenuePerm(venueProfiles, venue.venueId, 'members.invite')}>
                                Send Invite
                            </button>
                        </>
                    )}
                </div>
                <button className="btn tertiary close" onClick={onClose}>
                    Close
                </button>
            </div>
        </div>
    )
}