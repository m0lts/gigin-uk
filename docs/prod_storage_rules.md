# Production Storage rules (live as of 3 Oct 2026)

This is the ruleset deployed on the production bucket. The repo file `storage.rules` is not this text. Do not deploy `storage.rules` until the order at the bottom of this file has been followed.

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Under those rules anyone can list and read every object, and any signed-in user can write or delete any object.

## Paths the app, API, and functions use

`allow get` is a fetch of one known object. `allow list` is a folder listing. `allow read` would grant both, so public images use `get` only. Anything not in this table is denied. The Admin SDK (API and Cloud Functions) bypasses these rules.

| Path | Who may get | Who may list | Who may write | How it is served |
| --- | --- | --- | --- | --- |
| `gigin.png` | Anyone | Nobody | Nobody (console / admin) | Emails use a download URL with a token on the **dev** bucket. The token URL does not need a public get. |
| `tutorials/musician/*.mp4`, `tutorials/venue/*.mp4` | Anyone | Nobody | Nobody (console / admin) | Welcome modal calls `getDownloadURL` on the known path. That call needs `get`. |
| `users/{uid}/**` | That user | That user | That user | Account picture is `users/{uid}/profile/{filename}`. The page stores the `getDownloadURL` result. |
| `musicians/{musicianId}/**` | Anyone, by exact path | The musician owner (`musicianProfiles.userId`, or the folder id is their uid) | That owner | Profile photo, photos, tracks, videos. Display uses the stored download URL. |
| `artistProfiles/{profileId}/**` | Anyone, by exact path | Profile owner or an active member | That owner or member | Hero, tracks, covers, videos, thumbnails. The profile document must exist before upload (the creator writes it first). |
| `venues/{venueId}/{file}` | Anyone, by exact path | Venue staff (creator, `userId`, or a member doc) | Venue staff | Photos sitting directly in the venue folder. Display uses the stored download URL. |
| `venues/{venueId}/videos/**` | Anyone, by exact path | Venue staff | Venue staff | Venue videos and thumbnails. |
| `venues/{venueId}/documents/**` | Venue staff | Venue staff | Venue staff | Terms, PRS, house rules. Guests open the stored download URL, which carries its own token. |
| `bands/{bandId}/**` | Anyone, by exact path | The band owner (`bands.userId` or `admin.userId`) | That owner | Band picture. The band document is created (API) before the upload. |
| `gig-media/{gigId}/**` | Nobody (client) | Nobody | Nobody (client) | API Admin SDK. Streamed or signed by `/api/gig-media`. |
| `guest-applications/{applicationId}/**` | Nobody (client) | Nobody | Nobody (client) | API Admin SDK. Guest photo and other application files. |
| `artist-press-kits/{profileId}/**` | Nobody (client) | Nobody | Nobody (client) | API signed upload and download (`profiles.js`, `keepProfile.js`). |

There is no Storage path for gig private details. Those stay on `gigs/{id}/private/details` in Firestore.

Cloud Functions do not upload to Storage. They only embed the `gigin.png` token URL in email HTML.

## Images on the live site

The client does not build `gs://` URLs, and it does not build `?alt=media` URLs without a token. Uploads go through `uploadBytes` / `uploadBytesResumable` and then `getDownloadURL`. Venue photos, artist heroes, musician pictures, and band pictures are saved as those token URLs and rendered with `<img src={thatUrl}>`. A token URL keeps working after public read is removed.

Gig pages do not have their own image objects. They show `venue.photos`, which are those same token URLs.

Two callers still need a rules `get`, because they ask Storage for the URL at view time instead of using a stored token:

- Welcome modal tutorials (`tutorials/...`), via `getDownloadURL`.
- Artist profile editing, which calls `getDownloadURL` on `heroMedia.storagePath` for the signed-in editor. Public pages use `heroMedia.url`.

`gigin.png` in this repo is already a token URL on `giginltd-dev.firebasestorage.app`. It does not depend on public read. The rules still allow `get` on that one object so a later `getDownloadURL` of the known path works. There is no list and no client write.

What this repo cannot see: objects already in the production bucket whose Firestore fields are a bare path or a token-less `?alt=media` URL. Those would stop loading for signed-out visitors unless that exact prefix stays `allow get`. None of the current read paths do that.

## Deploy order

Do not deploy these rules as part of a normal app release. Production today still has the open rules at the top of this file.

1. Ship the client that writes the ownership document before the first upload: `claimVenueForUpload` in the venue builder, the musician profile stub in the profile creator, and band creation before the band picture upload. Until that client is what users are running, a new venue, musician, or band picture upload returns 403 under the new rules.
2. Leave the API as it is. Guest photos, gig media, and press kits are already Admin SDK writes and signed reads. They do not need a rules change to keep working, and they must not be opened to the client.
3. Run `gigin-api/test/storageRules.emulator.test.js` against the local emulators (Auth 9099, Firestore 8081, Storage 9199). The emulator must be loading `storage.rules`. This is not a deploy.
4. Deploy the client (and only the client) to the environment you are about to lock. Confirm a new venue image, a new artist hero, and a band picture still upload.
5. Deploy `storage.rules` to that same environment. Dev (`giginltd-dev`) first. Production (`giginltd-16772`) is a separate decision after dev has been checked.
6. After the rules deploy, check: a signed-out venue page still shows its photos (token URL); a signed-out request for a known venue photo path succeeds and a list of that folder does not; an account that does not own a venue cannot write there; a guest photo and a gig-media file are not readable with the client SDK; the welcome-modal tutorial still resolves.

Firestore rules do not need to change for this. Do not deploy Storage rules before step 1 is live, or venue and band creation uploads fail.
