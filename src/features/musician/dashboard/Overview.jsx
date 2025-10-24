import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaceFrownIcon,
    TelescopeIcon,
    SortIcon,
    HouseIconLight,
    PeopleGroupIcon } from '@features/shared/ui/extras/Icons';
import { GigHandbook } from '@features/musician/components/GigHandbook';
import { PromoteModal } from '@features/shared/components/PromoteModal';
import { MapIcon, NextGigIcon, NoImageIcon, StarEmptyIcon, StarIcon } from '../../shared/ui/extras/Icons';
import { formatDate } from '../../../services/utils/dates';

export const Overview = ({ user, musicianProfile, gigApplications, gigs, gigsToReview, setGigsToReview, bandProfiles, unseenInvites }) => {

    const navigate = useNavigate();

    const [nextGig, setNextGig] = useState(null);
    const [awaitingResponse, setAwaitingResponse] = useState([]);
    const [showGigHandbook, setShowGigHandbook] = useState(false);
    const [showSocialsModal, setShowSocialsModal] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false)

    const isOnlyNameFilled = useMemo(() => {
        const p = musicianProfile;
        if (!p) return true;
        const hasMusicianType = !!(p.musicianType);
        const hasBio = !!(p.bio?.text && p.bio.text.trim().length > 0);
        const hasPhotos = Array.isArray(p.photos) && p.photos.length > 0;
        const hasVideos = Array.isArray(p.videos) && p.videos.length > 0;
        const hasGenres = Array.isArray(p.genres) && p.genres.length > 0;
        const hasInstruments = Array.isArray(p.instruments) && p.instruments.length > 0;
        const hasLocation =
          !!p.location && (
            (Array.isArray(p.location.coordinates) && p.location.coordinates.length === 2) ||
            Object.keys(p.location).length > 0
          );
        const hasSocials =
          !!p.socials && Object.values(p.socials).some(v => typeof v === 'string' ? v.trim() : v);
        const anyContent =
          hasMusicianType || hasBio || hasPhotos || hasVideos || hasGenres || hasInstruments || hasLocation || hasSocials;
        const hasBand = Array.isArray(bandProfiles) && bandProfiles.length > 0;
        const shouldSwap = hasBand && !anyContent;
        return shouldSwap;
    }, [musicianProfile, bandProfiles]);

    const toMs = (dt) => {
        if (!dt) return NaN;
        if (typeof dt?.toDate === 'function') return dt.toDate().getTime();
        const t = new Date(dt).getTime();
        return Number.isFinite(t) ? t : NaN;
    };
  
    useEffect(() => {
        if (!gigs || !gigs.length) return;
        const primaryProfile = (() => {
        if (!musicianProfile) return null;
        if (isOnlyNameFilled) {
            return Array.isArray(bandProfiles) && bandProfiles.length
            ? bandProfiles[0]
            : musicianProfile;
        }
        return musicianProfile;
        })();
        if (!primaryProfile) return;
        const userProfileIds = new Set([
        musicianProfile?.id ?? musicianProfile?.musicianId,
        ...(Array.isArray(bandProfiles) ? bandProfiles.map(b => b?.id) : []),
        ].filter(Boolean));
        const profileNameMap = {};
        if (musicianProfile?.id) profileNameMap[musicianProfile.id] = musicianProfile.name;
        bandProfiles?.forEach(b => { if (b?.id) profileNameMap[b.id] = b.name; });
        const allProfiles = [
        ...(musicianProfile ? [musicianProfile] : []),
        ...(Array.isArray(bandProfiles) ? bandProfiles : []),
        ].filter(Boolean);
        
        const now = Date.now();
        
        const nextConfirmed = allProfiles
        .flatMap((p) => {
            const pid = p?.id ?? p?.musicianId;
            const pname = p?.name ?? null;
            const confirmed = Array.isArray(p?.confirmedGigs) ? p?.confirmedGigs : [];
        
            return gigs
            .filter((g) => confirmed.includes(g?.gigId))
            .map((g) => {
                const t = toMs(g?.startDateTime);
                return Number.isFinite(t) && t > now
                ? { gig: g, t, profileId: pid, profileName: pname }
                : null;
            })
            .filter(Boolean);
        })
        .sort((a, b) => a.t - b.t)[0] || null;
        
        setNextGig(
        nextConfirmed
            ? {
                ...nextConfirmed?.gig,
                _profileId: nextConfirmed?.profileId,
                _profileName: nextConfirmed?.profileName,
            }
            : null
        );

        const awaiting = gigs
        .map(gig => {
            const applicants = Array.isArray(gig.applicants) ? gig.applicants : []
            const matchedApplicant = applicants.find(a =>
                userProfileIds.has(a?.id) &&
                a?.invited === true &&
                (a?.status === 'pending' || a?.status === 'awaiting your response')
            );
            if (!matchedApplicant) return null;
            const t = toMs(gig.startDateTime);
            if (!Number.isFinite(t) || t <= now) return null;
            const invitedProfileId = matchedApplicant.id;
            const invitedProfileName = profileNameMap[invitedProfileId] ?? 'Your Profile';
            return {
                ...gig,
                _invitedApplicant: matchedApplicant,
                _invitedProfileId: invitedProfileId,
                _invitedProfileName: invitedProfileName,
            };
        })
        .filter(Boolean);
        setAwaitingResponse(awaiting);
    }, [gigs, musicianProfile, bandProfiles, isOnlyNameFilled]);

    const formatName = (name) => {
        return name.split(' ')[0];
    };

    return (
        <>
            <div className='body overview'>
                <div className="welcome-box">
                    <h1 className='title'>Good Afternoon, {formatName(user.name)} 👋</h1>
                    <h2>Have a look at your next gig arrangements, profile, venues who have invited you, or find your next gig</h2>
                    <div className="two-buttons" style={{ justifyContent: 'flex-start' }}>
                        <button className="btn secondary" onClick={() => navigate('/find-a-gig')}>
                            <MapIcon />
                            Find a Gig
                        </button>
                        <button className="btn secondary" onClick={() => navigate('/find-venues')}>
                            <TelescopeIcon />
                            Find a Venue
                        </button>
                    </div>
                </div>
                <div className="overview-profile-container">
                    {!isOnlyNameFilled ? (
                        <>
                            <h1 className='large-title'>My Musician Profile</h1>
                            <div className="overview-profile">
                                {musicianProfile.picture ? (
                                    <img src={musicianProfile.picture} alt={musicianProfile.name} />
                                ) : (
                                    <div className="background-image empty">
                                        <NoImageIcon />
                                        <h4>No Artist Image</h4>
                                    </div>
                                )}
                                <div className="profile-overlay">
                                    <h1 className='profile-name'>
                                        {musicianProfile.name}
                                        <span className="orange-dot">.</span>
                                    </h1>
                                    <div className="action-buttons">
                                        <button className="btn quaternary" onClick={() => navigate(`/dashboard/profile`)}>
                                            View My Profile
                                        </button>
                                        <button className="btn quaternary" onClick={() => navigate(`/dashboard/profile`, { state: {preview: false} })}>
                                            Add New Photos / Videos
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : bandProfiles.length > 0 && bandProfiles[0] && (
                        <>
                            <h1 className='large-title'>My Band Profile</h1>
                            <div className="overview-profile">
                                <img src={bandProfiles[0].picture} alt={bandProfiles[0].name} />
                                <div className="profile-overlay">
                                    <h1 className='profile-name'>
                                        {bandProfiles[0].name}
                                        <span className="orange-dot">.</span>
                                    </h1>
                                    <div className="action-buttons">
                                        <button className="btn quaternary" onClick={() => navigate(`/dashboard/bands/${bandProfiles[0].id}`, { state: {band: bandProfiles[0]} })}>
                                            View Band Profile
                                        </button>
                                        <button className="btn quaternary" onClick={() => navigate(`/dashboard/bands/${bandProfiles[0].id}`, { state: {band: bandProfiles[0], preview: false} })}>
                                            Add New Photos / Videos
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <div className="next-gig-container">
                    <h1 className='large-title'>Gigs</h1>
                    {nextGig ? (
                        <div className="next-gig">
                            <div className="heading">
                                <h2>Up Next</h2>
                                <button className="btn text" onClick={() => setShowGigHandbook(true)}>
                                    See Details
                                </button>
                            </div>
                            <h2>{nextGig._profileName} @ {nextGig.venue.venueName}</h2>
                            <h3>{formatDate(nextGig.startDateTime, 'withTime')}</h3>
                        </div>
                    ) : (
                        <div className="empty-container">
                            <h4>You have no upcoming gigs.</h4>
                            <button className="btn tertiary" onClick={() => navigate('/find-a-gig')}>
                                <MapIcon />
                                Find a Gig
                            </button>
                        </div>
                    )}
                </div>
                <div className="awaiting-response-container">
                    {awaitingResponse.length > 0 ? (
                        <div className="awaiting-response">
                            <div className="heading">
                                <h2>Awaiting Your Response</h2>
                                <button className="btn text" onClick={() => navigate('/dashboard/gigs')}>
                                    See All
                                </button>
                            </div>
                            <div className='body gigs musician'>
                                    <table>
                                        <tbody>
                                            {awaitingResponse.slice(0, 10).map((gig) => {
                                                const dt = gig.startDateTime?.toDate
                                                ? gig.startDateTime.toDate()
                                                : new Date(gig.startDateTime);
                                                return (
                                                <tr key={gig.id} onClick={() => navigate('/dashboard/gigs')}>
                                                    <td>{gig?.venue?.venueName}</td>
                                                    <td>
                                                        {dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                        {' - '}
                                                        {dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                    </td>
                                                    {(bandProfiles && bandProfiles.length) && (
                                                        <td className="applied-profile-name">{gig._invitedProfileName}</td>
                                                    )}
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-container">
                            <h4>You have no gig invitations.</h4>
                            <button className="btn tertiary" onClick={() => navigate('/find-a-gig')}>
                                <TelescopeIcon />
                                Find a Venue
                            </button>
                        </div>
                    )}
                </div>
                {showGigHandbook && (
                    <GigHandbook
                        setShowGigHandbook={setShowGigHandbook}
                        showGigHandbook={showGigHandbook}
                        gigForHandbook={nextGig}
                        musicianId={musicianProfile.musicianId}
                        showConfirmation={showConfirmation}
                        setShowConfirmation={setShowConfirmation}
                    />
                )}
                {showSocialsModal && (
                    <PromoteModal
                        socialLinks={musicianProfile.socialMedia}
                        setShowSocialsModal={setShowSocialsModal}
                    />
                )}
            </div>
        </>
    );
};