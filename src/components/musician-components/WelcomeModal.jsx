import { TextLogo } from "../ui/logos/Logos";

export const WelcomeModal = ({ user, setShowWelcomeModal, role }) => {
    return (
        <div className="modal welcome">
            <div className="modal-content welcome">
                <TextLogo />
                <h2>Welcome to Gigin!</h2>
                {role === 'musician' ? (
                    <div className="body">
                        <h4>We’re so glad to have you as on of our earliest users. If you have any feedback (of any kind) do let us know by clicking the <i>feedback</i> button in the header menu.</h4>
                        <h4>Here’s a recap of our 3-step booking process:</h4>
                        <ol>
                            <li>Find a gig <i>(on the map or list view)</i>.</li>
                            <li>Apply to the gig / Negotiate the fee (this can be done from the <i>Messages</i> window).</li>
                            <li>The venue pays now to confirm the gig, and you get paid when the gig is performed.</li>
                        </ol>
                        <h4>Enjoy!</h4>
                    </div>
                ) : (
                    <div className="body">
                        <h4>We’re so glad to have you as on of our earliest users. If you have any feedback (of any kind) do let us know by clicking the <i>feedback</i> button in the header menu.</h4>
                        <h4>Here’s a recap of our 3-step booking process:</h4>
                        <ol>
                            <li><i>Post a gig</i>, using the button from your dashboard.</li>
                            <li>Find the perfect music by allowing musicians to apply or finding them yourself.</li>
                            <li><i>Accept and pay</i> securely using Stripe payments to confirm the gig.</li>
                        </ol>
                        <h4>Enjoy!</h4>
                    </div>
                )}
                <button className="btn primary" onClick={() => setShowWelcomeModal(false)}>Got it!</button>
            </div>
        </div>
    )
};