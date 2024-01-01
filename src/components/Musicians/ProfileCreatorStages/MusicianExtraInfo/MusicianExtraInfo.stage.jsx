import { useState, useEffect } from 'react';
import { MusicianType, MusicianBio, MusicianGenres } from './MusicianExtraInfo.inputs';

export const MusicianExtraInfo = ({ musicianExtraInfo, setMusicianExtraInfo }) => {

    const [genres, setGenres] = useState([]);
    const [musicType, setMusicType] = useState('');
    const [bio, setBio] = useState('');

    useEffect(() => {
        setMusicianExtraInfo((prevMusicianExtraInfo) => ({
            ...prevMusicianExtraInfo,
            genres: genres,
            musicType: musicType,
            bio: bio,
        }));
      }, [genres, musicType, bio])


    return (
        <div className='musician-info profile-creator-stage'>
            <h1 className='title'>Let's find out more about what makes you tick.</h1>
            <div className="sections">
                <div className='music-type'>
                    <p className="text">What type of music do you prefer to play?</p>
                    <MusicianType 
                        setMusicType={setMusicType} 
                        musicianExtraInfo={musicianExtraInfo}
                    />
                </div>
                <div className='musician-genres'>
                    <p className="text">What genres do you play?</p>
                    <MusicianGenres 
                        setGenres={setGenres}
                        musicianExtraInfo={musicianExtraInfo}
                    />
                </div>
                <div className='musician-bio'>
                    <p className="text">Tell us more about you.</p>
                    <MusicianBio 
                        setBio={setBio}
                        musicianExtraInfo={musicianExtraInfo}
                    />
                </div>
            </div>
        </div>
    )
}