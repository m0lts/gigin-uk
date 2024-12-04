import { TextLogo } from "../ui/logos/Logos";

export const WelcomeModal = ({ user, setShowWelcomeModal, role }) => {
    return (
        <div className="modal welcome">
            <div className="modal-content welcome">
                <TextLogo />
                <h2>Hi {user.name.split(' ')[0]}!</h2>
                {role === 'musician' ? (
                    <div className="body">
                        <h4>Thank you for joining the movement!</h4>
                        <h4>Use the map to find and apply to gigs.</h4>
                        <h4>You can negotiate gig fees with the venue to ensure you get what you deserve.</h4>
                        <h4>See the status of your applications in the gigs section of your dashboard.</h4>
                        <h4>If the venue accepts your application, the gig is confirmed when the venue has paid the gig fee.</h4>
                        <h4>We will release the gig fee to you 24 hours after the gig start time.</h4>
                        <h4>If the venue reports an issue, we will hold your gig fee until the issue is resolved.</h4>
                    </div>
                ) : (
                    <div className="body">
                        <h4>Thank you for joining the movement!</h4>
                        <h4>This is your dashboard.</h4>
                        <h4>Post a gig to the map and wait for musicians to apply.</h4>
                        <h4>If no musicians apply, you can find a musician in the musicians tab.</h4>
                        <h4>When a musician applies to a gig, you can choose to accept or decline the application.</h4>
                        <h4>If you accept the musician, you must pay the gig fee for the gig to be confirmed.</h4>
                        <h4>We will release the gig fee to the musicians 24 hours after the gig has started.</h4>
                        <h4>If you have an issue and want to dispute the payout to the musician, we will halt the payment to the musician until the dispute is solved.</h4>
                        <h4>We will refund you if the dispute is successful.</h4>
                    </div>
                )}
                <button className="btn primary" onClick={() => setShowWelcomeModal(false)}>Got it!</button>
            </div>
        </div>
    )
};