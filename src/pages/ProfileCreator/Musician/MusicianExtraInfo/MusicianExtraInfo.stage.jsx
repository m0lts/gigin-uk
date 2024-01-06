import { useState, useEffect } from 'react';
import { MusicianType, MusicianBio, MusicianGenres } from '/pages/ProfileCreator/Musician/MusicianExtraInfo/MusicianExtraInfo.inputs';

export const MusicianExtraInfo = ({ musicianExtraInfo, setMusicianExtraInfo, setNextButtonAvailable }) => {

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

    useEffect(() => {
    if (musicianExtraInfo && musicianExtraInfo.musicType && musicianExtraInfo.genres.length > 0) {
        setNextButtonAvailable(true);
    } else {
        setNextButtonAvailable(false);
    }
    }, [musicianExtraInfo]);


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