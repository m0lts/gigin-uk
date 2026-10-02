import { useState } from 'react';
import { toast } from 'sonner';
import { auth } from '@lib/firebase';
import {
  commitGigMedia,
  createGigMediaShare,
  createGigMediaUploadUrl,
  emailGigMediaShare,
  revokeGigMediaShare,
} from '@services/api/gigMedia';

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

export function GigMediaPanel({ gigId, media = [], hasShareLink = false, canUpdate = false, onShareLinkChange }) {
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const [linkRevoked, setLinkRevoked] = useState(false);
  const files = Array.isArray(media) ? media : [];
  const linkLive = !linkRevoked && (hasShareLink || Boolean(token));

  if (!gigId || !canUpdate) return null;

  const upload = async (file) => {
    if (!ALLOWED.has(file.type)) {
      toast.error('Use a photo or video (JPG, PNG, WEBP, HEIC, MP4, MOV, or WEBM).');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Each file must be 50 MB or smaller.');
      return;
    }
    setBusy(true);
    try {
      const signed = await createGigMediaUploadUrl({
        gigId,
        contentType: file.type,
        name: file.name,
        size: file.size,
      });
      const headers = { 'Content-Type': file.type };
      if (signed.method === 'POST' && auth.currentUser) {
        headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
      }
      const put = await fetch(signed.uploadUrl, {
        method: signed.method || 'PUT',
        headers,
        body: file,
      });
      if (!put.ok) throw new Error('Upload failed');
      await commitGigMedia({ gigId, path: signed.path, name: file.name, contentType: file.type });
      toast.success('Uploaded.');
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Could not upload that file.');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setBusy(true);
    try {
      const created = await createGigMediaShare(gigId);
      setLinkRevoked(false);
      setToken(created.token);
      onShareLinkChange?.(true);
      const link = `${window.location.origin}/share/gig-media/${created.token}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      toast.success('Private link copied.');
    } catch (err) {
      console.error(err);
      toast.error('Could not create a share link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="gig-details-tile">
      <div className="fill-this-slot__header fill-this-slot__header--invite-promoter">
        <h3 className="fill-this-slot__title fill-this-slot__title--invite-promoter">Photos and videos</h3>
      </div>
      <p>{files.length ? `${files.length} file${files.length === 1 ? '' : 's'} on this gig.` : 'Nothing uploaded yet.'} 50 MB per file, 250 MB in total.</p>
      <label className="btn secondary" style={{ display: 'inline-block', marginTop: 8 }}>
        {busy ? 'Working…' : 'Upload'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm"
          hidden
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) upload(file);
          }}
        />
      </label>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn secondary" disabled={busy} onClick={share}>
          {linkLive ? 'New private link' : 'Create private link'}
        </button>
        {linkLive ? (
          <button
            type="button"
            className="btn tertiary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await revokeGigMediaShare(gigId);
                setToken('');
                setLinkRevoked(true);
                onShareLinkChange?.(false);
                toast.success('Link revoked.');
              } catch (err) {
                console.error(err);
                toast.error('Could not revoke the link.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Revoke link
          </button>
        ) : null}
        {token ? (
          <button
            type="button"
            className="btn tertiary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await emailGigMediaShare({ gigId, token });
                toast.success(result.sent ? `Email queued for ${result.sent} act${result.sent === 1 ? '' : 's'}.` : 'No confirmed acts with an email address.');
              } catch (err) {
                console.error(err);
                toast.error(err?.message || 'Could not queue the email.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Email confirmed acts
          </button>
        ) : null}
      </div>
      {token ? <p style={{ wordBreak: 'break-all' }}>{`${window.location.origin}/share/gig-media/${token}`}</p> : null}
    </section>
  );
}
