import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FEATURES } from '../../../../config/features';
import { getArtistProfileById, getArtistProfileMembers, getMusicianProfileByMusicianId } from '@services/client-side/artists';
import { createArtistCRMEntry, getArtistCRMEntries, updateArtistCRMEntry } from '@services/client-side/artistCRM';
import { getUserEmailById } from '@services/api/users';
import {
  getConversationsByGigAndMusicianProfileId,
  getConversationsByParticipantAndGigId,
} from '@services/client-side/conversations';
import { get } from '@services/http';
import { buildGuestTechRider, computeCompatibility } from '@services/utils/techRiderCompatibility';
import { preferencePhrase } from '@services/utils/nightApplications';
import { formatClock, slotEnd } from '@features/gig-discovery/guest/guestFormat';
import { InviteToGigModal } from '@features/venue/dashboard/ArtistCRM';
import './ApplicantProfileModal.css';

const BRANDS = {
  spotify: { color: '#1DB954', label: 'Spotify' },
  youtube: { color: '#FF0033', label: 'YouTube' },
  soundcloud: { color: '#FF5500', label: 'SoundCloud' },
  instagram: { color: '#E56969', label: 'Instagram' },
  website: { color: '#6B7280', label: 'Website' },
};

const SET_WORDS = ['ONE SET', 'TWO SETS', 'THREE SETS', 'FOUR SETS', 'FIVE SETS'];
const ACTIVE = new Set(['accepted', 'confirmed', 'paid', 'payment processing']);
const profileCache = new Map();
const crmCache = new Map();

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const seconds = value.seconds || value._seconds;
  if (seconds) return new Date(seconds * 1000);
  return null;
}

function actName(app, profile) {
  const candidates = [app?.name, app?.artistName, app?.actName, profile?.name, profile?.artistName];
  return candidates.find((value) => value && value !== 'This act') || 'This act';
}

function firstName(name) {
  const clean = String(name || '').trim();
  if (!clean || clean === 'This act') return 'They';
  return clean.split(/\s+/)[0];
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return `${parts[0][0] || ''}${parts[1]?.[0] || ''}`.toUpperCase();
}

function cleanGigName(name) {
  return String(name || 'Gig').replace(/\s*\(Set \d+\)\s*$/, '');
}

function isGuestRecord(app) {
  return app?.guest === true || app?.type === 'guest';
}

function profileIdFor(app) {
  if (app?.linkedArtistId) return app.linkedArtistId;
  if (isGuestRecord(app)) return null;
  return app?.artistId || app?.profileId || app?.id || null;
}

function isAccepted(app) {
  return ACTIVE.has(String(app?.status || '').toLowerCase());
}

function isWaiting(app) {
  const status = String(app?.status || 'pending').toLowerCase();
  return status === 'pending' || status === 'sent' || status === '';
}

function assignedId(app) {
  if (app?.assignedSlotGigId) return app.assignedSlotGigId;
  if (isAccepted(app)) return app?.applicationSlotGigId || null;
  return null;
}

function slotId(slot) {
  return slot?.gigId || slot?.id || null;
}

