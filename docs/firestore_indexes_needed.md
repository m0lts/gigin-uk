# Firestore collection group indexes

Searched `src`, `gigin-api`, and `functions` for `collectionGroup`. Four queries, three distinct shapes. `src` and `functions` have none. `gigin-api/test/guestReturnFixture.js` only mocks `collectionGroup` for tests.

A collection group query does not use the automatic single-field indexes. Those are collection-scoped. Each query below is one equality filter and a `limit`. None uses `orderBy` or a second filter, so none needs a composite index. Each needs a single-field index with query scope **Collection group**.

`limit` does not add a field to the index.

## guestApplicants.email

Already created on dev.

| | |
|---|---|
| Collection group | `guestApplicants` |
| Filter | `email` `==` |
| Order | none |
| Real Firestore index | yes, collection group scope on `email` |

Call sites, same query:

- `gigin-api/routes/guestApplications.js` (`sendFreshManageLinks`)
- `gigin-api/lib/guestReturn.js` (`loadHistory`)

## private.mediaShareTokenHash

Already created on dev.

| | |
|---|---|
| Collection group | `private` |
| Filter | `mediaShareTokenHash` `==` |
| Order | none |
| Real Firestore index | yes, collection group scope on `mediaShareTokenHash` |

Call site: `gigin-api/routes/gigMedia.js` (`gigByShareToken`).

The group id is the subcollection name `private`, so the index covers every subcollection with that name (`gigs/{id}/private`, and the other `private` subcollections). The query only matches documents that have `mediaShareTokenHash`.

## guestApplicants.applicantId

Not in the dev pair above. Still required on real Firestore.

| | |
|---|---|
| Collection group | `guestApplicants` |
| Filter | `applicantId` `==` |
| Order | none |
| Real Firestore index | yes, collection group scope on `applicantId` |

Call site: `gigin-api/routes/guestApplications.js` (`applicationIsStored`). If this index is missing, that call swallows the error and treats the id as already stored.
