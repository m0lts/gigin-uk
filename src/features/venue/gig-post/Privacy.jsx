import { InviteIcon, PeopleGroupIcon } from '@features/shared/ui/extras/Icons';
import { BackgroundMusicIcon, HouseIconSolid, InviteIconSolid, MicrophoneIconSolid, MusicianIconSolid, PeopleGroupIconSolid, TicketIcon, WeddingIcon } from '../../shared/ui/extras/Icons';

export const GigPrivacy = ({ formData, handleInputChange, error, setError }) => {

    const handlePrivacySelect = (value) => {
        handleInputChange({
            privacy: value,
        });
    };

    const handleKindSelect = (e) => {
        setError(null);
        handleInputChange({
            kind: e,
        });
    };

    const gigTypes = formData.venue.type === 'Public Establishment' ? ['Background Music', 'Live Music', 'Wedding', 'Open Mic'] : ['Background Music', 'Live Music', 'House Party', 'Wedding'];

    const filterGigIcon = (gig) => {
        switch (gig) {
            case 'Background Music':
                return <BackgroundMusicIcon />
            case 'Live Music':
                return <MusicianIconSolid />
            case 'Ticketed Gig':
                return <TicketIcon />
            case 'House Party':
                return <HouseIconSolid />
            case 'Wedding':
                return <WeddingIcon />
            default:
                return <MicrophoneIconSolid />
        }
    }

    return (
        <>
            <div className='head'>
                <h1 className='title'>What kind of gig is it?</h1>
                <p className='text'>Select whether the gig is private or open to the public, and then select the type of event it is.</p>
            </div>
            <div className='body privacy'>
                {/* <div className='selections'>
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
                )} */}
                <div className='type-of-gig'>
                    {gigTypes.map((gt) => (
                        <div className={`card ${formData.kind === gt || (formData.kind === 'Ticketed Gig' && gt === 'Live Music') ? 'selected' : ''}`} key={gt} onClick={() => handleKindSelect(gt)}>
                            {filterGigIcon(gt)}
                            <h4>{gt}</h4>
                        </div>
                    ))}
                </div>
                {error && error !== 'Please select both a gig kind and a privacy setting.' && (
                    <div className="error-cont" style={{ width: 'fit-content', margin: '1rem auto' }}>
                        <p className="error-message">{error}</p>
                    </div>
                )}
            </div>
        </>
    );
};