/**
 * AdditionalInfoSection Component
 * Component for Tech Rider, Members, and About sections
 */

import { useState, useEffect } from 'react';
import { MoreInformationIcon, PeopleGroupIconSolid, TechRiderIcon, EditIcon, AddMember } from "../../../shared/ui/extras/Icons";
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

