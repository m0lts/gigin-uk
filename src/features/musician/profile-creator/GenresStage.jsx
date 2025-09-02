import { useState, useEffect, useRef } from 'react';

export const GenresStage = ({ data, onChange, musicianType, band = false }) => {
    const [inputValue, setInputValue] = useState('');
    const [filteredGenres, setFilteredGenres] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const dropdownRef = useRef(null);

    const genres = {
        'Musician': [
            'Rock', 'Alternative Rock', 'Classic Rock', 'Indie Rock', 'Punk Rock', 'Hard Rock', 'Soft Rock', 'Progressive Rock',
            'Pop', 'Dance Pop', 'Teen Pop', 'Synth-pop', 'Indie Pop',
            'Jazz', 'Smooth Jazz', 'Bebop', 'Swing', 'Cool Jazz', 'Jazz Fusion', 'Free Jazz',
            'Classical', 'Baroque', 'Romantic', 'Contemporary Classical', 'Chamber Music', 'Opera', 'Symphonic',
            'Hip Hop', 'Rap', 'Trap', 'Boom Bap', 'Conscious Hip Hop', 'Gangsta Rap',
            'Country', 'Traditional Country', 'Country Rock', 'Bluegrass', 'Country Pop', 'Americana',
            'Blues', 'Delta Blues', 'Chicago Blues', 'Electric Blues', 'Blues Rock',
            'Reggae', 'Dancehall', 'Dub', 'Ska',
            'Folk', 'Contemporary Folk', 'Traditional Folk', 'Folk Rock', 'Folk Pop',
            'Metal', 'Heavy Metal', 'Thrash Metal', 'Death Metal', 'Black Metal', 'Power Metal', 'Progressive Metal',
            'R&B', 'Soul', 'Neo-Soul', 'Funk', 'Contemporary R&B',
            'Latin', 'Salsa', 'Bachata', 'Merengue', 'Reggaeton', 'Latin Pop',
            'World', 'Afrobeat', 'Bhangra', 'Celtic', 'K-pop', 'J-pop',
            'Electronic', 'Synthwave', 'Electro Pop'
        ],
        'Band': [
            'Rock', 'Alternative Rock', 'Classic Rock', 'Indie Rock', 'Punk Rock', 'Hard Rock', 'Soft Rock', 'Progressive Rock',
            'Pop', 'Dance Pop', 'Teen Pop', 'Synth-pop', 'Indie Pop',
            'Jazz', 'Smooth Jazz', 'Bebop', 'Swing', 'Cool Jazz', 'Jazz Fusion', 'Free Jazz',
            'Classical', 'Baroque', 'Romantic', 'Contemporary Classical', 'Chamber Music', 'Opera', 'Symphonic',
            'Hip Hop', 'Rap', 'Trap', 'Boom Bap', 'Conscious Hip Hop', 'Gangsta Rap',
            'Country', 'Traditional Country', 'Country Rock', 'Bluegrass', 'Country Pop', 'Americana',
            'Blues', 'Delta Blues', 'Chicago Blues', 'Electric Blues', 'Blues Rock',
            'Reggae', 'Dancehall', 'Dub', 'Ska',
            'Folk', 'Contemporary Folk', 'Traditional Folk', 'Folk Rock', 'Folk Pop',
            'Metal', 'Heavy Metal', 'Thrash Metal', 'Death Metal', 'Black Metal', 'Power Metal', 'Progressive Metal',
            'R&B', 'Soul', 'Neo-Soul', 'Funk', 'Contemporary R&B',
            'Latin', 'Salsa', 'Bachata', 'Merengue', 'Reggaeton', 'Latin Pop',
            'World', 'Afrobeat', 'Bhangra', 'Celtic', 'K-pop', 'J-pop',
            'Electronic', 'Synthwave', 'Electro Pop'
        ],
        DJ: [
            'Electronic Dance Music (EDM)', 'House', 'Deep House', 'Tech House', 'Progressive House',
            'Techno', 'Minimal Techno', 'Detroit Techno',
            'Trance', 'Progressive Trance', 'Psytrance',
            'Drum and Bass', 'Liquid Drum and Bass', 'Neurofunk',
            'Dubstep', 'Brostep', 'Chillstep',
            'Trap', 'Festival Trap', 'Chill Trap',
            'Hip Hop', 'Turntablism', 'Rap', 'Trap',
            'R&B', 'Contemporary R&B', 'Neo-Soul',
            'Pop', 'Dance Pop', 'Synth-pop',
            'Reggae', 'Dancehall', 'Dub',
            'Latin', 'Reggaeton', 'Latin House', 'Moombahton',
            'World', 'Afro House', 'K-pop', 'Bollywood',
            'Ambient', 'Chillout', 'Downtempo', 'Ambient House',
            'Experimental', 'Glitch', 'IDM (Intelligent Dance Music)',
            'Funk', 'Disco', 'Nu-Disco', 'Funky House'
        ]
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputValue(value);

        if (value.length > 0) {
            const allGenres = genres[musicianType];
            const filtered = allGenres.filter(genre =>
                genre.toLowerCase().includes(value.toLowerCase())
            );
            setFilteredGenres(filtered);
            setShowSuggestions(true);
        } else {
            setFilteredGenres([]);
            setShowSuggestions(false);
        }
    };

    const handleGenreClick = (genre) => {
        if (!data.includes(genre)) {
            onChange('genres', [...data, genre]);
        }
        setShowSuggestions(false);
        setInputValue('');
    };

    const handleRemoveTag = (genre) => {
        onChange('genres', data.filter(item => item !== genre));
    };

    return (
        <div className='stage genres'>
            <h3 className='section-title'>Music</h3>
            <div className='body'>
                {band ? (
                    <div className='title-container'>
                        <h1>What genres does your band play?</h1>
                        <h5>Select as many as you can, these help us match you with gigs.</h5>
                    </div>
                ) : (
                    <div className='title-container'>
                        <h1>What genres do you play?</h1>
                        <h5>Select as many as you can, these help us match you with gigs.</h5>
                    </div>
                )}
                <div className='genre-selections-container' ref={dropdownRef}>
                    <input
                        className='input'
                        type='text'
                        value={inputValue}
                        onChange={handleInputChange}
                        placeholder='Type to search genres'
                    />
                    {showSuggestions && inputValue && filteredGenres.length > 0 && (
                        <div className='genre-suggestions'>
                            {filteredGenres.map((genre, index) => (
                                <div key={index} className='genre-option' onClick={() => handleGenreClick(genre)}>
                                    {genre}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className='selected-genres'>
                    {data.map((genre, index) => (
                        <div key={index} className='genre-tag' onClick={() => handleRemoveTag(genre)}>
                            {genre}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};