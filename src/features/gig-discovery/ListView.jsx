import { useState, useEffect, useRef } from 'react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useFilterGigsByDate } from '@hooks/useFilterGigsByDate';
import { formatDate } from '@services/utils/dates';
import { getCityFromAddress, openInNewTab } from '@services/utils/misc';
import { LocationPinIcon } from '../shared/ui/extras/Icons';

export const ListView = ({ upcomingGigs, location }) => {

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const toRad = (value) => (value * Math.PI) / 180;
        const R = 3958.8;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    return (
        <div className='list'>
            {upcomingGigs.length > 0 ? (
                <div className='gigs-list'>
                    {upcomingGigs.map((gig) => {
                        const distance = location 
                        ? calculateDistance(location.latitude, location.longitude, gig.coordinates?.[1], gig.coordinates?.[0])
                        : null;
                        const venueName = gig.venue?.venueName ?? gig.gigName ?? 'Gig';
                        const venuePhoto = gig.venue?.photo;
                        return (
                            <div key={gig.gigId} className='gig-item' onClick={(e) => openInNewTab(`/gig/${gig.gigId}`, e)}>
                                <div className='gig-img'>
                                    {venuePhoto ? (
                                        <img src={venuePhoto} alt={`${venueName} Photo`} />
                                    ) : (
                                        <div className='gig-img-placeholder' aria-hidden />
                                    )}
                                </div>
                                <div className='gig-info'>
                                    <span className='venue-and-location'>
                                        <h4 className='venue-name'>{venueName}</h4>
                                        {(distance !== null && !isNaN(distance)) ? (
                                            <p className='venue-distance'>{distance.toFixed(1)} <LocationPinIcon /></p>
                                        ) : (
                                            <p className='venue-distance'>{getCityFromAddress(gig.venue?.address)}</p>
                                        )}
                                    </span>
                                    <p className='text'>{gig.kind}</p>
                                    <span className='time-and-date'>
                                        <p className='text'>{formatDate(gig.date)}</p>
                                        <p className='text'>{gig.startTime}</p>
                                    </span>
                                    {((gig.budget === '£' || gig.budget === 'No Fee') && (gig.kind === 'Ticketed Gig' || gig.kind === 'Open Mic')) ? (
                                        <h3 className="fee">{gig.kind}</h3>
                                    ) : (
                                        <h3 className='fee'>{gig.budget !== 'No Fee' ? `${gig.budget}` : 'No Fee'}</h3>
                                    )}
                                </div>
                            </div>
                        )
                    })}                    
                </div>
            ) : (
                <div className='no-gigs'>
                    <h2>No gigs to show.</h2>
                </div>
            )}
        </div>
    );
};