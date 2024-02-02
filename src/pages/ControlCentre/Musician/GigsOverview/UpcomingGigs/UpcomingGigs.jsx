// Components
    import { GigBox } from "../GigBox/GigBox"

export const UpcomingGigs = () => {
    return (
        <div className="upcoming-gigs tile bckgrd-white">
            <h2 className="subtitle">Upcoming</h2>
            <div className="list">
                <GigBox />
                <GigBox />
                <GigBox />
            </div>
        </div>
    )
}