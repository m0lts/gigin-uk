import { EllipsisVerticleIcon, FiltersIcon, MenuIcon } from "/components/Icons/Icons"
import { useState, useEffect } from "react"
import { AddGigModal } from "./AddGigModal";
import { LoadingSkeletonText } from "/components/loading/LoadingEffects";
import { handleDateClean } from "/utils/handleDateClean";

export const GigsTab = () => {

    const [addGigModal, setAddGigModal] = useState(false);

    const [venues, setVenues] = useState([]);
    const [fetchingVenues, setFetchingVenues] = useState(true);

    const [upcomingGigs, setUpcomingGigs] = useState([]);
    const [previousGigs, setPreviousGigs] = useState([]);
    const [fetchingGigs, setFetchingGigs] = useState(true);

    const user = JSON.parse(sessionStorage.getItem("user"));

    useEffect(() => {
        const fetchVenues = async (userId) => {
            const response = await fetch("/api/venues/handleRetrieveUserVenues", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });
            const data = await response.json();
            setVenues(data);
            setFetchingVenues(false);
        }

        if (user) {
            fetchVenues(user._id);
        }

    }, [user])

    useEffect(() => {
        const fetchGigs = async (userId) => {
            const response = await fetch("/api/gigs/handleRetrieveUserGigs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId })
            });
            const data = await response.json();

            // Filter gigs into upcoming and previous based on their dates
            const currentDate = new Date().getTime();
            const upcoming = data.filter(gig => new Date(gig.date).getTime() > currentDate);
            const previous = data.filter(gig => new Date(gig.date).getTime() <= currentDate);

            setUpcomingGigs(upcoming);
            setPreviousGigs(previous);
            setFetchingGigs(false);
        }

        if (user) {
            fetchGigs(user._id);
        }
    }, [user])


    return (
        <div className="gigs-tab tab">
            <div className="tab-banner background-effect">
                <h3>Gigs</h3>
                <button className={`btn btn-border ${fetchingVenues && 'disabled'}`} onClick={() => setAddGigModal(true)} disabled={fetchingVenues}>
                    Create Gig
                </button>
            </div>
            {addGigModal && <AddGigModal addGigModal={addGigModal} setAddGigModal={setAddGigModal} venues={venues} userId={user._id} />}
            <div className="tab-content table">
                <div className="head item">
                    <div className="left">
                        <h6>Upcoming</h6>
                    </div>
                    <div className="right">
                        <button className="btn btn-icon black"><FiltersIcon /></button>
                    </div>
                </div>
                <div className="body">
                    {fetchingGigs ? (
                        <div className="item">
                            <div className="left">
                                <LoadingSkeletonText
                                    height={16}
                                    width={150}
                                />
                            </div>
                        </div>
                    ) : (
                        upcomingGigs.length === 0 ? (
                            <div className="item">
                                <div className="left">
                                    <p>No upcoming gigs.</p>
                                </div>
                            </div>
                        ) : (
                            upcomingGigs.map((gig, id) => (
                                <div key={id} className="item">
                                    <div className="left">
                                        <p>{handleDateClean(gig.date)}</p>
                                        <p>{gig.time}</p>
                                        <p>{gig.venue}</p>
                                    </div>
                                    <div className="right">
                                        <button className="btn btn-icon black"><EllipsisVerticleIcon /></button>
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>
                <div className="head item">
                    <div className="left">
                        <h6>Previous</h6>
                    </div>
                    <div className="right">
                        <button className="btn btn-icon black"><FiltersIcon /></button>
                    </div>
                </div>
                <div className="body">
                    {fetchingGigs ? (
                        <div className="item">
                            <div className="left">
                                <LoadingSkeletonText
                                    height={16}
                                    width={150}
                                />
                            </div>
                        </div>
                    ) : (
                        previousGigs.length === 0 ? (
                            <div className="item">
                                <div className="left">
                                    <p>No previous gigs</p>
                                </div>
                            </div>
                        ) : (
                            previousGigs.map((gig, id) => (
                                <div key={id} className="item">
                                    <div className="left">
                                        <p>{handleDateClean(gig.date)}</p>
                                        <p>{gig.time}</p>
                                        <p>{gig.venue}</p>
                                    </div>
                                    <div className="right">
                                        <button className="btn btn-icon black"><EllipsisVerticleIcon /></button>
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>
            </div>
        </div>
    )
}