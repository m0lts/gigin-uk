import { useState, useEffect } from "react";
import { ClubIcon, MicrophoneIcon } from "../../../../components/ui/Icons/Icons";

export const GigGenre = ({ formData, handleInputChange }) => {
    
    const [selectedGenre, setSelectedGenre] = useState(formData.genre || []);
    const [selectedMusicType, setSelectedMusicType] = useState(formData.musicType || '');

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

    const handleMusicTypeSelect = (value) => {
        if (formData.noMusicPreference === true) return;
        setSelectedMusicType(value);
        handleInputChange({
            musicType: value,
        });
    };

    const handleCheckboxChange = (e) => {
        const isChecked = e.target.checked;
        handleInputChange({
            noMusicPreference: isChecked,
            genre: isChecked ? [] : selectedGenre,
            musicType: isChecked ? '' : selectedMusicType,
        });
        if (isChecked) {
            setSelectedMusicType('');
            setSelectedGenre([]);
        }
    };

    useEffect(() => {
        if (formData.noMusicPreference === true) {
            setSelectedMusicType('');
            setSelectedGenre([]);
        }
    }, [formData.noMusicPreference]);

    return (
        <>
            {formData.gigType === 'Live Music' ? (
                <>
                    <div className="head">
                        <h1 className="title">Let's get specific.</h1>
                        <p className="text">Select all that apply.</p>
                    </div>
                    <div className="body genre">
                        <div className="toggle-container">
                            <label htmlFor="no-specifics">Flexible, no specifics</label>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    id="no-specifics"
                                    checked={formData.noMusicPreference}
                                    onChange={handleCheckboxChange}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>
                        <div className="group">
                            <h5 className="label">Genre(s)</h5>
                            <div className="selections">
                                <div className={`card ${formData.genre.includes('Pop') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Pop')}>
                                    <MicrophoneIcon />
                                    <h4 className="text">Pop</h4>
                                </div>
                                <div className={`card ${formData.genre.includes('Rock') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Rock')}>
                                    <ClubIcon />
                                    <h4 className="text">Rock</h4>
                                </div>
                                <div className={`card ${formData.genre.includes('Classical') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Classical')}>
                                    <ClubIcon />
                                    <h4 className="text">Classical</h4>
                                </div>
                                <div className={`card ${formData.genre.includes('Jazz') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Jazz')}>
                                    <ClubIcon />
                                    <h4 className="text">Jazz</h4>
                                </div>
                                <div className={`card ${formData.genre.includes('Folk') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Folk')}>
                                    <ClubIcon />
                                    <h4 className="text">Folk</h4>
                                </div>
                            </div>
                        </div>
                        <div className="group">
                            <h5 className="label">Type</h5>
                            <div className="selections">
                                <div className={`card ${formData.musicType === 'Covers' ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleMusicTypeSelect('Covers')}>
                                    <MicrophoneIcon />
                                    <h4 className="text">Covers</h4>
                                </div>
                                <div className={`card ${formData.musicType === 'Originals' ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleMusicTypeSelect('Originals')}>
                                    <ClubIcon />
                                    <h4 className="text">Originals</h4>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : formData.gigType === 'DJ' && (
                <>
                    <div className="head">
                        <h1 className="title">Let's get specific.</h1>
                        <p className="text">Select all that apply.</p>
                    </div>
                    <div className="body genre">
                        <div className="toggle-container">
                            <label htmlFor="no-specifics">Flexible, no specifics</label>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    id="no-specifics"
                                    checked={formData.noMusicPreference}
                                    onChange={handleCheckboxChange}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>
                        <div className="selections">
                            <div className={`card ${formData.genre.includes('Club Classics') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Club Classics')}>
                                <MicrophoneIcon />
                                <h4 className="text">Club Classics</h4>
                            </div>
                            <div className={`card ${formData.genre.includes('House') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('House')}>
                                <ClubIcon />
                                <h4 className="text">House</h4>
                            </div>
                            <div className={`card ${formData.genre.includes('New Hits') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('New Hits')}>
                                <ClubIcon />
                                <h4 className="text">New Hits</h4>
                            </div>
                            <div className={`card ${formData.genre.includes('Hip-Hop & RnB') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Hip-Hop & RnB')}>
                                <ClubIcon />
                                <h4 className="text">Hip-Hop & RnB</h4>
                            </div>
                            <div className={`card ${formData.genre.includes('Funk & Soul') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Funk & Soul')}>
                                <ClubIcon />
                                <h4 className="text">Funk & Soul</h4>
                            </div>
                            <div className={`card ${formData.genre.includes('Disco') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Disco')}>
                                <ClubIcon />
                                <h4 className="text">Disco</h4>
                            </div>
                            <div className={`card ${formData.genre.includes('Drum & Bass') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Drum & Bass')}>
                                <ClubIcon />
                                <h4 className="text">Drum & Bass</h4>
                            </div>
                            <div className={`card ${formData.genre.includes('Jungle') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Jungle')}>
                                <ClubIcon />
                                <h4 className="text">Jungle</h4>
                            </div>
                            <div className={`card ${formData.genre.includes('Rock') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Rock')}>
                                <ClubIcon />
                                <h4 className="text">Rock</h4>
                            </div>
                            <div className={`card ${formData.genre.includes('Chillout/Lounge') ? 'selected' : ''} ${formData.noMusicPreference === true && 'disabled'}`} onClick={() => handleGenreSelect('Chillout/Lounge')}>
                                <ClubIcon />
                                <h4 className="text">Chillout/Lounge</h4>
                            </div>

                        </div>
                    </div>
                </>
            )}
        </>
    );
};