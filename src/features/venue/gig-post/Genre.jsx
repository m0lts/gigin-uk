import { useState, useEffect } from 'react';

export const GigGenre = ({ formData, handleInputChange }) => {
    
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

    return (
        <>
            <div className='head'>
                <h1 className='title'>What genre would you like?</h1>
                <p className='text'>Select all that apply.</p>
            </div>
            <div className='body genre'>
                <div className='toggle-container'>
                    <label htmlFor='no-specifics'>Flexible, no specifics</label>
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
                {formData.gigType === 'Musician/Band' ? (
                    <div className='selections'>
                        <div className={`card small ${formData.genre.includes('Pop') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Pop')}>
                            <h4 className='text'>Pop</h4>
                        </div>
                        <div className={`card small ${formData.genre.includes('Rock') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Rock')}>
                            <h4 className='text'>Rock</h4>
                        </div>
                        <div className={`card small ${formData.genre.includes('Classical') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Classical')}>
                            <h4 className='text'>Classical</h4>
                        </div>
                        <div className={`card small ${formData.genre.includes('Jazz') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Jazz')}>
                            <h4 className='text'>Jazz</h4>
                        </div>
                        <div className={`card small ${formData.genre.includes('Folk') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Folk')}>
                            <h4 className='text'>Folk</h4>
                        </div>
                    </div>
                ) : (
                    <div className='selections'>
                        <div className={`card small ${formData.genre.includes('Club Classics') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Club Classics')}>
                            <h4 className='text'>Club Classics</h4>
                        </div>
                        <div className={`card small ${formData.genre.includes('House') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('House')}>
                            <h4 className='text'>House</h4>
                        </div>
                        <div className={`card small ${formData.genre.includes('New Hits') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('New Hits')}>
                            <h4 className='text'>New Hits</h4>
                        </div>
                        <div className={`card small ${formData.genre.includes('Hip-Hop & RnB') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Hip-Hop & RnB')}>
                            <h4 className='text'>Hip-Hop & RnB</h4>
                        </div>
                        <div className={`card small ${formData.genre.includes('Funk & Soul') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Funk & Soul')}>
                            <h4 className='text'>Funk & Soul</h4>
                        </div>
                        <div className={`card small ${formData.genre.includes('Disco') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Disco')}>
                            <h4 className='text'>Disco</h4>
                        </div>
                        <div className={`card small ${formData.genre.includes('Drum & Bass') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Drum & Bass')}>
                            <h4 className='text'>Drum & Bass</h4>
                        </div>
                        <div className={`card small ${formData.genre.includes('Jungle') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Jungle')}>
                            <h4 className='text'>Jungle</h4>
                        </div>
                        <div className={`card small ${formData.genre.includes('Rock') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Rock')}>
                            <h4 className='text'>Rock</h4>
                        </div>
                        <div className={`card small ${formData.genre.includes('Chillout/Lounge') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Chillout/Lounge')}>
                            <h4 className='text'>Chillout/Lounge</h4>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};