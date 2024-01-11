import { useEffect, useState } from 'react';
import { Header } from '/components/Header/Header';
import { Calendar } from '/components/Calendar/Calendar';
import { NumberOneIcon, NumberTwoIcon, NumberThreeIcon, NumberFourIcon } from '/components/Icons/Icons';
import './gig-builder.styles.css'
import { VenueSelection } from '/pages/GigBuilder/VenueSelection/VenueSelection';
import { GigDetails } from '/pages/GigBuilder/GigDetails/GigDetails';
import { SideBar } from './SideBar/SideBar';


export const GigBuilder = () => {

    const [gigInformation, setGigInformation] = useState({});
    
    const [gigProfile, setGigProfile] = useState();
    const [gigDate, setGigDate] = useState();
    const [gigDetails, setGigDetails] = useState();

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
    }, [gigInformation])


    return (
        <section className="gig-builder">
            <Header />
            <div className="body">
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
                    postButtonAvailable={postButtonAvailable}
                    setPostButtonAvailable={setPostButtonAvailable}
                />
            </div>
        </section>
    );
}