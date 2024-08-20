import { useState } from "react";
import { PlayIcon } from "../../../../components/ui/Extras/Icons";

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

export const MusicTab = ({ videos, tracks }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showModal, setShowModal] = useState(false);

    const [currentTrackIndex, setCurrentTrackIndex] = useState(null);

    const playTrack = (index) => {
        setCurrentTrackIndex(index);
    };

    const openModal = (index) => {
        setCurrentIndex(index);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
    };

    const formatVideoDate = (dateString) => {
        const [year, month, day] = dateString.split('-');
        return `${day}-${month}-${year}`;
    };

    return (
        <div className="music">
            <div className="videos">
                <h2>Watch</h2>
                <div className="videos-carousel">
                    {videos && videos.map((video, index) => (
                        <div key={index} className="video-item">
                            <div 
                                className="video-thumbnail-container" 
                                onClick={() => openModal(index)} 
                            >
                                <img 
                                    src={video.thumbnail} 
                                    alt={`Thumbnail for ${video.title}`} 
                                />
                                <PlayIcon />
                            </div>
                            <div className="video-title-and-date">
                                <h4>{video.title}</h4>
                                <h6>{formatVideoDate(video.date)}</h6>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="tracks">
                <h2>Listen</h2>
                <div className="tracks-table">
                    {tracks && tracks.map((track, index) => (
                        <div key={index} className="track-item">
                            {currentTrackIndex === index ? (
                                <audio 
                                    controls 
                                    autoPlay 
                                    onEnded={() => setCurrentTrackIndex(null)}
                                >
                                    <source src={track.file} type="audio/mpeg" />
                                    Your browser does not support the audio element.
                                </audio>
                            ) : (
                                <>
                                    <div className="track-play-and-title">
                                        <button 
                                            onClick={() => playTrack(index)} 
                                            className="btn icon"
                                        >
                                            <PlayIcon />
                                        </button>
                                        <h4>{track.title}</h4>
                                    </div>
                                    <div className="track-date">
                                        <h6>{track.date}</h6>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            {showModal && <VideoModal video={videos[currentIndex]} onClose={closeModal} />}
        </div>
    );
};