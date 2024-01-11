import { useState, useEffect } from "react"
import { MicrophoneIcon, BanjoIcon, SaxophoneIcon, ViolinIcon, HeadphonesIcon, HostIcon, BandIcon, MicrophoneStandIcon, MixingDeckIcon } from "/components/Icons/Icons"
import './gig-details.inputs.styles.css'

export const MusicianTypeInput = ({ musicianType, setMusicianType }) => {

    // Musician Type
    const [selectedType, setSelectedType] = useState(musicianType ? musicianType : []);

    const handleCardClick = (type) => {
        const updatedMusicianType = [...selectedType];
        const index = updatedMusicianType.findIndex(item => item === type);

        if (index === -1) {
            updatedMusicianType.push(type);
        } else {
            updatedMusicianType.splice(index, 1);
        }

        setSelectedType(updatedMusicianType);
    }

    useEffect(() => {
        setMusicianType(selectedType);
    }, [selectedType])

    return (
        <div className="genres field">
            <h3 className="subtitle">Click the type of musician(s) you would like. *</h3>
            <div className="options">
                <div 
                    className={`card ${selectedType.includes('Band') && 'active'}`}
                    onClick={() => handleCardClick('Band')}
                >   
                    <BandIcon />
                    <h2 className="text">Band</h2>
                </div>
                <div 
                    className={`card ${selectedType.includes('Solo Artist') && 'active'}`}
                    onClick={() => handleCardClick('Solo Artist')}
                >
                    <MicrophoneStandIcon />
                    <h2 className="text">Solo Artist</h2>
                </div>
                <div 
                    className={`card ${selectedType.includes('DJ') && 'active'}`}
                    onClick={() => handleCardClick('DJ')}
                >
                    <MixingDeckIcon />
                    <h2 className="text">DJ</h2>
                </div>
            </div>
        </div>
    )
}

export const MusicTypeInput = ({ musicType, setMusicType }) => {

    // Type of music
    const [selectedOption, setSelectedOption] = useState(musicType ? musicType : '');

    const handleOptionChange = (e) => {
        setSelectedOption(e.target.value);
    };

    useEffect(() => {
        setMusicType(selectedOption);
    }, [selectedOption])

    return (
        <div className='music-type field'>
            <h3 className="subtitle">What type of music are you looking for? *</h3>
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
    )
}

export const GenresInput = ({ genres, setGenres }) => {

    // Genres
    const [selectedGenres, setSelectedGenres] = useState(genres ? genres : []);

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
    }, [selectedGenres])

    return (
        <div className="genres field">
            <h3 className="subtitle">What genres are you looking for? *</h3>
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
        </div>
    )
}

export const GigStartTimeInput = ({ gigStartTime, setGigStartTime }) => {
    return (
        <div className="gig-start-time field">
            <h3 className="subtitle">What time will the gig start? *</h3>
            <input 
                type="time" 
                className="time-input"
                value={gigStartTime || ''}
                onChange={(e) => setGigStartTime(e.target.value)}
            />
        </div>
    )
}

export const GigDurationInput = ({ gigDuration, setGigDuration }) => {
    return (
        <div className="gig-duration field">
            <h3 className="subtitle">How long will the gig be? *</h3>
            <input 
                type="time" 
                className="time-input"
                value={gigDuration || ''}
                onChange={(e) => setGigDuration(e.target.value)}
            />
        </div>
    )
}

export const MusicianArrivalTimeInput = ({ musicianArrivalTime, setMusicianArrivalTime }) => {
    return (
        <div className="musician-arrival-time field">
            <h3 className="subtitle">What time should the musician arrive?</h3>
            <input
                type="time"
                className="time-input"
                value={musicianArrivalTime || ''}
                onChange={(e) => setMusicianArrivalTime(e.target.value)}
            />
        </div>
    )
}

export const GigExtraInformation = ({ extraInformation, setExtraInformation }) => {
    return (
        <div className="gig-extra-information field">
            <h3 className="subtitle">Add any extra information necessary below.</h3>
            <textarea 
                name="gig-extra-information" 
                id="gig-extra-information" 
                cols="30" 
                rows="10"
                value={extraInformation || ''}
                onChange={(e) => setExtraInformation(e.target.value)}
            ></textarea>
        </div>
    )
}