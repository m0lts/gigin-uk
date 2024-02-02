// Components
    import { AppliedGigs } from "./AppliedGigs/AppliedGigs"
    import { PreviousGigs } from "./PreviousGigs/PreviousGigs"
    import { UpcomingGigs } from "./UpcomingGigs/UpcomingGigs"

// Styles
    import './gigs-overview.styles.css'


export const GigsOverview = () => {

    const gigsAvailable = true;

    return (
        <div className="gigs-tile tile bckgrd-grey">
            <div className="top">
                <h1 className="title">Gigs</h1>
                <div className="profiles">
                    <p className="black-button">All</p>
                    <p className="white-button">Jazz Pianist</p>
                </div>
            </div>
            {gigsAvailable ? (
                <div className="options">
                    <AppliedGigs />
                    <UpcomingGigs />
                    <PreviousGigs />
                </div>
            ) : (
                <p className="text">You have no gigs available to view.</p>
            )}
        </div>
    )
}