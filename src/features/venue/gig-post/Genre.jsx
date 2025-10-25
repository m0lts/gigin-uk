import { useState, useEffect } from 'react';

export const GigGenre = ({ formData, handleInputChange, error }) => {
    
    const [selectedGenre, setSelectedGenre] = useState(formData.genre || []);

    const handleGenreSelect = (value) => {
        if (formData.noMusicPreference === true) return;
        const newSelectedGenre = selectedGenre.includes(value)
            ? selectedGenre.filter((genre) => genre !== value)
            : [...selectedGenre, value];
        setSelectedGenre(newSelectedGenre);
        handleInputChange({
            genre: newSelectedGenre,
        });
    };

    const handleCheckboxChange = (e) => {
        const isChecked = e.target.checked;
        handleInputChange({
            noMusicPreference: isChecked,
            genre: isChecked ? [] : selectedGenre,
        });
        if (isChecked) {
            setSelectedGenre([]);
        }
    };

    useEffect(() => {
        if (formData.noMusicPreference === true) {
            setSelectedGenre([]);
        }
    }, [formData.noMusicPreference]);

    const genresToShow = ['Pop', 'Soul', 'Rock', 'Jazz', 'Classical', 'Choral', 'Indie', 'Alternative', 'Singer-Songwriter', 'Folk', 'Blues', 'R&B', 'Funk', 'Electronic/Dance', 'House', 'Drill', 'Hip-Hop', 'Rap', 'Country', 'World', 'Latin']

    const handleExtraInfoChange = (info) => {
        handleInputChange({
            extraInformation: info,
        })
    }

    return (
        <>
            <div className='head'>
                <h1 className='title'>Gig Details</h1>
                <p className='text'>Select a genre for the gig if you'd like. Add any extra description.</p>
            </div>
            <div className='body genre'>
                <div className='toggle-container'>
                    <label htmlFor='no-specifics'>No specific genre</label>
                    <label className='switch'>
                        <input
                            type='checkbox'
                            id='no-specifics'
                            checked={formData.noMusicPreference}
                            onChange={handleCheckboxChange}
                            />
                        <span className='slider round'></span>
                    </label>
                </div>
                {!formData.noMusicPreference && (
                    <div className='selections'>
                        {genresToShow.map((genre, index) => (
                            <div key={index} className={`card small ${formData.genre.includes(genre) ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect(genre)}>
                                <h4 className='text'>{genre}</h4>
                            </div>
                        ))}
                    </div>
                )}
                <div className="extra-details">
                    <h6>Add any extra details on what kind of experience you’re after</h6>
                    <div className='input-group'>
                        <textarea 
                            name='extraInformation' 
                            id='extraInformation' 
                            onChange={(e) => handleExtraInfoChange(e.target.value)}
                            value={formData.extraInformation}
                            placeholder="We love 80's pop covers..."
                            maxLength={250}
                        ></textarea>
                    </div>
                </div>
                {error && (
                    <div className="error-cont" style={{ width: 'fit-content', margin: '0.5rem auto' }}>
                        <p className="error-message">{error}</p>
                    </div>
                )}
            </div>
        </>
    );
};