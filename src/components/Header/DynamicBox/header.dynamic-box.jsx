import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './header.dynamic-box.styles.css';

export const DynamicBox = ({ userProfile, stageNumber }) => {

    const location = useLocation();

    // Default messages to display and loop through
    const messages = [
        'Welcome to Gigin!',
        '£0 paid out to musicians.',
        '0 gigs needing musicians.',
        '0 total gig posts.'
    ];
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentMessageIndex((prevIndex) =>
                prevIndex === messages.length - 1 ? 0 : prevIndex + 1
            );
        }, 5000);
        return () => clearInterval(interval);
    }, [messages.length]);


    const DynamicBarOutput = (location) => {
        if (location === '/profile-creator') {
            return (
                <div className='progress'>
                    <p className='text'>Profile Creator Progress:</p>
                    <div className='bar'>
                        <div 
                            className="fill"
                            style={{
                                width: stageNumber === 0 ? '0%' :
                                    stageNumber === 1 ? '10%' :
                                    // Musician progress
                                    stageNumber === 2 && userProfile.profileType === 'Musician' ? '40%' :
                                    stageNumber === 3 && userProfile.profileType === 'Musician' ? '60%' :
                                    stageNumber === 4 &&
                                        userProfile.profileType === 'Musician' &&
                                        (userProfile.musicianType.includes('Instrumentalist / Vocalist') ||
                                        userProfile.musicianType.includes('Singer / Songwriter'))
                                        ? '70%' :
                                    stageNumber === 4 &&
                                        userProfile.profileType === 'Musician' &&
                                        !(userProfile.musicianType.includes('Instrumentalist / Vocalist') ||
                                        userProfile.musicianType.includes('Singer / Songwriter'))
                                        ? '80%' :
                                    stageNumber === 5 &&
                                        userProfile.profileType === 'Musician' &&
                                        (userProfile.musicianType.includes('Instrumentalist / Vocalist') ||
                                        userProfile.musicianType.includes('Singer / Songwriter'))
                                        ? '85%' :
                                    stageNumber === 5 &&
                                        userProfile.profileType === 'Musician' &&
                                        !(userProfile.musicianType.includes('Instrumentalist / Vocalist') ||
                                        userProfile.musicianType.includes('Singer / Songwriter'))
                                        ? '100%' :
                                    stageNumber === 6 && userProfile.profileType === 'Musician' ? '100%' :
                                    // Host progress
                                    stageNumber === 2 && userProfile.profileType === 'Host' ? '20%' :
                                    stageNumber === 3 && userProfile.profileType === 'Host' ? '30%' :
                                    stageNumber === 4 && userProfile.profileType === 'Host' ? '40%' :
                                    stageNumber === 5 && userProfile.profileType === 'Host' ? '50%' :
                                    stageNumber === 6 && 
                                        userProfile.profileType === 'Host' &&
                                        userProfile.inHouseEquipment.length > 0
                                        ? '60%' :
                                    stageNumber === 6 && 
                                        userProfile.profileType === 'Host' &&
                                        userProfile.inHouseEquipment.length === 0
                                        ? '65%' :
                                    stageNumber === 7 && 
                                        userProfile.profileType === 'Host' &&
                                        userProfile.inHouseEquipment.length > 0
                                        ? '70%' :
                                    stageNumber === 7 && 
                                        userProfile.profileType === 'Host' &&
                                        userProfile.inHouseEquipment.length === 0
                                        ? '82.5%' :
                                    stageNumber === 8 && 
                                        userProfile.profileType === 'Host' &&
                                        userProfile.inHouseEquipment.length > 0
                                        ? '85%' :
                                    stageNumber === 8 && 
                                        userProfile.profileType === 'Host' &&
                                        userProfile.inHouseEquipment.length === 0
                                        ? '100%' :
                                    stageNumber === 9 && '100%'
                              }}
                        ></div>
                    </div>
                </div>
            )
        } else {
            return (
                <p className='text'>{messages[currentMessageIndex]}</p>
            )
        }
    }



    return (
        <section className='dynamic-bar'>
            {DynamicBarOutput(location.pathname)}
        </section>
    )
}