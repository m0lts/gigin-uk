import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '/components/Header/Header';
import { Calendar } from '/components/Calendar/Calendar';
import { NumberOneIcon, NumberTwoIcon, NumberThreeIcon, NumberFourIcon } from '/components/Icons/Icons';
import { VenueSelection } from '/pages/GigBuilder/VenueSelection/VenueSelection';
import { GigDetails } from '/pages/GigBuilder/GigDetails/GigDetails';
import { SideBar } from '/pages/GigBuilder/SideBar/SideBar';
import { GetInfoFromLocalStorage } from '/utils/updateLocalStorage';
import { DefaultOverlay } from '/components/Overlays/Overlays';
import './gig-builder.styles.css'


export const GigBuilder = () => {

    // If user hasnt created a profile, don't allow them to access this page
    const { profileCreated } = GetInfoFromLocalStorage();

    const [gigInformation, setGigInformation] = useState({});
    
    const [gigProfile, setGigProfile] = useState(gigInformation.gigProfile ? gigInformation.gigProfile : undefined);
    const [gigDate, setGigDate] = useState(gigInformation.gigDate ? gigInformation.gigDate : undefined);
    const [gigDetails, setGigDetails] = useState(gigInformation.gigDetails ? gigInformation.gigDetails : {});

    const [postButtonAvailable, setPostButtonAvailable] = useState(false);

    useEffect(() => {
        const updatedGigInformation = {
            ...gigInformation,
            gigDate,
            gigProfile,
            gigDetails
        }
        setGigInformation(updatedGigInformation);
    }, [gigProfile, gigDate, gigDetails])

    useEffect(() => {
        if (gigInformation.gigProfile && 
            gigInformation.gigDate && 
            gigInformation.gigDetails.musicianType && 
            gigInformation.gigDetails.musicianType.length > 0 &&
            gigInformation.gigDetails.musicType && 
            gigInformation.gigDetails.genres && 
            gigInformation.gigDetails.genres.length > 0 &&
            gigInformation.gigDetails.gigStartTime && 
            gigInformation.gigDetails.gigDuration) {
            setPostButtonAvailable(true);
        } else {
            setPostButtonAvailable(false);
        }
        console.log(gigInformation)
    }, [gigInformation])


    return (
        <section className="gig-builder">
            <Header />
            <div className="body">
                {!profileCreated && (
                    <DefaultOverlay 
                        title="You haven't created a profile yet!"
                        text="Please create a profile before trying to create a gig."
                        link="/profile-creator"
                        linkText="Create Profile"
                    />
                )}
                <div className="selections-area">
                    <div className="heading">
                        <h1 className="title">Gig Builder</h1>
                        <p className="text">
                            Does exactly what it says on the tin - builds gigs! Fill in the fields below as accurately as possible, 
                            click publish and then musicians can apply to the gig. You can then select the musician you like the look of most!
                        </p>
                    </div>
                    <div className="main">
                        <div className="stage venue-select">
                            <h2 className="subtitle"><NumberOneIcon /> Which venue is hosting this gig? *</h2>
                            <VenueSelection
                                gigProfile={gigProfile}
                                setGigProfile={setGigProfile}
                            />
                        </div>
                        <div className="stage calendar">
                            {!gigInformation.gigProfile && (<div className='grey-out'></div>)}
                            <h2 className="subtitle"><NumberTwoIcon /> Select a date for your gig: *</h2>
                            <Calendar
                                dateSelected={gigDate}
                                setDateSelected={setGigDate}
                            />
                        </div>
                        <div className="stage gig-information">
                            {(!gigInformation.gigProfile || !gigInformation.gigDate) && (
                                <div className='grey-out'></div>
                            )}                            
                            <h2 className="subtitle"><NumberThreeIcon /> Let's get some more details:</h2>
                            <GigDetails
                                gigDetails={gigDetails}
                                setGigDetails={setGigDetails}
                            />
                        </div>
                    </div>
                </div>
                <SideBar
                    gigInformation={gigInformation}
                    setGigInformation={setGigInformation}
                    postButtonAvailable={postButtonAvailable}
                    setPostButtonAvailable={setPostButtonAvailable}
                />
            </div>
        </section>
    );
}