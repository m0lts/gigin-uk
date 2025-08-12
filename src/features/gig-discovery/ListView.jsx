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

    console.log(upcomingGigs)

    return (
        <div className='list'>
            {upcomingGigs.length > 0 ? (
                <div className='gigs-list'>
                    {upcomingGigs.map((gig) => {
                        const distance = location 
                        ? calculateDistance(location.latitude, location.longitude, gig.coordinates[1], gig.coordinates[0])
                        : null;
                        return (
                            <div key={gig.gigId} className='gig-item' onClick={(e) => openInNewTab(`/gig/${gig.gigId}`, e)}>
                                <div className='gig-img'>
                                    <img src={gig.venue.photo} alt={`${gig.venue.venueName} Photo`} />
                                </div>
                                <div className='gig-info'>
                                    <span className='venue-and-location'>
                                        <h4 className='venue-name'>{gig.venue.venueName}</h4>
                                        {(distance !== null && !isNaN(distance)) ? (
                                            <p className='venue-distance'>{distance.toFixed(1)} <LocationPinIcon /></p>
                                        ) : (
                                            <p className='venue-distance'>{getCityFromAddress(gig.venue.address)}</p>
                                        )}
                                    </span>
                                    <p className='text'>{gig.kind}</p>
                                    <span className='time-and-date'>
                                        <p className='text'>{formatDate(gig.date)}</p>
                                        <p className='text'>{gig.startTime}</p>
                                    </span>
                                    <h3 className='fee'>{gig.budget !== 'No Fee' ? `${gig.budget}` : 'No Fee'}</h3>
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