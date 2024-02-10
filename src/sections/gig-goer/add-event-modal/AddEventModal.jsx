import { useState, useCallback, useEffect } from "react";
import { AddressAutofill } from "@mapbox/search-js-react";
import { queryDatabase } from "/utils/queryDatabase";
import { XIcon } from "../../../components/Icons/Icons";
import { LoadingDots } from "/components/Loading/LoadingEffects";

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
    const [manualAddressEntry, setManualAddressEntry] = useState({
        address1: '',
        apartment: '',
        city: '',
        country: '',
        postcode: '',
    });
    const [expandForm, setExpandForm] = useState(false);
    const [error, setError] = useState('');
    const [postingGig, setPostingGig] = useState(false);

    const userId = "12345";

    useEffect(() => {
        if (!showModal) {
            setGigData({
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
            setManualAddressEntry({
                address1: '',
                apartment: '',
                city: '',
                country: '',
                postcode: '',
            });
            setExpandForm(false);
            setError('');
        }
    }, [showModal])

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

    // Upload gig. Details:
    // If the user has entered the address manually, use the entered address to fetch coordinates and then upload the gig
    // Otherwise, upload the gig with the autofilled address
    const handleGigUpload = async (e) => {
        setPostingGig(true);
        e.preventDefault();
        setError('');

        if (gigData.gigName === '' || gigData.gigVenue === '' || gigData.gigDate === '' || gigData.gigTime === '') {
            setError('Please fill in all fields marked with an asterisk (*)');
            return;
        }

        if (expandForm) {
            const address1 = manualAddressEntry.address1;
            const apartment = manualAddressEntry.apartment;
            const city = manualAddressEntry.city;
            const country = manualAddressEntry.country;
            const postcode = manualAddressEntry.postcode;

            if (address1 === '' || city === '' || country === '' || postcode === '') {
                setError('Please fill in all fields marked with an asterisk (*)');
                return;
            }

            const enteredAddress = `${address1}${apartment ? `, ${apartment}` : ''}, ${city}, ${postcode}, ${country}`;

            try {
                const response = await fetch(
                  `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(enteredAddress)}.json?access_token=pk.eyJ1IjoiZ2lnaW4iLCJhIjoiY2xwNDQ2ajFwMWRuNzJxczZqNHlvbHg3ZCJ9.nR_HaL-dWRkUhOgBnmbyjg`
                );
          
                if (response.ok) {
                  const data = await response.json();
                  if (data.features && data.features.length > 0) {
                    const coordinates = data.features[0].geometry.coordinates;
                    setGigData(prevState => ({ ...prevState, gigLocation: enteredAddress, gigCoordinates: coordinates }));

                    const dataPayload = {
                        userId: userId,
                        gigInformation: {
                            ...gigData,
                            gigLocation: enteredAddress,
                            gigCoordinates: coordinates
                        }
                    };
            
                    try {
                        const response = await queryDatabase('/api/events/handleEventUpload.js', dataPayload); 
                        if (response.ok) {
                            setShowModal(false);
                            setPostingGig(false);
                            window.location.reload();
                        } else {
                            console.log('error');
                        }
                    } catch (error) {
                        console.error('Error:', error);
                    }


                  } else {
                    setError('Please fill in all fields marked with an asterisk (*)');
                    return;
                  }
                } else {
                    setError('Please fill in all fields marked with an asterisk (*)');
                    return;
                }
            } catch (error) {
                console.error('Error fetching coordinates:', error);
            }

        } else {

            if (gigData.gigLocation === '' || gigData.gigCoordinates === '') {
                setError('Please fill in all fields marked with an asterisk (*)');
                return;
            }

            const dataPayload = {
                userId: userId,
                gigInformation: gigData
            };
    
            try {
                const response = await queryDatabase('/api/events/handleEventUpload.js', dataPayload); 
                if (response.ok) {
                    setShowModal(false);
                    setPostingGig(false);
                    window.location.reload();
                } else {
                    console.log('error');
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
    };

    // Address autofill callback
    const handleRetrieve = useCallback(
        (res) => {
            const feature = res.features[0];
            const address = feature.properties.place_name;
            const coordinates = feature.geometry.coordinates;

            setGigData(prevState => ({ ...prevState, gigLocation: address, gigCoordinates: coordinates }));
        },
        [setGigData]
    );


    return (
        <div className={`add-event-modal shadow ${showModal && 'open'}`}>
            <div className="exit-button">
                <button className="btn" onClick={() => setShowModal(false)}>
                    <XIcon />
                </button>
            </div>
            <div className="heading">
                <h1>Add Event</h1>
                <p>Tell us what's happening!</p>
            </div>
            {error && 
                <div className="error-message">
                    <p>{error}</p>
                </div>
            }
            {postingGig ? (
                <div className="loading">
                    <LoadingDots />
                </div>
            ) : (
                <form onSubmit={handleGigUpload}>
                <div className="input-group">
                        <label htmlFor="gigName">Event Title *</label>
                        <input type="text" id="gigName" required value={gigData.gigName} onChange={(e) => { setGigData({ ...gigData, gigName: e.target.value }); setError('') }} />
                    </div>
                    <div className="input-group">
                        <label htmlFor="gigVenue">Name of Venue *</label>
                        <input type="text" id="gigVenue" required value={gigData.gigVenue} onChange={(e) => { setGigData({ ...gigData, gigVenue: e.target.value }); setError('') }} />
                    </div>
                    {!expandForm && (
                        <AddressAutofill accessToken="pk.eyJ1IjoiZ2lnaW4iLCJhIjoiY2xwNDQ2ajFwMWRuNzJxczZqNHlvbHg3ZCJ9.nR_HaL-dWRkUhOgBnmbyjg" onRetrieve={handleRetrieve}>
                            <div className="input-group">
                                <label htmlFor="autofill" className="label">Venue Address: *</label>
                                <input 
                                    type="text"
                                    name="autofill"
                                    id="autofill"
                                    required={!expandForm}
                                    placeholder="Start typing your address, e.g. 72 High Street..."
                                    onChange={() => setError('')}
                                />
                            </div>
                        </AddressAutofill>
                    )}
                    <div className="manual-entry-option" onClick={() => setExpandForm(!expandForm)}>
                        {expandForm ? (
                            <p>Hide manual entry</p>
                        ) : (
                            <p>Enter address manually</p>
                        )}
                    </div>
                    <div className="manual-entry-form" style={{ display: expandForm ? 'block' : 'none' }}>
                        <div className="input-group">
                            <label htmlFor="address1" className="label">Address Line 1 *</label>
                            <input 
                                className="input"
                                type="text"
                                name="address1"
                                autoComplete="address-line1"
                                required={expandForm}
                                onChange={(e) => { setManualAddressEntry({ ...manualAddressEntry, address1: e.target.value }); setError('') }} 
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="apartment" className="label">Apartment Number</label>
                            <input 
                                className="input"
                                type="text"
                                name="apartment"
                                autoComplete="address-line2"
                                required={expandForm}
                                onChange={(e) => { setManualAddressEntry({ ...manualAddressEntry, apartment: e.target.value }); setError('') }}
                            />    
                        </div>
                        <div className="input-group">
                            <label htmlFor="city" className="label">City *</label>
                            <input 
                                className="input"
                                type="text"
                                name="city"
                                autoComplete="address-level2"
                                required={expandForm}
                                onChange={(e) => { setManualAddressEntry({ ...manualAddressEntry, city: e.target.value }); setError('') }} 
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="country" className="label">Country *</label>
                            <input 
                                className="input"
                                type="text"
                                name="country"
                                autoComplete="country"
                                required={expandForm}
                                onChange={(e) => { setManualAddressEntry({ ...manualAddressEntry, country: e.target.value }); setError('') }} 
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="postcode" className="label">Postcode *</label>
                            <input 
                                className="input"
                                type="text"
                                name="postcode"
                                autoComplete="postal-code"
                                required={expandForm}
                                onChange={(e) => { setManualAddressEntry({ ...manualAddressEntry, postcode: e.target.value }); setError('') }} 
                            />
                        </div>
                    </div>
                    <div className="input-group">
                        <label htmlFor="gigDate">Date *</label>
                        <input type="date" id="gigDate" required value={gigData.gigDate} onChange={(e) => { setGigData({ ...gigData, gigDate: e.target.value }); setError('') }} />
                    </div>
                    <div className="input-group">
                        <label htmlFor="gigTime">Time *</label>
                        <input type="time" id="gigTime" required value={gigData.gigTime} onChange={(e) => { setGigData({ ...gigData, gigTime: e.target.value }); setError('') }} />
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
                    <button className="btn primary-btn" type="submit">Post Gig</button>
                </form>
            )}
        </div>
    );
};
