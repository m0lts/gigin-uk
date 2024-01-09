import { useCallback } from "react"
import { AddressAutofill } from "@mapbox/search-js-react"
import './address.inputs.styles.css'

export const AddressInputAutofill = ({ expandForm, setExpandForm, feature, setFeature, locationCoordinates, setLocationCoordinates, locationAddress, setLocationAddress }) => {

    const handleRetrieve = useCallback(
        (res) => {
            const feature = res.features[0];
            setFeature(feature);

            const address = feature.properties.place_name;
            const coordinates = feature.geometry.coordinates;

            setLocationAddress(address);
            setLocationCoordinates(coordinates);
        },
        [setFeature, setLocationCoordinates, setLocationAddress]
    );


    const handleGeocodeAddress = async (address) => {
        setLocationAddress(address);
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=pk.eyJ1IjoiZ2lnaW4iLCJhIjoiY2xwNDQ2ajFwMWRuNzJxczZqNHlvbHg3ZCJ9.nR_HaL-dWRkUhOgBnmbyjg`
          );
    
          if (response.ok) {
            const data = await response.json();
            if (data.features && data.features.length > 0) {
              const coordinates = data.features[0].geometry.coordinates;
              setLocationCoordinates(coordinates);
              const addressDetails = {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: coordinates,
                },
                properties: {
                  address: address,
                },
              };
              setFeature(addressDetails);
            } else {
              console.error('No coordinates found for the provided address.');
            }
          } else {
            console.error('Failed to fetch coordinates.');
          }
        } catch (error) {
          console.error('Error fetching coordinates:', error);
        }
      };

    const handleAddressSubmission = (e) => {
        e.preventDefault();

        const address1 = e.target.address1.value;
        const apartment = e.target.apartment.value;
        const city = e.target.city.value;
        const country = e.target.country.value;
        const postcode = e.target.postcode.value;

        const enteredAddress = `${address1}${apartment ? `, ${apartment}` : ''}, ${city}, ${postcode}, ${country}`;

        handleGeocodeAddress(enteredAddress);
    }

    return (
        <form onSubmit={handleAddressSubmission} className="address-form">
            <div className="autofill-cont" style={{ display: expandForm ? 'none' : 'block' }}>
                <AddressAutofill accessToken="pk.eyJ1IjoiZ2lnaW4iLCJhIjoiY2xwNDQ2ajFwMWRuNzJxczZqNHlvbHg3ZCJ9.nR_HaL-dWRkUhOgBnmbyjg" onRetrieve={handleRetrieve}>
                    <div className="input-cont">
                        <label htmlFor="autofill" className="label">Address:</label>
                        <input 
                            className="input"
                            type="text"
                            name="autofill"
                            id="autofill"
                            placeholder="Start typing your address, e.g. 72 High Street..."
                            autoComplete="address-line1"
                        />
                    </div>
                </AddressAutofill>
            </div>
            {!expandForm && 
                <div className="manual-entry-option" onClick={() => setExpandForm(true)}>
                    <p>Enter address manually</p>
                </div>
            }
            <div className="manual-entry-form" style={{ display: expandForm ? 'block' : 'none' }}>
                <div className="input-cont">
                    <label htmlFor="address1" className="label">Address Line 1:</label>
                    <input 
                        className="input"
                        type="text"
                        name="address1"
                        placeholder="Address Line 1"
                        autoComplete="address-line1"
                    />
                </div>
                <div className="input-cont">
                    <label htmlFor="apartment" className="label">Apartment Number:</label>
                    <input 
                        className="input"
                        type="text"
                        name="apartment"
                        placeholder="Apartment Number"
                        autoComplete="address-line2"
                    />    
                </div>
                <div className="input-cont">
                    <label htmlFor="city" className="label">City:</label>
                    <input 
                        className="input"
                        type="text"
                        name="city"
                        placeholder="City"
                        autoComplete="address-level2"
                    />
                </div>
                <div className="input-cont">
                    <label htmlFor="country" className="label">Country:</label>
                    <input 
                        className="input"
                        type="text"
                        name="country"
                        placeholder="Country"
                        autoComplete="country"
                    />
                </div>
                <div className="input-cont">
                    <label htmlFor="postcode" className="label">Post Code:</label>
                    <input 
                        className="input"
                        type="text"
                        name="postcode"
                        placeholder="Postcode"
                        autoComplete="postal-code"
                    />
                </div>
                <button type="submit" className="btn white-button">
                    Submit
                </button>
            </div>
        </form>
    )
}
