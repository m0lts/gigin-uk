import { useNavigate } from 'react-router-dom';

const NEARBY_VENUES_LINEUPS = [
    { id: 'portland-arms', name: 'Portland Arms', lineupUrl: 'https://theportlandarms.co.uk/wp/upcoming-events/' },
    { id: 'blue-moon', name: 'Blue Moon', lineupUrl: 'https://www.facebook.com/bluemooncambridge/?utm_source=ig&utm_medium=social&utm_content=link_in_bio' },
    { id: 'clare-cellars', name: 'Clare Cellars', lineupUrl: 'https://www.instagram.com/clarecollegebar/' },
    { id: 'the-geldart', name: 'The Geldart', lineupUrl: 'https://www.the-geldart.co.uk/events/' },
    { id: 'bar-oh', name: 'Bar OH', lineupUrl: 'https://www.instagram.com/barohcambridge/?hl=en' },
];

export const NearbyLineups = () => {
    const navigate = useNavigate();

    return (
        <>
            <div className="head">
                <h1 className="title">Who&apos;s playing nearby</h1>
                <button
                    type="button"
                    className="btn secondary"
                    onClick={() => navigate('/venues/dashboard/artists/find')}
                >
                    Back to Find Artists
                </button>
            </div>
            <div className="body musicians">
                <div className="nearby-lineups-section">
                    <p className="nearby-lineups-intro">Discover new artists by seeing who venues near you are booking</p>
                    <div className="nearby-lineups-tiles">
                        {NEARBY_VENUES_LINEUPS.map((venue) => (
                            <div key={venue.id} className="nearby-lineups-tile">
                                <h4 className="nearby-lineups-tile-name">{venue.name}</h4>
                                {venue.lineupUrl ? (
                                    <a href={venue.lineupUrl} target="_blank" rel="noopener noreferrer" className="btn tertiary nearby-lineups-tile-link">
                                        See gig lineup
                                    </a>
                                ) : (
                                    <button type="button" className="btn tertiary nearby-lineups-tile-link" disabled>
                                        See gig lineup
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};
