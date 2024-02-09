import { useState, useCallback } from "react";
import { AddressAutofill } from "@mapbox/search-js-react";
import { queryDatabase } from "/utils/queryDatabase";

export const AddEventModal = ({ showModal, setShowModal }) => {

    const [gigData, setGigData] = useState({
        gigName: '',
        gigVenue: '',
        gigLocation: '',
        gigCoordinates: '',
        gigDate: '',
        gigTime: '',
        gigPerformers: [''],
        gigGenres: [],
        gigDescription: '',
        gigLinks: [''],
    });
    const [expandForm, setExpandForm] = useState(false);

    const userId = "12345";

    const handlePerformersChange = (e, index) => {
        const { value } = e.target;
        const updatedPerformers = [...gigData.gigPerformers];
        updatedPerformers[index] = value;
        setGigData({ ...gigData, gigPerformers: updatedPerformers });
    };

    const handleLinksChange = (e, index) => {
        const { value } = e.target;
        const updatedLinks = [...gigData.gigLinks];
        updatedLinks[index] = value;
        setGigData({ ...gigData, gigLinks: updatedLinks });
    };

    const handleAddMore = (field) => {
        const updatedData = { ...gigData };
        updatedData[field].push("");
        setGigData(updatedData);
    };

    const genres = ["Rock", "Pop", "Jazz", "Blues", "Hip Hop", "Electronic", "Folk"];
    const handleGenreToggle = (genre) => {
        const updatedGenres = [...gigData.gigGenres];
        if (updatedGenres.includes(genre)) {
            // If genre is already selected, remove it
            updatedGenres.splice(updatedGenres.indexOf(genre), 1);
        } else {
            // If genre is not selected, add it
            updatedGenres.push(genre);
        }
        setGigData({ ...gigData, gigGenres: updatedGenres });
    };

    const handleGigUpload = async (e) => {
        e.preventDefault();

        const dataPayload = {
            userId: userId,
            gigInformation: gigData
        };

        try {
            const response = await queryDatabase('/api/events/handleEventUpload.js', dataPayload); 
            if (response.ok) {
                setShowModal(false);
            } else {
                console.log('error');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    // Address autofill callback
    const handleRetrieve = useCallback(
        (res) => {
            const feature = res.features[0];
            const address = feature.properties.place_name;
            const coordinates = feature.geometry.coordinates;

            setGigData({ ...gigData, gigLocation: address, gigCoordinates: coordinates });
        },
        [setGigData]
    );

    return (
        <div className={`add-event-modal shadow ${showModal && 'open'}`}>
            <div className="heading">
                <h1>Add Gig</h1>
                <p>Tell us what's happening!</p>
            </div>
            <form onSubmit={handleGigUpload}>
            <div className="input-group">
                    <label htmlFor="gigName">Name of Gig *</label>
                    <input type="text" id="gigName" value={gigData.gigName} onChange={(e) => setGigData({ ...gigData, gigName: e.target.value })} />
                </div>
                <div className="input-group">
                    <label htmlFor="gigVenue">Name of Venue *</label>
                    <input type="text" id="gigVenue" value={gigData.gigVenue} onChange={(e) => setGigData({ ...gigData, gigVenue: e.target.value })} />
                </div>
                {!expandForm && (
                    <AddressAutofill accessToken="pk.eyJ1IjoiZ2lnaW4iLCJhIjoiY2xwNDQ2ajFwMWRuNzJxczZqNHlvbHg3ZCJ9.nR_HaL-dWRkUhOgBnmbyjg" onRetrieve={handleRetrieve}>
                        <div className="input-group">
                            <label htmlFor="autofill" className="label">Venue Address: *</label>
                            <input 
                                type="text"
                                name="autofill"
                                id="autofill"
                                placeholder="Start typing your address, e.g. 72 High Street..."
                            />
                        </div>
                    </AddressAutofill>
                )}
                {/* <div className="manual-entry-option" onClick={() => setExpandForm(!expandForm)}>
                    {expandForm ? (
                        <p>Hide manual entry</p>
                    ) : (
                        <p>Enter address manually</p>
                    )}
                </div>
                <div className="manual-entry-form" style={{ display: expandForm ? 'block' : 'none' }}>
                    <div className="input-group">
                        <label htmlFor="address1" className="label">Address Line 1:</label>
                        <input 
                            className="input"
                            type="text"
                            name="address1"
                            placeholder="Address Line 1"
                            autoComplete="address-line1"
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="apartment" className="label">Apartment Number:</label>
                        <input 
                            className="input"
                            type="text"
                            name="apartment"
                            placeholder="Apartment Number"
                            autoComplete="address-line2"
                        />    
                    </div>
                    <div className="input-group">
                        <label htmlFor="city" className="label">City:</label>
                        <input 
                            className="input"
                            type="text"
                            name="city"
                            placeholder="City"
                            autoComplete="address-level2"
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="country" className="label">Country:</label>
                        <input 
                            className="input"
                            type="text"
                            name="country"
                            placeholder="Country"
                            autoComplete="country"
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="postcode" className="label">Post Code:</label>
                        <input 
                            className="input"
                            type="text"
                            name="postcode"
                            placeholder="Postcode"
                            autoComplete="postal-code"
                        />
                    </div>
                </div> */}
                <div className="input-group">
                    <label htmlFor="gigDate">Date *</label>
                    <input type="date" id="gigDate" value={gigData.gigDate} onChange={(e) => setGigData({ ...gigData, gigDate: e.target.value })} />
                </div>
                <div className="input-group">
                    <label htmlFor="gigTime">Time *</label>
                    <input type="time" id="gigTime" value={gigData.gigTime} onChange={(e) => setGigData({ ...gigData, gigTime: e.target.value })} />
                </div>
                <div className="input-group">
                    <label>Artist(s) Performing</label>
                    {gigData.gigPerformers.map((performer, index) => (
                        <div key={index}>
                            <input
                                type="text"
                                value={performer}
                                onChange={(e) => handlePerformersChange(e, index)}
                            />
                        </div>
                    ))}
                    <div className="manual-entry-option" onClick={() => handleAddMore("gigPerformers")}>
                        <p>Add More</p>
                    </div>
                </div>
                <div className="input-group">
                    <label>Genre(s)</label>
                    <div className="checkboxes">
                        {genres.map((genre, index) => (
                            <div key={index} className={`checkbox ${gigData.gigGenres.includes(genre) ? 'active' : ''}`}>
                                <input
                                    type="checkbox"
                                    className="checkbox-input"
                                    id={`genre_${index}`}
                                    checked={gigData.gigGenres.includes(genre)}
                                    onChange={() => handleGenreToggle(genre)}
                                />
                                <label htmlFor={`genre_${index}`}>{genre}</label>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="input-group">
                    <label htmlFor="gigDescription">Description</label>
                    <textarea id="gigDescription" value={gigData.gigDescription} onChange={(e) => setGigData({ ...gigData, gigDescription: e.target.value })}></textarea>
                </div>
                <div className="input-group">
                    <label>External Links</label>
                    {gigData.gigLinks.map((link, index) => (
                        <div key={index}>
                            <input
                                type="text"
                                value={link}
                                onChange={(e) => handleLinksChange(e, index)}
                            />
                        </div>
                    ))}
                    <div className="manual-entry-option" onClick={() => handleAddMore("gigLinks")}>
                        <p>Add More</p>
                    </div>                </div>
                <button className="btn" type="submit">Add Gig</button>
            </form>
        </div>
    );
};
