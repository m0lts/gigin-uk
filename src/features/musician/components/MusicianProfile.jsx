import { useState, useEffect, useMemo } from 'react';
import { EditIcon, StarIcon } from '@features/shared/ui/extras/Icons';
import '@styles/musician/musician-profile.styles.css'
import { OverviewTab } from '@features/musician/profile/OverviewTab';
import { MusicTab } from '@features/musician/profile/MusicTab';
import { ReviewsTab } from '@features/musician/profile/ReviewsTab';
import { useLocation, useNavigate } from 'react-router-dom';
import { TrackIcon, VerifiedIcon, VideoIcon } from '../../shared/ui/extras/Icons';
import { AboutTab } from '../profile/AboutTab';
import { getGigsByIds } from '../../../services/gigs';
import Skeleton from 'react-loading-skeleton';
import { openInNewTab } from '@services/utils/misc';


export const MusicianProfile = ({ musicianProfile, viewingOwnProfile = false, setShowPreview }) => {
    const [activeTab, setActiveTab] = useState('home');
    const [upcomingGigs, setUpcomingGigs] = useState([]);
    const [loadingGigs, setLoadingGigs] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const displayed = useMemo(() => (expanded ? upcomingGigs : upcomingGigs?.slice(0, 3) ?? []), [expanded, upcomingGigs]);

    console.log(musicianProfile)

    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const fetchUpcomingGigs = async () => {
            if (!musicianProfile?.confirmedGigs?.length) return;
            try {
                setLoadingGigs(true);
                const gigs = await getGigsByIds(musicianProfile.confirmedGigs);
                setUpcomingGigs(gigs);
            } catch (error) {
                console.error("Error fetching gigs:", error);
            } finally {
                setLoadingGigs(false);
            }
        };
        fetchUpcomingGigs();
    }, [musicianProfile?.confirmedGigs]);

    const renderActiveTabContent = () => {
        switch (activeTab) {
            case 'home':
                return <OverviewTab musicianData={musicianProfile} viewingOwnProfile={viewingOwnProfile} setShowPreview={setShowPreview} />; 
            case 'about':
                return <AboutTab musicianData={musicianProfile} viewingOwnProfile={viewingOwnProfile} setShowPreview={setShowPreview} />;
            case 'prev-shows':
                return <ReviewsTab profile={musicianProfile} viewingOwnProfile={viewingOwnProfile} setShowPreview={setShowPreview} />;
            default:
                return null;
        }        
    };

    return (
        <div className="musician-profile">
            {!viewingOwnProfile && (
                <div className='musician-profile-hero'>
                    <img src={musicianProfile?.picture} alt={musicianProfile.name} className='background-image' />
                    <div className="primary-information">
                        {!musicianProfile?.verified && (
                            <div className="verified-tag">
                                <VerifiedIcon />
                                <p>Verified Musician</p>
                            </div>
                        )}
                        <h1 className="venue-name">
                            {musicianProfile?.name}
                            <span className='orange-dot'>.</span>
                        </h1>
                        <h4 className="number-of-gigs">
                            {musicianProfile?.gigsPerformed} Gigs Performed
                        </h4>
                        <div className="action-buttons">
                            <button className="btn quaternary" onClick={() => handleSendMusicianInvite(musicianProfile.id)}>
                                Invite to Gig
                            </button>
                            <button className="btn quaternary" onClick={() => handleSaveMusician(musicianProfile.id)}>
                                Save Musician
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="musician-profile-body">
                <div className="musician-profile-information-container">
                    {(musicianProfile?.bio || musicianProfile?.videos || musicianProfile?.tracks) && (
                        <div className="musician-profile-bio-buttons-container">
                            {musicianProfile?.bio && (
                                <h4>{musicianProfile.bio.text}</h4>
                            )}
                            <div className="play-buttons">
                                {musicianProfile?.videos && (
                                    <button className="btn icon" onClick={() => handlePlayVideo(musicianProfile.videos[0])}>
                                        <VideoIcon />
                                    </button>
                                )}
                                {musicianProfile?.tracks && (
                                    <button className="btn icon" onClick={() => handlePlayTrack(musicianProfile.tracks[0])}>
                                        <TrackIcon />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="musician-profile-information">
                        <nav className='musician-profile-tabs' style={{
                                margin: location.pathname.includes('dashboard') ? '0 5%' : undefined,
                            }}>
                            <p onClick={() => setActiveTab('home')} className={`musician-profile-tab ${activeTab === 'home' ? 'active' : ''}`}>
                                Home
                            </p>
                            <p onClick={() => setActiveTab('prev-shows')} className={`musician-profile-tab ${activeTab === 'prev-shows' ? 'active' : ''}`}>
                                Previous Shows
                            </p>
                            <p onClick={() => setActiveTab('about')} className={`musician-profile-tab ${activeTab === 'about' ? 'active' : ''}`}>
                                About
                            </p>
                        </nav>
                        <div className='musician-profile-sections'>
                            {renderActiveTabContent()}
                        </div>
                    </div>
                </div>
                <div className="musician-profile-gigs-and-tracks">
                    {musicianProfile?.confirmedGigs?.length > 0 && (
                        <div className="gigs-box">
                            {loadingGigs ? (
                                <Skeleton width={'100%'} height={250} />
                            ) : upcomingGigs.length > 0 ? (
                                <>
                                    <div className="gigs-box-header">
                                        <h3>Upcoming Gigs</h3>
                                        {upcomingGigs?.length > 3 && (
                                            <button
                                            type="button"
                                            className="btn text"
                                            onClick={() => setExpanded(v => !v)}
                                            aria-expanded={expanded}
                                            >
                                            {expanded ? "See less" : `See more (${upcomingGigs.length - 3})`}
                                            </button>
                                        )}
                                    </div>
                                    {displayed.map((gig) => {
                                        const gigDate = gig.date?.toDate ? gig.date.toDate() : new Date(gig.date);
                                        const day = gigDate.toLocaleDateString("en-US", { day: "2-digit" });
                                        const month = gigDate.toLocaleDateString("en-US", { month: "short" });
                                        return (
                                            <div key={gig.id} className="gig-card">
                                                <div className="date-box">
                                                    <h4 className="month">{month.toUpperCase()}</h4>
                                                    <h2 className="day">{day}</h2>
                                                </div>
                                                <div className="gig-type">
                                                    <h4>{gig.gigName}</h4>
                                                </div>
                                                <button
                                                className="btn tertiary"
                                                onClick={(e) => openInNewTab(`/gig/${gig.gigId}`, e)}
                                                >
                                                Open
                                                </button>
                                            </div>
                                        )
                                    })}
                                </>
                            ) : (
                                <p>No upcoming gigs found</p>
                            )}
                        </div>
                    )}
                    {musicianProfile?.tracks && (
                        <div className="musician-tracks">
                            <h3>Listen</h3>
                            {musicianProfile.tracks.map((track) => (
                                <p key={track?.id}>{track?.name}</p>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
};