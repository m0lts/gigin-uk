import { useState, useEffect, useRef } from "react";
import ReactDatePicker from "react-datepicker";
import 'react-datepicker/dist/react-datepicker.css';

export const ListView = ({ upcomingGigs, location }) => {

    const [selectedDate, setSelectedDate] = useState(null);
    const [filteredGigs, setFilteredGigs] = useState(upcomingGigs);

    useEffect(() => {
        if (upcomingGigs && upcomingGigs.length > 0) {
            const filteredGigs = selectedDate
                ? upcomingGigs.filter(gig => {
                      const gigDate = gig.date.toDate();
                      return (
                          gigDate.toDateString() === selectedDate.toDateString()
                      );
                  })
                : upcomingGigs;
            setFilteredGigs(filteredGigs)
        }
    }, [upcomingGigs, selectedDate]);
    
    const getOrdinalSuffix = (day) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };
    
    const formatDate = (timestamp) => {
        const date = timestamp.toDate();
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
        const month = date.toLocaleDateString('en-GB', { month: 'long' });
        return `${weekday} ${day}${getOrdinalSuffix(day)} ${month}`;
    };
    
    const openMusicianGig = (gigId) => {
        const url = `/gig/${gigId}`;
        window.open(url, '_blank');
    };

    const getCityFromAddress = (address) => {
        const parts = address.split(',');
        return parts.length >= 3 ? parts[parts.length - 3].trim() : address;
    };

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const toRad = (value) => (value * Math.PI) / 180; // Convert degrees to radians
        const R = 3958.8; // Radius of Earth in miles
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in miles
    };

    return (
        <div className="list-view">
            <div className="filter-bar">
                <ReactDatePicker
                    id="date-picker"
                    selected={selectedDate}
                    onChange={date => setSelectedDate(date)}
                    dateFormat="dd-MM-yyyy"
                    placeholderText="Filter by Date"
                />
                {selectedDate && (
                    <button className="btn primary round" onClick={() => setSelectedDate(null)}>Clear Filter</button>
                )}
            </div>
            {filteredGigs.length > 0 ? (
                <div className="gigs-list">
                    {filteredGigs.map((gig) => {

                        const distance = location 
                        ? calculateDistance(location.latitude, location.longitude, gig.coordinates[1], gig.coordinates[0])
                        : null;

                        return (
                            <div key={gig.gigId} className="gig-item" onClick={() => openMusicianGig(gig.gigId)}>
                                <div className="gig-img">
                                    <img src={gig.venue.photo} alt={`${gig.venue.venueName} Photo`} />
                                </div>
                                <div className="gig-info">
                                    <span className="venue-and-location">
                                        <h3>{gig.venue.venueName}</h3>
                                        {(distance !== null && !isNaN(distance)) ? (
                                            <p>{distance.toFixed(1)} miles</p>
                                        ) : (
                                            <p>{getCityFromAddress(gig.venue.address)}</p>
                                        )}
                                    </span>
                                    <p>{gig.kind}</p>
                                    <span className="time-and-date">
                                        <p>{formatDate(gig.date)}</p>
                                        <p>{gig.startTime}</p>
                                    </span>
                                    <h3>{gig.budget}</h3>
                                </div>
                            </div>
                        )
                    })}                    
                </div>
            ) : (
                <div className="no-gigs">
                    <h2>No gigs to show.</h2>
                </div>
            )}
        </div>
    );
};