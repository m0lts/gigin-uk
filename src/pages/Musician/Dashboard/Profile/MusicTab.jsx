import { useState } from "react";
import { EditIcon, PlayIcon, PlusIcon } from "../../../../components/ui/Extras/Icons";
import { LoadingThreeDots } from "../../../../components/ui/loading/Loading";
import { useLocation } from "react-router-dom";
import { storage, firestore } from "../../../../firebase";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, arrayUnion, deleteDoc, arrayRemove } from 'firebase/firestore';

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

export const MusicTab = ({ videos, tracks, musicianId, setVideos, setTracks, setEditingMedia }) => {
    const location = useLocation();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showModal, setShowModal] = useState(false);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(null);
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);
    const [isUploadingTrack, setIsUploadingTrack] = useState(false);

    const [videoUploadProgress, setVideoUploadProgress] = useState(0);
    const [trackUploadProgress, setTrackUploadProgress] = useState(0);

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

    const uploadVideosToFirebaseStorage = async (mediaFiles, musicianId, folder, setVideoUploadProgress) => {
        let totalBytesTransferred = 0;
        let totalBytes = mediaFiles.reduce((acc, media) => acc + media.file.size, 0);
    
        const uploadPromises = mediaFiles.map(async (media) => {
            let videoUrl = media.file;
    
            if (typeof media.file !== 'string') {
                const videoStorageRef = ref(storage, `musicians/${musicianId}/${folder}/${media.title}`);
                const uploadTask = uploadBytesResumable(videoStorageRef, media.file);
    
                uploadTask.on('state_changed', (snapshot) => {
                    totalBytesTransferred += snapshot.bytesTransferred;
                    const progress = (totalBytesTransferred / totalBytes) * 100;
                    setVideoUploadProgress(Math.min(Math.round(progress), 100)); // Ensure it does not exceed 100
                });
    
                await uploadTask;
                videoUrl = await getDownloadURL(videoStorageRef);
            }
    
            let thumbnailUrl = media.thumbnail;
            if (typeof media.thumbnail !== 'string') {
                const thumbnailStorageRef = ref(storage, `musicians/${musicianId}/${folder}/thumbnails/${media.title}_thumbnail`);
                const uploadTask = uploadBytesResumable(thumbnailStorageRef, media.thumbnail);
    
                uploadTask.on('state_changed', (snapshot) => {
                    totalBytesTransferred += snapshot.bytesTransferred;
                    const progress = (totalBytesTransferred / totalBytes) * 100;
                    setVideoUploadProgress(Math.min(Math.round(progress), 100));
                });
    
                await uploadTask;
                thumbnailUrl = await getDownloadURL(thumbnailStorageRef);
            }
    
            return { videoUrl, thumbnailUrl };
        });
    
        return Promise.all(uploadPromises);
    };

    const uploadTracksToFirebaseStorage = async (mediaFiles, musicianId, folder, setTrackUploadProgress) => {
        let totalBytesTransferred = 0;
        let totalBytes = mediaFiles.reduce((acc, media) => acc + media.file.size, 0);
    
        const uploadPromises = mediaFiles.map(async (media) => {
            if (typeof media.file === 'string') {
                return media.file;
            }
    
            const storageRef = ref(storage, `musicians/${musicianId}/${folder}/${media.title}`);
            const uploadTask = uploadBytesResumable(storageRef, media.file);
    
            uploadTask.on('state_changed', (snapshot) => {
                totalBytesTransferred += snapshot.bytesTransferred;
                const progress = (totalBytesTransferred / totalBytes) * 100;
                setTrackUploadProgress(Math.min(Math.round(progress), 100));
            });
    
            await uploadTask;
            const url = await getDownloadURL(storageRef);
            return url;
        });
    
        return Promise.all(uploadPromises);
    };

    const generateThumbnail = (file) => {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.addEventListener('loadeddata', () => {
                video.currentTime = 1; // Seek to 1 second
            });
            video.addEventListener('seeked', () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Convert the canvas to a Blob and then to a File
                canvas.toBlob((blob) => {
                    const thumbnailFile = new File([blob], `${file.name}_thumbnail.png`, {
                        type: 'image/png',
                        lastModified: Date.now(),
                    });
                    resolve(thumbnailFile); // Resolve with the File object
                }, 'image/png');
            });
        });
    };

    const handleVideoUpload = async (e) => {
        const files = Array.from(e.target.files);
        setIsUploadingVideo(true);
        setVideoUploadProgress(0);
        const mediaFiles = await Promise.all(
            files.map(async (file) => {
                const thumbnail = await generateThumbnail(file);
                return {
                    file,
                    title: file.name.split('.')[0], // Extract title from file name
                    date: new Date().toISOString().split('T')[0], // Current date
                    thumbnail,
                };
            })
        );

        try {
            const videoResults = await uploadVideosToFirebaseStorage(mediaFiles, musicianId, 'videos', setVideoUploadProgress);

            // Prepare video metadata
            const videoMetadata = mediaFiles.map((video, index) => ({
                date: video.date,
                title: video.title,
                file: videoResults[index].videoUrl,
                thumbnail: videoResults[index].thumbnailUrl,
            }));

            // Update musician's profile with new videos
            const musicianRef = doc(firestore, 'musicianProfiles', musicianId);
            await updateDoc(musicianRef, {
                videos: arrayUnion(...videoMetadata), // Append new videos
            });
            setIsUploadingVideo(false);
            setVideoUploadProgress(0);
        } catch (error) {
            console.error('Error uploading videos:', error);
            alert('Failed to upload videos.');
        }
    };

    const handleTrackUpload = async (e) => {
        const files = Array.from(e.target.files);
        setIsUploadingTrack(true);
        setTrackUploadProgress(0);
        const mediaFiles = files.map(file => ({
            file,
            title: file.name.split('.')[0],
            date: new Date().toISOString().split('T')[0],
        }));
        try {
        const trackUrls = await uploadTracksToFirebaseStorage(mediaFiles, musicianId, 'tracks', setTrackUploadProgress);
        const trackMetadata = mediaFiles.map((track, index) => ({
            date: track.date,
            title: track.title,
            file: trackUrls[index],
        }));

        const musicianRef = doc(firestore, 'musicianProfiles', musicianId);
        await updateDoc(musicianRef, {
            tracks: arrayUnion(...trackMetadata),
        });
        setIsUploadingTrack(false);
        setTrackUploadProgress(0);
        } catch (error) {
            console.error('Error uploading tracks:', error);
            alert('Failed to upload tracks.');
        }
    };

    const handleVideoTitleChange = async (index, newTitle) => {
        setEditingMedia(true);
        const updatedVideos = [...videos];
        updatedVideos[index].title = newTitle;   
        setVideos(updatedVideos);
    };
    
    const handleVideoDateChange = async (index, newDate) => {
        setEditingMedia(true);
        const updatedVideos = [...videos];
        updatedVideos[index].date = newDate;    
        setVideos(updatedVideos);
    };
    
    const handleTrackTitleChange = async (index, newTitle) => {
        setEditingMedia(true);
        const updatedTracks = [...tracks];
        updatedTracks[index].title = newTitle;    
        setTracks(updatedTracks);
    };
    
    const handleTrackDateChange = async (index, newDate) => {
        setEditingMedia(true);
        const updatedTracks = [...tracks];
        updatedTracks[index].date = newDate;    
        setTracks(updatedTracks);
    };

    return (
        <div className="music">
            <div className="videos">
                <h2>Watch</h2>
                <div className="videos-carousel">
                    {location.pathname.includes('dashboard/profile') && (
                        <div className="video-upload">
                        {!isUploadingVideo ? (
                            <div className="video-upload-container" onClick={() => document.getElementById('videoUploadInput').click()}>
                                <input
                                    type="file"
                                    id="videoUploadInput"
                                    accept="video/*"
                                    onChange={handleVideoUpload}
                                    style={{ display: 'none' }} // Hide the input
                                />
                                <PlusIcon />
                                <h4>Add Another Video</h4>
                            </div>
                        ) : (
                            <div className="video-upload-container">
                                <div className="upload-progress">
                                    <h3>Uploading: {videoUploadProgress}%</h3>
                                    <progress value={videoUploadProgress} max="100"></progress>
                                    <h4>Please don't close or exit your browser.</h4>
                                </div>
                            </div>
                        )}
                    </div>
                    )}
                    {videos && videos.map((video, index) => (
                        video.file === 'uploading...' ? (
                            <div key={index} className="uploading-videos">
                                <h4>Uploading your videos...</h4>
                                <LoadingThreeDots />
                            </div>
                        ) : (
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
                                {location.pathname.includes('dashboard/profile') ? (
                                    <div className="video-title-and-date">
                                        <div className="editable-input">
                                            <input
                                                type="text"
                                                value={video.title}
                                                onChange={(e) => handleVideoTitleChange(index, e.target.value)}
                                                className="video-title-input"
                                            />
                                            <EditIcon />
                                        </div>
                                        <input
                                            type="date"
                                            value={video.date}
                                            onChange={(e) => handleVideoDateChange(index, e.target.value)}
                                            className="video-date-input"
                                        />
                                    </div>
                                ) : (
                                    <div className="video-title-and-date">
                                        <h4>{video.title}</h4>
                                        <h6>{formatVideoDate(video.date)}</h6>
                                    </div>
                                )}
                            </div>
                        )
                    ))}
                </div>
            </div>
            <div className="tracks">
                <h2>Listen</h2>
                <div className="tracks-table">
                    {location.pathname.includes('dashboard/profile') && (
                        <div className="track-upload">
                        {!isUploadingTrack ? (
                            <div
                                className="track-upload-container"
                                onClick={() => document.getElementById('trackUploadInput').click()}
                            >
                                <input
                                    type="file"
                                    id="trackUploadInput"
                                    accept=".mp3"
                                    onChange={handleTrackUpload}
                                    style={{ display: 'none' }} // Hide the input
                                />
                                <PlusIcon />
                                <h4>Add Track (MP3 file)</h4>
                            </div>
                        ) : (
                            <div className="track-upload-container">
                                <div className="upload-progress">
                                    <h5>Uploading: {trackUploadProgress}%</h5>
                                    <progress value={trackUploadProgress} max="100"></progress>
                                    <h4>Please don't close or exit your browser.</h4>
                                </div>
                            </div>
                        )}
                    </div>
                    )}
                    {tracks && tracks.map((track, index) => (
                        track.file === 'uploading...' ? (
                            <div key={index} className="uploading-tracks">
                                <h4>Uploading your tracks...</h4>
                                <LoadingThreeDots />
                            </div>
                        ) : (
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
                                            {location.pathname.includes('dashboard/profile') ? (
                                                <div className="editable-input">
                                                <input
                                                    type="text"
                                                    value={track.title}
                                                    onChange={(e) => handleTrackTitleChange(index, e.target.value)}
                                                    className="track-title-input"
                                                />
                                                <EditIcon />
                                            </div>
                                            ) : (
                                                <h4>{track.title}</h4>
                                            )}
                                        </div>
                                        <div className="track-date">
                                            {location.pathname.includes('dashboard/profile') ? (
                                                <input
                                                    type="date"
                                                    value={track.date}
                                                    onChange={(e) => handleTrackDateChange(index, e.target.value)}
                                                    className="track-date-input"
                                                />
                                            ) : (
                                                <h6>{track.date}</h6>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )
                    ))}
                </div>
            </div>
            {showModal && <VideoModal video={videos[currentIndex]} onClose={closeModal} />}
        </div>
    );
};