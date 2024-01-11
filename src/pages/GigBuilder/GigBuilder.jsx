import { useEffect, useState } from 'react';
import { Header } from '/components/Header/Header';
import { Calendar } from '/components/Calendar/Calendar';
import { NumberOneIcon, NumberTwoIcon, NumberThreeIcon, NumberFourIcon } from '/components/Icons/Icons';
import './gig-builder.styles.css'
import { VenueSelection } from '/pages/GigBuilder/VenueSelection/VenueSelection';


export const GigBuilder = () => {

    const [gigInformation, setGigInformation] = useState({});
    
    const [gigProfile, setGigProfile] = useState();
    const [gigDate, setGigDate] = useState();

    useEffect(() => {
        const updatedGigInformation = {
            ...gigInformation,
            gigProfile: gigProfile,
            gigDate: gigDate,
        }
        setGigInformation(updatedGigInformation);
    }, [gigProfile, gigDate])

    useEffect(() => {
        console.log(gigInformation);
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
                            <h2 className="subtitle"><NumberOneIcon /> Which venue is hosting this gig?</h2>
                            <VenueSelection
                                gigProfile={gigProfile}
                                setGigProfile={setGigProfile}
                            />
                        </div>
                        <div className="stage calendar">
                            <h2 className="subtitle"><NumberTwoIcon /> Select a date for your gig:</h2>
                            <Calendar />
                        </div>
                        <div className="stage information">
                            <h2 className="subtitle"><NumberThreeIcon /> Fill in the following fields:</h2>
                            
                        </div>
                        <div className="stage information">
                            <h2 className="subtitle"><NumberFourIcon /> Fill in the following fields:</h2>
                            
                        </div>
                    </div>
                </div>
                <aside className="current-selections">
                    <h3 className='subtitle'>Gig Information:</h3>
                    {!gigInformation.gigProfile && <p className='text'>No information yet.</p>}
                    {gigInformation.gigProfile && (
                        <>
                            <p className='text'>Venue: {gigInformation.gigProfile.profileName}</p>
                            <p className='text'>Address: {gigInformation.gigProfile.hostAddress.address}</p>
                        </>
                    )}
                </aside>
            </div>
        </section>
    );
}