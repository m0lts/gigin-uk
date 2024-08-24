import { useEffect, useState } from "react";
import { useParams } from "react-router-dom"
import { Header } from "../../../components/common/Header";
import { firestore } from '../../../firebase';
import { getDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { OverviewTab } from "../Dashboard/Profile/OverviewTab";
import { MusicTab } from "../Dashboard/Profile/MusicTab";
import { ReviewsTab } from "../Dashboard/Profile/ReviewsTab";
import { ClockIcon, RejectedIcon, StarIcon, TickIcon } from "../../../components/ui/Extras/Icons";

export const MusicianProfile = ({ user, setAuthModal, setAuthType }) => {

    const { musicianId, gigId } = useParams();
    const [musicianProfile, setMusicianProfile] = useState();
    const [applicantData, setApplicantData] = useState();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [padding, setPadding] = useState('5%');


    useEffect(() => {
        const fetchMusicianProfile = async () => {
            try {
                const musicianRef = doc(firestore, 'musicianProfiles', musicianId);
                const musicianSnapshot = await getDoc(musicianRef);
                if (musicianSnapshot.exists()) {
                    const musician = musicianSnapshot.data();
                    setMusicianProfile(musician);
                    if (gigId) {
                        const gigRef = doc(firestore, 'gigs', gigId);
    
                        // Set up the onSnapshot listener
                        const unsubscribe = onSnapshot(gigRef, (gigSnapshot) => {
                            if (gigSnapshot.exists()) {
                                const gig = gigSnapshot.data();
                                const applicant = gig.applicants.find(applicant => applicant.id === musician.musicianId);
                                setApplicantData(applicant);
                            } else {
                                console.error('No such applicant!');
                            }
                        });
    
                        // Clean up the listener when the component unmounts
                        return () => unsubscribe();
                    }

                } else {
                    console.error('No such musician!');
                }
            } catch (error) {
                console.error('Error fetching musician profile', error);
            } finally {
                setLoading(false);
            }
        };


        fetchMusicianProfile();

    }, [musicianId, gigId]);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 1100) {
                setPadding('15vw');
            } else {
                setPadding('1rem');
            }
        };

        handleResize(); // Set initial padding
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);
    
    const renderActiveTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return <OverviewTab musicianData={musicianProfile} />; 
            case 'music':
                return <MusicTab videos={musicianProfile.videos} tracks={musicianProfile.tracks}/>;
            case 'reviews':
                return <ReviewsTab reviews={musicianProfile.reviews} />;
            default:
                return null;
        }        
    };       

    const handleAccept = async (musicianId) => {

        // TAKE PAYMENT FROM HOST
    
        try {
            const gigRef = doc(firestore, 'gigs', gigId);
            const gigSnapshot = await getDoc(gigRef);
    
            if (gigSnapshot.exists()) {
                const gigData = gigSnapshot.data();
                const updatedApplicants = gigData.applicants.map(applicant => {
                    if (applicant.id === musicianId) {
                        return { ...applicant, status: 'Accepted' };
                    } else {
                        return { ...applicant, status: 'Declined' };
                    }
                });
                await updateDoc(gigRef, { applicants: updatedApplicants });
                const updatedApplicant = updatedApplicants.find(applicant => applicant.id === musicianId);
                setApplicantData(updatedApplicant);
            } else {
                console.error('Gig not found');
            }
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleReject = async (musicianId) => {
        try {
            const gigRef = doc(firestore, 'gigs', gigId);
            const gigSnapshot = await getDoc(gigRef);
    
            if (gigSnapshot.exists()) {
                const gigData = gigSnapshot.data();
                const updatedApplicants = gigData.applicants.map(applicant => {
                    if (applicant.id === musicianId) {
                        return { ...applicant, status: 'Declined' };
                    }
                });
                await updateDoc(gigRef, { applicants: updatedApplicants });
                const updatedApplicant = updatedApplicants.find(applicant => applicant.id === musicianId);
                setApplicantData(updatedApplicant);
            } else {
                console.error('Gig not found');
            }
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    return (
        <div className="musician-profile-page" style={{ padding: `0 ${padding}` }}>
            <Header 
                user={user}
                setAuthModal={setAuthModal}
                setAuthType={setAuthType}
            />
            {loading ? (
                <p>loading...</p>
            ) : (
                <div className="profile">
                    <div className="profile-banner">
                        <div className="profile-information">
                            <figure className="profile-picture">
                                <img src={musicianProfile.picture} alt={`${musicianProfile.name}'s Profile Picture`} />
                            </figure>
                            <div className="profile-details">
                                <h1>{musicianProfile.name}</h1>
                                <div className="data">
                                    <p>50 gigs played</p>
                                    <p>300 followers</p>
                                    <p>4.5<StarIcon /> avg. rating</p>
                                </div>
                                <div className="genre-tags">
                                    {musicianProfile.genres && musicianProfile.genres.map((genre, index) => (
                                        <div className="genre-tag" key={index}>
                                            {genre}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                            {applicantData && (
                        <div className="profile-actions applicant">
                            <h2>{applicantData.fee}</h2>
                            {applicantData.status === 'Accepted' && (
                                <div className="status-box">
                                    <div className="status confirmed">
                                        <TickIcon />
                                        Accepted
                                    </div>
                                </div>
                            )}
                            {applicantData.status === 'Declined' && (
                                <div className="status-box">
                                    <div className="status rejected">
                                        <RejectedIcon />
                                        Declined
                                    </div>
                                </div>
                            )}
                        </div>
                            )}
                    </div>
                    <nav className="profile-tabs">
                        <p onClick={() => setActiveTab('overview')} className={`profile-tab ${activeTab === 'overview' ? 'active' : ''}`}>
                            Overview
                        </p>
                        <p onClick={() => setActiveTab('music')} className={`profile-tab ${activeTab === 'music' ? 'active' : ''}`}>
                            Music
                        </p>
                        <p onClick={() => setActiveTab('reviews')} className={`profile-tab ${activeTab === 'reviews' ? 'active' : ''}`}>
                            Reviews
                        </p>
                    </nav>
                    <div className="profile-sections">
                        {renderActiveTabContent()}
                    </div>
                </div>
            )}
        </div>
    );
}