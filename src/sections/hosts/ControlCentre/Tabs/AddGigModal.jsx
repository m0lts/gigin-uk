import { useState } from 'react';

export const AddGigModal = ({ addGigModal, setAddGigModal }) => {

    // Modal functions
    const closeModal = () => {
        setAddGigModal(false);
    };
    const handleContentClick = (event) => {
        event.stopPropagation();
    };

    // Form related states
    const [gigData, setGigData] = useState({
        venue: '',
        date: '',
        time: '',
        performers: [''],
        genres: [],
        description: '',
        links: [''],
    });

    // Form related functions
    const genres = ["Rock", "Pop", "Jazz", "Blues", "Hip Hop", "Electronic", "Folk"];
    const handleGenreToggle = (genre) => {
        const updatedGenres = [...gigData.genres];
        if (updatedGenres.includes(genre)) {
            // If genre is already selected, remove it
            updatedGenres.splice(updatedGenres.indexOf(genre), 1);
        } else {
            // If genre is not selected, add it
            updatedGenres.push(genre);
        }
        setGigData({ ...gigData, genres: updatedGenres });
    };

    const handlePerformersChange = (e, index) => {
        const { value } = e.target;
        const updatedPerformers = [...gigData.performers];
        updatedPerformers[index] = value;
        setGigData({ ...gigData, performers: updatedPerformers });
    };

    const handleLinksChange = (e, index) => {
        const { value } = e.target;
        const updatedLinks = [...gigData.links];
        updatedLinks[index] = value;
        setGigData({ ...gigData, links: updatedLinks });
    };

    const handleAddMore = (field) => {
        const updatedData = { ...gigData };
        updatedData[field].push("");
        setGigData(updatedData);
    };

    const handleGigSubmission = () => {
        console.log(gigData);
    }
    
console.log(gigData);
    return (
        <div className={`modal add-gig-modal ${addGigModal ? 'show' : ''}`} onClick={closeModal}>
            <div className="modal-content" onClick={handleContentClick}>
                <div className="modal-head">
                    <h3 className="title">Create a Gig</h3>
                </div>
                <div className="modal-body">
                    <div className="input-group">
                        <label htmlFor="venue">Select a Venue</label>
                        <select name="venue" id="venue" onChange={(e) => setGigData({ ...gigData, venue: e.target.value })}>
                            <option value="" disabled selected>---</option>
                            <option value="1">The Old Blue Last</option>
                            <option value="2">The Old Blue Last</option>
                            <option value="3">The Old Blue Last</option>
                            <option value="4">The Old Blue Last</option>
                        </select>
                    </div>
                    <div className="input-group">
                        <label htmlFor="date">Date</label>
                        <input type="date" name="date" id="date" onChange={(e) => setGigData({ ...gigData, date: e.target.value })} />
                    </div>
                    <div className="input-group">
                        <label htmlFor="time">Time</label>
                        <input type="time" name="time" id="time" onChange={(e) => setGigData({ ...gigData, time: e.target.value })} />
                    </div>
                    <div className="input-group">
                        <label>Artist(s) Performing</label>
                        {gigData.performers.map((performer, index) => (
                            <div key={index}>
                                <input
                                    type="text"
                                    value={performer}
                                    onChange={(e) => handlePerformersChange(e, index)}
                                />
                            </div>
                        ))}
                        <div className="add-more-button" onClick={() => handleAddMore("performers")}>
                            <p>Add More</p>
                        </div>
                    </div>
                    <div className="input-group">
                        <label>Genre(s)</label>
                        <div className="checkboxes">
                            {genres.map((genre, index) => (
                                <div key={index} className='checkbox'>
                                    <input
                                        type="checkbox"
                                        className="checkbox-input"
                                        id={`genre_${index}`}
                                        checked={gigData.genres.includes(genre)}
                                        onChange={() => handleGenreToggle(genre)}
                                    />
                                    <label htmlFor={`genre_${index}`} className={`${gigData.genres.includes(genre) ? 'active' : ''}`}>{genre}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="input-group">
                        <label>External Links</label>
                        {gigData.links.map((link, index) => (
                            <div key={index}>
                                <input
                                    type="text"
                                    value={link}
                                    onChange={(e) => handleLinksChange(e, index)}
                                />
                            </div>
                        ))}
                        <div className="add-more-button" onClick={() => handleAddMore("links")}>
                            <p>Add More</p>
                        </div>                
                    </div>
                    <div className="input-group">
                        <label htmlFor="description">Description</label>
                        <textarea name="description" id="description" rows="5" onChange={(e) => setGigData({ ...gigData, description: e.target.value })}></textarea>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-border" onClick={() => setAddGigModal(false)}>Cancel</button>
                    <button className="btn btn-black" onClick={handleGigSubmission}>Add Gig</button>
                </div>
            </div>
        </div>
    )
}