import { useNavigate, Link } from 'react-router-dom';
import { TextLogo, TextLogoLink } from '@features/shared/ui/logos/Logos';
import '@styles/shared/landing-page.styles.css'
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useAuth } from '../../hooks/useAuth';
import { useState, useEffect, useRef } from 'react';
import { RightArrowIcon, MicrophoneLinesIcon, AlbumCollectionIcon, FileUserIcon, SuccessIcon, HamburgerMenuIcon, CloseIcon, ShareIcon } from '../shared/ui/extras/Icons';
import TechRiderImage from '@assets/images/landing_page/artist/tech_rider.png';
import UploadMediaImage from '@assets/images/landing_page/artist/upload_media.png';
import Ap1Image from '@assets/images/landing_page/artist/ap_1.png';
import Ap2Image from '@assets/images/landing_page/artist/ap_2.png';
import { Footer } from '../shared/components/Footer';
import mapboxgl from 'mapbox-gl';
import { fetchNearbyVenues } from '../../services/client-side/venues';
import { fetchNearbyGigs } from '../../services/client-side/gigs';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MobileMenu } from '../shared/components/MobileMenu';
import Portal from '../shared/components/Portal';
import { incrementProClicks } from '../../services/client-side/reports';
import { TextLogoArtistLandingPage } from '../shared/ui/logos/Logos';

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

const labelForGig = (g) =>
    ((g.budget === '£' || g.budget === 'No Fee') && (g.kind === 'Ticketed Gig' || g.kind === 'Open Mic'))
        ? g.kind
        : (g.budget !== 'No Fee' ? g.budget : 'No Fee');

