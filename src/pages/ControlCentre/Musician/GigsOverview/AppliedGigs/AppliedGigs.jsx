// Components
    import { GigBox } from "../GigBox/GigBox"

export const AppliedGigs = () => {
    return (
        <div className="applied-gigs tile bckgrd-white">
            <h2 className="subtitle">Applications</h2>
            <div className="list">
                <GigBox />
                <GigBox />
                <GigBox />
                <GigBox />
            </div>
        </div>
    )
}