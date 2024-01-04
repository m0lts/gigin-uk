import { AddressMinimap, useConfirmAddress, AddressAutofill } from "@mapbox/search-js-react"
import { AddressInputAutofill } from "../../../Global/Addresses/Addresses"
import { useState, useEffect, useCallback } from "react";
import { MapIcon } from "../../../Global/Icons/Icons";

export const HostAddressStage = ({ hostAddress, setHostAddress, setNextButtonAvailable }) => {

    // Updating hostAddress state
    const [locationCoordinates, setLocationCoordinates] = useState();
    const [locationAddress, setLocationAddress] = useState();

    useEffect(() => {
      if (locationAddress || locationCoordinates) {
        setHostAddress({
            address: locationAddress,
            coordinates: locationCoordinates,
        });
    }
    }, [locationAddress, locationCoordinates])


    // Form and map
    const [expandForm, setExpandForm] = useState(false);
    const [feature, setFeature] = useState();

    useEffect(() => {
      if (hostAddress) {
        const featureDetails = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: hostAddress.coordinates,
          },
        };
        setFeature(featureDetails);
      }
    }, [])

    const handleGeocodeCoordinates = async (coordinates) => {
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(coordinates)}.json?access_token=pk.eyJ1IjoiZ2lnaW4iLCJhIjoiY2xwNDQ2ajFwMWRuNzJxczZqNHlvbHg3ZCJ9.nR_HaL-dWRkUhOgBnmbyjg`
          );
    
          if (response.ok) {
            const data = await response.json();
            if (data.features && data.features.length > 0) {
              const address = data.features[0].place_name;
              setLocationAddress(address);
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

    const handleSaveMarkerLocation = (coordinate) => {
        setLocationCoordinates(coordinate);
        handleGeocodeCoordinates(coordinate)
    }

    useEffect(() => {
      if (hostAddress) {
          setNextButtonAvailable(true);
      } else {
          setNextButtonAvailable(false);
      }
    }, [hostAddress]);

    return (
        <div className='host-address profile-creator-stage'>
            <h1 className='title'>Address and Location</h1>
            <p className="text">Please enter the venue's address.</p>
            <div className="address-cont">
                <AddressInputAutofill 
                    expandForm={expandForm}
                    setExpandForm={setExpandForm}
                    feature={feature}
                    setFeature={setFeature}
                    locationAddress={locationAddress}
                    locationCoordinates={locationCoordinates}
                    setLocationAddress={setLocationAddress}
                    setLocationCoordinates={setLocationCoordinates}
                />
                <div className="minimap">
                  {feature ? (
                    <AddressMinimap 
                        canAdjustMarker={true}
                        satelliteToggle={true}
                        show={true}
                        feature={feature}
                        accessToken="pk.eyJ1IjoiZ2lnaW4iLCJhIjoiY2xwNDQ2ajFwMWRuNzJxczZqNHlvbHg3ZCJ9.nR_HaL-dWRkUhOgBnmbyjg"
                        onSaveMarkerLocation={handleSaveMarkerLocation}
                    />
                  ) : (
                    <MapIcon />
                  )}
                </div>
            </div>
        </div>
    )
}