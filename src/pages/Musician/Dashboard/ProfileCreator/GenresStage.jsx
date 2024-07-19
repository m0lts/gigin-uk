import { useState } from "react";

export const GenresStage = ({ data, onChange, musicianType }) => {
    const [inputValue, setInputValue] = useState('');
    const [filteredGenres, setFilteredGenres] = useState([]);

    const genres = {
        Musician: [
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
            'Hip Hop', 'Turntablism', 'Hip Hop', 'Rap', 'Trap',
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

    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputValue(value);

        if (value.length > 0) {
            const allGenres = genres[musicianType];
            const filtered = allGenres.filter(genre =>
                genre.toLowerCase().includes(value.toLowerCase())
            );
            setFilteredGenres(filtered);
        } else {
            setFilteredGenres([]);
        }
    };

    const handleGenreClick = (genre) => {
        if (!data.includes(genre)) {
            onChange('genres', [...data, genre]);
        }
    };

    const handleRemoveTag = (genre) => {
        onChange('genres', data.filter(item => item !== genre));
    };

    return (
        <div className="stage">
            <h2>Stage 5: Genres</h2>
            <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="Type to search genres"
            />
            {inputValue && filteredGenres.length > 0 && (
                <div className="genre-suggestions">
                    {filteredGenres.map((genre, index) => (
                        <div key={index} className="genre-option" onClick={() => handleGenreClick(genre)}>
                            {genre}
                        </div>
                    ))}
                </div>
            )}
            <div className="selected-genres">
                {data.map((genre, index) => (
                    <div key={index} className="genre-tag">
                        {genre} <button onClick={() => handleRemoveTag(genre)}>x</button>
                    </div>
                ))}
            </div>
        </div>
    );
};