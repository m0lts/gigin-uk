import { useEffect, useState, useRef } from 'react';
import { 
    BackgroundMusicIcon,
    ClubIcon,
    DotIcon,
    FacebookIcon,
    GuitarsIcon,
    InstagramIcon,
    MapIcon,
    PlayIcon,
    ShootingStarIcon,
    SoundcloudIcon,
    SpotifyIcon,
    TwitterIcon,
    YoutubeIcon } from '@features/shared/ui/extras/Icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faGuitar,
    faDrum,
    faPiano,
    faKeyboard,
    faSaxophone,
    faTrumpet,
    faFlute,
    faViolin,
    faMicrophone,
    faBanjo,
    faMandolin,
    faHeadphones,
    faLaptop,
    faMusic,
    faTurntable,
    faLightbulb
} from '@fortawesome/pro-light-svg-icons';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { EmptyIcon } from '../../shared/ui/extras/Icons';
import { useMapbox } from '../../../hooks/useMapbox';

export const AboutTab = ({musicianData, viewingOwnProfile, setShowPreview}) => {

    const mapContainerRef = useRef(null);
      
    useMapbox({
        containerRef: mapContainerRef,
        coordinates: musicianData?.location.coordinates,
    });

    const getInstrumentIcon = (instrument) => {
        switch (instrument.toLowerCase()) {
            case 'singer':
            case 'microphone':
                return <FontAwesomeIcon icon={faMicrophone} className='icon' />;
            case 'guitar':
                return <FontAwesomeIcon icon={faGuitar} className='icon' />;
            case 'bass':
                return <FontAwesomeIcon icon={faGuitar} className='icon' />; // Use the guitar icon for bass as well
            case 'drums':
            case 'drum machine':
                return <FontAwesomeIcon icon={faDrum} className='icon' />;
            case 'piano':
            case 'keyboard':
            case 'accordion':
                return <FontAwesomeIcon icon={faPiano} className='icon' />;
            case 'violin':
            case 'cello':
            case 'harp':
                return <FontAwesomeIcon icon={faViolin} className='icon' />;
            case 'saxophone':
                return <FontAwesomeIcon icon={faSaxophone} className='icon' />;
            case 'trumpet':
                return <FontAwesomeIcon icon={faTrumpet} className='icon' />;
            case 'flute':
                return <FontAwesomeIcon icon={faFlute} className='icon' />;
            case 'banjo':
                return <FontAwesomeIcon icon={faBanjo} className='icon' />;
            case 'mandolin':
                return <FontAwesomeIcon icon={faMandolin} className='icon' />;
            case 'turntable':
            case 'mixer':
                return <FontAwesomeIcon icon={faTurntable} className='icon' />;
            case 'controller':
            case 'synthesizer':
            case 'sampler':
            case 'harmonica':
                return <FontAwesomeIcon icon={faKeyboard} className='icon' />; // Use the keyboard icon for DJ controllers/synthesizers/samplers
            case 'laptop':
                return <FontAwesomeIcon icon={faLaptop} className='icon' />;
            case 'speakers':
                return <FontAwesomeIcon icon={faMusic} className='icon' />; // There isn't a direct speaker icon in Font Awesome Pro Light, using music icon
            case 'headphones':
                return <FontAwesomeIcon icon={faHeadphones} className='icon' />;
            case 'lighting':
                return <FontAwesomeIcon icon={faLightbulb} className='icon' />; // Lighting icon
            case 'dj software':
                return <FontAwesomeIcon icon={faLaptop} className='icon' />; // Use the laptop icon for DJ software
            default:
                return <FontAwesomeIcon icon={faMusic} className='icon' />; // Default icon
        }
    };

    if (!musicianData.genres && !musicianData.musicType && !musicianData.coordinates && !musicianData.equipment && !musicianData.socials) {
        return (
            <div className="nothing-to-display">
                <EmptyIcon />
                {viewingOwnProfile ? (
                    <>
                        <h4>More information will show here when you complete your profile.</h4>
                        <button className="btn primary" onClick={() => setShowPreview(false)}>
                            Finish Profile
                        </button>
                    </>
                ) : (
                    <>
                        <h4>No more information to show.</h4>
                    </>
                )}
            </div>
          )
    }

    return (
        <div className='musician-profile-about'>
            {musicianData?.genres.length > 0 && (
                <div className="musician-genres">
                    <h3>Genres</h3>
                    {musicianData.genres.map((g) => (
                        <div className="genre-item" key={g}>
                            <p>{g}</p>
                        </div>
                    ))}
                </div>
            )}
            {musicianData?.musicType && (
                <div className="musician-genres">
                    <h3>Music Played</h3>
                    <h4>{musicianData.musicType}</h4>
                </div>
            )}
            {musicianData?.location && (
                <div className="musician-location">
                    <h3>Location</h3>
                    {musicianData.location.coordinates.length > 0 && (
                        <div ref={mapContainerRef} className="map-container" style={{ width: 100, height: 100 }} />
                    )}
                    <h5>{musicianData?.location?.city}</h5>
                    <h5>{musicianData?.location?.travelDistance}</h5>
                </div>
            )}
            {musicianData?.instruments.length > 0 && (
                <div className="musician-instruments">
                    <h3>Instruments Played</h3>
                    {musicianData.instruments.map((i) => (
                        <div className="instrument-item" key={i}>
                            {getInstrumentIcon(i)}
                            <p>{i}</p>
                        </div>
                    ))}
                </div>
            )}
            {musicianData?.bandProfile && (
                <div className="musician-band-members">
                    <h3>Band Members</h3>
                    {musicianData.genres.map((g) => (
                        <div className="genre-item" key={g}>
                            <p>{g}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}