function relativeWhen(value) {
  const date = toDate(value);
  if (!date) return '';
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function shortDay(value) {
  const date = toDate(value);
  if (!date) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function monoDay(value) {
  const date = toDate(value);
  if (!date) return '';
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' }).replace('.', '');
  const month = date.toLocaleDateString('en-GB', { month: 'short' }).replace('.', '');
  return `${weekday} ${date.getDate()} ${month}`.toUpperCase();
}

function monoPlayed(value) {
  const date = toDate(value);
  if (!date) return '';
  const month = date.toLocaleDateString('en-GB', { month: 'short' }).replace('.', '').toUpperCase();
  return `${date.getDate()} ${month} ${date.getFullYear()}`;
}

function monoMonth(value) {
  const date = toDate(value);
  if (!date) return '';
  const month = date.toLocaleDateString('en-GB', { month: 'short' }).replace('.', '').toUpperCase();
  return `${month} ${date.getFullYear()}`;
}

function isToday(date) {
  const now = new Date();
  return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function youtubeId(url) {
  const match = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  return match ? match[1] : '';
}

function externalHref(raw, host) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${host}/${text.replace(/^@/, '')}`;
}

function waHref(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const intl = digits.startsWith('44') ? digits : (digits.startsWith('0') ? `44${digits.slice(1)}` : digits);
  return `https://wa.me/${intl}`;
}

function joinMethods(labels) {
  const list = labels.filter(Boolean);
  if (!list.length) return 'the details they sent';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} or ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}`;
}

function kindOf(app, profile) {
  if (app?.kind) return app.kind;
  if (Array.isArray(profile?.genres) && profile.genres[0]) return profile.genres[0];
  if (profile?.genre) return profile.genre;
  if (app?.genre) return app.genre;
  return 'Act';
}

function townOf(app, profile) {
  const loc = profile?.location || app?.location || app?.town || '';
  if (!loc) return '';
  if (typeof loc === 'string') return loc;
  return loc.city || loc.town || loc.name || '';
}

function memberLine(member) {
  if (Array.isArray(member?.instruments) && member.instruments.length) return member.instruments.join(', ');
  if (typeof member?.instruments === 'string' && member.instruments.trim()) return member.instruments.trim();
  return member?.instrument || member?.role || '';
}

function loadProfile(id) {
  if (!id) return Promise.resolve(null);
  if (!profileCache.has(id)) {
    const pending = (async () => {
      let profile = await getArtistProfileById(id);
      let members = [];
      if (profile) {
        members = await getArtistProfileMembers(id).catch(() => []);
      } else {
        profile = await getMusicianProfileByMusicianId(id);
      }
      if (!profile) return null;
      let email = profile.email || '';
      if (!email && profile.userId) {
        try { email = await getUserEmailById({ userId: profile.userId }) || ''; } catch { email = ''; }
      }
      return { ...profile, email, bandMembers: members || [] };
    })().catch((error) => {
      profileCache.delete(id);
      throw error;
    });
    profileCache.set(id, pending);
  }
  return profileCache.get(id);
}

function loadCrm(userId) {
  if (!userId) return Promise.resolve([]);
  if (!crmCache.has(userId)) {
    crmCache.set(userId, getArtistCRMEntries(userId).catch(() => []));
  }
  return crmCache.get(userId);
}

function rememberCrm(userId, entry) {
  const pending = crmCache.get(userId);
  if (!pending || !entry?.id) return;
  pending.then((list) => {
    const index = list.findIndex((row) => row.id === entry.id);
    if (index >= 0) list[index] = { ...list[index], ...entry };
    else list.unshift(entry);
  }).catch(() => {});
}

export function useApplicantQuery() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const applicantId = params.get('applicant') || '';
  const pushedRef = useRef(false);
  const focusRef = useRef(null);

  useEffect(() => {
    if (!applicantId) pushedRef.current = false;
  }, [applicantId]);

  const write = (id, { replace = false, trigger } = {}) => {
    const next = new URLSearchParams(location.search);
    const already = next.has('applicant');
    if (id) next.set('applicant', id);
    else next.delete('applicant');
    if (trigger) focusRef.current = trigger;
    if (id && !already) pushedRef.current = true;
    const search = next.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash },
      { replace, state: location.state },
    );
  };

  return {
    applicantId,
    focusRef,
    openApplicant: (id, trigger) => write(id, { replace: params.has('applicant'), trigger }),
    moveApplicant: (id) => write(id, { replace: true }),
    closeApplicant: () => {
      if (pushedRef.current) {
        pushedRef.current = false;
        navigate(-1);
        return;
      }
      write('', { replace: true });
    },
  };
}

function useDashboardNode() {
  const [node, setNode] = useState(null);
  useEffect(() => {
    setNode(document.querySelector('.dashboard .window') || document.body);
  }, []);
  return node;
}

function IconChevron({ left = false }) {
  if (left) {
    return (
      <svg viewBox="0 0 320 512" width="8" height="12" aria-hidden="true">
        <path fill="currentColor" d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 512 512" width="10" height="10" aria-hidden="true">
      <path fill="currentColor" d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z" />
    </svg>
  );
}

function IconNext() {
  return (
    <svg viewBox="0 0 320 512" width="8" height="12" aria-hidden="true">
      <path fill="currentColor" d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z" />
    </svg>
  );
}

function IconBubble() {
  return (
    <svg viewBox="0 0 512 512" width="13" height="13" aria-hidden="true">
      <path fill="currentColor" d="M64 0C28.7 0 0 28.7 0 64V352c0 35.3 28.7 64 64 64h96v80c0 6.1 3.4 11.6 8.8 14.3s11.9 2.1 16.8-1.5L309.3 416H448c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64H64z" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg viewBox="0 0 384 512" width="16" height="20" aria-hidden="true">
      <path fill="#FFFFFF" d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg viewBox="0 0 320 512" width="14" height="16" aria-hidden="true">
      <path fill="#FFFFFF" d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z" />
    </svg>
  );
}

function MusicRow({ row }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState('');
  const [title, setTitle] = useState(row.title || '');

  useEffect(() => {
    setTitle(row.title || '');
    setPlaying(false);
    setProgress(0);
    setDuration('');
  }, [row.href, row.audioUrl, row.title]);

  useEffect(() => {
    if (row.title || !row.href || row.audioUrl) return undefined;
    let cancelled = false;
    get('/link-preview/oembed', { query: { url: row.href }, auth: false })
      .then((data) => { if (!cancelled && data?.title) setTitle(data.title); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [row.href, row.title, row.audioUrl]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  const source = `${row.source}${duration ? ` · ${duration}` : ''}`;
  return (
    <div className="ap-track">
      {row.audioUrl ? (
        <audio
          ref={audioRef}
          src={row.audioUrl}
          preload="metadata"
          onTimeUpdate={() => {
            const audio = audioRef.current;
            if (audio?.duration) setProgress((audio.currentTime / audio.duration) * 100);
          }}
          onLoadedMetadata={() => setDuration(formatDuration(audioRef.current?.duration))}
          onEnded={() => { setPlaying(false); setProgress(0); }}
        />
      ) : null}
      <button type="button" className="ap-track-play" style={{ background: row.color }} onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <IconPause /> : <IconPlay />}
      </button>
      <span className="ap-track-copy">
        <strong>{title || row.source}</strong>
        <span>{source}</span>
        <span className="ap-progress"><i style={{ width: `${progress}%` }} /></span>
      </span>
      {row.href ? <a href={row.href} target="_blank" rel="noreferrer">Open in {row.source}</a> : null}
    </div>
  );
}

export function ApplicantProfileModal(props) {
  const node = useDashboardNode();
  if (!node || !props.applicant) return null;
  return createPortal(<ApplicantProfileDialog {...props} />, node);
}

function ApplicantProfileDialog({
  applicant,
  applicants = [],
  applications = [],
  slots = [],
  gig,
  venue,
  venueGigs = [],
  user,
  venues = [],
  canUpdate = true,
  busy = false,
  onClose,
  onMove,
  onAccept,
  onDecline,
  returnFocusEl,
}) {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const focusRef = useRef(returnFocusEl || null);
  const soonTimer = useRef(null);
  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [crmEntry, setCrmEntry] = useState(null);
  const [crmReady, setCrmReady] = useState(false);
  const [menu, setMenu] = useState(false);
  const [tipHover, setTipHover] = useState(false);
  const [tipFocus, setTipFocus] = useState(false);
  const [forcedTip, setForcedTip] = useState(false);
  const [soon, setSoon] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const [pick, setPick] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const menuRef = useRef(null);

  const profileId = profileIdFor(applicant);
  const gigin = Boolean(profileId);
  const person = applicant.contactName || actName(applicant, profile);
  const first = firstName(person);
  const oneSet = slots.length < 2;
  const gigTitle = cleanGigName(gig?.gigName);
  const venueName = venue?.venueName || venue?.name || gig?.venue?.venueName || 'the bar';

  useEffect(() => {
    focusRef.current = returnFocusEl || focusRef.current;
  }, [returnFocusEl]);

  useEffect(() => () => {
    const el = focusRef.current;
    if (el?.focus && document.contains(el)) el.focus();
  }, []);

  useEffect(() => {
    setMenu(false);
    setTipHover(false);
    setTipFocus(false);
    setForcedTip(false);
    setSoon(false);
    setPick(false);
    setOfferOpen(false);
    setLightbox(null);
    setPlayingVideo(null);
    setNoteEditing(false);
    setProfile(null);
    setProfileLoaded(!profileIdFor(applicant));
    clearTimeout(soonTimer.current);
  }, [applicant?.id]);

  useEffect(() => {
    if (!profileId) {
      setProfileLoaded(true);
      return undefined;
    }
    let cancelled = false;
    setProfileLoaded(false);
    loadProfile(profileId)
      .then((next) => { if (!cancelled) setProfile(next); })
      .catch(() => { if (!cancelled) setProfile(null); })
      .finally(() => { if (!cancelled) setProfileLoaded(true); });
    return () => { cancelled = true; };
  }, [profileId]);

  useEffect(() => {
    const userId = user?.uid;
    if (!userId) {
      setCrmReady(true);
      return undefined;
    }
    let cancelled = false;
    setCrmReady(false);
    loadCrm(userId).then((entries) => {
      if (cancelled) return;
      const byId = applicant.crmEntryId && entries.find((entry) => entry.id === applicant.crmEntryId);
      const byArtist = profileId && entries.find((entry) => entry.artistId === profileId);
      setCrmEntry(byId || byArtist || null);
      setCrmReady(true);
    });
    return () => { cancelled = true; };
  }, [user?.uid, applicant?.id, applicant?.crmEntryId, profileId]);

  const navList = applicants.some((item) => item.id === applicant.id)
    ? applicants
    : (applications.some((item) => item.id === applicant.id) ? applications : [applicant]);
  const index = Math.max(0, navList.findIndex((item) => item.id === applicant.id));
  const keyRef = useRef({});
  keyRef.current = {
    offerOpen, menu, lightbox, menuIndex, onClose, onMove, index,
    ids: navList.map((item) => item.id),
    photoCount: 0,
  };

  const step = (dir) => {
    const { ids, onMove: move, index: at } = keyRef.current;
    if (!ids.length || !move) return;
    const next = ids[(at + dir + ids.length) % ids.length];
    if (next) move(next);
  };

  useEffect(() => {
    panelRef.current?.querySelector('[data-ap-close]')?.focus();
  }, [applicant?.id]);

  useEffect(() => {
    const onKey = (event) => {
      const state = keyRef.current;
      const root = panelRef.current;
      if (!root || state.offerOpen) return;
      if (event.key === 'Tab') {
        const nodes = [...root.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])')]
          .filter((el) => !el.disabled && el.getAttribute('aria-hidden') !== 'true');
        if (!nodes.length) return;
        const firstNode = nodes[0];
        const lastNode = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === firstNode) {
          event.preventDefault();
          lastNode.focus();
        } else if (!event.shiftKey && document.activeElement === lastNode) {
          event.preventDefault();
          firstNode.focus();
        }
        return;
      }
      const typing = event.target?.tagName === 'TEXTAREA' || event.target?.tagName === 'INPUT';
      if (event.key === 'Escape') {
        event.preventDefault();
        if (state.lightbox != null) { setLightbox(null); return; }
        if (state.menu) { setMenu(false); return; }
        state.onClose?.();
        return;
      }
      if (typing) return;
      if (state.lightbox != null) {
        const count = Math.max(state.photoCount, 1);
        if (event.key === 'ArrowRight') setLightbox((value) => (value + 1) % count);
        if (event.key === 'ArrowLeft') setLightbox((value) => (value - 1 + count) % count);
        return;
      }
      if (state.menu) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const buttons = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])];
          const next = event.key === 'ArrowDown' ? Math.min(state.menuIndex + 1, buttons.length - 1) : Math.max(state.menuIndex - 1, 0);
          setMenuIndex(next);
          buttons[next]?.focus();
        }
        return;
      }
      if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!menu) return undefined;
    const onPointer = (event) => {
      if (!event.target.closest?.('[data-ap-menu]')) setMenu(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [menu]);

  const links = useMemo(() => {
    const next = { ...(applicant.links || {}) };
    const set = (key, url) => { if (url && !next[key]) next[key] = url; };
    set('spotify', profile?.spotifyUrl);
    set('youtube', profile?.youtubeUrl);
    set('soundcloud', profile?.soundcloudUrl);
    set('instagram', profile?.instagramUrl || profile?.instagram || applicant.instagram);
    set('website', profile?.websiteUrl || profile?.website);
    return next;
  }, [applicant, profile]);

  const email = applicant.email || profile?.email || crmEntry?.email || '';
  const phone = applicant.phone || profile?.phone || crmEntry?.phone || '';
  const instagram = links.instagram || applicant.instagram || crmEntry?.instagram || '';
  const whatsapp = applicant.whatsapp === true || applicant.contacts?.whatsapp === true;
  const coverUrl = gigin
    ? (profile?.heroMedia?.url || profile?.heroImage || '')
    : (applicant.photo?.url || applicant.photoUrl || '');
  const avatarUrl = gigin
    ? (profile?.picture || profile?.profilePicture || profile?.photoUrl || coverUrl)
    : (applicant.photo?.url || applicant.photoUrl || '');
  const heroY = typeof profile?.heroPositionY === 'number' ? profile.heroPositionY : (typeof profile?.heroPosition === 'number' ? profile.heroPosition : 50);
  const heroBrightness = typeof profile?.heroBrightness === 'number' ? profile.heroBrightness : 100;
  const members = useMemo(() => {
    if (!gigin) {
      return (applicant.members || []).filter((member) => member?.name || member?.instruments?.length).map((member) => ({
        name: member.name || 'Member',
        instruments: memberLine(member),
      }));
    }
    const fromProfile = (profile?.bandMembers || []).map((member) => ({
      name: member.userName || member.name || 'Member',
      instruments: memberLine(member),
    })).filter((member) => member.name);
    return fromProfile;
  }, [gigin, applicant.members, profile]);
  const memberCount = members.length || Number(applicant.numberOfPeople) || 1;
  const shownMembers = members.length ? members : [{ name: actName(applicant, profile), instruments: kindOf(applicant, profile) }];
  const kind = kindOf(applicant, profile);
  const town = townOf(applicant, profile);
  const meta = [kind, `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`, town].filter(Boolean).join(' · ');

  const gallery = useMemo(() => {
    const items = [];
    const pushVideo = (url, title) => {
      if (!url || items.some((item) => item.url === url)) return;
      const yt = youtubeId(url);
      items.push(yt ? { type: 'youtube', url, yt, title: title || 'Video' } : { type: 'video', url, title: title || 'Video' });
    };
    if (links.youtube) pushVideo(links.youtube, 'Video');
    (profile?.videos || []).forEach((video) => {
      pushVideo(video.youtubeUrl || video.videoUrl || video.file || video.url, video.title);
    });
    const photos = [];
    if (gigin) {
      (profile?.photos || []).forEach((photo) => {
        const url = typeof photo === 'string' ? photo : photo?.url;
        if (url) photos.push(url);
      });
    } else {
      const photo = applicant.photo?.url || applicant.photoUrl;
      if (photo) photos.push(photo);
      (applicant.assets || []).forEach((asset) => {
        if (!asset?.url) return;
        const type = String(asset.contentType || asset.type || '');
        if (type.startsWith('video')) pushVideo(asset.url, asset.name);
        else photos.push(asset.url);
      });
    }
    photos.forEach((url) => { if (!items.some((item) => item.url === url)) items.push({ type: 'photo', url }); });
    return items;
  }, [links.youtube, profile, gigin, applicant]);

  const photoItems = gallery.filter((item) => item.type === 'photo');
  keyRef.current.photoCount = photoItems.length;
  const videoCount = gallery.filter((item) => item.type !== 'photo').length;
  const photoCount = photoItems.length;
  const galleryCount = [
    videoCount ? `${videoCount} ${videoCount === 1 ? 'video' : 'videos'}` : '',
    photoCount ? `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}` : '',
  ].filter(Boolean).join(' · ');

  const tracks = useMemo(() => {
    const rows = [];
    (profile?.tracks || []).forEach((track) => {
      if (!track) return;
      rows.push({
        key: track.id || track.audioUrl || track.title,
        title: track.title || '',
        audioUrl: track.audioUrl || '',
        href: track.audioUrl || '',
        source: 'Track',
        color: '#6B7280',
      });
    });
    ['spotify', 'soundcloud'].forEach((key) => {
      if (!links[key]) return;
      rows.push({
        key: links[key],
        title: '',
        audioUrl: '',
        href: externalHref(links[key], key === 'spotify' ? 'open.spotify.com' : 'soundcloud.com'),
        source: BRANDS[key].label,
        color: BRANDS[key].color,
      });
    });
    return rows;
  }, [profile, links]);

  const chips = ['spotify', 'youtube', 'soundcloud', 'instagram', 'website'].flatMap((key) => {
    const url = links[key];
    if (!url) return [];
    const href = key === 'instagram'
      ? externalHref(url, 'instagram.com')
      : key === 'website'
        ? externalHref(url, '')
        : externalHref(url, key === 'spotify' ? 'open.spotify.com' : key === 'soundcloud' ? 'soundcloud.com' : 'youtube.com');
    return [{ key, href, label: BRANDS[key].label, color: BRANDS[key].color }];
  });

  const played = useMemo(() => {
    const ids = new Set([applicant.id, profileId, applicant.linkedArtistId].filter(Boolean));
    const nights = new Map();
    (venueGigs || []).forEach((entry) => {
      if (venue?.venueId && entry.venueId && entry.venueId !== venue.venueId && entry.venueId !== gig?.venueId) return;
      const date = toDate(entry.date || entry.startDateTime);
      if (!date || date > new Date()) return;
      const hit = (entry.applicants || []).some((row) => (
        isAccepted(row) && (ids.has(row.id) || ids.has(row.linkedArtistId) || ids.has(row.artistId))
      ));
      if (!hit) return;
      const key = date.toDateString();
      if (!nights.has(key) || date > nights.get(key)) nights.set(key, date);
    });
    return [...nights.values()].sort((a, b) => b - a);
  }, [venueGigs, applicant, profileId, venue, gig]);

  const gigsOnGigin = Array.isArray(profile?.confirmedGigs)
    ? profile.confirmedGigs.length
    : (profileLoaded ? 0 : null);
  const stats = gigin
    ? [
      { value: gigsOnGigin == null ? '—' : String(gigsOnGigin), label: 'gigs on Gigin' },
      { value: String(played.length), label: 'times at the bar' },
      { value: String(memberCount), label: memberCount === 1 ? 'member' : 'members' },
    ]
    : [
      { value: String(memberCount), label: memberCount === 1 ? 'member' : 'members' },
      { value: 'New', label: 'to the bar' },
      { value: 'Guest', label: 'no Gigin profile yet' },
    ];

  const note = String(applicant.note || applicant.applicationMessage || '').trim();
  const bio = String(profile?.bio || '').trim();
  const preference = preferencePhrase(slots, applicant.preferredSlotGigIds || []);
  const methods = [
    email ? 'email' : '',
    phone ? 'phone' : '',
    whatsapp && phone ? 'WhatsApp' : '',
    instagram ? 'Instagram' : '',
  ];
  const named = first !== 'They';
  const tipText = `${first} ${named ? 'doesn’t' : 'don’t'} have a Gigin account, so you can’t message them here. Contact them by ${joinMethods(methods)} instead.`;
  const soonText = `For now, contact ${named ? first : 'them'}${email ? ` at ${email}` : ' using the details in Contact'}.`;
  const showTip = !gigin && !menu && (tipHover || tipFocus || forcedTip);

  const compatRows = useMemo(() => {
    const rider = gigin
      ? (profile?.techRider || applicant.techRider)
      : buildGuestTechRider({ needs: applicant.needs || [], bringOwn: applicant.bringOwn || [], members: applicant.members || [] });
    const guestFilled = !gigin && ((applicant.needs || []).length || (applicant.bringOwn || []).length);
    const artistFilled = gigin && rider && (rider.isComplete || rider.lineup?.length || rider.performerDetails?.length);
    if (!guestFilled && !artistFilled) return [];
    const compat = computeCompatibility(rider, venue?.techRider);
    const chat = [...(compat.needsDiscussion || []), ...(compat.hireableEquipment || [])];
    return [
      { label: 'Provided by the bar', dot: 'oklch(0.66 0.14 150)', items: compat.providedByVenue || [] },
      { label: 'Covered by the act', dot: '#111317', items: compat.coveredByArtist || [] },
      { label: 'Needs a chat', dot: 'oklch(0.72 0.15 70)', items: chat },
    ].filter((row) => row.items.length).map((row) => ({
      ...row,
      text: row.items.map((item) => item.label || item).filter(Boolean).join(', '),
    }));
  }, [gigin, profile, applicant, venue]);

  const created = toDate(crmEntry?.createdAt);
  const history = played.length
    ? [
      ['Played here', `${played.length} ${played.length === 1 ? 'TIME' : 'TIMES'}`],
      ['Last played', monoPlayed(played[0])],
      created ? ['In My Contacts since', monoMonth(created)] : null,
    ].filter(Boolean)
    : [
      ['First time applying to the bar', ''],
      created ? ['Added to My Contacts', isToday(created) ? 'TODAY' : monoMonth(created)] : null,
    ].filter(Boolean);

  const assigned = slots.find((slot) => slotId(slot) === assignedId(applicant));
  const assignedIndex = assigned ? slots.findIndex((slot) => slotId(slot) === slotId(assigned)) : -1;
  const chip = (() => {
    if (applicant.status === 'withdrawn') return { label: `Withdrew ${shortDay(applicant.withdrawnAt)}`.trim(), bg: '#F3F4F6', color: '#6B7280', dot: '#9AA0AA' };
    if (applicant.status === 'declined') return { label: 'Declined', bg: '#F3F4F6', color: '#6B7280', dot: '#9AA0AA' };
    if (isAccepted(applicant)) {
      if (oneSet) return { label: 'Accepted', bg: 'oklch(0.95 0.04 150)', color: 'oklch(0.45 0.11 150)', dot: 'oklch(0.66 0.14 150)' };
      if (!assigned) return { label: 'Accepted · no set yet', bg: 'oklch(0.95 0.05 80)', color: 'oklch(0.48 0.11 60)', dot: 'oklch(0.72 0.15 70)' };
      return { label: `Accepted · Set ${assignedIndex + 1}`, bg: 'oklch(0.95 0.04 150)', color: 'oklch(0.45 0.11 150)', dot: 'oklch(0.66 0.14 150)' };
    }
    if (!applicant.viewed) return { label: 'New', bg: '#FFEDE7', color: '#B5462C', dot: '#FF6C4B' };
    return { label: 'Waiting', bg: '#F3F4F6', color: '#6B7280', dot: '#9AA0AA' };
  })();
  const decidedText = applicant.status === 'withdrawn'
    ? `Withdrew on ${shortDay(applicant.withdrawnAt) || 'this date'}.`
    : applicant.status === 'declined'
      ? 'Declined. You can undo this from the applicant list.'
      : isAccepted(applicant) && !oneSet && !assigned
        ? 'Accepted, no set yet. Give them a set from the Sets panel.'
        : isAccepted(applicant) && !oneSet
          ? `Accepted for Set ${assignedIndex + 1}. Change it from the Sets panel.`
          : isAccepted(applicant)
            ? 'Accepted. Change it from the Sets panel.'
            : '';
  const canDecide = canUpdate && isWaiting(applicant);
  const gigDate = toDate(gig?.date || gig?.startDateTime) || toDate(slots[0]?.date || slots[0]?.startDateTime);
  const setsLabel = SET_WORDS[Math.max(slots.length, 1) - 1] || `${slots.length} SETS`;
  const savedNote = typeof crmEntry?.notes === 'string' ? crmEntry.notes.trim() : '';

  const showSoon = () => {
    clearTimeout(soonTimer.current);
    setSoon(true);
    setMenu(false);
    setForcedTip(false);
    soonTimer.current = setTimeout(() => setSoon(false), 3500);
  };

  const onMessage = async () => {
    if (!gigin) {
      setMenu(false);
      setSoon(false);
      setForcedTip(true);
      return;
    }
    if (!FEATURES.chat) {
      showSoon();
      return;
    }
    setMenu(false);
    try {
      const gid = gig?.gigId || gig?.id;
      let conversations = profileId ? await getConversationsByGigAndMusicianProfileId(gid, profileId) : [];
      const uid = profile?.userId || applicant.userId;
      if (!conversations?.length && uid) conversations = await getConversationsByParticipantAndGigId(gid, uid);
      const conversationId = conversations?.[0]?.id;
      if (!conversationId) {
        toast.error('No conversation found.');
        return;
      }
      navigate(`/venues/dashboard/messages?conversationId=${conversationId}`);
    } catch (error) {
      console.error(error);
      toast.error('Could not open messages.');
    }
  };

  const contacts = [
    email ? { label: 'Email', value: email, href: `mailto:${email}` } : null,
    phone ? { label: 'Phone', value: phone, href: `tel:${phone}` } : null,
    whatsapp && phone ? { label: 'WhatsApp', value: 'Message', href: waHref(phone) } : null,
    instagram ? { label: 'Instagram', value: String(instagram).replace(/^https?:\/\/(www\.)?instagram\.com\//, '@'), href: externalHref(instagram, 'instagram.com') } : null,
    gigin ? { label: 'Gigin', value: 'Open full Gigin profile', href: `/artist/${profileId}` } : null,
  ].filter(Boolean);

  const offerArtist = {
    id: crmEntry?.id || applicant.crmEntryId || applicant.id,
    artistId: gigin ? profileId : null,
    name: actName(applicant, profile),
    email,
    phone,
    instagram,
    genres: profile?.genres || [],
    userId: profile?.userId || applicant.userId || null,
  };

  const saveNote = async () => {
    if (!user?.uid || savingNote) return;
    setSavingNote(true);
    try {
      const text = noteDraft.trim();
      let next = crmEntry;
      if (crmEntry?.id) {
        await updateArtistCRMEntry(user.uid, crmEntry.id, { notes: text });
        next = { ...crmEntry, notes: text };
      } else {
        const id = await createArtistCRMEntry(user.uid, {
          name: actName(applicant, profile),
          notes: text,
          email: email || null,
          phone: phone || null,
          instagram: instagram || null,
          artistId: gigin ? profileId : null,
        });
        next = { id, notes: text, artistId: gigin ? profileId : null, name: actName(applicant, profile), createdAt: new Date() };
      }
      setCrmEntry(next);
      rememberCrm(user.uid, next);
      setNoteEditing(false);
    } catch (error) {
      console.error(error);
      toast.error('Could not save the note.');
    } finally {
      setSavingNote(false);
    }
  };

  const occupant = (slot) => applications.find((item) => isAccepted(item) && assignedId(item) === slotId(slot) && item.id !== applicant.id);

  return (
    <div className="ap-modal">
      <div className="ap-backdrop" onClick={onClose} />
      <div
        className="ap-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-name"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ap-top">
          <div className="ap-top-side">
            <button type="button" className="ap-nav" aria-label="Previous applicant" onClick={() => step(-1)}><IconChevron left /></button>
            <button type="button" className="ap-nav" aria-label="Next applicant" onClick={() => step(1)}><IconNext /></button>
            <span className="ap-count">{index + 1} OF {navList.length} APPLICANTS</span>
            <span className="ap-gig-name">· {gigTitle}</span>
          </div>
          <div className="ap-top-side">
            <span className="ap-hint">Esc to close · ← → to move</span>
            <button type="button" className="ap-close" data-ap-close aria-label="Close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="ap-scroll">
          <div className="ap-hero">
            <div className="ap-cover">
              {coverUrl ? (
                <img src={coverUrl} alt="" style={gigin ? { objectPosition: `center ${heroY}%`, filter: `brightness(${heroBrightness}%)` } : undefined} />
              ) : null}
            </div>
            <div className="ap-identity">
              <div className="ap-who">
                <span className="ap-avatar">
                  {avatarUrl ? <img src={avatarUrl} alt="" /> : initials(actName(applicant, profile))}
                </span>
                <div className="ap-name-block">
                  <div className="ap-name-row">
                    <h1 id="ap-name" className="ap-name">{actName(applicant, profile)}</h1>
                    {gigin ? <span className="ap-tag is-gigin"><b>✓</b>On Gigin</span> : <span className="ap-tag">Guest</span>}
                  </div>
                  <span className="ap-meta">{meta}</span>
                </div>
              </div>
              <div
                className="ap-message"
                data-ap-menu
                onMouseEnter={() => { if (!gigin) setTipHover(true); }}
                onMouseLeave={() => { setTipHover(false); setForcedTip(false); }}
              >
                <button
                  type="button"
                  className={`ap-message-main${gigin ? '' : ' is-disabled'}`}
                  aria-disabled={gigin ? undefined : 'true'}
                  onClick={onMessage}
                  onFocus={() => { if (!gigin) setTipFocus(true); }}
                  onBlur={() => setTipFocus(false)}
                >
                  <IconBubble /> Message
                </button>
                <button
                  type="button"
                  className="ap-message-more"
                  aria-label="More ways to reach this act"
                  aria-expanded={menu}
                  onClick={() => { setMenu((open) => !open); setSoon(false); setForcedTip(false); setMenuIndex(0); }}
                >
                  <IconChevron />
                </button>
                {showTip ? <div className="ap-tooltip" role="tooltip">{tipText}</div> : null}
                {soon ? (
                  <div className="ap-popover" role="status">
                    <strong>Messaging is coming soon</strong>
                    <span>{soonText}</span>
                  </div>
                ) : null}
                {menu ? (
                  <div className="ap-menu" role="menu" ref={menuRef}>
                    <button type="button" role="menuitem" className={gigin ? '' : 'is-disabled'} aria-disabled={gigin ? undefined : 'true'} onClick={onMessage}>
                      <span>Message</span>
                      <small>{gigin ? 'Open a conversation on Gigin' : 'No Gigin account. Use email, phone or Instagram'}</small>
                    </button>
                    <button type="button" role="menuitem" className="is-offer" onClick={() => { setMenu(false); setOfferOpen(true); }}>
                      <span>Offer gig</span>
                      <small>{gigin ? 'Pick one of your upcoming gigs' : 'Send by email or WhatsApp'}</small>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="ap-stats">
              <div className="ap-stats-nums">
                {stats.map((stat) => (
                  <span className="ap-stat" key={stat.label}><b>{stat.value}</b><span>{stat.label}</span></span>
                ))}
              </div>
              {chips.length ? (
                <div className="ap-chips">
                  {chips.map((chipItem) => (
                    <a key={chipItem.key} className="ap-chip" href={chipItem.href} target="_blank" rel="noreferrer">
                      <i style={{ background: chipItem.color }} />{chipItem.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="ap-columns">
            <div className="ap-main">
              <section className="ap-card">
                <div className="ap-post">
                  <span className="ap-post-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : initials(actName(applicant, profile))}</span>
                  <span className="ap-post-copy">
                    <strong>{actName(applicant, profile)} <span>applied to {gigTitle}</span></strong>
                    <small>{relativeWhen(applicant.createdAt || applicant.appliedAt || applicant.timestamp)}</small>
                  </span>
                </div>
                <p className={`ap-note${note ? '' : ' is-empty'}`}>{note ? `“${note}”` : 'No note with this application.'}</p>
                <div className="ap-pills">
                  {!oneSet ? <span className={`ap-pill${preference ? ' is-pref' : ''}`}>{preference ? `Prefers ${preference}` : 'No preference'}</span> : null}
                  <span className="ap-pill is-plain">{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
                </div>
              </section>
              <section className="ap-card">
                <div className="ap-card-head"><h2>Photos and videos</h2>{galleryCount ? <span>{galleryCount}</span> : null}</div>
                {gallery.length ? (
                  <div className="ap-gallery">
                    {gallery.map((item, itemIndex) => {
                      const photoIndex = photoItems.findIndex((photo) => photo.url === item.url);
                      if (item.type === 'youtube' && playingVideo === item.url) {
                        return (
                          <div key={item.url} className="ap-tile is-video">
                            <iframe title={item.title || 'Video'} src={`https://www.youtube.com/embed/${item.yt}?autoplay=1`} allow="autoplay; encrypted-media" allowFullScreen />
                          </div>
                        );
                      }
                      if (item.type === 'video' && playingVideo === item.url) {
                        return (
                          <div key={item.url} className="ap-tile is-video">
                            <video src={item.url} controls autoPlay />
                          </div>
                        );
                      }
                      return (
                        <button
                          key={`${item.type}-${item.url}-${itemIndex}`}
                          type="button"
                          className={`ap-tile${item.type === 'photo' ? ' is-photo' : ' is-video'}`}
                          data-ap-photo={item.type === 'photo' ? '' : undefined}
                          onClick={() => {
                            if (item.type === 'photo') setLightbox(photoIndex);
                            else setPlayingVideo(item.url);
                          }}
                        >
                          {item.type === 'photo' ? <img src={item.url} alt="" /> : <span className="ap-play"><IconPlay /></span>}
                        </button>
                      );
                    })}
                  </div>
                ) : <p className="ap-muted">No photos or videos added.</p>}
              </section>
              <section className="ap-card">
                <h2>Music</h2>
                {tracks.map((row) => <MusicRow key={row.key} row={row} />)}
                {!tracks.length ? <p className="ap-muted">No music links added.</p> : null}
              </section>
              <section className="ap-card">
                <h2>About</h2>
                <p className={`ap-bio${bio ? '' : ' is-empty'}`}>
                  {bio || (gigin ? 'No bio added.' : `No bio yet. ${first} applied as a guest, so this page shows what they sent with the application.`)}
                </p>
              </section>
              <div className="ap-split">
                <section className="ap-card">
                  <h2>Who&apos;s in the band</h2>
                  {shownMembers.map((member) => (
                    <div className="ap-member" key={`${member.name}-${member.instruments}`}>
                      <b>{initials(member.name)}</b>
                      <span><strong>{member.name}</strong>{member.instruments ? <small>{member.instruments}</small> : null}</span>
                    </div>
                  ))}
                </section>
                <section className="ap-card">
                  <h2>Tech and the bar</h2>
                  {compatRows.length ? compatRows.map((row) => (
                    <span className="ap-tech" key={row.label}><i style={{ background: row.dot }} /><span><b>{row.label}:</b> {row.text}</span></span>
                  )) : <p className="ap-muted">Tech rider not filled in.</p>}
                </section>
              </div>
              <section className="ap-card">
                <h2>At {venueName}</h2>
                {history.map(([label, value]) => (
                  <div className="ap-history" key={label}><span>{label}</span><span>{value}</span></div>
                ))}
              </section>
            </div>
            <aside className="ap-side">
              <div className="ap-side-card">
                <div className="ap-gig-head">
                  <h2>{gigTitle}</h2>
                  <span className="ap-status" style={{ background: chip.bg, color: chip.color }}><i style={{ background: chip.dot }} />{chip.label}</span>
                </div>
                <span className="ap-when">{[monoDay(gigDate), setsLabel].filter(Boolean).join(' · ')}</span>
                {canDecide && pick ? (
                  <div className="ap-pick">
                    <p>{preference ? `They’d prefer ${preference}. Pick any open set.` : 'No preference, so any open set works.'}</p>
                    {slots.map((slot, slotIndex) => {
                      const holder = occupant(slot);
                      const id = slotId(slot);
                      const preferred = (applicant.preferredSlotGigIds || []).includes(id);
                      const range = [formatClock(slot.startTime), slotEnd(slot)].filter(Boolean).join('–');
                      return (
                        <button
                          key={id || slotIndex}
                          type="button"
                          className={`ap-set${preferred && !holder ? ' is-pick' : ''}`}
                          disabled={Boolean(holder) || busy}
                          onClick={() => { if (!holder) onAccept?.(applicant, id); }}
                        >
                          <span>
                            <b>{oneSet ? 'The set' : `Set ${slotIndex + 1}`} {range ? <span>{range}</span> : null}</b>
                            <small>{holder ? `Taken · ${actName(holder)}` : preferred ? 'Their pick' : 'Open'}</small>
                          </span>
                        </button>
                      );
                    })}
                    <div className="ap-pick-actions">
                      <button type="button" className="ap-text-btn" onClick={() => setPick(false)}>Cancel</button>
                      <button type="button" className="ap-later" disabled={busy} onClick={() => onAccept?.(applicant, null)}>Accept, choose set later</button>
                    </div>
                  </div>
                ) : null}
                {canDecide && !pick ? (
                  <div className="ap-decide">
                    <button type="button" className="ap-decline" disabled={busy} onClick={() => onDecline?.(applicant)}>Decline</button>
                    <button
                      type="button"
                      className="ap-accept"
                      disabled={busy}
                      onClick={() => {
                        if (oneSet) onAccept?.(applicant, slotId(slots[0]));
                        else setPick(true);
                      }}
                    >
                      Accept
                    </button>
                  </div>
                ) : null}
                {!canDecide && decidedText ? <p className="ap-decided">{decidedText}</p> : null}
              </div>
              <div className="ap-side-card">
                <span className="ap-contact-sub">
                  <h2>Contact</h2>
                  <span>{person} · {gigin ? 'on Gigin' : 'applied as a guest'}</span>
                </span>
                {contacts.map((row) => (
                  <a key={row.label} className="ap-contact" href={row.href} target={row.label === 'Email' || row.label === 'Phone' ? undefined : '_blank'} rel="noreferrer">
                    <span>{row.label}</span><strong>{row.value}</strong>
                  </a>
                ))}
              </div>
              <div className="ap-side-card">
                <div className="ap-notes-head">
                  <span className="ap-contact-sub">
                    <h2>Your notes on this act</h2>
                    <span>Saved to My Contacts</span>
                  </span>
                  {crmReady && savedNote && !noteEditing ? (
                    <button type="button" className="ap-edit" onClick={() => { setNoteEditing(true); setNoteDraft(savedNote); }}>Edit</button>
                  ) : null}
                </div>
                {crmReady && savedNote && !noteEditing ? <p className="ap-notes">{savedNote}</p> : null}
                {crmReady && !savedNote && !noteEditing ? (
                  <button type="button" className="ap-add-note" onClick={() => { setNoteEditing(true); setNoteDraft(''); }}><b>+</b>Add a note</button>
                ) : null}
                {noteEditing ? (
                  <div className="ap-notes-edit">
                    <textarea rows={3} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="e.g. Great with the late crowd. Needs a stool." />
                    <div className="ap-notes-actions">
                      <button type="button" className="ap-text-btn" onClick={() => setNoteEditing(false)}>Cancel</button>
                      <button type="button" className="ap-save" disabled={savingNote} onClick={saveNote}>Save note</button>
                    </div>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
        {lightbox != null && photoItems[lightbox] ? (
          <div className="ap-lightbox" onClick={() => setLightbox(null)}>
            <button type="button" className="ap-close" aria-label="Close photo" onClick={() => setLightbox(null)}>×</button>
            {photoItems.length > 1 ? (
              <button type="button" className="ap-nav is-prev" aria-label="Previous photo" onClick={(event) => { event.stopPropagation(); setLightbox((value) => (value - 1 + photoItems.length) % photoItems.length); }}><IconChevron left /></button>
            ) : null}
            <img src={photoItems[lightbox].url} alt="" onClick={(event) => event.stopPropagation()} />
            {photoItems.length > 1 ? (
              <button type="button" className="ap-nav is-next" aria-label="Next photo" onClick={(event) => { event.stopPropagation(); setLightbox((value) => (value + 1) % photoItems.length); }}><IconNext /></button>
            ) : null}
          </div>
        ) : null}
      </div>
      {offerOpen ? (
        <InviteToGigModal artist={offerArtist} venues={venues} user={user} gigs={venueGigs} onClose={() => setOfferOpen(false)} />
      ) : null}
    </div>
  );
}
