import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom"
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../../../firebase'; // Adjust this import to your actual Firebase configuration
import { LoadingThreeDots } from "../../../components/ui/loading/Loading";

export const GigApplications = () => {
    const location = useLocation();
    const gigInfo = location.state.gig;
    const [musicianProfiles, setMusicianProfiles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMusicianProfiles = async () => {
            const profiles = [];
            for (const applicant of gigInfo.applicants) {
                const musicianRef = doc(firestore, 'musicianProfiles', applicant.id);
                const musicianSnapshot = await getDoc(musicianRef);
                if (musicianSnapshot.exists()) {
                    profiles.push({ ...musicianSnapshot.data(), id: applicant.id, status: applicant.status });
                }
            }
            setMusicianProfiles(profiles);
            setLoading(false);
        };

        fetchMusicianProfiles();
    }, [gigInfo]);

    const formatDate = (timestamp) => {
        const date = timestamp;
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
        const month = date.toLocaleDateString('en-GB', { month: 'long' });
        return `${weekday} ${day}${getOrdinalSuffix(day)} ${month}`;
    };

    const getOrdinalSuffix = (day) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };

    const handleAccept = (id) => {
        // Implement logic for accepting the application
        console.log(`Accepted musician with id: ${id}`);
    };

    const handleReject = (id) => {
        // Implement logic for rejecting the application
        console.log(`Rejected musician with id: ${id}`);
    };

    return (
        <>
            <div className="head">
                <h1 className="title" style={{ fontWeight: 500 }}>
                    Applications for {formatDate(gigInfo.date)} at {gigInfo.venue.venueName}
                </h1>
            </div>
            <div className="body gigs">
                {loading ? (
                    <LoadingThreeDots />
                ) : (
                    musicianProfiles.length > 0 ? (
                        <table className="applications-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Genres</th>
                                    <th>Reviews</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {musicianProfiles.map((profile) => (
                                    <tr key={profile.id}>
                                        <td>
                                            <img
                                                src={profile.picture}
                                                alt={`${profile.name}'s profile`}
                                                style={{ width: '50px', height: '50px', borderRadius: '50%' }}
                                            />
                                            {profile.name}
                                        </td>
                                        <td>{profile.genres.join(', ')}</td>
                                        <td>{profile.reviews?.length || 'No'} Reviews</td>
                                        <td>
                                            <button onClick={() => console.log(`Viewing profile of ${profile.name}`)}>
                                                View Profile
                                            </button>
                                        </td>
                                        <td>
                                            <button onClick={() => handleAccept(profile.id)} className="btn accept-btn">
                                                Accept
                                            </button>
                                            <button onClick={() => handleReject(profile.id)} className="btn reject-btn">
                                                Reject
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <h4>No Applicants.</h4>
                    )
                )}
            </div>
        </>
    );
};