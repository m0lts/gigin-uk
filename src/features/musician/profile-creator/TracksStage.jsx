import { useEffect, useState, useRef } from 'react';
import { 
    BackgroundMusicIcon,
    EditIcon,
    PlayIcon,
    PauseIcon } from '@features/shared/ui/extras/Icons';

export const TracksStage = ({ data, onChange }) => {
    const [tracks, setTracks] = useState(data || []);
    const [currentPlayingIndex, setCurrentPlayingIndex] = useState(null);
    const audioRefs = useRef([]);

    useEffect(() => {
        onChange('tracks', tracks);
    }, [tracks]);

    const handleFileChange = async (event) => {
        const files = Array.from(event.target.files);
    
        const fileToBase64 = (file) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]); // Get the base64 content without the prefix
                reader.onerror = () => reject(new Error('Failed to convert file to base64.'));
                reader.readAsDataURL(file);
            });
        };
    
        const encodedFiles = await Promise.all(
            files.map(async (file) => {
                const base64File = await fileToBase64(file);
    
                return {
                    file: base64File, // Base64 encoded file
                    title: file.name,
                    date: new Date(file.lastModified).toISOString().split('T')[0],
                };
            })
        );
    
        setTracks((prevTracks) => [...prevTracks, ...encodedFiles]);
    };

    const handleTitleChange = (index, newTitle) => {
        setTracks((prevTracks) =>
            prevTracks.map((track, i) =>
                i === index ? { ...track, title: newTitle } : track
            )
        );
    };

    const handleDateChange = (index, newDate) => {
        setTracks((prevTracks) =>
            prevTracks.map((track, i) =>
                i === index ? { ...track, date: newDate } : track
            )
        );
    };

    const removeTrack = (index) => {
        setTracks((prevTracks) => prevTracks.filter((_, i) => i !== index));
    };

    const handlePlayPauseTrack = (index) => {
        if (audioRefs.current[index]) {
            const audioElement = audioRefs.current[index];
            if (audioElement.paused) {
                audioElement.play().then(() => {
                    setCurrentPlayingIndex(index);
                }).catch(error => {
                    console.error('Error playing audio:', error);
                });
            } else {
                audioElement.pause();
                setCurrentPlayingIndex(null);
            }
        }
    };

    return (
        <div className='stage media'>
            <h3 className='section-title'>Content</h3>
            <div className='body'>
                <h1>Upload some of your best recordings.</h1>
                {tracks.length > 0 ? (
                    <table className='media-table'>
                        <thead>
                            <tr>
                                <th className='file-type'>Listen</th>
                                <th>Title</th>
                                <th>Date</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {tracks.map((track, index) => (
                                <tr key={index}>
                                    {/* <td className='file-type' onClick={() => handlePlayPauseTrack(index)}>
                                        <PlayIcon />
                                        <audio
                                            ref={el => audioRefs.current[index] = el}
                                            src={typeof track.file === 'string' ? track.file : URL.createObjectURL(track.file)}
                                        />
                                    </td> */}
                                    {/* <td className='file-type' onClick={() => handlePlayPauseTrack(index)}>
                                        <audio
                                            src={typeof track.file === 'string' ? track.file : URL.createObjectURL(track.file)}
                                            controls
                                        />
                                    </td> */}
                                    <td className='file-type'>
                                        <button className='btn text' onClick={() => handlePlayPauseTrack(index)}>
                                            {currentPlayingIndex === index && audioRefs.current[index]?.paused === false ? <PauseIcon /> : <PlayIcon />}
                                        </button>
                                        <audio
                                            ref={el => audioRefs.current[index] = el}
                                            src={typeof track.file === 'string' ? track.file : URL.createObjectURL(track.file)}
                                            style={{ display: 'none' }}
                                        />
                                    </td>
                                    <td className='title'>
                                        <input
                                            type='text'
                                            className='input'
                                            value={track.title}
                                            onChange={(e) => handleTitleChange(index, e.target.value)}
                                        />
                                        <EditIcon />
                                    </td>
                                    <td>
                                        <input
                                            type='date'
                                            className='input'
                                            value={track.date}
                                            onChange={(e) => handleDateChange(index, e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <button className='btn icon remove-button' onClick={() => removeTrack(index)}>
                                            &times;
                                        </button>
                                    </td>
                                </tr>
                            ))}
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
                                        <BackgroundMusicIcon />
                                        <span>Add more...</span>
                                    </label>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                ) : (
                    <div className='upload'>
                        <input
                            type='file'
                            multiple
                            accept='audio/*'
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                            id='fileInput'
                        />
                        <label htmlFor='fileInput' className='upload-label'>
                            <BackgroundMusicIcon />
                            <span>Upload tracks here...</span>
                        </label>
                    </div>
                )}
            </div>
        </div>
    );
};