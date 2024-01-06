import { useState, useEffect } from "react";
import { BanjoIcon, HeadphonesIcon, HostIcon, MicrophoneIcon, SaxophoneIcon, ViolinIcon } from "/components/Icons/Icons";

export const MusicianType = ({ setMusicType, musicianExtraInfo }) => {
    
    const [selectedOption, setSelectedOption] = useState(musicianExtraInfo && musicianExtraInfo.musicType ? musicianExtraInfo.musicType : '');

    useEffect(() => {
        setMusicType(selectedOption);
    }, [selectedOption])

    const handleOptionChange = (e) => {
        setSelectedOption(e.target.value);
    };

    return (
        <div className='music-type-inputs'>
            <div className='form'>
                <div className="radio-options">
                    <label htmlFor="covers" className={`labels ${selectedOption === 'Covers' ? 'clicked' : ''}`}>
                        <input 
                            type="radio"
                            id='covers'
                            value="Covers"
                            checked={selectedOption === 'Covers'}
                            onChange={handleOptionChange}
                        />
                        Covers
                    </label>
                    <label htmlFor="originals" className={`labels ${selectedOption === 'Originals' ? 'clicked' : ''}`}>
                        <input 
                            type="radio"
                            id='originals'
                            value="Originals"
                            checked={selectedOption === 'Originals'}
                            onChange={handleOptionChange}
                        />
                        Originals
                    </label>
                    <label htmlFor="both" className={`labels ${selectedOption === 'Both' ? 'clicked' : ''}`}>
                        <input 
                            type="radio"
                            id='both'
                            value="Both"
                            checked={selectedOption === 'Both'}
                            onChange={handleOptionChange}
                        />
                        Both
                    </label>
                </div>
            </div>
        </div>
    );
};

export const MusicianGenres = ({ setGenres, musicianExtraInfo }) => {
    
    const [selectedGenres, setSelectedGenres] = useState(musicianExtraInfo && musicianExtraInfo.genres ? musicianExtraInfo.genres : []);

    const handleCardClick = (genre) => {
        const updatedGenres = [...selectedGenres];
        const index = updatedGenres.findIndex(item => item === genre);

        if (index === -1) {
            updatedGenres.push(genre);
        } else {
            updatedGenres.splice(index, 1);
        }

        setSelectedGenres(updatedGenres);
    }
    
    useEffect(() => {
        setGenres(selectedGenres);
    }, [selectedGenres]);

    return (
        <div className="options">
            <div 
                className={`card ${selectedGenres.includes('Pop') && 'active'}`}
                onClick={() => handleCardClick('Pop')}
            >   
                <MicrophoneIcon />
                <h2 className="text">Pop</h2>
            </div>
            <div 
                className={`card ${selectedGenres.includes('Folk') && 'active'}`}
                onClick={() => handleCardClick('Folk')}
            >
                <BanjoIcon />
                <h2 className="text">Folk</h2>
            </div>
            <div 
                className={`card ${selectedGenres.includes('Jazz') && 'active'}`}
                onClick={() => handleCardClick('Jazz')}
            >
                <SaxophoneIcon />
                <h2 className="text">Jazz</h2>
            </div>
            <div 
                className={`card ${selectedGenres.includes('Classical') && 'active'}`}
                onClick={() => handleCardClick('Classical')}
            >
                <ViolinIcon />
                <h2 className="text">Classical</h2>
            </div>
            <div 
                className={`card ${selectedGenres.includes('Soul') && 'active'}`}
                onClick={() => handleCardClick('Soul')}
            >
                <HeadphonesIcon />
                <h2 className="text">Soul</h2>
            </div>
            <div 
                className={`card ${selectedGenres.includes('House') && 'active'}`}
                onClick={() => handleCardClick('House')}
            >
                <HostIcon />
                <h2 className="text">House</h2>
            </div>
        </div>
    );
};



export const MusicianBio = ({ setBio, musicianExtraInfo }) => {

    const [enteredText, setEnteredText] = useState(musicianExtraInfo && musicianExtraInfo.bio ? musicianExtraInfo.bio : '');

    useEffect(() => {
        setBio(enteredText);
    }, [enteredText])

    const handleTextChange = (e) => {
        setEnteredText(e.target.value);
    }

    return (
        <div className='musician-bio'>
            <div className="details">
                <textarea 
                    name="musician-bio" 
                    id="musician-bio" 
                    cols="100" 
                    rows="10"
                    placeholder='E.g. The sort of music you like to play, how adaptable you are to play requested songs etc.'
                    value={enteredText}
                    onChange={handleTextChange}
                >
                </textarea>
            </div>
        </div>
    );
};