import { useState } from 'react';
import { PostGigButton, SaveTemplateButton } from '/pages/GigBuilder/Buttons/GigBuilder.buttons'
import { formatSelectedDateLong } from '/utils/dateFormatting';
import './side-bar.styles.css'

export const SideBar = ({ gigInformation, postButtonAvailable, setPostButtonAvailable }) => {

    const [error, setError] = useState();

    return (
        <aside className="side-bar">
            <div className="main">
                <h3 className='subtitle'>Gig Information:</h3>
                {!gigInformation.gigProfile && (
                    <p className='text'>Start by selecting the venue profile you want to build the gig for.</p>
                )}
                {gigInformation.gigProfile && (
                    <>
                        <p className='text'>Venue: {gigInformation.gigProfile.profileName}</p>
                        <p className='text'>Address: {gigInformation.gigProfile.hostAddress.address}</p>
                    </>
                )}
                {gigInformation.gigDate && (
                    <>
                        <p className='text'>Date: {formatSelectedDateLong(gigInformation.gigDate)}</p>
                    </>
                )}
                {gigInformation.gigDetails && (
                    <>
                        {gigInformation.gigDetails.musicType && (<p className='text'>Music Type: {gigInformation.gigDetails.musicType}</p>)}
                        {gigInformation.gigDetails.genres && gigInformation.gigDetails.genres.length > 0 && (<p className='text'>Genres: {gigInformation.gigDetails.genres.map((genre, index) => (<span key={index}>{genre} </span>))}</p>)}
                        {gigInformation.gigDetails.gigStartTime && (<p className='text'>Start Time: {gigInformation.gigDetails.gigStartTime}</p>)}
                        {gigInformation.gigDetails.gigDuration && (<p className='text'>Gig Duration: {gigInformation.gigDetails.gigDuration}</p>)}
                        {gigInformation.gigDetails.musicianTime && (<p className='text'>Musician Arrival Time: {gigInformation.gigDetails.musicianArrivalTime}</p>)}
                        {gigInformation.gigDetails.extraInformation && (<p className='text'>Extra Information: {gigInformation.gigDetails.extraInformation}</p>)}

                    </>
                )}
            </div>
            <div className="foot">
                <SaveTemplateButton />
                <PostGigButton
                    gigInformation={gigInformation}
                    postButtonAvailable={postButtonAvailable}
                    setPostButtonAvailable={setPostButtonAvailable}
                    error={error}
                    setError={setError}
                />
            </div>
            {error && (
                <div className="error-container">
                    <p className='error'>{error}</p>
                </div>
            )}
        </aside>
    )
}