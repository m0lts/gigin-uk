import { useState } from "react";
import { createVenueInvite } from "../../../services/venues";
import { sendVenueInviteEmail } from "../../../services/emails";
import { toast } from "sonner";
import { LoadingSpinner } from "../../shared/ui/loading/Loading";
import { AddMember } from "../../shared/ui/extras/Icons";

export const AddStaffModal = ({user, venue, onClose}) => {

    const [emailToInvite, setEmailToInvite] = useState('');
    const [loading, setLoading] = useState(false);

    const generateInviteLink = async () => {
        const inviteId = await createVenueInvite(venue.id, user.uid);
        return `${window.location.origin}/join-venue?invite=${inviteId}`;
    };

    const handleSendEmailInvite = async () => {
        try {
            if (!user) return;
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
                            <button className="btn primary email" onClick={handleSendEmailInvite}>
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