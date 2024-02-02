// Icons and effects
    import { MicrophoneIcon, BanjoIcon, SaxophoneIcon, ViolinIcon, HeadphonesIcon, HostIcon, BandIcon, MicrophoneStandIcon, MixingDeckIcon } from "/components/Icons/Icons"

// Styles
    import './gig-details.inputs.styles.css'


export const MusicianTypeInput = ({ setMusicianType, gigDetails }) => {
    const handleCardClick = (type) => {
        const currentMusicianType = gigDetails.musicianType || [];
        const updatedMusicianType = currentMusicianType.includes(type)
            ? currentMusicianType.filter((item) => item !== type)
            : [...currentMusicianType, type];

        setMusicianType(updatedMusicianType);
    };

    return (
        <div className="genres field">
            <h3 className="subtitle">Click the type of musician(s) you would like. *</h3>
            <div className="options">
                <div
                    className={`card ${gigDetails.musicianType?.includes('Band') && 'active'}`}
                    onClick={() => handleCardClick('Band')}
                >
                    <BandIcon />
                    <h2 className="text">Band</h2>
                </div>
                <div
                    className={`card ${gigDetails.musicianType?.includes('Solo Artist') && 'active'}`}
                    onClick={() => handleCardClick('Solo Artist')}
                >
                    <MicrophoneStandIcon />
                    <h2 className="text">Solo Artist</h2>
                </div>
                <div
                    className={`card ${gigDetails.musicianType?.includes('DJ') && 'active'}`}
                    onClick={() => handleCardClick('DJ')}
                >
                    <MixingDeckIcon />
                    <h2 className="text">DJ</h2>
                </div>
            </div>
        </div>
    );
};

export const MusicTypeInput = ({ setMusicType, gigDetails }) => {
    const handleOptionChange = (e) => {
        const selectedOption = e.target.value;
        setMusicType(selectedOption);
    };

    return (
        <div className='music-type field'>
            <h3 className="subtitle">What type of music are you looking for? *</h3>
            <div className="radio-options">
                <label htmlFor="covers" className={`labels ${gigDetails.musicType === 'Covers' ? 'clicked' : ''}`}>
                    <input 
                        type="radio"
                        id='covers'
                        value="Covers"
                        checked={gigDetails.musicType === 'Covers'}
                        onChange={handleOptionChange}
                    />
                    Covers
                </label>
                <label htmlFor="originals" className={`labels ${gigDetails.musicType === 'Originals' ? 'clicked' : ''}`}>
                    <input 
                        type="radio"
                        id='originals'
                        value="Originals"
                        checked={gigDetails.musicType === 'Originals'}
                        onChange={handleOptionChange}
                    />
                    Originals
                </label>
                <label htmlFor="both" className={`labels ${gigDetails.musicType === 'Both' ? 'clicked' : ''}`}>
                    <input 
                        type="radio"
                        id='both'
                        value="Both"
                        checked={gigDetails.musicType === 'Both'}
                        onChange={handleOptionChange}
                    />
                    Both
                </label>
            </div>
        </div>
    );
};


export const GenresInput = ({ genres, setGenres, gigDetails }) => {

    const handleCardClick = (genre) => {
        const currentGenres = gigDetails.genres || [];
        const updatedGenres = currentGenres.includes(genre)
            ? currentGenres.filter((item) => item !== genre)
            : [...currentGenres, genre];

        setGenres(updatedGenres);
    }

    return (
        <div className="genres field">
            <h3 className="subtitle">What genres are you looking for? *</h3>
            <div className="options">
                <div 
                    className={`card ${gigDetails.genres?.includes('Pop') && 'active'}`}
                    onClick={() => handleCardClick('Pop')}
                >   
                    <MicrophoneIcon />
                    <h2 className="text">Pop</h2>
                </div>
                <div 
                    className={`card ${gigDetails.genres?.includes('Folk') && 'active'}`}
                    onClick={() => handleCardClick('Folk')}
                >
                    <BanjoIcon />
                    <h2 className="text">Folk</h2>
                </div>
                <div 
                    className={`card ${gigDetails.genres?.includes('Jazz') && 'active'}`}
                    onClick={() => handleCardClick('Jazz')}
                >
                    <SaxophoneIcon />
                    <h2 className="text">Jazz</h2>
                </div>
                <div 
                    className={`card ${gigDetails.genres?.includes('Classical') && 'active'}`}
                    onClick={() => handleCardClick('Classical')}
                >
                    <ViolinIcon />
                    <h2 className="text">Classical</h2>
                </div>
                <div 
                    className={`card ${gigDetails.genres?.includes('Soul') && 'active'}`}
                    onClick={() => handleCardClick('Soul')}
                >
                    <HeadphonesIcon />
                    <h2 className="text">Soul</h2>
                </div>
                <div 
                    className={`card ${gigDetails.genres?.includes('House') && 'active'}`}
                    onClick={() => handleCardClick('House')}
                >
                    <HostIcon />
                    <h2 className="text">House</h2>
                </div>
            </div>
        </div>
    )
}

export const GigStartTimeInput = ({ setGigStartTime, gigDetails }) => {
    return (
        <div className="gig-start-time field">
            <h3 className="subtitle">What time will the gig start? *</h3>
            <input 
                type="time" 
                className="time-input"
                value={gigDetails.gigStartTime || ''}
                onChange={(e) => setGigStartTime(e.target.value)}
            />
        </div>
    )
}

export const GigDurationInput = ({ setGigDuration, gigDetails }) => {
    return (
        <div className="gig-duration field">
            <h3 className="subtitle">How long will the gig be? *</h3>
            <input 
                type="time" 
                className="time-input"
                value={gigDetails.gigDuration || ''}
                onChange={(e) => setGigDuration(e.target.value)}
            />
        </div>
    )
}

export const MusicianArrivalTimeInput = ({ setMusicianArrivalTime, gigDetails }) => {
    return (
        <div className="musician-arrival-time field">
            <h3 className="subtitle">What time should the musician(s) arrive?</h3>
            <input
                type="time"
                className="time-input"
                value={gigDetails.musicianArrivalTime || ''}
                onChange={(e) => setMusicianArrivalTime(e.target.value)}
            />
        </div>
    )
}
export const GigFeeInput = ({ setGigFee, gigDetails }) => {
    return (
        <div className="gig-fee field">
            <h3 className="subtitle">Gig Fee: *</h3>
            <div className="input-cont">
                <label htmlFor="gig-fee" className="text">£</label>
                <input
                    type="number"
                    className="input"
                    value={gigDetails.gigFee || ''}
                    placeholder="e.g. 100"
                    onChange={(e) => setGigFee(e.target.value)}
                />
            </div>
        </div>
    )
}

export const GigExtraInformation = ({ setExtraInformation, gigDetails }) => {
    return (
        <div className="gig-extra-information field">
            <h3 className="subtitle">Add any extra information necessary below.</h3>
            <textarea 
                name="gig-extra-information" 
                id="gig-extra-information" 
                cols="30" 
                rows="10"
                value={gigDetails.extraInformation || ''}
                onChange={(e) => setExtraInformation(e.target.value)}
            ></textarea>
        </div>
    )
}