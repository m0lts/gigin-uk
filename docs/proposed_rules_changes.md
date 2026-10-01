# Proposed Firestore rules

These rules are not in `firestore.rules` and have not been deployed. They describe the subcollections added so guest contact details, the manage-token hash, sound-engineer contact, gig media metadata, and the media share-token hash are not on the world-readable `gigs/{gigId}` document.

`gigs/{gigId}` stays publicly readable. Clients still cannot write `applicants` or `venueId`. The new documents are readable by the venue owner and by an active member of that venue. Clients cannot create, update, or delete them. The API uses the Admin SDK, which bypasses these rules.

```
function canReadGigPrivate(gigId) {
  let gig = get(/databases/$(database)/documents/gigs/$(gigId)).data;
  return request.auth != null && (
    isVenueOwner(gig.venueId) ||
    isActiveVenueMember(gig.venueId)
  );
}

match /gigs/{gigId} {
  match /guestApplicants/{applicantId} {
    allow read: if canReadGigPrivate(gigId);
    allow create, update, delete: if false;
  }

  match /private/{docId} {
    allow read: if canReadGigPrivate(gigId);
    allow create, update, delete: if false;
  }
}
```

`isVenueOwner` and `isActiveVenueMember` are the helpers already in the live rules. `isVenueOwner` checks `venueProfiles/{venueId}.createdBy`. `isActiveVenueMember` checks that `venueProfiles/{venueId}/members/{uid}` exists. `canReadGigPrivate` loads the gig first so those helpers receive the venue id, not the gig id.

## Left in place

`internalNotes` and `internalNotesLastEdited` remain on `gigs/{gigId}`. That document is publicly readable, so those notes are an existing public-read risk.

`system/metadata` allows create, read, and update for anyone, and delete for nobody. The only caller in this repo is `incrementProClicks` in `src/services/client-side/reports.js`, which creates the document if missing and increments `proClicks`.
