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
        coordinates: musicianData?.location?.coordinates,
        addMarker: false,
        zoom: 8,
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

    const formatTravelDistance = (distance) => {
        switch (distance) {
          case '5 miles':
            return 'willing to travel up to 5 miles';
          case '25 miles':
            return 'willing to travel up to 25 miles';
          case '50 miles':
            return 'willing to travel up to 50 miles';
          case '100 miles':
            return 'willing to travel up to 100 miles';
          case 'Nationwide':
            return 'available to travel nationwide';
          default:
            return distance || 'Travel distance not specified';
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
                <div className="musician-genres about-section">
                    <h3>Genres</h3>
                    <ul className="genre-list">
                        {musicianData.genres.map((g) => (
                            <ul className="genre-item" key={g}>
                                <p>{g}</p>
                            </ul>
                        ))}
                    </ul>
                </div>
            )}
            {musicianData?.musicType && (
                <div className="musician-music about-section">
                    <h3>Music Played</h3>
                    <h4>{musicianData.musicType === 'Both' ? 'Both Covers And Originals' : musicianData.musicType}</h4>
                </div>
            )}
            {musicianData?.bio?.experience && (
                <div className="musician-music about-section">
                    <h3>Gigging Experience</h3>
                    <h4>{musicianData.bio.experience}</h4>
                </div>
            )}
            {musicianData?.location && (
                <div className="musician-location about-section">
                    <h3>Location</h3>
                    {musicianData?.location?.coordinates.length > 0 && (
                        <div ref={mapContainerRef} className="map-container" />
                    )}
                    <h4>{musicianData?.location?.city}; {formatTravelDistance(musicianData?.location?.travelDistance)}.</h4>
                </div>
            )}
            {musicianData?.instruments.length > 0 && (
                <div className="musician-instruments about-section">
                    <h3>Instruments Played</h3>
                    <ul className="instrument-list">
                        {musicianData.instruments.map((i) => (
                            <li className="instrument-item" key={i}>
                                {getInstrumentIcon(i)}
                                <p>{i}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {musicianData?.bandProfile && (
                <div className="musician-band-members about-section">
                    <h3>Band Members</h3>
                    {musicianData.bandMembers.map((bm) => (
                        <div className="genre-item" key={bm}>
                            <p>{bm}</p>
                        </div>
                    ))}
                </div>
            )}
            {(musicianData?.socialMedia?.instagram !== '' || musicianData?.socialMedia?.facebook !== '' || musicianData?.socialMedia?.twitter !== '' || musicianData?.socialMedia?.spotify !== '' || musicianData?.socialMedia?.soundcloud !== '' || musicianData?.socialMedia?.youtube !== '') && (
                <div className="musician-socials about-section">
                    <h3>Socials</h3>
                    {musicianData.socialMedia.facebook && (
                        <a href={musicianData.socialMedia.facebook} target='_blank' rel='noreferrer'>
                            <FacebookIcon />
                        </a>
                    )}
                    {musicianData.socialMedia.instagram && (
                        <a href={musicianData.socialMedia.instagram} target='_blank' rel='noreferrer'>
                            <InstagramIcon />
                        </a>
                    )}
                    {musicianData.socialMedia.twitter && (
                        <a href={musicianData.socialMedia.twitter} target='_blank' rel='noreferrer'>
                            <TwitterIcon />
                        </a>
                    )}
                    {musicianData.socialMedia.spotify && (
                        <a href={musicianData.socialMedia.spotify} target='_blank' rel='noreferrer'>
                            <SpotifyIcon />
                        </a>
                    )}
                    {musicianData.socialMedia.soundcloud && (
                        <a href={musicianData.socialMedia.soundcloud} target='_blank' rel='noreferrer'>
                            <SoundcloudIcon />
                        </a>
                    )}
                    {musicianData.socialMedia.youtube && (
                        <a href={musicianData.socialMedia.youtube} target='_blank' rel='noreferrer'>
                            <YoutubeIcon />
                        </a>
                    )}
                </div>
            )}
        </div>
    )
}