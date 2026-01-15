import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useArtistDashboard } from '../../../../context/ArtistDashboardContext';
import { useBreakpoint } from '../../../../hooks/useBreakpoint';
import { useAuth } from '../../../../hooks/useAuth';
import { openInNewTab } from '../../../../services/utils/misc';
import { getVenueProfileById } from '../../../../services/client-side/venues';
import { getOrCreateConversation } from '../../../../services/api/conversations';
import { markInviteAsViewed } from '../../../../services/api/artists';
import { withdrawArtistApplication } from '../../../../services/client-side/artists';
import { getArtistProfileMembers } from '../../../../services/client-side/artists';
import { sanitizeArtistPermissions } from '../../../../services/utils/permissions';
import Portal from '../../../shared/components/Portal';
import { GigHandbook } from '../../../artist/components/GigHandbook';
import {
  ClockIcon,
  PreviousIcon,
  SortIcon,
  TickIcon,
  ExclamationIcon,
  OptionsIcon,
  MailboxFullIcon,
  NewTabIcon,
  CancelIcon,
  RejectedIcon,
  CalendarIconSolid,
  InviteIconSolid,
} from '../../../shared/ui/extras/Icons';

export const ArtistProfileGigs = () => {
  const {
    artistProfiles,
    activeArtistProfile,
    artistGigApplications,
    artistGigs,
    artistSavedGigs,
    artistDataLoading,
  } = useArtistDashboard();
  const { user } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isMdUp, isXlUp, isSmUp } = useBreakpoint();

  const [sortOrder, setSortOrder] = useState('asc');
  const [openOptionsGigId, setOpenOptionsGigId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const [openOptionsGig, setOpenOptionsGig] = useState(null);
  const [showGigHandbook, setShowGigHandbook] = useState(false);
  const [gigForHandbook, setGigForHandbook] = useState(null);
  const optionsButtonRefs = useRef({});

  // Artist profile permissions for the focused profile
  const [artistProfilePerms, setArtistProfilePerms] = useState(null);
  const [loadingArtistPerms, setLoadingArtistPerms] = useState(false);

  const selectedStatus = searchParams.get('status') || 'all';
  // Use activeArtistProfile from context (which is filtered by activeProfileId prop)
  const focusProfileId = activeArtistProfile?.id || activeArtistProfile?.profileId || '';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        !event.target.closest('.options-cell') &&
        !event.target.closest('.portal-dropdown')
      ) {
        closeOptionsMenu();
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const updateUrlParams = (key, value) => {
    const params = new URLSearchParams(location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    navigate(`?${params.toString()}`, { replace: true });
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  const baseGigs = useMemo(() => artistGigs, [artistGigs]);

  const now = useMemo(() => new Date(), []);

  // Load artist profile permissions for the current focused profile (if it's an artistProfile)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user?.uid || !focusProfileId) {
        if (!cancelled) setArtistProfilePerms(null);
        return;
      }

      const isArtistProfile =
        Array.isArray(user?.artistProfiles) &&
        user.artistProfiles.some(
          (p) => (p.id || p.profileId) === focusProfileId
        );

      if (!isArtistProfile) {
        if (!cancelled) setArtistProfilePerms(null);
        return;
      }

      try {
        setLoadingArtistPerms(true);
        const members = await getArtistProfileMembers(focusProfileId);
        if (cancelled) return;
        const me = members.find(
          (m) => m.id === user.uid && (m.status || 'active') === 'active'
        );
        const perms = sanitizeArtistPermissions(me?.permissions || {});
        setArtistProfilePerms(perms);
      } catch (e) {
        console.error(
          'Failed to load artist profile permissions for dashboard gig actions:',
          e
        );
        if (!cancelled) setArtistProfilePerms(null);
      } finally {
        if (!cancelled) setLoadingArtistPerms(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.artistProfiles, focusProfileId]);

  const canBookCurrentArtistProfile = (() => {
    if (!focusProfileId) return true;
    const isArtistProfile =
      Array.isArray(user?.artistProfiles) &&
      user.artistProfiles.some(
        (p) => (p.id || p.profileId) === focusProfileId
      );
    if (!isArtistProfile) return true;
    if (!artistProfilePerms) return true; // fallback: don't block if we couldn't load perms
    return !!artistProfilePerms['gigs.book'];
  })();

  const getGigStatus = (gig) => {
    if (!focusProfileId) {
      return { icon: <ExclamationIcon />, text: 'Select Profile' };
    }
    const gigDate = gig.date?.toDate?.() || gig.startDateTime?.toDate?.() || new Date(gig.date || Date.now());
    if (gig.startTime) {
      const [hours, minutes] = gig.startTime.split(':').map(Number);
      if (!Number.isNaN(hours)) {
        gigDate.setHours(hours, minutes || 0, 0, 0);
      }
    }
    const now = new Date();
    const applicant = gig.applicants?.find((app) => app.id === focusProfileId);
    if (!applicant) return { icon: <ExclamationIcon />, text: 'Not Applied' };
    if (gig.disputeLogged) return { icon: <ExclamationIcon />, text: 'Dispute Logged' };
    
    // Check if invite has expired
    if (applicant.invited && applicant.inviteExpiresAt) {
      let expiresAtDate = null;
      // Handle Firestore Timestamp formats
      if (applicant.inviteExpiresAt?.toDate) {
        expiresAtDate = applicant.inviteExpiresAt.toDate();
      } else if (applicant.inviteExpiresAt?._seconds) {
        expiresAtDate = new Date(applicant.inviteExpiresAt._seconds * 1000);
      } else if (applicant.inviteExpiresAt?.seconds) {
        expiresAtDate = new Date(applicant.inviteExpiresAt.seconds * 1000);
      } else if (applicant.inviteExpiresAt instanceof Date) {
        expiresAtDate = applicant.inviteExpiresAt;
      } else if (typeof applicant.inviteExpiresAt === 'string' || typeof applicant.inviteExpiresAt === 'number') {
        expiresAtDate = new Date(applicant.inviteExpiresAt);
      }
      
      if (expiresAtDate && !isNaN(expiresAtDate.getTime()) && expiresAtDate < now) {
        return { icon: <InviteIconSolid />, text: 'Expired' };
      }
    }
    
    if (gigDate > now) {
      const status = applicant.status;
      if (status === 'confirmed') return { icon: <TickIcon />, text: 'Confirmed' };
      if (status === 'accepted' || status === 'payment processing') {
        return { icon: <ClockIcon />, text: 'Awaiting Venue Payment' };
      }
      if (status === 'pending' && applicant.invited) {
        return { icon: <ClockIcon />, text: 'Respond' };
      }
      if (status === 'pending') {
        return { icon: <ClockIcon />, text: 'Pending' };
      }
      if (status === 'declined') {
        return { icon: <RejectedIcon />, text: 'Declined' };
      }
      if (status === 'withdrawn') {
        return { icon: <RejectedIcon />, text: 'Withdrawn' };
      }
    }
    return { icon: <PreviousIcon />, text: 'Past' };
  };

  const normalizedGigs = useMemo(() => {
    const now = new Date();
    return baseGigs.map((gig) => {
      const gigDate = gig.date?.toDate?.() || gig.startDateTime?.toDate?.() || new Date();
      if (gig.startTime) {
        const [hours, minutes] = gig.startTime.split(':').map(Number);
        if (!Number.isNaN(hours)) {
          gigDate.setHours(hours, minutes || 0, 0, 0);
        }
      }
      const isoDate = gigDate.toISOString().split('T')[0];
      const applicantId = focusProfileId;
      const applicant = gig.applicants?.find((app) => app.id === applicantId);
      const appStatus = applicant?.status;
      let status = 'past';
      if (gigDate > now) {
        if (appStatus === 'confirmed') status = 'confirmed';
        else if (appStatus === 'accepted' || appStatus === 'pending') status = 'pending';
        else if (!appStatus && gig.status === 'open') status = 'upcoming';
        else if (!applicant) status = 'not applied';
        else status = 'closed';
      }
      return {
        ...gig,
        dateObj: gigDate,
        dateIso: isoDate,
        dateTime: gigDate,
        status,
      };
    });
  }, [baseGigs, focusProfileId]);

  const filteredGigs = useMemo(() => {
    if (selectedStatus === 'all') return normalizedGigs;
    return normalizedGigs.filter((gig) => gig.status === selectedStatus);
  }, [normalizedGigs, selectedStatus]);

  const sortedGigs = useMemo(() => {
    return filteredGigs.slice().sort((a, b) => {
      // Both future
      if (a.dateTime > now && b.dateTime > now) {
        return sortOrder === 'desc' ? b.dateTime - a.dateTime : a.dateTime - b.dateTime;
      }
      // Both past
      if (a.dateTime < now && b.dateTime < now) {
        return sortOrder === 'desc' ? b.dateTime - a.dateTime : a.dateTime - b.dateTime;
      }
      // One past, one future – always push past gigs below future gigs
      return a.dateTime < now ? 1 : -1;
    });
  }, [filteredGigs, sortOrder, now]);

  const toggleOptionsMenu = (gigId, event, gig) => {
    if (openOptionsGigId === gigId) {
      setOpenOptionsGigId(null);
      setOpenOptionsGig(null);
      setDropdownPosition({ top: 0, right: 0 });
    } else {
      const button = event?.currentTarget || optionsButtonRefs.current[gigId];
      if (button) {
        const rect = button.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY,
          right: window.innerWidth - rect.right + window.scrollX,
        });
      }
      setOpenOptionsGigId(gigId);
      setOpenOptionsGig(gig);
    }
  };

  const closeOptionsMenu = () => {
    setOpenOptionsGigId(null);
    setOpenOptionsGig(null);
    setDropdownPosition({ top: 0, right: 0 });
  };

  // Helper function to build gig URL with inviteId if needed
  const buildGigUrl = (gig, applicant) => {
    const baseUrl = `/gig/${gig.gigId}`;
    
    // If gig is private and artist has been invited, use inviteId from applicant object
    if (gig.private && applicant?.invited && applicant?.inviteId) {
      return `${baseUrl}?inviteId=${applicant.inviteId}`;
    }
    
    // Fallback to appliedAs for non-private gigs or if inviteId not available
    return `${baseUrl}?appliedAs=${applicant?.profileId || focusProfileId || ''}`;
  };

  const allProfiles = artistProfiles || [];

  const handleContactVenue = async (appliedProfile, gig) => {
    try {
      const profileId = appliedProfile?.profileId || focusProfileId;
      const fullProfile = allProfiles.find((profile) => profile.id === profileId);
      if (!fullProfile) {
        throw new Error('Artist profile not found.');
      }
      const venueProfile = await getVenueProfileById(gig.venueId);
      const normalizedProfile = {
        ...fullProfile,
        musicianId: fullProfile.id,
        profileId: fullProfile.id,
      };
      const { conversationId } = await getOrCreateConversation({
        musicianProfile: normalizedProfile,
        gigData: gig,
        venueProfile,
      });
      navigate(`/artist-profile/messages?conversationId=${conversationId}`);
    } catch (error) {
      console.error('Failed to contact venue:', error);
      toast.error('Unable to contact venue right now.');
    }
  };

  const handleWithdrawApplication = async (gig, appliedProfile) => {
    try {
      if (!canBookCurrentArtistProfile) {
        toast.error(
          'You do not have permission to withdraw applications for this artist profile.'
        );
        return;
      }

      const profileId = appliedProfile?.profileId || focusProfileId;
      const fullProfile = allProfiles.find((profile) => profile.id === profileId);
      if (!fullProfile) {
        throw new Error('Artist profile not found.');
      }
      await withdrawArtistApplication(gig.gigId, fullProfile);
      toast.success('Application withdrawn.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to withdraw application.');
    }
  };

  const statusButtons = (
    <div className='status-buttons'>
      <button
        className={`btn ${selectedStatus === 'all' ? 'active' : ''}`}
        onClick={() => updateUrlParams('status', 'all')}
      >
        All
      </button>
      <button
        className={`btn ${selectedStatus === 'confirmed' ? 'active' : ''}`}
        onClick={() => updateUrlParams('status', 'confirmed')}
      >
        Confirmed
      </button>
      <button
        className={`btn ${selectedStatus === 'pending' ? 'active' : ''}`}
        onClick={() => updateUrlParams('status', 'pending')}
      >
        Pending
      </button>
      <button
        className={`btn ${selectedStatus === 'past' ? 'active' : ''}`}
        onClick={() => updateUrlParams('status', 'past')}
      >
        Past
      </button>
    </div>
  );

  const sortedByDate = useMemo(
    () => [...normalizedGigs].sort((a, b) => a.dateTime - b.dateTime),
    [normalizedGigs]
  );

  const nextConfirmedGig = useMemo(() => {
    const now = new Date();
    return sortedByDate.find((gig) =>
      gig.applicants?.some(
        (applicant) =>
          applicant.id === focusProfileId &&
          applicant.status === 'confirmed' &&
          gig.dateTime > now
      )
    );
  }, [sortedByDate, focusProfileId]);

  const gigInvitations = useMemo(() => {
    return sortedByDate.filter((gig) =>
      gig.applicants?.some(
        (applicant) =>
          applicant.id === focusProfileId &&
          applicant.invited &&
          (applicant.status === 'pending' || !applicant.status)
      )
    );
  }, [sortedByDate, focusProfileId]);

  const NextGigSection = () => {
    if (!nextConfirmedGig) return null;
    const applicant = nextConfirmedGig.applicants?.find(
      (app) => app.id === focusProfileId
    );
    return (
      <section className='artist-profile-gigs-section next-gig'>
        <div className='section-header'>
          <h3 className='sub-heading'>Next Gig</h3>
        </div>
        <div className='next-gig-card'>
          <div className='next-gig-primary'>
            <p className='gig-name'>{nextConfirmedGig.gigName}</p>
            <p className='gig-venue'>{nextConfirmedGig.venue?.venueName || nextConfirmedGig.venueName}</p>
            <p className='gig-date'>
              {nextConfirmedGig.startDateTime?.toDate?.().toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}{' '}
              ·{' '}
              {nextConfirmedGig.startDateTime?.toDate?.().toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}
            </p>
          </div>
          <div className='next-gig-secondary'>
            <div className='status confirmed'>
              <TickIcon /> Confirmed
            </div>
            <button
              className='btn secondary'
              onClick={() => {
                setGigForHandbook(nextConfirmedGig);
                setShowGigHandbook(true);
              }}
            >
              View details
            </button>
          </div>
        </div>
      </section>
    );
  };

  const InvitationsSection = () => (
    <section className='artist-profile-gigs-section invitations'>
      <div className='section-header'>
        <div className='title'>
          <h3 className='sub-heading'>Gig Invitations</h3>
        </div>
      </div>
      {gigInvitations.length ? (
        <div className='invites-row'>
          {gigInvitations.map((gig) => {
            const applicant = gig.applicants?.find((app) => app.id === focusProfileId);
            const gigStatus = getGigStatus(gig);
            return (
              <div
                className='invite-card'
                key={gig.gigId}
                onClick={(event) => {
                  const url = buildGigUrl(gig, applicant);
                  openInNewTab(url, event);
                }}
              >
                <p className='gig-name'>{gig.gigName}</p>
                <p className='gig-venue'>{gig.venue?.venueName || gig.venueName}</p>
                <p className='gig-date'>
                  {gig.startDateTime?.toDate?.().toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </p>
                <div className='status respond'>
                  {gigStatus?.icon} Awaiting your response
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className='invites-empty'>
          <p>No invitations at the moment.</p>
          <button className='btn primary' onClick={() => navigate('/find-venues')}>
            Find Venues
          </button>
        </div>
      )}
    </section>
  );

  if (!artistProfiles?.length) {
    return (
      <div className='artist-profile-gigs-card'>
        <div className='head gigs'>
          <div className='title-container'>
            <h1 className='title'>Gigs</h1>
          </div>
          <div className='filters'>{statusButtons}</div>
        </div>
        <div className='body gigs musician'>
          <div className='artist-profile-gigs-empty'>
            <h4>No artist profiles found.</h4>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='artist-profile-gigs-card'>
      <div className='head gigs'>
        <div className='title-container'>
          <CalendarIconSolid />
          <h3>Gigs</h3>
        </div>
      </div>
        <div
          className={`artist-profile-gigs-content ${
            nextConfirmedGig ? 'has-next-gig' : 'no-next-gig'
          }`}
        >
        <NextGigSection />
        <section className='artist-profile-gigs-section all-gigs'>
          <div className='section-header'>
            <h3 className='sub-heading'>All Gigs</h3>
            <div className='filters'>{statusButtons}</div>
          </div>
          <div className='body gigs musician'>
            {artistDataLoading ? (
              <div className='loading-state'>
                <p>Loading gigs...</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th id='date'>
                      Time and Date
                      <button className='sort btn text' onClick={toggleSortOrder}>
                        <SortIcon />
                      </button>
                    </th>
                    <th className='centre'>Fee</th>
                    <th className='centre'>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedGigs.length > 0 ? (
                    sortedGigs.map((gig, index) => {
                      const isFirstPreviousGig =
                        index > 0 &&
                        gig.dateTime < now &&
                        sortedGigs[index - 1].dateTime >= now;
                      const gigStatus = getGigStatus(gig);
                      const appliedProfile =
                        artistGigApplications?.find(
                          (app) =>
                            app.gigId === gig.gigId &&
                            (!focusProfileId || app.profileId === focusProfileId)
                        ) || null;
                      const applicant = gig.applicants?.find(
                        (a) => a.id === focusProfileId
                      );
                      const isSaved = artistSavedGigs?.some(
                        (savedGig) => savedGig.gigId === gig.gigId
                      );
                      return (
                        <React.Fragment key={gig.gigId}>
                          {isFirstPreviousGig && (
                            <tr className='filler-row' style={{ backgroundColor: 'var(--gn-grey-300)' }}>
                              <td className='data' colSpan={4}>
                                <div className='flex' >
                                  <h4>Past Gigs</h4>
                                </div>
                              </td>
                            </tr>
                          )}
                          <tr
                          onClick={(event) => {
                            const url = buildGigUrl(gig, applicant);
                            openInNewTab(url, event);
                            if (isSmUp && applicant?.invited && !applicant?.viewed) {
                              markInviteAsViewed({
                                gigId: gig.gigId,
                                applicantId: applicant.id,
                              });
                            }
                          }}
                          onMouseEnter={() => {
                            if (
                              applicant?.invited &&
                              (!applicant?.viewed || applicant?.viewed === undefined)
                            ) {
                              markInviteAsViewed({
                                gigId: gig.gigId,
                                applicantId: applicant.id,
                              });
                            }
                          }}
                        >
                          <td>
                            {!isSmUp &&
                              applicant?.invited &&
                              !applicant?.viewed && (
                                <span className='notification-dot'></span>
                              )}
                            {gig.startDateTime
                              ?.toDate?.()
                              .toLocaleTimeString('en-GB', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              })}{' '}
                            -{' '}
                            {gig.startDateTime?.toDate?.().toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </td>
                          <td className='centre'>
                            {gig.kind === 'Ticketed Gig' ? 'Ticketed' : gig.kind === 'Open Mic' ? 'Open Mic' : (
                              gig.applicants?.length ? gig.applicants.find((applicant) => applicant.id === focusProfileId)?.fee || gig.budget : gig.budget
                            )}
                          </td>
                          <td className='centre'>
                            <div
                              className={`status ${gigStatus.text
                                ?.toLowerCase()
                                .replace(/\s/g, '-')}`}
                            >
                              {gigStatus.icon} {gigStatus.text}
                            </div>
                          </td>
                          <td
                            className='options-cell'
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              ref={(el) => (optionsButtonRefs.current[gig.gigId] = el)}
                              className={`btn icon ${
                                openOptionsGigId === gig.gigId ? 'active' : ''
                              }`}
                              onClick={(event) => toggleOptionsMenu(gig.gigId, event, gig)}
                            >
                              <OptionsIcon />
                            </button>
                          </td>
                        </tr>
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr className='no-gigs'>
                      <td className='data' colSpan={4}>
                        <div className='flex' style={{ margin: '1rem 0' }}>
                          <h4>No Gigs to Show</h4>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
        <InvitationsSection />
      </div>
      {openOptionsGigId && openOptionsGig && (
        <Portal>
          <div
            className='options-dropdown portal-dropdown'
            style={{
              position: 'fixed',
              top: `${dropdownPosition.top}px`,
              right: `${dropdownPosition.right}px`,
              zIndex: 1000,
            }}
          >
            {(() => {
              const gig = openOptionsGig;
              const gigStatus = getGigStatus(gig);
              const appliedProfile =
                artistGigApplications?.find(
                  (app) =>
                    app.gigId === gig.gigId &&
                    (!focusProfileId || app.profileId === focusProfileId)
                ) || null;
              const isSaved = artistSavedGigs?.some(
                (savedGig) => savedGig.gigId === gig.gigId
              );
              const isConfirmed = gigStatus.text === 'Confirmed';
              return (
                <>
                  <button
                    onClick={(event) => {
                      closeOptionsMenu();
                      openInNewTab(`/venues/${gig.venueId}`, event);
                    }}
                  >
                    View Venue Page <NewTabIcon />
                  </button>
                  <button
                    onClick={() => {
                      closeOptionsMenu();
                      handleContactVenue(appliedProfile, gig);
                    }}
                  >
                    Contact Venue <MailboxFullIcon />
                  </button>
                  {canBookCurrentArtistProfile &&
                    (isConfirmed ? (
                    <button
                      onClick={() => {
                        closeOptionsMenu();
                        setGigForHandbook(gig);
                        setShowGigHandbook(true);
                      }}
                      className='danger'
                    >
                      Cancel Gig <CancelIcon />
                    </button>
                  ) : (
                    gigStatus.text !== 'Withdrawn' &&
                    !isSaved && (
                      <button
                        onClick={() => {
                          closeOptionsMenu();
                          handleWithdrawApplication(gig, appliedProfile);
                        }}
                        className='danger'
                      >
                        Withdraw Application <CancelIcon />
                      </button>
                    )
                    ))}
                </>
              );
            })()}
          </div>
        </Portal>
      )}
      {showGigHandbook && gigForHandbook && (
        <GigHandbook
          setShowGigHandbook={setShowGigHandbook}
          gigForHandbook={gigForHandbook}
          musicianId={focusProfileId}
        />
      )}
    </div>
  );
};
