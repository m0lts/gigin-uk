import { useNavigate, Link } from 'react-router-dom';
import { TextLogo, TextLogoLink } from '@features/shared/ui/logos/Logos';
import '@styles/shared/landing-page.styles.css'
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useAuth } from '../../hooks/useAuth';
import { useState, useEffect, useRef } from 'react';
import { RightArrowIcon, MicrophoneLinesIcon, AlbumCollectionIcon, FileUserIcon, CoinsIconSolid, MediaIcon, SuccessIcon, HamburgerMenuIcon, CloseIcon } from '../shared/ui/extras/Icons';
import ArtistProfileExample from '@assets/images/artist-profile-example.png';
import ArtistProfileExample2 from '@assets/images/artist-profile-example2.png';
import ArtistProfileExample3 from '@assets/images/artist-profile-example3.png';
import { Footer } from '../shared/components/Footer';
import mapboxgl from 'mapbox-gl';
import { fetchNearbyVenues } from '../../services/client-side/venues';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MobileMenu } from '../shared/components/MobileMenu';
import Portal from '../shared/components/Portal';
import { incrementProClicks } from '../../services/client-side/reports';

const toLngLat = (venue) => {
    if (venue?.geopoint?.longitude != null && venue?.geopoint?.latitude != null) {
        return [venue.geopoint.longitude, venue.geopoint.latitude]; // [lng, lat]
    }
    if (Array.isArray(venue?.coordinates) && venue.coordinates.length === 2) {
        return venue.coordinates; // [lng, lat]
    }
    return null;
};

const toFeatureCollection = (list) => ({
    type: 'FeatureCollection',
    features: (list || [])
        .map((v) => {
            const coords = toLngLat(v);
            if (!coords) return null;
            return {
                type: 'Feature',
                properties: { id: v.id, name: v.name },
                geometry: { type: 'Point', coordinates: coords },
            };
        })
        .filter(Boolean),
});

