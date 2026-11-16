import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { readNight } from '@services/utils/nightApplications';
import { downloadPromoZip, sendPromoReminder } from '@services/api/gigs';
import { Button, Card } from '@features/shared/ui/foundation';
import {
  formatPromoDay,
  promoCaption,
  promoDueKey,
  promoMissingParts,
  promoMissingSentence,
} from '../../../../../gigin-api/lib/promo.js';

const ACTIVE = new Set(['accepted', 'confirmed', 'paid']);

function gigTitle(gig) {
  return String(gig?.gigName || 'the gig').replace(/\s*\(Set\s+\d+\)\s*$/, '');
}

function dateLabel(gig) {
  const raw = gig?.startDateTime || gig?.date;
  const date = raw?.toDate ? raw.toDate() : (raw?.seconds ? new Date(raw.seconds * 1000) : new Date(raw));
  if (!raw || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function received(value) {
  return value ? 'Received' : 'Waiting';
}

export function NightPromo({ rawGig, slots, venue, guestPrivate, onShowApplications }) {
  const night = useMemo(() => readNight(slots?.length ? slots : [rawGig].filter(Boolean)), [slots, rawGig]);
  const rootId = night.applicationsRootGigId || rawGig?.gigId;
  const title = gigTitle(rawGig);
  const when = dateLabel(rawGig);
  const venueName = venue?.name || venue?.venueName || rawGig?.venueName || '';
  const [busy, setBusy] = useState('');

  const rows = night.slots.map((slot, index) => {
    const slotId = slot.gigId || slot.id;
    const app = (night.applications || []).find((entry) => (
      ACTIVE.has(String(entry?.status || '').toLowerCase()) && entry.assignedSlotGigId === slotId
    ));
    const setLabel = night.slots.length < 2 ? 'The set' : `Set ${index + 1}`;
    if (!app) return { booked: false, setLabel, slotId };
    const promo = guestPrivate?.[app.id]?.promo || app.promo || {};
    const name = app.name || app.actName || app.artistName || 'Act';
    return {
      booked: true,
      id: app.id,
      name,
      setLabel,
      bio: promo.bio || '',
      photos: Array.isArray(promo.photos) ? promo.photos : [],
      track: promo.track || null,
      videoUrl: promo.videoUrl || '',
      played: promo.played || '',
      missing: promoMissingParts(promo),
      dueLabel: formatPromoDay(promoDueKey(rawGig?.startDateTime || rawGig?.date, app.acceptedAt)),
    };
  });

  const caption = promoCaption({
    title: [title, when, venueName ? `at ${venueName}` : ''].filter(Boolean).join(' · '),
    acts: rows,
  });
  const missing = promoMissingSentence(rows);

  const download = async (applicantId, filename) => {
    setBusy(applicantId || 'all');
    try {
      await downloadPromoZip({ rootGigId: rootId, applicantId, filename });
    } catch (err) {
      toast.error(err?.message || 'Could not download the promo.');
    } finally {
      setBusy('');
    }
  };

  const copy = async (text, label) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied.`);
    } catch {
      toast.error('Could not copy that.');
    }
  };

  const remind = async (row) => {
    setBusy(`remind-${row.id}`);
    try {
      await sendPromoReminder({ rootGigId: rootId, applicantId: row.id });
      toast.success(`Reminder sent to ${row.name}.`);
    } catch (err) {
      toast.error(err?.message || 'Could not send the reminder.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="night-promo">
      <div className="night-promo__bar">
        <Button onClick={() => download('', `${title || 'promo'}.zip`)} disabled={busy === 'all' || !rows.some((row) => row.booked)}>
          {busy === 'all' ? 'Preparing…' : 'Download everything'}
        </Button>
      </div>
      {missing ? <p className="night-promo__missing">{missing}</p> : null}
      {rows.map((row) => (
        <Card key={row.slotId || row.id || row.setLabel} className="night-promo__card">
          <p className="night-promo__set">{row.setLabel}</p>
          {row.booked ? (
            <>
              <h2>{row.name}</h2>
              <ul>
                <li><span>Bio</span><b>{received(row.bio)}</b></li>
                <li><span>Photos</span><b>{row.photos.length ? `Received · ${row.photos.length}` : 'Waiting'}</b></li>
                <li><span>Track</span><b>{received(row.track?.path || row.track?.url)}</b></li>
                <li><span>Video</span><b>{received(row.videoUrl)}</b></li>
                <li><span>Venues played</span><b>{received(row.played)}</b></li>
              </ul>
              <div className="night-promo__actions">
                <Button variant="secondary" onClick={() => download(row.id, `${row.name}.zip`)} disabled={busy === row.id}>Download</Button>
                <Button variant="secondary" onClick={() => copy(row.bio, 'Bio')} disabled={!row.bio}>Copy bio</Button>
                <Button variant="secondary" onClick={() => remind(row)} disabled={busy === `remind-${row.id}` || row.missing.length === 0}>
                  {busy === `remind-${row.id}` ? 'Sending…' : 'Send a reminder'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2>Not booked yet</h2>
              <button type="button" className="night-promo__link" onClick={onShowApplications}>Applications</button>
            </>
          )}
        </Card>
      ))}
      <Card className="night-promo__caption">
        <h2>Ready to post</h2>
        <pre>{caption}</pre>
        <Button variant="secondary" onClick={() => copy(caption, 'Caption')}>Copy caption</Button>
      </Card>
    </div>
  );
}
