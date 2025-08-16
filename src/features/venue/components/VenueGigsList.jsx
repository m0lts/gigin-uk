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
import { getMusicianProfileByMusicianId } from "../../../services/musicians";

export const VenueGigsList = ({ title, gigs, isVenue = false }) => {
    const [expanded, setExpanded] = useState(false);
    const displayed = useMemo(() => (expanded ? gigs : gigs?.slice(0, 3) ?? []), [expanded, gigs]);
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
  
    return (
      <div className="gigs-box">
        <div className="gigs-box-header">
          <h3>{title}</h3>
          {gigs?.length > 3 && (
            <button
              type="button"
              className="btn text"
              onClick={() => setExpanded(v => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "See less" : `See more (${gigs.length - 3})`}
            </button>
          )}
        </div>
  
        {displayed?.map((gig) => {
          const gigDate = gig.date?.toDate ? gig.date.toDate() : new Date(gig.date);
          const day = gigDate.toLocaleDateString("en-US", { day: "2-digit" });
          const month = gigDate.toLocaleDateString("en-US", { month: "short" });
          const confirmed = (gig?.applicants ?? []).filter(a => a?.status === "confirmed");
          return (
            <div key={gig.gigId} className="venue-gig">
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
                        <div className="date-box">
                            <h4 className="month">{month.toUpperCase()}</h4>
                            <h2 className="day">{day}</h2>
                        </div>
                        <div className="gig-type">
                            {findGigIcon(gig.kind)}
                            <h4>{gig.kind}</h4>
                        </div>
                    </div>
                )}
  
              {title !== "Upcoming" && !isVenue ? (
                <button
                  className="btn primary"
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
        })}
  
        {/* optional subtle hint while profiles are loading */}
        {title === "Upcoming" && loadingProfiles && <div className="loading-inline">Loading acts…</div>}
      </div>
    );
  };