import { InviteIcon, PeopleGroupIcon } from "/components/ui/Extras/Icons";

export const GigPrivacy = ({ formData, handleInputChange, error, setError }) => {

    const handlePrivacySelect = (value) => {
        handleInputChange({
            privacy: value,
        });
    };

    const handleKindSelect = (e) => {
        setError(null);
        handleInputChange({
            kind: e.target.value,
        });
    };

    return (
        <>
            <div className="head">
                <h1 className="title">What kind of gig is it?</h1>
                <p className="text">Select whether the gig is private or open to the public, and then select the type of event it is.</p>
            </div>
            <div className="body privacy">
                <div className="selections">
                    <div className={`card ${formData.privacy === 'Public' ? 'selected' : ''}`} onClick={() => handlePrivacySelect('Public')}>
                        <PeopleGroupIcon />
                        <h4 className="text">Public</h4>
                        <p className="sub-text">The Gig is open for the public to view on the map.</p>
                    </div>
                    <div className={`card ${formData.privacy === 'Private' ? 'selected' : ''}`} onClick={() => handlePrivacySelect('Private')}>
                        <InviteIcon />
                        <h4 className="text">Private</h4>
                        <p className="sub-text">The Gig won’t be shown on the public map.</p>
                    </div>
                </div>
                <div className="selections">
                    <select name="kind" id="kind" value={formData.kind} onChange={handleKindSelect} className={`${error ? 'error' : ''}`}>
                        <option value="">Select...</option>
                        <option value="Background Music">Background Music</option>
                        <option value="Live Music">Live Music</option>
                        <option value="Ticketed Gig">Ticketed Gig</option>
                        <option value="House Party">House Party</option>
                        <option value="Wedding">Wedding</option>
                        <option value="Open Mic">Open Mic</option>
                    </select>
                </div>
            </div>
        </>
    );
};