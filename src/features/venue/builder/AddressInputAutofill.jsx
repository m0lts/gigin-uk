import React, { useCallback, useState, useEffect, useRef } from 'react';
import { AddressAutofill } from '@mapbox/search-js-react';
import { toast } from 'sonner';

const parseMapboxFeature = (f) => {
    const ctx = Object.fromEntries((f.context || []).map(c => [c.id.split('.')[0], c]));
    const line1 =
      f.place_type?.includes('address')
        ? `${f.address ?? ''} ${f.text ?? ''}`.trim()
        : f.text || '';
    return {
      fullAddress: f.place_name || line1,
      line1,
      city: ctx.place?.text || ctx.locality?.text || '',
      region: ctx.region?.text || '',
      postcode: ctx.postcode?.text || '',
      country: ctx.country?.text || '',
      countryCode: (ctx.country?.short_code || '').toUpperCase(),
      geometry: f.geometry,
    };
};


export const AddressInputAutofill = ({
    expandForm,
    setExpandForm,
    setFeature,
    setLocationAddress,
    setLocationCoordinates,
    locationAddress,
    handleInputChange,
    coordinatesError,
    setCoordinatesError,
    stepError,
    setStepError,
    errorField,
    setErrorField,
  }) => {
    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  
    const [typedAddress, setTypedAddress] = useState(locationAddress || '');
    const [hasChosenSuggestion, setHasChosenSuggestion] = useState(false);
  
    const justSelectedRef = useRef(false);
  
    const latestReqId = useRef(0);
  
    useEffect(() => {
      setTypedAddress(locationAddress || '');
    }, [locationAddress]);
  
    const applyPartsToState = useCallback((parts) => {
      setFeature({
        type: 'Feature',
        geometry: parts.geometry,
        properties: {
          full_address: parts.fullAddress,
          line1: parts.line1,
          city: parts.city,
          region: parts.region,
          postcode: parts.postcode,
          country: parts.country,
          countryCode: parts.countryCode,
        },
      });
  
      const coords = parts.geometry?.coordinates;
      if (Array.isArray(coords) && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
        setLocationCoordinates(coords);
        setCoordinatesError(false);
      } else {
        setCoordinatesError(true);
      }
  
      setLocationAddress(parts.fullAddress);
      setTypedAddress(parts.fullAddress);
      handleInputChange?.('address', parts.fullAddress);
    }, [handleInputChange, setCoordinatesError, setFeature, setLocationAddress, setLocationCoordinates]);
  
    const handleRetrieve = useCallback((res) => {
      const f = res?.features?.[0];
      if (!f) return;
      const parts = parseMapboxFeature(f);
  
      justSelectedRef.current = true;
      setHasChosenSuggestion(true);
  
      applyPartsToState(parts);
  
      setTimeout(() => { justSelectedRef.current = false; }, 500);
    }, [applyPartsToState]);
  
    const geocodeAndSave = useCallback(async (address) => {
      const q = (address || '').trim();
      if (!q) return;
  
      const reqId = ++latestReqId.current;
  
      try {
        const params = new URLSearchParams({
          access_token: mapboxToken,
          country: 'gb',
          limit: '1',
          language: 'en',
        });
  
        const resp = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params.toString()}`
        );
        if (!resp.ok) throw new Error('Geocoding request failed');
  
        const data = await resp.json();
  
        if (reqId !== latestReqId.current) return;
  
        const best = data?.features?.[0];
        if (!best) {
          if (!locationAddress) {
            setCoordinatesError(true);
            toast.error('We couldn’t find that address. Please try another.');
          }
          return;
        }
  
        const parts = parseMapboxFeature(best);
        const coords = parts.geometry?.coordinates;
        if (!Array.isArray(coords) || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) {
          setCoordinatesError(true);
          toast.error('No coordinates found for that address.');
          return;
        }
  
        applyPartsToState(parts);
        setExpandForm(false);
      } catch (err) {
        console.error(err);
        if (!locationAddress) {
          setCoordinatesError(true);
          toast.error('Error fetching coordinates for that address. Please try again.');
        }
      }
    }, [applyPartsToState, locationAddress, mapboxToken, setCoordinatesError, setExpandForm]);
  
    const handleBlur = useCallback(() => {
      if (justSelectedRef.current) return; // user just picked a suggestion
      if (!locationAddress && typedAddress.trim()) {
        geocodeAndSave(typedAddress);
      }
    }, [geocodeAndSave, typedAddress, locationAddress]);
  
    const handleKeyDown = useCallback((e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!hasChosenSuggestion) {
          geocodeAndSave(typedAddress);
        }
      }
    }, [geocodeAndSave, hasChosenSuggestion, typedAddress]);
  
    const handleAddressSubmission = (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const address1 = formData.get('address1');
      const address2 = formData.get('address2');
      const city = formData.get('city');
      const country = formData.get('country');
      const postcode = formData.get('postcode');
      const enteredAddress = `${address1}${address2 ? `, ${address2}` : ''}, ${city}, ${postcode}, ${country}`;
      geocodeAndSave(enteredAddress);
      handleInputChange('address', enteredAddress);
      setExpandForm(false);
    };

    return (
        <>
            {!expandForm ? ( 
                <div className='address-input'>
                    {locationAddress ? (
                        <div className='input-group'>
                        <label htmlFor='autofill' className='input-label'>Venue Address</label>
                        <input
                            className={`input-box ${(coordinatesError || (stepError && errorField === 'address')) ? 'error': ''}`}
                            type='text'
                            value={locationAddress}
                            readOnly
                            onClick={() => {
                            setLocationAddress('');
                            setLocationCoordinates(null);
                            setTypedAddress('');
                            setExpandForm(false);
                            }}
                        />
                        {coordinatesError && (
                            <p className='error-message'>
                            Sorry, we couldn't find any coordinates for that address. Please try again.
                            </p>
                        )}
                        </div>
                    ) : (
                        <AddressAutofill accessToken={mapboxToken} onRetrieve={handleRetrieve}>
                        <div className='input-group'>
                            <label htmlFor='autofill' className='input-label'>Venue Address</label>
                            <input
                            className={`input-box ${(coordinatesError || (stepError && errorField === 'address')) ? 'error': ''}`}
                            type='text'
                            name='autofill'
                            id='autofill'
                            placeholder='Start typing your address...'
                            autoComplete='off'
                            value={typedAddress}
                            onChange={(e) => {
                                setStepError?.(null);
                                setErrorField?.(null);
                                setTypedAddress(e.target.value);
                            }}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            onClick={() => {
                                setStepError?.(null);
                                setErrorField?.(null);
                            }}
                            />
                        </div>
                        </AddressAutofill>
                    )}
                    {!locationAddress && (
                        <button
                        className="btn primary"
                        onClick={() => geocodeAndSave(typedAddress)}
                        disabled={!typedAddress.trim()}
                        >
                        Save
                        </button>
                    )}
                    <button
                        className='btn text'
                        onClick={() => { setExpandForm(true); setLocationAddress(''); setLocationCoordinates(null); setTypedAddress(''); }}
                        style={{ textAlign: 'left', fontSize: '0.75rem' }}
                    >
                        Or enter the address manually...
                    </button>
                </div>
            ) : (
                <>
                <form onSubmit={handleAddressSubmission} className='form' style={{ width: '100%', marginTop: 0 }}>
                    <div className='input-group'>
                        <label htmlFor='address1' className='input-label'>Address Line 1</label>
                        <input
                            className='input-box'
                            type='text'
                            name='address1'
                            placeholder='Address Line 1'
                            autoComplete='address-line1'
                            id='address1'
                        />
                    </div>
                    <div className='input-group'>
                        <label htmlFor='address2' className='input-label'>Address Line 2</label>
                        <input
                            className='input-box'
                            type='text'
                            name='address2'
                            placeholder='Address Line 2'
                            autoComplete='address-line2'
                            id='address2'
                        />    
                    </div>
                    <div className='input-group'>
                        <label htmlFor='city' className='input-label'>City</label>
                        <input
                            className='input-box'
                            type='text'
                            name='city'
                            placeholder='City'
                            autoComplete='address-level2'
                            id='city'
                        />
                    </div>
                    <div className='input-group'>
                        <label htmlFor='country' className='input-label'>Country</label>
                        <input
                            className='input-box'
                            type='text'
                            name='country'
                            placeholder='Country'
                            autoComplete='country'
                            id='country'
                        />
                    </div>
                    <div className='input-group'>
                        <label htmlFor='postcode' className='input-label'>Postcode</label>
                        <input
                            className='input-box'
                            type='text'
                            name='postcode'
                            placeholder='Postcode'
                            autoComplete='postal-code'
                            id='postcode'
                        />
                    </div>
                    <div className="two-buttons">
                        <button className='btn secondary' type='submit' style={{ width: 'fit-content' }}>
                            Save
                        </button>
                        <button className='btn text manual-address' onClick={() => {setExpandForm(false); setLocationAddress(''); setLocationCoordinates(null)}} style={{ textAlign: 'left', fontSize: '0.75rem' }}>
                            Back to automatic address entry
                        </button>
                    </div>
                </form>
                </>
            )}
        </>
    );
};
