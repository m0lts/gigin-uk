import { toast } from 'sonner';
import { isGuestApplyGig } from '@features/gig-discovery/guest/guestFormat';

export function usesPaymentsCancel(gig) {
  if (!gig) return false;
  return Boolean(
    gig.paymentIntentId
    || gig.payoutConfig
    || gig.clearPendingFeeTaskName
    || gig.automaticMessageTaskName
  );
}

export function isNightModelGig(gig, venue) {
  if (!gig) return false;
  if (gig.itemType === 'venue_hire' || gig.kind === 'Venue Rental' || gig.bookingMode === 'rental') return false;
  if (usesPaymentsCancel(gig)) return false;
  return isGuestApplyGig(gig, venue);
}

export function isNightModelGroup(gigs, venue) {
  const slots = (gigs || []).filter(Boolean);
  if (!slots.length) return false;
  if (slots.some(usesPaymentsCancel)) return false;
  return slots.some((slot) => isNightModelGig(slot, venue));
}

function applicantStatus(app) {
  return String(app?.status || 'pending').toLowerCase();
}

export function nightAudienceCounts(gigs) {
  const byId = new Map();
  for (const slot of gigs || []) {
    for (const app of slot?.applicants || []) {
      if (app?.id == null) continue;
      const key = String(app.id);
      if (!byId.has(key)) byId.set(key, app);
    }
  }
  let accepted = 0;
  let waiting = 0;
  for (const app of byId.values()) {
    const status = applicantStatus(app);
    if (status === 'accepted' || status === 'confirmed' || status === 'paid') accepted += 1;
    else if (status === 'pending' || status === 'sent') waiting += 1;
  }
  return { accepted, waiting, total: byId.size };
}

export function cancelNightSummary(accepted, waiting) {
  const acts = accepted === 1 ? '1 accepted act' : `${accepted} accepted acts`;
  const people = waiting === 1 ? '1 waiting applicant' : `${waiting} waiting applicants`;
  return `This will email ${acts} and ${people} and show the night as cancelled.`;
}

export function toastNightCancelled({ rootGigId, undo, refresh }) {
  toast('Night cancelled.', {
    duration: 10000,
    action: {
      label: 'Undo',
      onClick: () => {
        Promise.resolve(undo({ rootGigId }))
          .then(() => {
            toast.success('Cancellation undone.');
            return refresh?.();
          })
          .catch((error) => {
            toast.error(error?.message || "That can't be undone now.");
          });
      },
    },
  });
}
