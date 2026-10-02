# Proposed Storage rules

These rules replace the catch-all that let any signed-in user read and write every object. Unlisted paths are denied. The Admin SDK (guest photos, gig media, press kits) bypasses the rules and the API returns signed URLs.

A download URL that was minted at upload time still opens in a browser. Rules apply to client SDK and REST calls (`getDownloadURL`, `uploadBytes`), not to an already-issued download token.

## Who can do what

| Path | Read | Write | Why |
|---|---|---|---|
| `users/{uid}/**` | That user only | That user only | Account picture (`users/{uid}/profile/{file}`). |
| `musicians/{musicianId}/**` | Public | The musician | Profile photo, photos, tracks, and videos. `musicianId` may be the auth uid, or `musicianProfiles/{id}.userId` must match. A profile that does not exist yet can be written by any signed-in user, because the app uploads before the profile document is created. |
| `artistProfiles/{profileId}/**` | Public | Owner (`userId`) or an active member | Hero, tracks, covers, and videos. Same first-upload exception when the profile document does not exist yet. |
| `venues/{venueId}/{file}` | Public | Venue creator, `userId`, or a member | Venue photos stored at the root of the venue folder. |
| `venues/{venueId}/videos/**` | Public | Same venue staff | Venue videos and thumbnails. |
| `venues/{venueId}/documents/**` | Venue staff only | Venue staff only | Terms, PRS, and house rules. Signed-out guests are not given a client read; the app keeps the download URL from upload. |
| `bands/{bandId}/**` | Public | Band `userId` or `admin.userId` | Band picture. First upload is allowed before the band document exists (the id is a fresh uuid). |
| `gig-media/**` | Nobody (client) | Nobody (client) | Venue uploads and act downloads go through `/api/gig-media` signed URLs. |
| `guest-applications/**` | Nobody (client) | Nobody (client) | Guest photos are uploaded by the API. |
| `artist-press-kits/**` | Nobody (client) | Nobody (client) | Press-kit files are uploaded and downloaded by the API. |
| Anything else | Denied | Denied | No catch-all. |

## First upload before the Firestore document exists

Venue, musician, artist, and band creates upload the file and then write the Firestore document. Until that document exists, a signed-in user can write that new id. They cannot write an id that already belongs to someone else. Ids are uuids, not guessable.

## Checked in the emulator

- An artist cannot read or write `users/{someoneElse}/…`.
- An artist cannot read or write `gig-media/…`, `guest-applications/…`, or `artist-press-kits/…`.
- An artist cannot write another musician's or another venue's existing files.
- The owner can still write `users/{uid}/profile/…` and their own `artistProfiles/{id}/hero/…`.
- Venue staff can still upload `venues/{venueId}/photo.jpg`.
- A guest photo written by the Admin SDK is not readable by a client.
