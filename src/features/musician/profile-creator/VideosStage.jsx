import { useEffect, useState } from 'react';
import { EditIcon, VideoIcon, PlayIcon } from '@features/shared/ui/extras/Icons';

const VideoModal = ({ video, onClose }) => {
    return (
        <div className='modal' onClick={onClose}>
            <div className='modal-content' onClick={(e) => e.stopPropagation()}>
                <span className='close' onClick={onClose}>&times;</span>
                <video controls autoPlay style={{ width: '100%' }}>
                    <source src={typeof video.file === 'string' ? video.file : URL.createObjectURL(video.file)} type='video/mp4' />
                    Your browser does not support the video tag.
                </video>
            </div>
        </div>
    );
};

export const VideosStage = ({ data, onChange }) => {
    const [videos, setVideos] = useState(data || []);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        onChange('videos', videos);
    }, [videos]);

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

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (file) {
            const thumbnail = await generateThumbnail(file);
            const newVideo = {
                file,
                title: file.name,
                date: new Date(file.lastModified).toISOString().split('T')[0],
                thumbnail
            };
            setVideos((prevVideos) => [...prevVideos, newVideo]);
        }
    };

    const handleTitleChange = (index, newTitle) => {
        setVideos((prevVideos) =>
            prevVideos.map((video, i) =>
                i === index ? { ...video, title: newTitle } : video
            )
        );
    };

    const handleDateChange = (index, newDate) => {
        setVideos((prevVideos) =>
            prevVideos.map((video, i) =>
                i === index ? { ...video, date: newDate } : video
            )
        );
    };

    const removeVideo = (index) => {
        setVideos((prevVideos) => prevVideos.filter((_, i) => i !== index));
    };

    const openModal = (index) => {
        setCurrentIndex(index);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
    };

    return (
        <div className='stage media'>
            <h3 className='section-title'>Content</h3>
            <div className='body'>
                <h1>Upload a showcase video.</h1>
                <h5>You can add more videos later.</h5>
                {videos.length > 0 ? (
                    <table className='media-table'>
                        <thead>
                            <tr>
                                <th className='file-type'>Watch</th>
                                <th>Title</th>
                                <th>Date</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {videos.map((video, index) => (
                                <tr key={index}>
                                    <td onClick={() => openModal(index)} className='video-data'>
                                        <div className='video-container'>
                                            <img
                                                src={typeof video.thumbnail === 'string' ? video.thumbnail : URL.createObjectURL(video.thumbnail)}
                                                alt='Video thumbnail'
                                                style={{ cursor: 'pointer' }}
                                            />
                                            <PlayIcon />
                                        </div>
                                    </td>
                                    <td className='title'>
                                        <input
                                            type='text'
                                            className='input'
                                            value={video.title}
                                            onChange={(e) => handleTitleChange(index, e.target.value)}
                                        />
                                        <EditIcon />
                                    </td>
                                    <td className='table-input'>
                                        <input
                                            type='date'
                                            className='input'
                                            value={video.date}
                                            onChange={(e) => handleDateChange(index, e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <button className='btn icon remove-button' onClick={() => removeVideo(index)}>
                                            &times;
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {videos.length < 1 && (
                                <tr className='upload-table'>
                                    <td colSpan='4'>
                                        <input
                                            type='file'
                                            accept='video/*'
                                            onChange={handleFileChange}
                                            style={{ display: 'none' }}
                                            id='fileInput'
                                        />
                                        <label htmlFor='fileInput' className='upload-table-label'>
                                            <VideoIcon />
                                            <span>Add more...</span>
                                        </label>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                ) : (
                    <div className='upload'>
                        <input
                            type='file'
                            accept='video/*'
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                            id='fileInput'
                        />
                        <label htmlFor='fileInput' className='upload-label'>
                            <VideoIcon />
                            <span>Upload videos here...</span>
                        </label>
                    </div>
                )}
                {showModal && <VideoModal video={videos[currentIndex]} onClose={closeModal} />}
            </div>
        </div>
    );
};
