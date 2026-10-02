import { useEffect, useId, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { useVenueDashboard } from '@context/VenueDashboardContext';
import { updateGigDocument } from '@services/api/gigs';
import { hasVenuePerm } from '@services/utils/permissions';
import {
  acceptingApplicationsPatch,
  buildNight,
  clockLabel,
  mediumDate,
  reopenedBannerActive,
  shareMessage,
} from './nights';
import { copyText, displayUrl, gigApplyUrl } from './publicLinks';
import { CloseIcon, CopyIcon, LinkIcon, QrCodeIcon, WhatsAppIcon } from './icons';
import './share-panel.css';

function bannerCopy(night) {
  const left = Math.max(night.setCount - night.bookedCount, 0);
  if (night.fullyBooked) return 'All sets are booked, but you can still collect applications.';
  if (night.setCount === 1) return 'The set is still to fill.';
  return `${left} of ${night.setCount} sets still to fill. Anyone with the link can apply.`;
}

export function ShareApplicationLinkPanel({ slots, venueName, onClose }) {
  const { isMdUp } = useBreakpoint();
  const { gigs, venueProfiles, refreshGigs } = useVenueDashboard();
  const titleId = useId();
  const dialogRef = useRef(null);
  const liveRef = useRef(null);
  const [svg, setSvg] = useState('');
  const [png, setPng] = useState('');
  const [copied, setCopied] = useState('');
  const [saving, setSaving] = useState(false);
  const canWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const liveSlots = useMemo(() => (
    (slots || []).map((slot) => {
      const id = slot?.gigId || slot?.id;
      return (gigs || []).find((gig) => gig.gigId === id) || slot;
    })
  ), [slots, gigs]);

  const night = useMemo(() => buildNight(liveSlots, { venueName }), [liveSlots, venueName]);
  const url = night.gigId ? gigApplyUrl(night.gigId) : '';
  const message = shareMessage({ name: night.name, venueName: night.venueName || venueName, date: night.date, url });
  const reopened = reopenedBannerActive(night);
  const closed = !night.open;
  const canManage = hasVenuePerm(venueProfiles, night.venueId, 'gigs.applications.manage');
  const showMore = !isMdUp && canWebShare;

  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    QRCode.toString(url, { type: 'svg', margin: 0 }).then((markup) => {
      if (!cancelled) setSvg(markup);
    }).catch(() => {});
    QRCode.toDataURL(url, { width: 1024, margin: 2 }).then((data) => {
      if (!cancelled) setPng(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return undefined;
    const previous = document.activeElement;
    const focusable = () => [...node.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')];
    focusable()[0]?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose]);

  const announce = (text) => {
    if (liveRef.current) liveRef.current.textContent = text;
  };

  const flash = (key, label) => {
    setCopied(key);
    announce(label);
    window.setTimeout(() => setCopied((current) => (current === key ? '' : current)), 1400);
  };

  const writeApplications = async (open) => {
    const ids = night.gigIds.filter(Boolean);
    if (!ids.length || !canManage) return;
    setSaving(true);
    try {
      const patch = open ? acceptingApplicationsPatch(false) : acceptingApplicationsPatch(true);
      await Promise.all(ids.map((gigId) => updateGigDocument({
        gigId,
        action: 'gigs.applications.manage',
        updates: patch,
      })));
      refreshGigs?.();
      toast.success(open ? 'Applications open.' : 'Applications closed.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update.');
    } finally {
      setSaving(false);
    }
  };

  const downloadPng = () => {
    if (!png || closed) return;
    const link = document.createElement('a');
    link.href = png;
    link.download = `gigin-${night.gigId}-qr.png`;
    link.click();
    flash('png', 'Downloaded');
  };

  const printPoster = () => {
    if (closed || !png) return;
    const when = [mediumDate(night.date), night.range, night.setCount > 1 ? `${night.setCount} sets` : night.setCount === 1 ? '1 set' : '']
      .filter(Boolean)
      .join(' · ');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Poster</title>
      <style>
        @page { size: 148mm 210mm; margin: 14mm; }
        html, body { margin: 0; width: 148mm; height: 210mm; color: #000; background: #fff; font-family: Geist, -apple-system, 'Segoe UI', Arial, sans-serif; }
        body { box-sizing: border-box; padding: 8mm 4mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
        .venue { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 11px; letter-spacing: .08em; }
        h1 { margin: 18px 0 0; font-size: 38px; line-height: 1.05; font-weight: 600; letter-spacing: -0.03em; }
        .name { margin: 16px 0 0; font-size: 17px; font-weight: 500; }
        .when { margin: 6px 0 0; font-size: 14px; }
        img { width: 200px; height: 200px; margin: 22px 0 8px; }
        .scan { font-size: 16px; font-weight: 600; }
        .url { margin-top: 8px; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 11px; word-break: break-all; }
        .mark { margin-top: auto; font-family: 'Visby CF', Geist, sans-serif; font-size: 28px; font-weight: 600; }
        .mark i { color: #FF6C4B; font-style: normal; }
      </style></head><body>
      <div class="venue">${escapeHtml((night.venueName || venueName || '').toUpperCase())}</div>
      <h1>Now booking acts</h1>
      <div class="name">${escapeHtml(night.name)}</div>
      <div class="when">${escapeHtml(when)}</div>
      <img src="${png}" alt="QR code">
      <div class="scan">Scan to apply</div>
      <div class="url">${escapeHtml(displayUrl(url))}</div>
      <div class="mark">gigin<i>.</i></div>
      </body></html>`;
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();
    window.setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(() => frame.remove(), 1000);
    }, 50);
  };

  const reopenLabel = night.reopenedAt
    ? `${sameDay(night.reopenedAt, new Date()) ? 'TODAY' : mediumDate(night.reopenedAt).toUpperCase()} ${clockLabel(night.reopenedAt)}`
    : '';

  return (
    <div className="share-panel-root" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        className="share-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <div className="share-panel__grabber" aria-hidden="true" />
        <div className="share-panel__head">
          <div>
            <h2 id={titleId}>Share application link</h2>
            <p>{night.name}{night.date ? ` · ${mediumDate(night.date)}` : ''}</p>
          </div>
          <button type="button" className="share-panel__x" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="share-panel__body">
          <div className={`share-panel__banner ${closed ? 'is-closed' : reopened ? 'is-reopened' : 'is-open'}`}>
            <strong>
              <i />
              {closed ? 'Applications closed' : reopened ? 'Applications reopened' : 'Applications open'}
            </strong>
            {closed && (
              <button type="button" className="share-panel__reopen" disabled={saving || !canManage} onClick={() => writeApplications(true)}>
                Reopen
              </button>
            )}
            {reopened && <span className="share-panel__when">{reopenLabel}</span>}
            <p>
              {closed
                ? "People who open the link see that this night isn't taking applications."
                : reopened
                  ? "The link and QR code are the same as before, so posters and messages you've already sent work again."
                  : bannerCopy(night)}
            </p>
          </div>

          <span className="share-panel__label">LINK</span>
          <div className="share-panel__link">
            <span className="share-panel__link-icon"><LinkIcon /></span>
            <span className="share-panel__url">{displayUrl(url)}</span>
            <button
              type="button"
              className={`share-panel__copy${copied === 'link' ? ' is-done' : ''}`}
              onClick={async () => {
                if (await copyText(url)) flash('link', 'Copied');
              }}
            >
              <CopyIcon />
              {copied === 'link' ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className={closed ? 'share-panel__dim' : undefined}>
            <span className="share-panel__label">SEND IT</span>
            <div className={`share-panel__send${!showMore && !isMdUp ? ' is-single' : ''}`}>
              <button
                type="button"
                disabled={closed}
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')}
              >
                <WhatsAppIcon />
                WhatsApp
              </button>
              {isMdUp && (
                <button
                  type="button"
                  disabled={closed}
                  onClick={async () => {
                    if (await copyText(message)) flash('message', 'Copied');
                  }}
                >
                  <CopyIcon />
                  {copied === 'message' ? 'Copied' : 'Copy message'}
                </button>
              )}
              {showMore && (
                <button
                  type="button"
                  disabled={closed}
                  onClick={() => navigator.share({ title: night.name, text: message, url }).catch(() => {})}
                >
                  More
                </button>
              )}
            </div>
            <p className="share-panel__preview">{message}</p>
          </div>

          <div className={closed ? 'share-panel__dim' : undefined}>
            <div className="share-panel__qr-block">
              <div className="share-panel__qr" dangerouslySetInnerHTML={{ __html: svg }} />
              <div className="share-panel__qr-title"><QrCodeIcon /> QR code for posters</div>
              <p>Opens the same link. Put it on posters, flyers or table cards.</p>
              <div className="share-panel__qr-actions">
                <button type="button" className={`share-panel__text-btn${copied === 'png' ? ' is-done' : ''}`} disabled={closed} onClick={downloadPng}>
                  {copied === 'png' ? 'Downloaded' : 'Download PNG'}
                </button>
                <button type="button" className="share-panel__text-btn" disabled={closed} onClick={printPoster}>
                  Print poster
                </button>
              </div>
              {closed && <p className="share-panel__muted">Reopen applications to share this night.</p>}
            </div>
          </div>
        </div>
        <div className="share-panel__switch-row">
          <div>
            <strong>Accepting applications</strong>
            <span>Turn off to close the listing</span>
          </div>
          <button
            type="button"
            className={`share-panel__switch${night.open ? ' is-on' : ''}`}
            role="switch"
            aria-checked={night.open}
            aria-label="Accepting applications"
            disabled={saving || !canManage}
            onClick={() => writeApplications(!night.open)}
          >
            <span />
          </button>
        </div>
        <div className="share-panel__live" aria-live="polite" ref={liveRef} />
      </div>
    </div>
  );
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}