const toGigFeatureCollection = (list) => {
    const features = (list || [])
        .map((gig) => {
            let coordinates;
            if (gig.coordinates && Array.isArray(gig.coordinates) && gig.coordinates.length === 2) {
                coordinates = gig.coordinates;
            } else if (gig.geopoint) {
                const lat = gig.geopoint.latitude ?? gig.geopoint._latitude;
                const lng = gig.geopoint.longitude ?? gig.geopoint._longitude;
                if (typeof lat === 'number' && typeof lng === 'number') {
                    coordinates = [lng, lat];
                }
            }
            if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
                return null;
            }
            return {
                type: 'Feature',
                properties: {
                    gigId: gig.gigId || gig.id,
                    budget: gig.budget,
                    kind: gig.kind,
                    label: labelForGig(gig),
                },
                geometry: { type: 'Point', coordinates },
            };
        })
        .filter(Boolean);
    return {
        type: 'FeatureCollection',
        features,
    };
};

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
    
    // Hero section map state
    const heroMapContainerRef = useRef(null);
    const heroMapRef = useRef(null);
    const heroVenuesRef = useRef([]);
    const [heroLoading, setHeroLoading] = useState(true);
    
    // Discovery section map state (venues)
    const discoveryMapContainerRef = useRef(null);
    const discoveryMapRef = useRef(null);
    const discoveryVenuesRef = useRef([]);
    const [discoveryVenues, setDiscoveryVenues] = useState([]);
    const [discoveryLoading, setDiscoveryLoading] = useState(true);
    
    // Gigs map state (for bottom section)
    const gigsMapContainerRef = useRef(null);
    const gigsMapRef = useRef(null);
    const gigsRef = useRef([]);
    const [gigsLoading, setGigsLoading] = useState(true);
    
    const cambridgeLocation = { latitude: 52.2053, longitude: 0.1218 }; // Cambridge UK
    
    // Map EPK features to images
    const epkImages = {
        profile: Ap1Image,
        gigs: UploadMediaImage,
        'tech-rider': Ap2Image
    };

    // Array of features in order for slideshow
    const epkFeatures = ['profile', 'gigs', 'tech-rider'];

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
            navigate('/venues/dashboard/gigs');
        }
    }, [hasVenueProfile, navigate]);

    // Auto-redirect if user has artist profile (and no venue profile)
    useEffect(() => {
        if (hasArtistProfile && !hasVenueProfile) {
            navigate('/artist-profile');
        }
    }, [hasArtistProfile, hasVenueProfile, navigate]);

    // Fetch venues for hero and discovery sections
    useEffect(() => {
        let cancelled = false;
        const fetchVenues = async () => {
            setHeroLoading(true);
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
                    heroVenuesRef.current = venues;
                }
            } catch (err) {
                console.error('Error fetching venues:', err);
            } finally {
                if (!cancelled) {
                    setHeroLoading(false);
                    setDiscoveryLoading(false);
                }
            }
        };
        fetchVenues();
        return () => { cancelled = true; };
    }, []);

    // Fetch gigs for bottom map section
    useEffect(() => {
        let cancelled = false;
        const fetchGigs = async () => {
            setGigsLoading(true);
            try {
                const { gigs: newGigs } = await fetchNearbyGigs({
                    location: cambridgeLocation,
                    radiusInKm: 50,
                    limitCount: 100,
                    lastDoc: null,
                    filters: {},
                });
                if (!cancelled) {
                    const gigs = newGigs || [];
                    gigsRef.current = gigs;
                }
            } catch (err) {
                console.error('Error fetching gigs:', err);
            } finally {
                if (!cancelled) {
                    setGigsLoading(false);
                }
            }
        };
        fetchGigs();
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

    // Initialize hero map
    useEffect(() => {
        if (!heroMapContainerRef.current || heroMapRef.current) return;
        mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

        const map = new mapboxgl.Map({
            container: heroMapContainerRef.current,
            style: 'mapbox://styles/gigin/clp5jayun01l901pr6ivg5npf',
            center: [cambridgeLocation.longitude, cambridgeLocation.latitude],
            zoom: 12,
        });

        const sourceId = 'hero-venues';

        map.on('load', () => {
            map.addSource(sourceId, {
                type: 'geojson',
                data: toFeatureCollection(heroVenuesRef.current),
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
                const match = heroVenuesRef.current.find((v) => ids.has(v.id));
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

        heroMapRef.current = map;
        return () => { 
            if (heroMapRef.current) {
                heroMapRef.current.remove();
                heroMapRef.current = null;
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

    useEffect(() => {
        if (!heroMapRef.current) return;
        const src = heroMapRef.current.getSource('hero-venues');
        if (src) {
            src.setData(toFeatureCollection(heroVenuesRef.current));
        }
    }, [heroVenuesRef]);

    // Initialize gigs map
    useEffect(() => {
        if (!gigsMapContainerRef.current || gigsMapRef.current) return;
        mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

        const map = new mapboxgl.Map({
            container: gigsMapContainerRef.current,
            style: 'mapbox://styles/gigin/clp5jayun01l901pr6ivg5npf',
            center: [cambridgeLocation.longitude, cambridgeLocation.latitude],
            zoom: 12,
        });

        const sourceId = 'gigs-map';

        map.on('load', () => {
            map.addSource(sourceId, {
                type: 'geojson',
                data: toGigFeatureCollection(gigsRef.current),
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
                    'text-field': ['concat', ['get', 'point_count_abbreviated'], ' Gigs'],
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
                    'text-field': ['get', 'label'],
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
                const gigId = features[0].properties?.gigId;
                if (gigId) {
                    window.open(`/gig/${gigId}`, '_blank', 'noopener,noreferrer');
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

        gigsMapRef.current = map;
        return () => { 
            if (gigsMapRef.current) {
                gigsMapRef.current.remove();
                gigsMapRef.current = null;
            }
        };
    }, []);

    // Update gigs map data when gigs change
    useEffect(() => {
        if (!gigsMapRef.current || gigsLoading) return;
        const src = gigsMapRef.current.getSource('gigs-map');
        if (src) {
            src.setData(toGigFeatureCollection(gigsRef.current));
        }
    }, [gigsLoading]);


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
                        <TextLogoArtistLandingPage />
                        {isMdUp && (
                            <>
                                <button className="nav-link" onClick={() => navigate('/find-a-gig')}>
                                    Find Gig
                                </button>
                                <button className="nav-link" onClick={() => navigate('/find-venues')}>
                                    Find Venue
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
                            <h6 className="or-separator">
                                OR
                            </h6>
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
                            <div className="hero-map-container">
                                <div ref={heroMapContainerRef} className="hero-map" />
                                {heroLoading && (
                                    <div className="hero-map-loading">
                                        <span>Loading venues...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="hero-left">
                        <h1>Find gigs to play, without the hassle.</h1>
                        <h4>Find venues, exclusive gig opportunities, and build a re-usable professional Artist Page in minutes.</h4>
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
                            <button className="btn artist-profile" onClick={handleStartNow} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                Start Now <RightArrowIcon />
                            </button>
                        </div>
                    </div>
                    {isMdUp && (
                        <div className="hero-right">
                            <div className="hero-map-container">
                                <div ref={heroMapContainerRef} className="hero-map" />
                                {heroLoading && (
                                    <div className="hero-map-loading">
                                        <span>Loading venues...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </section>
                <section className="epk-section">
                    <h2>Your Artist Profile: The Key to Unlocking Gigs</h2>
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
                                        </div>
                                        <h4>
                                            {feature === 'profile' && 'Profile'}
                                            {feature === 'gigs' && 'Gigs'}
                                            {feature === 'tech-rider' && 'Tech Rider'}
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
                <section className="profile-link-section">
                    <h2>Build it once. Use it everywhere.</h2>
                    <div className="profile-link-input">
                        <span className="profile-link-text">giginmusic.com/Cardboard-rocket</span>
                        <button className="profile-link-share" aria-label="Share profile link">
                            <ShareIcon />
                        </button>
                    </div>
                    <button className="btn artist-profile" onClick={handleCreateArtistProfile} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Make my Profile <RightArrowIcon />
                    </button>
                    <span className="small-text">Set up time: 5 Minutes</span>
                </section>
                <section className="discovery-section">
                    <div className="discovery-content">
                        <div className="discovery-text">
                            <h2>A simple tech rider</h2>
                            <p>
                            Put your lineup on stage and what you need for a gig, reduce the back and forths, and make it easy for bookers to say yes.
                            </p>
                        </div>
                        <div className="discovery-image">
                            <img src={TechRiderImage} alt="Tech rider" />
                        </div>
                    </div>
                    <div className="discovery-content reverse">
                        <div className="discovery-image">
                            <img src={UploadMediaImage} alt="Upload media" />
                        </div>
                        <div className="discovery-text">
                            <h2>Upload media, and link your socials</h2>
                            <p>
                            An evolving page for your sound, videos, and story, always ready to send.
                            </p>
                        </div>
                    </div>
                </section>
                <section className="discovery-section">
                    <div className="discovery-content">
                        <div className="discovery-text">
                            <h2>Start booking now</h2>
                            <p>
                                Contact venues and bookers directly and find exclusive gigs. Let’s get you on stage.
                            </p>
                            <button className="btn artist-profile" onClick={() => navigate('/find-a-gig')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content' }}>
                                Start searching for gigs <RightArrowIcon />
                            </button>
                        </div>
                        <div className="discovery-map-container">
                            <div ref={gigsMapContainerRef} className="discovery-map" />
                            {gigsLoading && (
                                <div className="discovery-map-loading">
                                    <span>Loading gigs...</span>
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

