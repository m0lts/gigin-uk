/**
 * AdditionalInfoSection Component
 * Component for Tech Rider, Members, and About sections
 */

import { useState, useEffect, useMemo } from 'react';
import { MoreInformationIcon, PeopleGroupIconSolid, TechRiderIcon, EditIcon, AddMember, LeftChevronIcon, RightArrowIcon, PlusIconSolid, CloseIcon, ExitIcon } from "../../../shared/ui/extras/Icons";
import { updateArtistProfileDocument, getArtistProfileMembers, updateArtistProfileMemberPermissions, getArtistProfilePendingInvites } from "@services/client-side/artists";
import { createArtistInvite, removeArtistMember } from "@services/api/artists";
import { sendArtistInviteEmail } from "@services/client-side/emails";
import { ARTIST_PERM_KEYS, ARTIST_PERMS_DISPLAY, ARTIST_PERM_DEFAULTS, sanitizeArtistPermissions } from "@services/utils/permissions";
import { toast } from 'sonner';
import { useAuth } from '@hooks/useAuth';
import { LoadingSpinner } from '../../../shared/ui/loading/Loading';

// Genres for About section
const genres = {
  'Musician/Band': [
    'Rock', 'Pop', 'Jazz', 'Classical', 'Hip Hop', 'Country', 'Blues', 'Reggae', 'Folk', 'Metal', 'R&B', 'Latin', 'World', 'Electronic'
  ],
  'DJ': [
    'EDM', 'House', 'Techno', 'Trance', 'Drum and Bass', 'Dubstep', 'Trap', 'Hip Hop', 'R&B', 'Pop', 'Reggae', 'Latin', 'World', 'Ambient', 'Experimental', 'Funk'
  ]
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const UK_CITIES = [
  'Aberdeen', 'Ayr', 'Bath', 'Belfast', 'Birmingham', 'Blackburn', 'Blackpool', 'Bolton', 'Bournemouth', 'Bradford',
  'Brighton', 'Bristol', 'Burnley', 'Cambridge', 'Canterbury', 'Cardiff', 'Carlisle', 'Chester', 'Coventry', 'Derby',
  'Dumfries', 'Dundee', 'Durham', 'Edinburgh', 'Ely', 'Exeter', 'Falkirk', 'Glasgow', 'Gloucester', 'Greenock',
  'Hereford', 'Inverness', 'Ipswich', 'Kilmarnock', 'Kingston upon Hull', 'Lancaster', 'Leeds', 'Leicester', 'Lincoln',
  'Liverpool', 'Livingston', 'London', 'Luton', 'Manchester', 'Middlesbrough', 'Newcastle upon Tyne', 'Northampton',
  'Norwich', 'Nottingham', 'Oxford', 'Paisley', 'Perth', 'Peterborough', 'Portsmouth', 'Preston', 'Reading', 'Sheffield',
  'Slough', 'Southampton', 'Southend-on-Sea', 'Stirling', 'Stoke-on-Trent', 'Swindon', 'Truro', 'Wolverhampton',
  'Worcester', 'York'
];

// Instrument types for tech rider
const INSTRUMENT_TYPES = [
  'Vocals',
  'Drums',
  'Keys',
  'Guitar',
  'Bass',
  'Tenor Sax',
  'Alto Sax',
  'Soprano Sax',
  'Trumpet',
  'Trombone',
  'Other',
  'Playback'
];

// Instrument-specific question configurations
const INSTRUMENT_QUESTIONS = {
  'Vocals': [
    { key: 'needsMic', type: 'yesno', label: 'Needs mic provided?', notes: true },
    { key: 'needsMicStand', type: 'yesno', label: 'Need mic stand provided?', notes: true },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Drums': [
    { key: 'needsDrumKit', type: 'yesno', label: 'Need drum kit provided?', notes: true },
    { key: 'needsCymbals', type: 'yesno', label: 'Need cymbals provided?', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Needs mic provided?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsMicStand', type: 'yesno', label: 'Needs stand provided?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Keys': [
    { key: 'bringingKeyboard', type: 'yesno', label: 'Bringing keyboard?', notes: false },
    { key: 'needsDI', type: 'yesno', label: 'Need DI?', notes: true },
    { key: 'needsKeyboardStand', type: 'yesno', label: 'Need keyboard stand provided?', notes: true },
    { key: 'hasSeat', type: 'yesno', label: 'Have seat (if needed)?', notes: false },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Guitar': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsAmp', type: 'yesno', label: 'Need amp provided?', notes: true },
    { key: 'needsDI', type: 'yesno', label: 'Need DI?', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Bass': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsAmp', type: 'yesno', label: 'Need amp provided?', notes: true },
    { key: 'needsDI', type: 'yesno', label: 'Need DI?', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Tenor Sax': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Need mic provided? (in case horns need amplification)', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMicForSinging', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Alto Sax': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Need mic provided? (in case horns need amplification)', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMicForSinging', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Soprano Sax': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Need mic provided? (in case horns need amplification)', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMicForSinging', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Trumpet': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Need mic provided? (in case horns need amplification)', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMicForSinging', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Trombone': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Need mic provided? (in case horns need amplification)', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMicForSinging', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Other': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsAmp', type: 'yesno', label: 'Need amp provided?', notes: true },
    { key: 'needsDI', type: 'yesno', label: 'Need DI?', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Playback': [
    { key: 'hasPrerecordedSounds', type: 'yesno', label: 'Have pre-recorded sounds?', notes: false },
    { key: 'bringingLaptopPhone', type: 'yesno', label: 'Bringing laptop/phone and connectivity?', notes: false, dependsOn: { key: 'hasPrerecordedSounds', value: true } },
    { key: 'needsDI', type: 'yesno', label: 'Need DI?', notes: true },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ]
};

async function geocodeCity(city) {
  if (!city || city.trim().length < 2) return null;
  try {
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(city)}.json`);
    url.searchParams.set('access_token', MAPBOX_TOKEN);
    url.searchParams.set('types', 'place');
    url.searchParams.set('limit', '1');
    url.searchParams.set('country', 'gb');
    
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Geocode failed: ${res.status}`);
    const data = await res.json();
    
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { city, coordinates: [lat, lng] };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export const AdditionalInfoSection = ({ type, onClose, profileData, profileId, canEdit = true, isOwner = false }) => {
  // All hooks must be declared at the top, before any conditional returns
  
  // State for About section editing
  const [artistType, setArtistType] = useState(profileData?.artistType || '');
  const [selectedGenres, setSelectedGenres] = useState(profileData?.genres || []);
  const [city, setCity] = useState(profileData?.location?.city || '');
  const [cityCoordinates, setCityCoordinates] = useState(profileData?.location?.coordinates || null);
  const [travelDistance, setTravelDistance] = useState(profileData?.location?.travelDistance || '');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // State for Members section
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editingPermissions, setEditingPermissions] = useState({ ...ARTIST_PERM_DEFAULTS });
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [isUpdatingPermissions, setIsUpdatingPermissions] = useState(false);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [invitePermissions, setInvitePermissions] = useState({ ...ARTIST_PERM_DEFAULTS });
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // State for Tech Rider section
  const [techRiderStage, setTechRiderStage] = useState(1); // 1-6 stages
  const [techRiderData, setTechRiderData] = useState({
    lineup: [],
    performerDetails: [],
    extraNotes: '',
    stageArrangement: {
      performers: [],
      stageWidth: null,
      stageDepth: null
    },
    isComplete: false
  });
  const [loadingTechRider, setLoadingTechRider] = useState(false);
  const [savingTechRider, setSavingTechRider] = useState(false);
  const [currentPerformerIndex, setCurrentPerformerIndex] = useState(0); // For Stage 2 substages

  // Initialize state from profileData
  useEffect(() => {
    if (type === 'about' && profileData) {
      setArtistType(profileData.artistType || '');
      setSelectedGenres(profileData.genres || []);
      setCity(profileData.location?.city || '');
      setCityCoordinates(profileData.location?.coordinates || null);
      setTravelDistance(profileData.location?.travelDistance || '');
      setHasChanges(false);
    }
  }, [type, profileData]);

  // Track changes
  useEffect(() => {
    if (type === 'about') {
      const original = {
        artistType: profileData?.artistType || '',
        genres: profileData?.genres || [],
        city: profileData?.location?.city || '',
        coordinates: profileData?.location?.coordinates || null,
        travelDistance: profileData?.location?.travelDistance || '',
      };

      const current = {
        artistType,
        genres: selectedGenres,
        city,
        coordinates: cityCoordinates,
        travelDistance,
      };

      const changed = 
        original.artistType !== current.artistType ||
        JSON.stringify(original.genres.sort()) !== JSON.stringify(current.genres.sort()) ||
        original.city !== current.city ||
        JSON.stringify(original.coordinates) !== JSON.stringify(current.coordinates) ||
        original.travelDistance !== current.travelDistance;

      setHasChanges(changed);
    }
  }, [type, artistType, selectedGenres, city, cityCoordinates, travelDistance, profileData]);

  // Initialize tech rider data from profileData
  useEffect(() => {
    if (type === 'tech-rider' && profileData?.techRider) {
      setTechRiderData({
        lineup: profileData.techRider.lineup || [],
        performerDetails: profileData.techRider.performerDetails || [],
        extraNotes: profileData.techRider.extraNotes || '',
        stageArrangement: profileData.techRider.stageArrangement || {
          performers: [],
          stageWidth: null,
          stageDepth: null
        },
        isComplete: profileData.techRider.isComplete || false
      });
      // If tech rider exists, start at stage 1 but allow navigation
      setTechRiderStage(1);
    } else if (type === 'tech-rider' && !profileData?.techRider) {
      // Reset to empty state
      setTechRiderData({
        lineup: [],
        performerDetails: [],
        extraNotes: '',
        stageArrangement: {
          performers: [],
          stageWidth: null,
          stageDepth: null
        },
        isComplete: false
      });
      setTechRiderStage(1);
    }
  }, [type, profileData]);


  // Fetch members and pending invites when Members section is opened
  useEffect(() => {
    if (type === 'members' && profileId) {
      const fetchData = async () => {
        setLoadingMembers(true);
        try {
          // Always try to fetch members
          const membersList = await getArtistProfileMembers(profileId);
          setMembers(membersList);
          
          // Try to fetch invites, but don't fail if user doesn't have permission
          try {
            const invitesList = await getArtistProfilePendingInvites(profileId);
            setPendingInvites(invitesList);
          } catch (inviteError) {
            // If user doesn't have permission to read invites, just set empty array
            // This allows members without profile.edit to still see the members section
            console.warn('Unable to fetch invites (may not have permission):', inviteError);
            setPendingInvites([]);
          }
        } catch (error) {
          console.error('Failed to fetch members/invites:', error);
          toast.error('Failed to load members');
        } finally {
          setLoadingMembers(false);
        }
      };
      fetchData();
    } else {
      // Reset state when switching away from members section
      setMembers([]);
      setPendingInvites([]);
      setEditingMemberId(null);
      setRemovingMemberId(null);
      setIsAddingMember(false);
      setInviteEmail('');
      setInvitePermissions({ ...ARTIST_PERM_DEFAULTS });
    }
  }, [type, profileId]);

  const handleArtistTypeSelect = (type) => {
    setArtistType(type);
    setSelectedGenres([]); // Reset genres when type changes
  };

  const handleGenreToggle = (genre) => {
    setSelectedGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const handleCityChange = async (value) => {
    if (!value) {
      setCity('');
      setCityCoordinates(null);
      return;
    }
    
    setCity(value);
    setIsGeocoding(true);
    
    try {
      const result = await geocodeCity(value);
      if (result) {
        setCity(result.city);
        setCityCoordinates(result.coordinates);
      } else {
        setCityCoordinates(null);
      }
    } catch (error) {
      console.error('Failed to geocode city:', error);
      setCityCoordinates(null);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleTravelDistanceSelect = (distance) => {
    setTravelDistance(distance);
  };

  const handleCancel = () => {
    // Reset to original values
    setArtistType(profileData?.artistType || '');
    setSelectedGenres(profileData?.genres || []);
    setCity(profileData?.location?.city || '');
    setCityCoordinates(profileData?.location?.coordinates || null);
    setTravelDistance(profileData?.location?.travelDistance || '');
    setHasChanges(false);
  };

  const handleSave = async () => {
    if (!profileId || isSaving) return;

    setIsSaving(true);
    try {
      const updates = {
        artistType: artistType || null,
        genres: selectedGenres,
        location: city && cityCoordinates ? {
          city,
          coordinates: cityCoordinates,
          travelDistance: travelDistance || null,
        } : null,
      };

      await updateArtistProfileDocument(profileId, updates);
      toast.success('About information updated successfully');
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save about information:', error);
      toast.error('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'tech-rider':
        return <TechRiderIcon />;
      case 'members':
        return <PeopleGroupIconSolid />;
      case 'about':
        return <MoreInformationIcon />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'tech-rider':
        return 'Tech Rider';
      case 'members':
        return 'Members';
      case 'about':
        return 'About';
      default:
        return 'Additional Info';
    }
  };

  const getDescription = () => {
    switch (type) {
      case 'tech-rider':
        return 'Technical requirements and equipment specifications';
      case 'members':
        return 'Band members and collaborators';
      case 'about':
        return 'Artist information and details';
      default:
        return 'Additional information';
    }
  };

  // Render About section with editable fields
  if (type === 'about') {
    const hasAboutContent =
      !!artistType ||
      (Array.isArray(selectedGenres) && selectedGenres.length > 0) ||
      !!city ||
      !!travelDistance;

    // For viewers (canEdit === false) with no data, show a simple placeholder
    if (!canEdit && !hasAboutContent) {
      return (
        <div className="additional-info-section">
          <div className="section-header">
            <div className="title">
              {getIcon()}
              <h3>{getTitle()}</h3>
            </div>
          </div>
          <div className="section-content">
            <p>The artist hasn&apos;t added any information here yet.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="additional-info-section">
        <div className="section-header">
          <div className="title">
            {getIcon()}
            <h3>{getTitle()}</h3>
          </div>
        </div>
        <div className="section-content">
          {/* Artist Type */}
          <div className="about-field-section">
            <h6 className="label about-field-title">
              Performer Type
            </h6>
            <div className="selection-container">
              <div className="selections">
                <div 
                  className={`selection-card ${artistType === 'Musician/Band' ? 'selected' : ''} ${!canEdit ? 'read-only' : ''}`}
                  onClick={canEdit ? () => handleArtistTypeSelect('Musician/Band') : undefined}
                >
                  <h4 className='text'>Musician/Band</h4>
                </div>
                <div 
                  className={`selection-card ${artistType === 'DJ' ? 'selected' : ''} ${!canEdit ? 'read-only' : ''}`}
                  onClick={canEdit ? () => handleArtistTypeSelect('DJ') : undefined}
                >
                  <h4 className='text'>DJ</h4>
                </div>
              </div>
            </div>
          </div>

          {/* Genres */}
          {artistType && (
            <div className="about-field-section">
              <h6 className="label about-field-title">
                Genres
              </h6>
              <div className="selection-container">
                <div className="selections">
                  {genres[artistType]?.map((genre) => (
                    <div
                      key={genre}
                      className={`selection-card ${selectedGenres.includes(genre) ? 'selected' : ''} ${!canEdit ? 'read-only' : ''}`}
                      onClick={canEdit ? () => handleGenreToggle(genre) : undefined}
                    >
                      {genre}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Location */}
          <div className="about-field-section">
            <div className="input-container" style={{ marginBottom: '0.5rem' }}>
              <label htmlFor="about-city" className='label'>City</label>
              <select
                className='input'
                id="about-city"
                value={city}
                onChange={canEdit ? (e) => handleCityChange(e.target.value) : undefined}
                disabled={!canEdit}
              >
                <option value="">Select a city</option>
                {UK_CITIES.map((cityName) => (
                  <option key={cityName} value={cityName}>
                    {cityName}
                  </option>
                ))}
              </select>
              {isGeocoding && <p style={{ fontSize: '0.85rem', color: 'var(--gn-grey-500)', marginTop: '0.5rem' }}>Finding your location...</p>}
            </div>
            <div className="selection-container">
              <h6 className='label'>Travel Distance</h6>
              <div className="selections">
                {['5 miles', '25 miles', '50 miles', '100 miles', 'Nationwide'].map((distance) => (
                  <div
                    key={distance}
                    className={`selection-card ${travelDistance === distance ? 'selected' : ''} ${!canEdit ? 'read-only' : ''}`}
                    onClick={canEdit ? () => handleTravelDistanceSelect(distance) : undefined}
                  >
                    <h4 className='text'>{distance}</h4>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Save/Cancel Buttons */}
          {canEdit && hasChanges && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                className="btn tertiary"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="btn artist-profile"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const handleEditPermissions = (member) => {
    setEditingMemberId(member.id);
    setEditingPermissions(member.permissions || { ...ARTIST_PERM_DEFAULTS });
  };

  const handlePermissionToggle = (permissionKey) => {
    // profile.viewer can't be unselected
    if (permissionKey === 'profile.viewer') return;
    
    setEditingPermissions(prev => ({
      ...prev,
      [permissionKey]: !prev[permissionKey],
    }));
  };

  const handleCancelEditPermissions = () => {
    setEditingMemberId(null);
    setEditingPermissions({ ...ARTIST_PERM_DEFAULTS });
  };

  const handleUpdatePermissions = async () => {
    if (!profileId || !editingMemberId || isUpdatingPermissions) return;

    setIsUpdatingPermissions(true);
    try {
      const sanitizedPermissions = sanitizeArtistPermissions(editingPermissions);
      await updateArtistProfileMemberPermissions(profileId, editingMemberId, sanitizedPermissions);
      
      // Update local state
      setMembers(prev => prev.map(m => 
        m.id === editingMemberId 
          ? { ...m, permissions: sanitizedPermissions }
          : m
      ));
      
      toast.success('Permissions updated successfully');
      setEditingMemberId(null);
    } catch (error) {
      console.error('Failed to update permissions:', error);
      toast.error('Failed to update permissions. Please try again.');
    } finally {
      setIsUpdatingPermissions(false);
    }
  };

  const handleRemoveClick = (memberId) => {
    setRemovingMemberId(memberId);
  };

  const handleCancelRemove = () => {
    setRemovingMemberId(null);
  };

  const handleConfirmRemove = async () => {
    if (!profileId || !removingMemberId || isRemovingMember) return;

    setIsRemovingMember(true);
    try {
      await removeArtistMember({ artistProfileId: profileId, memberId: removingMemberId });
      
      // Update local state
      setMembers(prev => prev.filter(m => m.id !== removingMemberId));
      
      toast.success('Member removed successfully');
      setRemovingMemberId(null);
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error('Failed to remove member. Please try again.');
    } finally {
      setIsRemovingMember(false);
    }
  };

  const handleAddMemberClick = () => {
    setIsAddingMember(true);
    setInvitePermissions({ ...ARTIST_PERM_DEFAULTS });
    setInviteEmail('');
  };

  const handleCancelAddMember = () => {
    setIsAddingMember(false);
    setInviteEmail('');
    setInvitePermissions({ ...ARTIST_PERM_DEFAULTS });
  };

  const handleInvitePermissionToggle = (permissionKey) => {
    // profile.viewer can't be unselected
    if (permissionKey === 'profile.viewer') return;
    
    setInvitePermissions(prev => ({
      ...prev,
      [permissionKey]: !prev[permissionKey],
    }));
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendInvite = async () => {
    const trimmedEmail = inviteEmail.trim();
    
    if (!trimmedEmail) return;

    // Validate email format
    if (!validateEmail(trimmedEmail)) {
      toast.error('Please enter a valid email address');
      setInviteEmail('');
      return;
    }

    // Check if email matches current user's email
    if (user?.email && trimmedEmail.toLowerCase() === user.email.toLowerCase()) {
      toast.error('You cannot invite yourself');
      setInviteEmail('');
      return;
    }

    if (!profileId) {
      toast.error('Profile ID is missing');
      return;
    }

    try {
      setIsSendingInvite(true);
      
      // Sanitize permissions before sending
      const sanitizedPermissions = sanitizeArtistPermissions(invitePermissions);
      
      // Create the invite via backend
      const invite = await createArtistInvite({
        artistProfileId: profileId,
        email: trimmedEmail,
        permissionsInput: sanitizedPermissions,
        invitedByName: user?.name || null,
      });

      const inviteId = invite?.inviteId || null;
      if (!inviteId) {
        toast.error("Failed to create invite");
        return;
      }

      const link = `${window.location.origin}/join-artist?invite=${inviteId}`;

      await sendArtistInviteEmail({
        to: trimmedEmail,
        artistProfile: { name: profileData?.name || 'your artist profile' },
        link,
      });

      toast.success(`Invitation sent to ${trimmedEmail}`);
      
      // Reset permissions to default and clear email
      setInvitePermissions({ ...ARTIST_PERM_DEFAULTS });
      setInviteEmail('');
      setIsAddingMember(false);
      
      // Refresh pending invites to show the new invite
      try {
        const invitesList = await getArtistProfilePendingInvites(profileId);
        setPendingInvites(invitesList);
      } catch (error) {
        console.error('Failed to refresh invites:', error);
      }
    } catch (error) {
      console.error('Error sending invite:', error);
      toast.error('Failed to send invite. Please try again.');
    } finally {
      setIsSendingInvite(false);
    }
  };

  // Render Members section
  if (type === 'members') {
    // Render add member view
    if (canEdit && isOwner && isAddingMember) {
      return (
        <div className="additional-info-section">
          <div className="section-header">
            <div className="title">
              {getIcon()}
              <h3>Add Member</h3>
            </div>
          </div>
          <div className="section-content">
            <div className="members-step-container">
              <div className="members-permissions-section">
                <h4 className="section-title">Permissions</h4>
                <div className="permissions-list">
                  {ARTIST_PERM_KEYS.map((permissionKey) => (
                    <label key={permissionKey} className="permission-checkbox">
                      <input
                        type="checkbox"
                        checked={!!invitePermissions[permissionKey]}
                        onChange={() => handleInvitePermissionToggle(permissionKey)}
                        disabled={permissionKey === 'profile.viewer'}
                      />
                      <span>{ARTIST_PERMS_DISPLAY[permissionKey]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="members-email-section">
                <h4 className="section-title">Invite Member</h4>
                <div className="email-input-container">
                  <input
                    type="email"
                    className="input"
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSendInvite();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn artist-profile send-button"
                    onClick={handleSendInvite}
                    disabled={!inviteEmail.trim() || isSendingInvite}
                  >
                    {isSendingInvite ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                className="btn tertiary"
                onClick={handleCancelAddMember}
                disabled={isSendingInvite}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Render edit permissions view
    if (canEdit && isOwner && editingMemberId) {
      const member = members.find(m => m.id === editingMemberId);
      return (
        <div className="additional-info-section">
          <div className="section-header">
            <div className="title">
              {getIcon()}
              <h3>Edit Permissions - {member?.userName || member?.userEmail || 'Member'}</h3>
            </div>
          </div>
          <div className="section-content">
            <div className="members-permissions-section">
              <div className="permissions-list">
                {ARTIST_PERM_KEYS.map((permissionKey) => (
                  <label key={permissionKey} className="permission-checkbox">
                    <input
                      type="checkbox"
                      checked={!!editingPermissions[permissionKey]}
                      onChange={() => handlePermissionToggle(permissionKey)}
                      disabled={permissionKey === 'profile.viewer'}
                    />
                    <span>{ARTIST_PERMS_DISPLAY[permissionKey]}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                className="btn tertiary"
                onClick={handleCancelEditPermissions}
                disabled={isUpdatingPermissions}
              >
                Cancel
              </button>
              <button
                className="btn artist-profile"
                onClick={handleUpdatePermissions}
                disabled={isUpdatingPermissions}
              >
                {isUpdatingPermissions ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Render remove confirmation view
    if (canEdit && removingMemberId) {
      const member = members.find(m => m.id === removingMemberId);
      return (
        <div className="additional-info-section">
          <div className="section-header">
            <div className="title">
              {getIcon()}
              <h3>Remove Member</h3>
            </div>
          </div>
          <div className="section-content">
            <p>Are you sure you want to remove {member?.userName || member?.userEmail || 'this member'}?</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                className="btn tertiary"
                onClick={handleCancelRemove}
                disabled={isRemovingMember}
              >
                Cancel
              </button>
              <button
                className="btn artist-profile"
                onClick={handleConfirmRemove}
                disabled={isRemovingMember}
              >
                {isRemovingMember ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Render members list view
    return (
      <div className="additional-info-section">
        <div className="section-header">
          <div className="title">
            {getIcon()}
            <h3>{getTitle()}</h3>
          </div>
          {canEdit && isOwner && (
            <button
              className="btn primary add-member-btn"
              onClick={handleAddMemberClick}
            >
              <AddMember />
              Add Member
            </button>
          )}
        </div>
        <div className="section-content">
          {loadingMembers ? (
            <LoadingSpinner marginTop={'1rem'} marginBottom={'1rem'} />
          ) : members.length === 0 && pendingInvites.length === 0 ? (
            <p>No members found.</p>
          ) : (
            <div className="members-list">
              {/* Active Members */}
              {members.map((member) => (
                <div key={member.id} className="member-item">
                  <div className="member-name">
                    {member.userName || member.userEmail || 'Unknown Member'}
                    {member.role === 'owner' && (
                      <span className="member-role"> (Owner)</span>
                    )}
                  </div>
                  {canEdit && isOwner && member.role !== 'owner' && (
                    <div className="member-actions">
                        <button
                        className="btn tertiary small"
                        onClick={() => handleEditPermissions(member)}
                        title="Edit Permissions"
                        >
                            Edit Permissions
                        </button>
                        <button
                            className="btn danger small"
                            onClick={() => handleRemoveClick(member.id)}
                            title="Remove Member"
                        >
                            Remove
                        </button>
                    </div>
                  )}
                </div>
              ))}
              {/* Pending Invites */}
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="member-item pending">
                  <div className="member-name">
                    {invite.email}
                    <span className="member-status pending">Invited</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tech Rider Handlers
  const handleTechRiderStageChange = (newStage) => {
    if (newStage >= 1 && newStage <= 6) {
      setTechRiderStage(newStage);
      if (newStage === 2) {
        setCurrentPerformerIndex(0);
      }
    }
  };

  const handleAddPerformer = () => {
    const newPerformer = {
      performerId: null,
      performerName: '',
      instruments: [],
      isMember: false,
      memberId: null
    };
    setTechRiderData(prev => ({
      ...prev,
      lineup: [...prev.lineup, newPerformer],
      performerDetails: [...prev.performerDetails, {}]
    }));
  };

  const handleRemovePerformer = (index) => {
    setTechRiderData(prev => {
      const newLineup = prev.lineup.filter((_, i) => i !== index);
      const newDetails = prev.performerDetails.filter((_, i) => i !== index);
      // Also remove from stage arrangement
      const newArrangement = {
        ...prev.stageArrangement,
        performers: prev.stageArrangement.performers.filter(p => p.lineupIndex !== index)
          .map(p => p.lineupIndex > index ? { ...p, lineupIndex: p.lineupIndex - 1 } : p)
      };
      return {
        ...prev,
        lineup: newLineup,
        performerDetails: newDetails,
        stageArrangement: newArrangement
      };
    });
  };

  const handleUpdatePerformer = (index, updates) => {
    setTechRiderData(prev => {
      const newLineup = [...prev.lineup];
      newLineup[index] = { ...newLineup[index], ...updates };
      return { ...prev, lineup: newLineup };
    });
  };

  const handleAddInstrument = (performerIndex) => {
    const performer = techRiderData.lineup[performerIndex];
    const currentInstruments = performer.instruments || [];
    handleUpdatePerformer(performerIndex, { instruments: [...currentInstruments, ''] });
  };

  const handleUpdateInstrument = (performerIndex, instrumentIndex, instrumentValue) => {
    const performer = techRiderData.lineup[performerIndex];
    const currentInstruments = [...(performer.instruments || [])];
    currentInstruments[instrumentIndex] = instrumentValue;
    // Remove empty strings from the array
    const filteredInstruments = currentInstruments.filter(i => i !== '');
    handleUpdatePerformer(performerIndex, { instruments: filteredInstruments });
  };

  const handleRemoveInstrument = (performerIndex, instrumentIndex) => {
    const performer = techRiderData.lineup[performerIndex];
    const currentInstruments = [...(performer.instruments || [])];
    currentInstruments.splice(instrumentIndex, 1);
    handleUpdatePerformer(performerIndex, { instruments: currentInstruments });
  };

  const handleUpdatePerformerDetails = (index, updates) => {
    setTechRiderData(prev => {
      const newDetails = [...prev.performerDetails];
      newDetails[index] = { ...newDetails[index], ...updates };
      return { ...prev, performerDetails: newDetails };
    });
  };

  const handleAddMemberFromLineup = async (performerIndex) => {
    const performer = techRiderData.lineup[performerIndex];
    if (!performer || !performer.performerName || !performer.performerName.includes('@')) {
      toast.error('Please enter a valid email address for the performer');
      return;
    }

    try {
      setIsSendingInvite(true);
      const sanitizedPermissions = sanitizeArtistPermissions({ ...ARTIST_PERM_DEFAULTS });
      
      const invite = await createArtistInvite({
        artistProfileId: profileId,
        email: performer.performerName.trim(),
        permissionsInput: sanitizedPermissions,
        invitedByName: user?.name || null,
      });

      if (invite?.inviteId) {
        const link = `${window.location.origin}/join-artist?invite=${invite.inviteId}`;
        await sendArtistInviteEmail({
          to: performer.performerName.trim(),
          artistProfile: { name: profileData?.name || 'your artist profile' },
          link,
        });
        toast.success(`Invitation sent to ${performer.performerName}`);
      }
    } catch (error) {
      console.error('Error sending invite:', error);
      toast.error('Failed to send invite. Please try again.');
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleSaveTechRider = async () => {
    if (!profileId || savingTechRider) return;

    setSavingTechRider(true);
    try {
      const techRiderPayload = {
        ...techRiderData,
        lastUpdated: new Date().toISOString(),
        version: 1
      };

      await updateArtistProfileDocument(profileId, {
        techRider: techRiderPayload
      });

      toast.success('Tech rider saved successfully');
    } catch (error) {
      console.error('Failed to save tech rider:', error);
      toast.error('Failed to save tech rider. Please try again.');
    } finally {
      setSavingTechRider(false);
    }
  };

  // Auto-populate lineup from members when tech rider is first opened (only if lineup is empty and no existing tech rider)
  useEffect(() => {
    if (type === 'tech-rider' && profileId) {
      const fetchAndPopulate = async () => {
        try {
          const membersList = await getArtistProfileMembers(profileId);
          setMembers(membersList);
          
          // Only auto-populate if tech rider doesn't exist yet and lineup is empty
          if (membersList.length > 0 && !profileData?.techRider) {
            setTechRiderData(prev => {
              // Only populate if lineup is still empty
              if (prev.lineup.length === 0) {
                const lineupFromMembers = membersList.map(member => ({
                  performerId: member.userId || member.id,
                  performerName: member.userName || member.userEmail || 'Unknown',
                  instruments: [],
                  isMember: true,
                  memberId: member.id
                }));
                const detailsFromMembers = membersList.map(() => ({}));
                
                return {
                  ...prev,
                  lineup: lineupFromMembers,
                  performerDetails: detailsFromMembers
                };
              }
              return prev;
            });
          }
        } catch (error) {
          console.error('Failed to fetch members for tech rider:', error);
        }
      };
      fetchAndPopulate();
    }
  }, [type, profileId, profileData?.techRider]); // Only run when type, profileId, or techRider existence changes

  // Render Tech Rider section
  if (type === 'tech-rider') {
    return (
      <div className="additional-info-section">
        <div className="section-header">
          <div className="title">
            {getIcon()}
            <h3>{getTitle()}</h3>
          </div>
          {canEdit && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn primary"
                onClick={handleSaveTechRider}
                disabled={savingTechRider}
              >
                {savingTechRider ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
        <div className="section-content">
          {/* Stage 1: Lineup */}
          {techRiderStage === 1 && (
            <div className="tech-rider-stage">
              <h4>Lineup</h4>
              
              {techRiderData.lineup.map((performer, index) => {
                // Check if this performer is the profile owner
                const isProfileOwner = performer.isMember && performer.performerId === profileData?.userId;
                
                return (
                <div key={index} className="tech-rider-performer-row">
                  {/* Single row: Name input, Instrument dropdowns, and Remove button */}
                  <div className="tech-rider-performer-content">
                    <div className="tech-rider-performer-name-field">
                      <label className="label tech-rider-performer-name-label">Performer Name</label>
                      <input
                        type="text"
                        className="input tech-rider-performer-name-input"
                        value={performer.performerName}
                        onChange={(e) => handleUpdatePerformer(index, { performerName: e.target.value })}
                        disabled={!canEdit || performer.isMember}
                        placeholder="Enter performer name or email"
                      />
                    </div>

                    <div className="tech-rider-instruments-container">
                      {/* First instrument with plus button inline */}
                      <div className="tech-rider-instrument-row">
                        <div className="tech-rider-instrument-field">
                          <label className="label tech-rider-instrument-label">Instrument{performer.instruments.length <= 1 ? '' : 's'}</label>
                          <select
                            className="input tech-rider-instrument-select"
                            value={(performer.instruments && performer.instruments[0]) || ''}
                            onChange={(e) => handleUpdateInstrument(index, 0, e.target.value)}
                            disabled={!canEdit}
                          >
                            <option value="">Select instrument</option>
                            {INSTRUMENT_TYPES.map((inst) => (
                              <option key={inst} value={inst}>
                                {inst}
                              </option>
                            ))}
                          </select>
                        </div>
                        {canEdit && (
                          <button
                            className="btn icon tech-rider-add-instrument-btn"
                            onClick={() => handleAddInstrument(index)}
                            title="Add another instrument"
                          >
                            <PlusIconSolid />
                          </button>
                        )}
                      </div>
                      
                      {/* Additional instruments below, each with minus button */}
                      {performer.instruments && performer.instruments.length > 1 && performer.instruments.slice(1).map((instrument, instIndex) => (
                        <div key={instIndex + 1} className="tech-rider-instrument-row">
                          <div className="tech-rider-instrument-field">
                            <select
                              className="input tech-rider-instrument-select"
                              value={instrument || ''}
                              onChange={(e) => handleUpdateInstrument(index, instIndex + 1, e.target.value)}
                              disabled={!canEdit}
                            >
                              <option value="">Select instrument</option>
                              {INSTRUMENT_TYPES.map((inst) => (
                                <option key={inst} value={inst}>
                                  {inst}
                                </option>
                              ))}
                            </select>
                          </div>
                          {canEdit && (
                            <button
                              className="btn icon tech-rider-remove-instrument-btn"
                              onClick={() => handleRemoveInstrument(index, instIndex + 1)}
                              title="Remove instrument"
                            >
                              <CloseIcon />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Remove button - don't show for profile owner */}
                    {canEdit && !isProfileOwner && (
                      <div className="tech-rider-remove-performer-wrapper">
                        <button
                          className="btn danger small tech-rider-remove-performer-btn"
                          onClick={() => handleRemovePerformer(index)}
                          title="Remove performer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )})}

              {canEdit && (
                <button
                  className="btn secondary tech-rider-add-performer-btn"
                  onClick={handleAddPerformer}
                >
                  <PlusIconSolid /> Add Performer
                </button>
              )}

              {canEdit && techRiderData.lineup.length > 0 && (
                <div className="tech-rider-stage-nav">
                  <button
                    className="btn artist-profile"
                    onClick={() => handleTechRiderStageChange(2)}
                  >
                    Next <RightArrowIcon />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Stage 2: Performer Details */}
          {techRiderStage === 2 && (
            <div className="tech-rider-stage">
              <h4>
                {techRiderData.lineup[currentPerformerIndex]?.performerName || `Performer ${currentPerformerIndex + 1}`}'s Performer Details
              </h4>
              
              {techRiderData.lineup.length === 0 ? (
                <div>
                  <p>Please add performers in Stage 1 first.</p>
                  <button
                    className="btn artist-profile"
                    onClick={() => handleTechRiderStageChange(1)}
                  >
                    Go to Stage 1
                  </button>
                </div>
              ) : (
                <>
                  {/* Questions for current performer's instruments */}
                  {techRiderData.lineup[currentPerformerIndex]?.instruments?.map((instrument) => {
                    const questions = INSTRUMENT_QUESTIONS[instrument] || [];
                    const details = techRiderData.performerDetails[currentPerformerIndex] || {};
                    const instrumentDetails = details[instrument] || {};

                    return (
                      <div key={instrument} className="tech-rider-instrument-questions">
                        {questions.map((question) => {
                          // Check if question should be shown based on dependencies
                          if (question.dependsOn) {
                            const dependsValue = instrumentDetails[question.dependsOn.key];
                            if (dependsValue !== question.dependsOn.value) {
                              return null;
                            }
                          }

                          const questionKey = `${instrument}_${question.key}`;
                          const currentValue = instrumentDetails[question.key];

                          if (question.type === 'yesno') {
                            const isRequired = question.key !== 'extraNotes';
                            return (
                              <div key={questionKey} className="tech-rider-question-field">
                                <label className="label">
                                  {question.label}
                                  {isRequired && <span className="required-asterisk">*</span>}
                                </label>
                                <div className={`tech-rider-yesno-radio ${!question.notes ? 'no-notes' : ''}`}>
                                  <label className={`tech-rider-radio-option ${currentValue === true ? 'selected' : ''}`}>
                                    <input
                                      type="radio"
                                      name={questionKey}
                                      checked={currentValue === true}
                                      onChange={() => {
                                        const newDetails = { ...instrumentDetails, [question.key]: true };
                                        handleUpdatePerformerDetails(currentPerformerIndex, {
                                          ...details,
                                          [instrument]: newDetails
                                        });
                                      }}
                                      disabled={!canEdit}
                                    />
                                    <span>Yes</span>
                                  </label>
                                  <label className={`tech-rider-radio-option ${currentValue === false ? 'selected' : ''}`}>
                                    <input
                                      type="radio"
                                      name={questionKey}
                                      checked={currentValue === false}
                                      onChange={() => {
                                        const newDetails = { ...instrumentDetails, [question.key]: false };
                                        handleUpdatePerformerDetails(currentPerformerIndex, {
                                          ...details,
                                          [instrument]: newDetails
                                        });
                                      }}
                                      disabled={!canEdit}
                                    />
                                    <span>No</span>
                                  </label>
                                </div>
                                {question.notes && (
                                  <textarea
                                    className="input tech-rider-notes-textarea"
                                    placeholder="Notes (optional)"
                                    value={instrumentDetails[`${question.key}_notes`] || ''}
                                    onChange={(e) => {
                                      const newDetails = { ...instrumentDetails, [`${question.key}_notes`]: e.target.value };
                                      handleUpdatePerformerDetails(currentPerformerIndex, {
                                        ...details,
                                        [instrument]: newDetails
                                      });
                                    }}
                                    disabled={!canEdit}
                                    rows={2}
                                  />
                                )}
                              </div>
                            );
                          }

                          if (question.type === 'number') {
                            const isRequired = question.key !== 'extraNotes';
                            const labelText = question.key === 'needsPowerSockets' 
                              ? 'Number of power sockets required'
                              : question.label;
                            return (
                              <div key={questionKey} className="tech-rider-question-field">
                                <label className="label">
                                  {labelText}
                                  {isRequired && <span className="required-asterisk">*</span>}
                                </label>
                                <input
                                  type="number"
                                  className="input"
                                  min="0"
                                  value={currentValue ?? 0}
                                  onChange={(e) => {
                                    const newDetails = { ...instrumentDetails, [question.key]: parseInt(e.target.value) || 0 };
                                    handleUpdatePerformerDetails(currentPerformerIndex, {
                                      ...details,
                                      [instrument]: newDetails
                                    });
                                  }}
                                  disabled={!canEdit}
                                />
                                {question.notes && (
                                  <textarea
                                    className="input tech-rider-notes-textarea"
                                    placeholder="Notes (optional)"
                                    value={instrumentDetails[`${question.key}_notes`] || ''}
                                    onChange={(e) => {
                                      const newDetails = { ...instrumentDetails, [`${question.key}_notes`]: e.target.value };
                                      handleUpdatePerformerDetails(currentPerformerIndex, {
                                        ...details,
                                        [instrument]: newDetails
                                      });
                                    }}
                                    disabled={!canEdit}
                                    rows={2}
                                  />
                                )}
                              </div>
                            );
                          }

                          if (question.type === 'text') {
                            const isRequired = question.key !== 'extraNotes';
                            return (
                              <div key={questionKey} className="tech-rider-question-field">
                                <label className="label">
                                  {question.label}
                                  {isRequired && <span className="required-asterisk">*</span>}
                                </label>
                                <textarea
                                  className="input tech-rider-notes-textarea"
                                  value={currentValue || ''}
                                  onChange={(e) => {
                                    const newDetails = { ...instrumentDetails, [question.key]: e.target.value };
                                    handleUpdatePerformerDetails(currentPerformerIndex, {
                                      ...details,
                                      [instrument]: newDetails
                                    });
                                  }}
                                  disabled={!canEdit}
                                  rows={3}
                                />
                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>
                    );
                  })}

                  {techRiderData.lineup[currentPerformerIndex]?.instruments?.length === 0 && (
                    <p className="tech-rider-empty-message">
                      Please add instruments for this performer in Stage 1.
                    </p>
                  )}

                  <div className="tech-rider-stage-actions">
                    <button
                      className="btn tertiary"
                      onClick={() => {
                        if (currentPerformerIndex > 0) {
                          setCurrentPerformerIndex(currentPerformerIndex - 1);
                        } else {
                          handleTechRiderStageChange(1);
                        }
                      }}
                    >
                      <LeftChevronIcon /> Back
                    </button>
                    <button
                      className="btn artist-profile"
                      onClick={() => {
                        if (currentPerformerIndex < techRiderData.lineup.length - 1) {
                          setCurrentPerformerIndex(currentPerformerIndex + 1);
                        } else {
                          handleTechRiderStageChange(3);
                        }
                      }}
                    >
                      {currentPerformerIndex < techRiderData.lineup.length - 1 ? 'Next Performer' : 'Next: Extra Notes'} <RightArrowIcon />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Stage 3: Extra Notes */}
          {techRiderStage === 3 && (
            <div className="tech-rider-stage">
              <h4>Stage 3: Extra Notes</h4>
              <textarea
                className="input"
                value={techRiderData.extraNotes}
                onChange={(e) => setTechRiderData(prev => ({ ...prev, extraNotes: e.target.value }))}
                disabled={!canEdit}
                rows={8}
                placeholder="Enter any additional notes about your technical requirements..."
              />
              <div className="tech-rider-stage-actions">
                <button
                  className="btn tertiary"
                  onClick={() => handleTechRiderStageChange(2)}
                >
                  <LeftChevronIcon /> Back
                </button>
                <button
                  className="btn artist-profile"
                  onClick={() => handleTechRiderStageChange(4)}
                >
                  Next: Stage Map <RightArrowIcon />
                </button>
              </div>
            </div>
          )}

          {/* Stage 4: Map of Performers */}
          {techRiderStage === 4 && (
            <div className="tech-rider-stage">
              <h4>Stage 4: Map of Performers</h4>
              <div className="tech-rider-stage-map-placeholder">
                <p>Stage arrangement visual editor coming soon</p>
              </div>
              <div className="tech-rider-stage-actions">
                <button
                  className="btn tertiary"
                  onClick={() => handleTechRiderStageChange(3)}
                >
                  <LeftChevronIcon /> Back
                </button>
                <button
                  className="btn artist-profile"
                  onClick={() => handleTechRiderStageChange(5)}
                >
                  Next: Add Members <RightArrowIcon />
                </button>
              </div>
            </div>
          )}

          {/* Stage 5: Add Members */}
          {techRiderStage === 5 && (
            <div className="tech-rider-stage">
              <h4>Stage 5: Add Members to Artist Profile</h4>
              
              {techRiderData.lineup.filter(p => !p.isMember && p.performerName && p.performerName.includes('@')).map((performer, index) => {
                const lineupIndex = techRiderData.lineup.findIndex(p => p === performer);
                return (
                  <div key={lineupIndex} className="tech-rider-member-invite-card">
                    <div className="tech-rider-member-invite-content">
                      <div>
                        <strong>{performer.performerName}</strong>
                        <p className="tech-rider-member-invite-status">
                          Not a member yet
                        </p>
                      </div>
                      {canEdit && isOwner && (
                        <button
                          className="btn artist-profile small"
                          onClick={() => handleAddMemberFromLineup(lineupIndex)}
                          disabled={isSendingInvite}
                        >
                          {isSendingInvite ? 'Sending...' : 'Send Invite'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {techRiderData.lineup.filter(p => !p.isMember && p.performerName && p.performerName.includes('@')).length === 0 && (
                <p className="tech-rider-empty-message">
                  All performers are already members, or no performers with email addresses were found.
                </p>
              )}

              <div className="tech-rider-stage-actions">
                <button
                  className="btn tertiary"
                  onClick={() => handleTechRiderStageChange(4)}
                >
                  <LeftChevronIcon /> Back
                </button>
                <button
                  className="btn artist-profile"
                  onClick={() => handleTechRiderStageChange(6)}
                >
                  Next: Info <RightArrowIcon />
                </button>
              </div>
            </div>
          )}

          {/* Stage 6: Info */}
          {techRiderStage === 6 && (
            <div className="tech-rider-stage">
              <h4 className="stage-title">Stage 6: Information</h4>
              <div className="tech-rider-info-content">
                <h5 className="tech-rider-info-section">What is a Tech Rider?</h5>
                <p className="tech-rider-info-text">
                  A tech rider is a document that outlines your technical requirements for live performances. 
                  It helps venues understand what equipment you need and what you&apos;ll be bringing yourself.
                </p>

                <h5 className="tech-rider-info-section">How It Works</h5>
                <p className="tech-rider-info-text">
                  When you apply for a gig, we&apos;ll automatically compare your tech rider with the venue&apos;s available equipment. 
                  You&apos;ll see a summary showing what the venue can provide and what you&apos;ll need to bring or arrange.
                </p>

                <h5 className="tech-rider-info-section">Tips</h5>
                <ul className="tech-rider-info-list">
                  <li>Be as detailed as possible in your notes</li>
                  <li>Update your tech rider if your setup changes</li>
                  <li>Include power requirements for all equipment</li>
                  <li>Specify any special positioning needs</li>
                </ul>
              </div>
              <div className="tech-rider-stage-actions">
                <button
                  className="btn tertiary"
                  onClick={() => handleTechRiderStageChange(5)}
                >
                  <LeftChevronIcon /> Back
                </button>
                <button
                  className="btn artist-profile"
                  onClick={() => {
                    setTechRiderData(prev => ({ ...prev, isComplete: true }));
                    handleSaveTechRider();
                  }}
                >
                  Complete Tech Rider
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render placeholder for other sections
  return (
    <div className="additional-info-section">
      <div className="section-header">
        <div className="title">
          {getIcon()}
          <h3>{getTitle()}</h3>
        </div>
      </div>
      <div className="section-content">
        <p>{getDescription()}</p>
        <p style={{ color: 'var(--gn-grey-600)', fontSize: '0.9rem', marginTop: '1rem' }}>
          This section is coming soon.
        </p>
      </div>
    </div>
  );
};

