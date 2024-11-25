import { useState } from "react";
import { BackgroundMusicIcon, ClubIcon, DotIcon, FacebookIcon, GuitarsIcon, InstagramIcon, LocationPinIcon, MapIcon, PlayIcon, ShootingStarIcon, SoundcloudIcon, SpotifyIcon, TwitterIcon, YoutubeIcon } from "../../../../components/ui/Extras/Icons"
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
import { LoadingThreeDots } from "../../../../components/ui/loading/Loading";

const VideoModal = ({ video, onClose }) => {
    return (
        <div className="modal">
            <div className="modal-content transparent">
                <span className="close" onClick={onClose}>&times;</span>
                <video controls autoPlay style={{ width: '100%' }}>
                    <source src={video.file} type="video/mp4" />
                    Your browser does not support the video tag.
                </video>
            </div>
        </div>
    );
};

export const OverviewTab = ({musicianData}) => {

    const [showModal, setShowModal] = useState(false);

    const formatVideoDate = (dateString) => {
        const [year, month, day] = dateString.split('-');
        return `${day}-${month}-${year}`;
    };

    const openModal = () => {
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
    };

    const getInstrumentIcon = (instrument) => {
        switch (instrument.toLowerCase()) {
            case 'singer':
            case 'microphone':
                return <FontAwesomeIcon icon={faMicrophone} className="icon" />;
            case 'guitar':
                return <FontAwesomeIcon icon={faGuitar} className="icon" />;
            case 'bass':
                return <FontAwesomeIcon icon={faGuitar} className="icon" />; // Use the guitar icon for bass as well
            case 'drums':
            case 'drum machine':
                return <FontAwesomeIcon icon={faDrum} className="icon" />;
            case 'piano':
            case 'keyboard':
            case 'accordion':
                return <FontAwesomeIcon icon={faPiano} className="icon" />;
            case 'violin':
            case 'cello':
            case 'harp':
                return <FontAwesomeIcon icon={faViolin} className="icon" />;
            case 'saxophone':
                return <FontAwesomeIcon icon={faSaxophone} className="icon" />;
            case 'trumpet':
                return <FontAwesomeIcon icon={faTrumpet} className="icon" />;
            case 'flute':
                return <FontAwesomeIcon icon={faFlute} className="icon" />;
            case 'banjo':
                return <FontAwesomeIcon icon={faBanjo} className="icon" />;
            case 'mandolin':
                return <FontAwesomeIcon icon={faMandolin} className="icon" />;
            case 'turntable':
            case 'mixer':
                return <FontAwesomeIcon icon={faTurntable} className="icon" />;
            case 'controller':
            case 'synthesizer':
            case 'sampler':
            case 'harmonica':
                return <FontAwesomeIcon icon={faKeyboard} className="icon" />; // Use the keyboard icon for DJ controllers/synthesizers/samplers
            case 'laptop':
                return <FontAwesomeIcon icon={faLaptop} className="icon" />;
            case 'speakers':
                return <FontAwesomeIcon icon={faMusic} className="icon" />; // There isn't a direct speaker icon in Font Awesome Pro Light, using music icon
            case 'headphones':
                return <FontAwesomeIcon icon={faHeadphones} className="icon" />;
            case 'lighting':
                return <FontAwesomeIcon icon={faLightbulb} className="icon" />; // Lighting icon
            case 'dj software':
                return <FontAwesomeIcon icon={faLaptop} className="icon" />; // Use the laptop icon for DJ software
            default:
                return <FontAwesomeIcon icon={faMusic} className="icon" />; // Default icon
        }
    };

    return (
        <div className="profile-overview">
            <div className="overview-top">
                <div className="info-box">
                    <h2>Watch</h2>
                    <div className="video-thumbnail" onClick={() => openModal()}>
                        {musicianData.videos && musicianData.videos.length > 0 ? (
                            musicianData.videos[0].thumbnail === 'uploading...' ? (
                                <>
                                    <h3>Uploading your videos...</h3>
                                    <LoadingThreeDots />
                                </>
                            ) : (
                                <>
                                    <img src={musicianData.videos[0].thumbnail} alt="Video Thumbnail" />
                                    <div className="title-and-date">
                                        <h3>{musicianData.videos[0].title}</h3>
                                        <h6>{formatVideoDate(musicianData.videos[0].date)}</h6>
                                    </div>
                                </>
                            )
                        ) : (
                            <p>No videos available.</p>
                        )}
                        {musicianData.videos[0].thumbnail !== 'uploading...' && (
                            <PlayIcon />
                        )}
                    </div>
                </div>
                <div className="info-box">
                    <h2>Bio</h2>
                    <div className="box-style text bio">
                        <p>{musicianData.bio.text}</p>
                    </div>
                </div>
            </div>
            <div className="overview-middle box-style">
                <h6 className="data">
                    <MapIcon /> {musicianData.location.city} <DotIcon /> {musicianData.location.travelDistance}
                </h6>
                <h6 className="data">
                    <BackgroundMusicIcon /> {musicianData.musicType === 'Both' ? 'Both Covers and Originals' : musicianData.musicType}
                </h6>
                <h6 className="data">
                    <ShootingStarIcon />
                    {musicianData.bio.experience === 'less than 1 year' ? (
                        <>Up and Comer</>
                    ) : musicianData.bio.experience === '1-2 years' ? (
                        <>Rising Star</>
                    ) : musicianData.bio.experience === '2-5 years' ? (
                        <>Seasoned Performer</>
                    ) : musicianData.bio.experience === '5+ years' && (
                        <>Veteran Performer</>
                    )}
                </h6>
            </div>
            <div className="overview-bottom">
                <div className="info-box">
                    <h2>Sound</h2>
                    <ul className="box-style list">
                        {musicianData.instruments.map((instrument, index) => (
                            <li className="sound-item" key={index}>
                                <h4>{instrument}</h4>
                                {getInstrumentIcon(instrument)}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="info-box">
                    <h2>Type</h2>
                    <div className="box-style musician-type">
                        {musicianData.musicianType === 'DJ' ? <ClubIcon /> : <GuitarsIcon />}
                        <h3>
                            {musicianData.musicianType}
                        </h3>
                    </div>
                </div>
                <div className="social-media-links list">
                    {musicianData.socialMedia.facebook && (
                            <a className="link" href={musicianData.socialMedia.facebook} target="_blank" rel="noopener noreferrer">
                                <FacebookIcon /> Facebook
                            </a>
                    )}
                    {musicianData.socialMedia.instagram && (
                            <a className="link" href={musicianData.socialMedia.instagram} target="_blank" rel="noopener noreferrer">
                                <InstagramIcon /> Instagram
                            </a>
                    )}
                    {musicianData.socialMedia.twitter && (
                            <a className="link" href={musicianData.socialMedia.twitter} target="_blank" rel="noopener noreferrer">
                                <TwitterIcon /> X
                            </a>
                    )}
                    {musicianData.socialMedia.spotify && (
                            <a className="link" href={musicianData.socialMedia.spotify} target="_blank" rel="noopener noreferrer">
                                <SpotifyIcon /> Spotify
                            </a>
                    )}
                    {musicianData.socialMedia.youtube && (
                            <a className="link" href={musicianData.socialMedia.youtube} target="_blank" rel="noopener noreferrer">
                                <YoutubeIcon /> Youtube
                            </a>
                    )}
                    {musicianData.socialMedia.soundcloud && (
                            <a className="link" href={musicianData.socialMedia.soundcloud} target="_blank" rel="noopener noreferrer">
                                <SoundcloudIcon /> SoundCloud
                            </a>
                    )}
                </div>
            </div>
            {showModal && <VideoModal video={musicianData.videos[0]} onClose={closeModal} />}
        </div>
    )
}