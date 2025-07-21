import { InviteIcon, PeopleGroupIcon } from '@features/shared/ui/extras/Icons';
import { InviteIconSolid, PeopleGroupIconSolid } from '../../shared/ui/extras/Icons';

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
            <div className='head'>
                <h1 className='title'>What kind of gig is it?</h1>
                <p className='text'>Select whether the gig is private or open to the public, and then select the type of event it is.</p>
            </div>
            <div className='body privacy'>
                <div className='selections'>
                    <div className={`card ${formData.privacy === 'Public' ? 'selected' : ''}`} onClick={() => handlePrivacySelect('Public')}>
                        {formData.privacy === 'Public' ? (
                            <PeopleGroupIconSolid />
                        ) : (
                            <PeopleGroupIcon />
                        )}
                        <h4 className='text'>Public</h4>
                        <p className='sub-text'>The Gig is open for the public to view on the map. Suited to venues such as pubs and restuarants.</p>
                    </div>
                    <div className={`card ${formData.privacy === 'Private' ? 'selected' : ''}`} onClick={() => handlePrivacySelect('Private')}>
                        {formData.privacy === 'Private' ? (
                            <InviteIconSolid />
                        ) : (
                            <InviteIcon />
                        )}
                        <h4 className='text'>Private</h4>
                        <p className='sub-text'>The Gig won’t be shown on the public map. Perfect for weddings and parties.</p>
                    </div>
                </div>
                {error && error === 'Please select a privacy setting.' && (
                    <div className="error-cont" style={{ width: 'fit-content', margin: '1rem auto' }}>
                        <p className="error-message">{error}</p>
                    </div>
                )}
                {formData.privacy && (
                    <>
                        <div className='type-of-gig'>
                            <h6>WHAT TYPE OF GIG IS IT?</h6>
                            <div className='selections'>
                                <select name='kind' id='kind' value={formData.kind} onChange={handleKindSelect} className={`${error ? 'error' : ''}`}>
                                    <option value=''>Select gig type here...</option>
                                    <option value='Background Music'>Background Music</option>
                                    <option value='Live Music'>Live Music</option>
                                    <option value='Ticketed Gig'>Ticketed Gig</option>
                                    <option value='House Party'>House Party</option>
                                    <option value='Wedding'>Wedding</option>
                                    <option value='Open Mic'>Open Mic</option>
                                </select>
                            </div>
                        </div>
                        {error && error !== 'Please select both a gig kind and a privacy setting.' && (
                            <div className="error-cont" style={{ width: 'fit-content', margin: '1rem auto' }}>
                                <p className="error-message">{error}</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
};