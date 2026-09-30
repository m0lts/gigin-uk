import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getArtistCRMEntries } from '@services/client-side/artistCRM';
import { createGigInvite } from '@services/api/gigInvites';
import { inviteToGig, updateGigDocument } from '@services/api/gigs';
import { getOrCreateConversation } from '@services/api/conversations';
import { getMusicianProfileByMusicianId } from '@services/client-side/artists';
import { sendGigInvitationMessage } from '@services/client-side/messages';
import { saveGigTemplate } from '@services/api/venues';
import { formatDate } from '@services/utils/dates';
import { InviteMethodsModal } from '../InviteMethodsModal';
import { buildBookNewTemplatePayload, filterBookNewEventTemplatesForVenue } from '../bookNewEventTemplateHelpers';
import { hasVenuePerm } from '@services/utils/permissions';
import { NewGigCreatedPanel } from './NewGigCreatedPanel';
import { NewGigFullForm } from './NewGigFullForm';
import { NewGigQuickDrawer } from './NewGigQuickDrawer';
import { NewGigWizard } from './NewGigWizard';
import { applyTemplateToDraft, draftToFormGig, logGigCreated, useNewGigDraft, writeLastNewGigRoute } from './useNewGigDraft';

export function NewGigExperience({
  route,
  entry,
  initialDraft,
  venues,
  venueId,
  setVenueId,
  templates,
  user,
  gigs,
  onSubmit,
  onClose,
  refreshTemplates,
}) {
  const { draft, patch, check, setDraft } = useNewGigDraft(initialDraft);
  const [screen, setScreen] = useState(route || 'full');
  const [switchedFrom, setSwitchedFrom] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const [offeredIds, setOfferedIds] = useState(initialDraft?.offerArtistIds || []);
  const [published, setPublished] = useState(!!initialDraft?.showOnProfile);
  const [contacts, setContacts] = useState([]);
  const [scrollTo, setScrollTo] = useState('');
  const [inviteMethods, setInviteMethods] = useState(null);
  const venue = venues.find((item) => item.venueId === venueId) || venues[0];
  const venueTemplates = filterBookNewEventTemplatesForVenue(templates, venue?.venueId);

  useEffect(() => {
    if (!user?.uid) return undefined;
    let cancelled = false;
    getArtistCRMEntries(user.uid).then((entries) => {
      if (!cancelled) setContacts(entries || []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.uid]);

  const update = (partial) => {
    if (partial && Object.prototype.hasOwnProperty.call(partial, 'applyTemplate')) {
      setDraft((current) => applyTemplateToDraft({ ...current, ...partial, applyTemplate: undefined }, partial.applyTemplate));
      return;
    }
    patch(partial);
  };

  const go = (next) => {
    if (screen === 'quick' && next === 'full') setSwitchedFrom('quick');
    writeLastNewGigRoute(next);
    setScreen(next);
  };

  const submit = async (meta = {}) => {
    if (!venue?.venueId || !hasVenuePerm(venues, venue.venueId, 'gigs.create')) {
      toast.error("You don't have permission to create gigs for this venue.");
      return;
    }
    if (!check.ready && screen !== 'quick') {
      setScrollTo(check.firstMissing || 'when');
      toast.error('Fill in the required fields first.');
      return;
    }
    if (!draft.dates.length || !draft.start || !draft.end) {
      toast.error('Add a date, a start time and an end time.');
      return;
    }
    setSubmitting(true);
    try {
      const docs = await onSubmit(draft, venue);
      const routeName = screen === 'wizard' ? 'wizard' : screen;
      logGigCreated({
        route: routeName,
        entry: entry || 'menu',
        kind: draft.kind,
        usedTemplate: !!draft.templateId,
        ...(switchedFrom ? { switchedFrom } : {}),
      });
      const offerIds = meta.offerIds || draft.offerArtistIds || [];
      setOfferedIds(offerIds);
      setPublished(draft.kind === 'find' ? (meta.publish ?? draft.showOnProfile) : false);
      setCreated(docs || []);
      setScreen('created');
      if (offerIds.length && docs?.[0]) {
        for (const id of offerIds) {
          const contact = contacts.find((item) => item.id === id);
          if (contact) await sendOffer(docs[0], contact, user, venue, setInviteMethods);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Failed to create the gig.');
    } finally {
      setSubmitting(false);
    }
  };

  const saveTemplate = async () => {
    const name = window.prompt('Template name');
    if (!name || !venue?.venueId) return;
    try {
      const payload = buildBookNewTemplatePayload(draftToFormGig(draft, venue), venue.venueId, undefined, name);
      await saveGigTemplate({ templateData: payload });
      toast.success('Template saved.');
      refreshTemplates?.();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save template.');
    }
  };

  if (screen === 'created') {
    return (
      <>
      <NewGigCreatedPanel
        draft={draft}
        docs={created}
        contacts={contacts}
        offeredIds={offeredIds}
        published={published}
        onClose={onClose}
        onFinish={(section) => { setScrollTo(section); setScreen('full'); }}
        onOffer={async (contact) => {
          if (!created?.[0]) return;
          try {
            await sendOffer(created[0], contact, user, venue, setInviteMethods);
            setOfferedIds((current) => current.includes(contact.id) ? current : [...current, contact.id]);
            toast.success(`Offered to ${contact.name}.`);
          } catch (error) {
            console.error(error);
            toast.error('Failed to offer the gig.');
          }
        }}
        onPublish={async (next) => {
          setPublished(next);
          try {
            await Promise.all((created || []).filter((doc) => doc.gigId).map((doc) => updateGigDocument({
              gigId: doc.gigId,
              action: 'gigs.update',
              updates: { private: !next },
            })));
          } catch (error) {
            console.error(error);
            toast.error('Failed to update the listing.');
          }
        }}
      />
      {inviteMethods && (
        <InviteMethodsModal
          artist={inviteMethods.artist}
          gigData={inviteMethods.gig}
          venue={inviteMethods.venue}
          user={user}
          onClose={() => setInviteMethods(null)}
          onEmailSent={() => setInviteMethods(null)}
        />
      )}
      </>
    );
  }

  if (screen === 'quick') {
    return (
      <NewGigQuickDrawer
        draft={draft}
        patch={update}
        templates={venueTemplates}
        contacts={contacts}
        submitting={submitting}
        onClose={onClose}
        onCreate={() => submit()}
        onFullForm={() => go('full')}
      />
    );
  }

  if (screen === 'wizard') {
    return (
      <NewGigWizard
        draft={draft}
        patch={update}
        templates={venueTemplates}
        contacts={contacts}
        gigs={gigs}
        submitting={submitting}
        onClose={onClose}
        onSaveDraft={() => toast.success('Draft kept in this window.')}
        onPublish={() => submit({ publish: draft.publishListing, offerIds: draft.offerArtistIds })}
      />
    );
  }

  return (
    <NewGigFullForm
      draft={draft}
      patch={update}
      check={check}
      venue={venue}
      venues={venues}
      onVenue={setVenueId}
      templates={venueTemplates}
      contacts={contacts}
      submitting={submitting}
      scrollTo={scrollTo}
      onClose={onClose}
      onSaveTemplate={saveTemplate}
      onCreate={() => submit({ publish: true })}
      onOffer={() => submit({ publish: false })}
    />
  );
}

async function sendOffer(gigDoc, contact, user, venue, openOffPlatform) {
  await createGigInvite({
    gigId: gigDoc.gigId,
    expiresAt: null,
    artistId: contact.artistId || null,
    crmEntryId: contact.id || null,
    artistName: contact.name || null,
  });
  const offPlatform = () => openOffPlatform?.({
    artist: {
      name: contact.name,
      email: contact.email || null,
      phone: contact.phone || null,
      instagram: contact.instagram || null,
      facebook: contact.facebook || null,
      other: contact.other || null,
    },
    gig: gigDoc,
    venue,
  });
  if (!contact.artistId) {
    offPlatform();
    return;
  }
  const profile = await getMusicianProfileByMusicianId(contact.artistId);
  if (!profile?.userId) {
    offPlatform();
    return;
  }
  await inviteToGig({ gigId: gigDoc.gigId, musicianProfile: profile });
  const { conversationId } = await getOrCreateConversation({
    musicianProfile: profile,
    gigData: gigDoc,
    venueProfile: venue,
    type: 'invitation',
  });
  const dateLabel = gigDoc.date ? formatDate(gigDoc.date, 'long') : '';
  const who = venue?.accountName || user?.name || 'The venue';
  await sendGigInvitationMessage(conversationId, {
    senderId: user?.uid,
    text: `${who} has invited ${profile.name || contact.name} to play at their gig at ${venue?.name || ''}${dateLabel ? ` on the ${dateLabel}` : ''}.`,
  });
}
