// Utils
    import { formatSelectedDate } from '/utils/dateFormatting'

// Icons and effects
    import { CalendarIcon, GuitarIcon, PoundIcon } from '/components/Icons/Icons'

// Styles
    import './gig-preview.styles.css'
    

export const GigPreview = ({ gig }) => {

    return (
        <>
            <div className="profile-picture">
                <img src={gig.gigInformation.gigProfile.profileImages[0]} alt="Profile picture" />
            </div>
            <div className="gig-information">
                <h1 className="title">{gig.gigInformation.gigProfile.profileName}</h1>
                <div className="other">
                    <div className="fee">
                        <PoundIcon />
                        {gig.gigInformation.gigDetails.gigFee}
                    </div>
                    <div className="genres">
                        <GuitarIcon />
                        {gig.gigInformation.gigDetails.genres.map((genre, index) => (<span key={index}>{genre} </span>))}
                        </div>
                    <div className="date">
                        <CalendarIcon />
                        {formatSelectedDate(gig.gigInformation.gigDate)}
                    </div>
                </div>
            </div>
        </>
    );
};