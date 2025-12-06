import { useState, useMemo, useEffect } from "react";
import { CashIcon, MicrophoneIconSolid, NewTabIcon, OptionsIcon, VerifiedIcon } from '../../shared/ui/extras/Icons';
import { 
    BackgroundMusicIcon,
    ClubIcon,
    FacebookIcon,
    GuitarsIcon,
    HouseIconLight,
    InstagramIcon,
    InviteIcon,
    MicrophoneIcon,
    MicrophoneLinesIcon,
    PeopleGroupIcon,
    SpeakersIcon,
    TicketIcon,
    TwitterIcon,
    WeddingIcon } from '@features/shared/ui/extras/Icons';
import { openInNewTab } from '@services/utils/misc';
import { getMusicianProfileByMusicianId } from "../../../services/client-side/artists";
import { createVenueRequest } from "@services/api/artists";
import { toast } from "sonner";
import { useBreakpoint } from "../../../hooks/useBreakpoint";

export const VenueGigsList = ({ title, gigs, isVenue = false, musicianId = null, venueId }) => {
    const { isMdUp } = useBreakpoint();
    // Always show all gigs, container will be scrollable
    const displayed = gigs ?? [];
    const [profilesById, setProfilesById] = useState({});
    const [loadingProfiles, setLoadingProfiles] = useState(false);
  
    useEffect(() => {
      let cancelled = false;
      async function fetchConfirmedProfiles() {
        if (title !== "Upcoming" || !displayed?.length) return;
        const ids = displayed.flatMap(gig =>
          (gig?.applicants ?? [])
            .filter(a => a?.status === "confirmed" && a?.id)
            .map(a => a.id)
        );
        if (!ids.length) return;
        const uniqueToFetch = [...new Set(ids)].filter(id => !profilesById[id]);
        if (!uniqueToFetch.length) return;
        setLoadingProfiles(true);
        try {
          const results = await Promise.all(
            uniqueToFetch.map(async (id) => {
              try {
                const profile = await getMusicianProfileByMusicianId(id);
                return [id, profile];
              } catch {
                return [id, null];
              }
            })
          );
          if (!cancelled) {
            setProfilesById(prev => {
              const next = { ...prev };
              for (const [id, profile] of results) {
                next[id] = profile;
              }
              return next;
            });
          }
        } finally {
          if (!cancelled) setLoadingProfiles(false);
        }
      }
      fetchConfirmedProfiles();
      return () => {
        cancelled = true;
      };
    }, [title, displayed, profilesById]);
  
    const findGigIcon = (kind) => {
      switch (kind) {
        case "Ticketed Gig": return <TicketIcon />;
        case "Open Mic": return <MicrophoneIconSolid />;
        case "Live Music": return <CashIcon />;
        case "Wedding": return <WeddingIcon />;
        default: return <BackgroundMusicIcon />;
      }
    };

    const handleMusicianRequest = async () => {
      try {
        const profile = await getMusicianProfileByMusicianId(musicianId);
        if (!profile) throw new Error('Musician profile not found');
        await createVenueRequest({
          venueId: venueId,
          musicianId: profile.musicianId,
          musicianName: profile.name,
          musicianImage: profile.picture || '',
          musicianGenres: profile.genres || [],
          musicianType: profile.musicianType || null,
          musicianPlays: profile.musicType || null,
          message: `${profile.name}`,
          createdAt: new Date(),
          viewed: false,
        });
        toast.success('Request sent to venue!');
        setRequestMessage('');
        setShowRequestModal(false);
      } catch (err) {
        console.error('Error sending request:', err);
        toast.error('Failed to send request. Please try again.');
      }
  };
  
    return (
      <div className="gigs-box">
        <div className="gigs-box-header">
          {isMdUp ? (
            <h3>{title}</h3>
          ) : (
            <h4 className="subtitle">{title}</h4>
          )}
        </div>
        
        <div className="gigs-list-container">
        {displayed.length > 0 ? (
          displayed?.map((gig) => {
            const gigDate = gig.date?.toDate ? gig.date.toDate() : new Date(gig.date);
            const day = gigDate.toLocaleDateString("en-US", { day: "2-digit" });
            const month = gigDate.toLocaleDateString("en-US", { month: "short" });
            const confirmed = (gig?.applicants ?? []).filter(a => a?.status === "confirmed");
            if (confirmed.length > 0) return null;
            return (
              <div key={gig.gigId} className="venue-gig" onClick={(e) => openInNewTab(`/gig/${gig.gigId}`, e)}>
                  {title === 'Upcoming' ? (
                      <div className="confirmed-musician">
                          <div className="date-box">
                              <h4 className="month">{month.toUpperCase()}</h4>
                              <h2 className="day">{day}</h2>
                          </div>
                          <div className="confirmed-musicians">
                              {confirmed.slice(0, 3).map(a => {
                                  const p = profilesById[a.id];
                                  return (
                                      confirmed.length > 1 ? (
                                          <>
                                              <img key={a.id} src={p?.picture || a?.img} alt={p?.name || a?.name} className="avatar sm" />
                                          </>
                                      ) : (
                                          <>
                                              <img key={a.id} src={p?.picture || a?.img} alt={p?.name || a?.name} className="avatar sm" />
                                              <h4>{p?.name}</h4>
                                          </>
                                      )
                                  )
                              })}
                          </div>
                      </div>
                ) : (
                      <div className="confirmed-musician">
                        <div className="left">
                          <div className="date-box">
                              <h4 className="month">{month.toUpperCase()}</h4>
                              <h2 className="day">{day}</h2>
                          </div>
                          {isMdUp && (
                            <div className="gig-time" style={{ display: 'flex', alignItems: 'center', margin: '0 1rem'}}>
                              <h3>{gig.startTime}</h3>
                            </div>
                          )}
                        </div>
                          <div className="gig-type">
                              {findGigIcon(gig.kind)}
                              {gig.kind === 'Ticketed Gig' || gig.kind === 'Open Mic' ? (
                                <h4>{gig.kind}</h4>
                              ) : (
                                <h4>{(gig.budget === '£' || gig.budget === 'No Fee' || gig.budget === '£0') ? 'No Fee' : gig.budget}</h4>
                              )}
                          </div>
                      </div>
                )}
    
                {title !== "Upcoming" && !isVenue ? (
                  <button
                    className="btn primary-alt"
                    onClick={(e) => openInNewTab(`/gig/${gig.gigId}`, e)}
                  >
                    Apply
                  </button>
                ) : (
                  <button
                    className="btn tertiary"
                    onClick={(e) => openInNewTab(`/gig/${gig.gigId}`, e)}
                  >
                    Open
                  </button>
                )}
              </div>
            );
          })
        ) : (
          title === "Upcoming" ? (
            <div className="no-gigs">
              <h4>No Upcoming Gigs</h4>
            </div>
          ) : (
            <div className="no-gigs">
              <h4>No Gig Vacancies</h4>
              {musicianId && (
                <button className="btn tertiary" onClick={handleMusicianRequest}>
                  Request a Gig
                </button>
              )}
            </div>
          )
        )}
        </div>
  
        {/* optional subtle hint while profiles are loading */}
        {title === "Upcoming" && loadingProfiles && <div className="loading-inline">Loading acts…</div>}
      </div>
    );
  };