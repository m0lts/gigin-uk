// Dependencies
import { useEffect, useState } from "react"

// Components
import { EllipsisVerticleIcon } from "/components/Icons/Icons"
import { AddVenueModal } from "./AddVenueModal";


export const VenuesTab = () => {

    const [addVenueModal, setAddVenueModal] = useState(false);
    const [fetchingVenues, setFetchingVenues] = useState(true);
    const [venues, setVenues] = useState([]);

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

    return (
        <div className="venues-tab tab">
            <div className="tab-banner background-effect">
                <h3 className="title">Venues</h3>
                <button className="btn btn-border" onClick={() => setAddVenueModal(true)}>
                    Add Venue
                </button>
            </div>
            {addVenueModal && <AddVenueModal addVenueModal={addVenueModal} setAddVenueModal={setAddVenueModal} />}
            <div className="tab-content">
                {fetchingVenues ? (
                    <>
                        <div className="skeleton-card">
                            <div className="skeleton-animation"></div>
                        </div>
                        <div className="skeleton-card">
                            <div className="skeleton-animation"></div>
                        </div>
                    </>
                ) : (
                    venues.length === 0 ? (
                        <div className="empty-state">
                            <p>You have no venues yet</p>
                        </div>
                    ) : (
                        venues.map((venue, index) => {
                            return (
                                <div className="card" key={index}>
                                    <div className="left">
                                        <h4 className="title">{venue.name}</h4>
                                        <p className="address">{venue.address}</p>
                                        <p className="description">{venue.description}</p>
                                    </div>
                                    <div className="right">
                                        <button className="btn btn-icon black"><EllipsisVerticleIcon /></button>
                                    </div>
                                </div>
                            )
                        })
                    )
                )}
            </div>
        </div>
    )
}