export const LandingPage = ({ setAuthModal, authType, setAuthType, authClosable, setAuthClosable, noProfileModal, setNoProfileModal, setInitialEmail }) => {
    const navigate = useNavigate();
    const { isXlUp, isMdUp } = useBreakpoint();
    const { user, logout } = useAuth();
    const [heroEmail, setHeroEmail] = useState('');
    const [activeEpkFeature, setActiveEpkFeature] = useState('profile'); // Default to profile
    const [isImageTransitioning, setIsImageTransitioning] = useState(false);
    const [userInteracted, setUserInteracted] = useState(false);
    const slideshowIntervalRef = useRef(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    
    // Discovery section map state
    const discoveryMapContainerRef = useRef(null);
    const discoveryMapRef = useRef(null);
    const discoveryVenuesRef = useRef([]);
    const [discoveryVenues, setDiscoveryVenues] = useState([]);
    const [discoveryLoading, setDiscoveryLoading] = useState(true);
    const cambridgeLocation = { latitude: 52.2053, longitude: 0.1218 }; // Cambridge UK
    
    // Map EPK features to images
    const epkImages = {
        profile: ArtistProfileExample,
        gigs: ArtistProfileExample2,
        'tech-rider': ArtistProfileExample3,
        finances: ArtistProfileExample,
        'media-storage': ArtistProfileExample2
    };

    // Array of features in order for slideshow
    const epkFeatures = ['profile', 'gigs', 'tech-rider', 'finances', 'media-storage'];

    const handleEpkFeatureChange = (feature) => {
        setUserInteracted(true);
        setIsImageTransitioning(true);
        setActiveEpkFeature(feature);
        setTimeout(() => {
            setIsImageTransitioning(false);
        }, 500); // Match animation duration
    };

    // Auto-slideshow effect
    useEffect(() => {
        // Only start slideshow if user hasn't interacted
        if (!userInteracted) {
            slideshowIntervalRef.current = setInterval(() => {
                setActiveEpkFeature((current) => {
                    const currentIndex = epkFeatures.indexOf(current);
                    const nextIndex = (currentIndex + 1) % epkFeatures.length;
                    return epkFeatures[nextIndex];
                });
            }, 7000); // 7 seconds
        }

        return () => {
            if (slideshowIntervalRef.current) {
                clearInterval(slideshowIntervalRef.current);
            }
        };
    }, [userInteracted]);

    const handleCreateArtistProfile = () => {
        if (!user) {
            // User not logged in - navigate to artist profile example page (don't show auth modal)
            navigate('/artist-profile?signup=true');
        } else {
            // User is logged in - navigate normally
            navigate('/artist-profile');
        }
    };

    const handleLogin = () => {
        if (!user) {
            setAuthType('login');
            setAuthModal(true);
        } else {
            // If user is logged in, redirect based on profile
            if (hasArtistProfile) {
                navigate('/artist-profile');
            } else if (hasVenueProfile) {
                navigate('/venues/dashboard/gigs');
            }
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
        } catch (err) {
            console.error(err);
        }
    };

    // Check if user is logged in but has no profiles
    const hasNoProfiles = user && 
        (!user.venueProfiles || user.venueProfiles.length === 0) && 
        (!user.artistProfiles || user.artistProfiles.length === 0);
    
    const hasArtistProfile = user && user.artistProfiles && user.artistProfiles.length > 0;
    const hasVenueProfile = user && user.venueProfiles && user.venueProfiles.length > 0;

    // Auto-redirect if user has venue profile
    useEffect(() => {
        if (hasVenueProfile) {
            navigate('/venues');
        }
    }, [hasVenueProfile, navigate]);

    // Fetch venues for discovery section
    useEffect(() => {
        let cancelled = false;
        const fetchVenues = async () => {
            setDiscoveryLoading(true);
            try {
                const { venues: newVenues } = await fetchNearbyVenues({
                    location: cambridgeLocation,
                    radiusInKm: 50,
                    lastDoc: null,
                });
                if (!cancelled) {
                    const venues = newVenues || [];
                    setDiscoveryVenues(venues);
                    discoveryVenuesRef.current = venues;
                }
            } catch (err) {
                console.error('Error fetching venues for discovery section:', err);
            } finally {
                if (!cancelled) setDiscoveryLoading(false);
            }
        };
        fetchVenues();
        return () => { cancelled = true; };
    }, []);

    // Initialize discovery map
    useEffect(() => {
        if (!discoveryMapContainerRef.current || discoveryMapRef.current) return;
        mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

        const map = new mapboxgl.Map({
            container: discoveryMapContainerRef.current,
            style: 'mapbox://styles/gigin/clp5jayun01l901pr6ivg5npf',
            center: [cambridgeLocation.longitude, cambridgeLocation.latitude],
            zoom: 10,
        });

        const sourceId = 'discovery-venues';

        map.on('load', () => {
            map.addSource(sourceId, {
                type: 'geojson',
                data: toFeatureCollection(discoveryVenuesRef.current),
                cluster: true,
                clusterMaxZoom: 14,
                clusterRadius: 50,
            });

            map.addLayer({
                id: 'clusters-shadow',
                type: 'circle',
                source: sourceId,
                filter: ['has', 'point_count'],
                paint: {
                    'circle-color': 'rgba(0, 0, 0, 0.07)',
                    'circle-radius': ['step', ['get', 'point_count'], 16, 5, 20, 10, 24, 25, 28],
                    'circle-blur': 1.2,
                },
            });

            map.addLayer({
                id: 'clusters',
                type: 'circle',
                source: sourceId,
                filter: ['has', 'point_count'],
                paint: {
                    'circle-color': '#1A1A1A',
                    'circle-radius': ['step', ['get', 'point_count'], 12, 5, 16, 10, 20, 25, 24],
                    'circle-stroke-width': 0,
                },
            });

            map.addLayer({
                id: 'cluster-count',
                type: 'symbol',
                source: sourceId,
                filter: ['has', 'point_count'],
                layout: {
                    'text-field': ['concat', ['get', 'point_count_abbreviated'], ' Venues'],
                    'text-font': ['DM Sans Bold'],
                    'text-size': 13,
                    'text-anchor': 'center',
                },
                paint: {
                    'text-color': '#FFFFFF',
                    'text-halo-color': '#1A1A1A',
                    'text-halo-width': 1.5,
                },
            });

            map.addLayer({
                id: 'unclustered-point',
                type: 'circle',
                source: sourceId,
                filter: ['!', ['has', 'point_count']],
                paint: {
                    'circle-color': '#FF6C4B',
                    'circle-radius': 8,
                    'circle-blur': 0.3,
                    'circle-opacity': 1,
                    'circle-stroke-width': 0,
                },
            });

            map.addLayer({
                id: 'unclustered-point-label',
                type: 'symbol',
                source: sourceId,
                filter: ['!', ['has', 'point_count']],
                layout: {
                    'text-field': ['get', 'name'],
                    'text-font': ['DM Sans Bold'],
                    'text-size': 14,
                    'text-anchor': 'top',
                    'text-offset': [0, 0.5],
                },
                paint: {
                    'text-color': '#111111',
                    'text-halo-color': '#FFFFFF',
                    'text-halo-width': 1,
                    'text-halo-blur': 0.5,
                },
            });

            map.addLayer({
                id: 'unclustered-hit',
                type: 'circle',
                source: sourceId,
                filter: ['!', ['has', 'point_count']],
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 18, 10, 22, 14, 26],
                    'circle-color': '#fff',
                    'circle-opacity': 0,
                },
            });

            const handleUnclusteredClick = (e) => {
                const padding = 10;
                const p1 = new mapboxgl.Point(e.point.x - padding, e.point.y - padding);
                const p2 = new mapboxgl.Point(e.point.x + padding, e.point.y + padding);
                const features = map.queryRenderedFeatures([p1, p2], {
                    layers: ['unclustered-point', 'unclustered-hit', 'unclustered-point-label'],
                });
                if (!features.length) return;
                const ids = new Set(features.map((f) => f.properties?.id).filter(Boolean));
                const match = discoveryVenuesRef.current.find((v) => ids.has(v.id));
                if (match) {
                    if (user?.musicianProfile) {
                        window.open(`/venues/${match.id}?musicianId=${user.musicianProfile.id}`, '_blank', 'noopener,noreferrer');
                    } else {
                        window.open(`/venues/${match.id}`, '_blank', 'noopener,noreferrer');
                    }
                }
            };

            map.on('click', 'unclustered-hit', handleUnclusteredClick);
            ['unclustered-point', 'unclustered-hit'].forEach((l) => {
                map.on('mouseenter', l, () => (map.getCanvas().style.cursor = 'pointer'));
                map.on('mouseleave', l, () => (map.getCanvas().style.cursor = ''));
            });

            map.on('mouseenter', 'clusters', () => (map.getCanvas().style.cursor = 'pointer'));
            map.on('mouseleave', 'clusters', () => (map.getCanvas().style.cursor = ''));

            map.on('click', 'clusters', (e) => {
                const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
                if (!features.length) return;
                const clusterId = features[0].properties.cluster_id;
                const source = map.getSource(sourceId);
                source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                    if (err) return;
                    map.easeTo({
                        center: features[0].geometry.coordinates,
                        zoom: zoom,
                    });
                });
            });
        });

        discoveryMapRef.current = map;
        return () => { 
            if (discoveryMapRef.current) {
                discoveryMapRef.current.remove();
                discoveryMapRef.current = null;
            }
        };
    }, []);

    // Update map data when venues change
    useEffect(() => {
        if (!discoveryMapRef.current) return;
        const src = discoveryMapRef.current.getSource('discovery-venues');
        if (src) {
            src.setData(toFeatureCollection(discoveryVenues));
        }
    }, [discoveryVenues]);


    const handleStartNow = () => {
        // Set initial email if provided, then show signup modal
        if (setInitialEmail && heroEmail) {
            setInitialEmail(heroEmail);
        }
        setAuthType('signup');
        setAuthModal(true);
    };

    const handlePricingClick = () => {
        const pricingSection = document.getElementById('pricing-section');
        if (pricingSection) {
            pricingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="landing-page">
            <nav className="landing-navbar">
                <div className={`navbar-container ${isXlUp ? 'constrained' : ''}`}>
                    <div className="navbar-left">
                        <TextLogo />
                        {isMdUp && (
                            <>
                                <button className="nav-link" onClick={() => navigate('/find-a-gig')}>
                                    Find Gig
                                </button>
                                <button className="nav-link" onClick={() => navigate('/find-venues')}>
                                    Find Venue
                                </button>
                                <button className="nav-link" onClick={handlePricingClick}>
                                    Pricing
                                </button>
                            </>
                        )}
                    </div>
                    {isMdUp ? (
                        <div className="navbar-right">
                            {!hasArtistProfile && (
                                <button className="btn tertiary" onClick={() => navigate('/venues')}>
                                    I'm a Venue
                                </button>
                            )}
                            {hasArtistProfile ? (
                                <button className="btn artist-profile" onClick={() => navigate('/artist-profile')}>
                                    My Artist Profile
                                </button>
                            ) : (
                                <button className="btn artist-profile" onClick={handleCreateArtistProfile}>
                                    Create Artist Profile
                                </button>
                            )}
                            {user && (
                                <h6 className="or-separator">
                                    OR
                                </h6>
                            )}
                            {user ? (
                                <button className="btn secondary" onClick={handleLogout}>
                                    Log Out
                                </button>
                            ) : (
                                <button className="btn secondary" onClick={handleLogin}>
                                    Log In
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="navbar-right">
                            <button 
                                className="btn icon hamburger-menu-btn"
                                aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
                                aria-expanded={mobileMenuOpen}
                                onClick={(e) => {
                                    setMobileMenuOpen(!mobileMenuOpen);
                                    e.stopPropagation();
                                }}
                            >
                                {mobileMenuOpen ? <CloseIcon /> : <HamburgerMenuIcon />}
                            </button>
                        </div>
                    )}
                </div>
            </nav>
            {!isMdUp && mobileMenuOpen && (
                <Portal>
                    <nav className='mobile-menu' style={{ right: '2rem', top: '8%' }}>
                        {!user ? (
                            <>
                                <Link className='link item no-margin' to='/venues' onClick={() => setMobileMenuOpen(false)}>
                                    I'm a Venue
                                </Link>
                                <Link className='link item no-margin' to='/find-a-gig' onClick={() => setMobileMenuOpen(false)}>
                                    Find a Gig
                                </Link>
                                <Link className='link item no-margin' to='/find-venues' onClick={() => setMobileMenuOpen(false)}>
                                    Find a Venue
                                </Link>
                                <button className='link item' onClick={() => { handlePricingClick(); setMobileMenuOpen(false); }}>
                                    Pricing
                                </button>
                                <div className="two-buttons">
                                    <button className='btn secondary' onClick={() => { setAuthType('login'); setAuthModal(true); setMobileMenuOpen(false); }}>
                                        Log In
                                    </button>
                                    <button className='btn primary' onClick={() => { setAuthType('signup'); setAuthModal(true); setMobileMenuOpen(false); }}>
                                        Sign Up
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                {!hasArtistProfile && (
                                    <Link className='link item no-margin' to='/venues' onClick={() => setMobileMenuOpen(false)}>
                                        I'm a Venue
                                    </Link>
                                )}
                                <Link className='link item no-margin' to='/find-a-gig' onClick={() => setMobileMenuOpen(false)}>
                                    Find a Gig
                                </Link>
                                <Link className='link item no-margin' to='/find-venues' onClick={() => setMobileMenuOpen(false)}>
                                    Find a Venue
                                </Link>
                                <button className='link item no-margin' onClick={() => { handlePricingClick(); setMobileMenuOpen(false); }}>
                                    Pricing
                                </button>
                                {hasArtistProfile ? (
                                    <Link className='link item no-margin' to='/artist-profile' onClick={() => setMobileMenuOpen(false)}>
                                        My Artist Profile
                                    </Link>
                                ) : (
                                    <button className='link item no-margin' onClick={() => { handleCreateArtistProfile(); setMobileMenuOpen(false); }}>
                                        Create Artist Profile
                                    </button>
                                )}
                                <div className="two-buttons">
                                    <button className='btn secondary' onClick={() => { handleLogout(); setMobileMenuOpen(false); }}>
                                        Log Out
                                    </button>
                                </div>
                            </>
                        )}
                    </nav>
                </Portal>
            )}
            <div className={`landing-content ${isXlUp ? 'constrained' : ''}`}>
                <section className="hero-section">
                    {!isMdUp && (
                        <div className="hero-right-mobile">
                            <div className="heartbeat-animation">
                                <div className="pulse-dot"></div>
                            </div>
                        </div>
                    )}
                    <div className="hero-left">
                        <h1>The heartbeat of grassroots live music.</h1>
                        <h4>Find venues and gig opportunities, and build a re-usable professional EPK in minutes, to accelerate your music career.</h4>
                        <div className="hero-cta">
                            <input
                                type="email"
                                className="hero-email-input"
                                placeholder="Email address"
                                value={heroEmail}
                                onChange={(e) => setHeroEmail(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleStartNow();
                                    }
                                }}
                            />
                            <button className="btn primary" onClick={handleStartNow} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                Start Now <RightArrowIcon />
                            </button>
                        </div>
                    </div>
                    {isMdUp && (
                        <div className="hero-right">
                            <div className="heartbeat-animation">
                                <div className="pulse-dot"></div>
                            </div>
                        </div>
                    )}
                </section>
                <section className="epk-section">
                    <h2>An Artist's EPK Solution</h2>
                    {isMdUp ? (
                        <>
                            <div className="epk-features">
                                <div className="epk-feature">
                                    <button 
                                        className={`epk-icon-circle ${activeEpkFeature === 'profile' ? 'active' : ''}`}
                                        onClick={() => handleEpkFeatureChange('profile')}
                                    >
                                        <AlbumCollectionIcon />
                                    </button>
                                    <h4>Profile</h4>
                                </div>
                                <div className="epk-connector"></div>
                                <div className="epk-feature">
                                    <button 
                                        className={`epk-icon-circle ${activeEpkFeature === 'gigs' ? 'active' : ''}`}
                                        onClick={() => handleEpkFeatureChange('gigs')}
                                    >
                                        <MicrophoneLinesIcon />
                                    </button>
                                    <h4>Gigs</h4>
                                </div>
                                <div className="epk-connector"></div>
                                <div className="epk-feature">
                                    <button 
                                        className={`epk-icon-circle ${activeEpkFeature === 'tech-rider' ? 'active' : ''}`}
                                        onClick={() => handleEpkFeatureChange('tech-rider')}
                                    >
                                        <FileUserIcon />
                                    </button>
                                    <h4>Tech Rider</h4>
                                </div>
                                <div className="epk-connector"></div>
                                <div className="epk-feature">
                                    <button 
                                        className={`epk-icon-circle ${activeEpkFeature === 'finances' ? 'active' : ''}`}
                                        onClick={() => handleEpkFeatureChange('finances')}
                                    >
                                        <CoinsIconSolid />
                                    </button>
                                    <h4>Finances</h4>
                                </div>
                                <div className="epk-connector last-connector"></div>
                                <div className="epk-feature">
                                    <button 
                                        className={`epk-icon-circle ${activeEpkFeature === 'media-storage' ? 'active' : ''}`}
                                        onClick={() => handleEpkFeatureChange('media-storage')}
                                    >
                                        <MediaIcon />
                                    </button>
                                    <h4>Media Storage</h4>
                                </div>
                            </div>
                            <section className="artist-profile-section">
                                <div className="artist-profile-image-container">
                                    <img 
                                        src={epkImages[activeEpkFeature]} 
                                        alt="Artist profile example" 
                                        className="artist-profile-screenshot"
                                        key={activeEpkFeature}
                                    />
                                </div>
                            </section>
                        </>
                    ) : (
                        <div className="epk-mobile-features">
                            {epkFeatures.map((feature) => (
                                <div key={feature} className="epk-mobile-feature">
                                    <div className="epk-mobile-header">
                                        <div className="epk-icon-circle">
                                            {feature === 'profile' && <AlbumCollectionIcon />}
                                            {feature === 'gigs' && <MicrophoneLinesIcon />}
                                            {feature === 'tech-rider' && <FileUserIcon />}
                                            {feature === 'finances' && <CoinsIconSolid />}
                                            {feature === 'media-storage' && <MediaIcon />}
                                        </div>
                                        <h4>
                                            {feature === 'profile' && 'Profile'}
                                            {feature === 'gigs' && 'Gigs'}
                                            {feature === 'tech-rider' && 'Tech Rider'}
                                            {feature === 'finances' && 'Finances'}
                                            {feature === 'media-storage' && 'Media Storage'}
                                        </h4>
                                    </div>
                                    <div className="artist-profile-image-container">
                                        <img 
                                            src={epkImages[feature]} 
                                            alt={`${feature} example`}
                                            className="artist-profile-screenshot"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
                <section className="discovery-section">
                    <div className="discovery-content">
                        <div className="discovery-text">
                            <h2>Be Seen. Find venues, and find gigs/enquire directly.</h2>
                            <p>
                                We make gig finding and applications simple by connecting you directly with venues. 
                                No more gatekeepers or complicated application processes. Browse venues on our interactive map, 
                                discover gig opportunities, and reach out to venues instantly. Your music career starts here.
                            </p>
                            <button className="btn primary" onClick={() => navigate('/find-a-gig')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content' }}>
                                Start searching for gigs <RightArrowIcon />
                            </button>
                        </div>
                        <div className="discovery-map-container">
                            <div ref={discoveryMapContainerRef} className="discovery-map" />
                            {discoveryLoading && (
                                <div className="discovery-map-loading">
                                    <span>Loading venues...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
                <section id="pricing-section" className="pricing-section">
                    <h2>We have two pricing tiers to suit your needs</h2>
                    <div className="pricing-cards">
                        <div className="pricing-card">
                            <h2 className="pricing-price">Free</h2>
                            <h3>Starter</h3>
                            <h4>Best for artists just starting out.</h4>
                            <ul className="pricing-features">
                                <li className="black"><SuccessIcon /> 2 artist profiles</li>
                                <li className="black"><SuccessIcon /> Gig booking system</li>
                                <li className="black"><SuccessIcon /> Tech rider</li>
                                <li className="black"><SuccessIcon /> 100MB media storage</li>
                            </ul>
                            <button className="btn primary" onClick={handleCreateArtistProfile}>Get Started <RightArrowIcon /></button>
                        </div>
                        <div className="pricing-card pricing-card-pro">
                            <h2 className="pricing-price">
                                <span className="pricing-amount">£5.99</span>
                                <span className="pricing-period"> / month</span>
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <h3>Gigin</h3>
                                <div className="pro-badge white">
                                    <span>Pro</span>
                                </div>
                            </div>
                            <h4>Best for artists looking to grow their career.</h4>
                            <ul className="pricing-features">
                                <li><SuccessIcon /> All features from the Free tier</li>
                                <li><SuccessIcon /> 3GB media storage</li>
                                <li><SuccessIcon /> Increased profile visibility</li>
                                <li><SuccessIcon /> Add band members to profile</li>
                                <li><SuccessIcon /> Split gig earnings with band members</li>
                            </ul>
                            <button className="btn secondary" onClick={async () => { 
                                await incrementProClicks();
                            }}>Get Started <RightArrowIcon /></button>
                        </div>
                        <div className="pricing-card venue-card">
                            <h3>Are you a venue?</h3>
                            <h4>Take a look at our venue pricing.</h4>
                            <button className="btn tertiary" onClick={() => navigate('/venues')}>
                                Get Started <RightArrowIcon />
                            </button>
                        </div>
                    </div>
                </section>
            </div>
            <Footer />
        </div>
    )
}

