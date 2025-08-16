import { collection, getDocs, writeBatch, Timestamp, GeoPoint, updateDoc, doc, deleteField } from 'firebase/firestore';
import { firestore } from './firebaseConfig.mjs';
import { geohashForLocation } from 'geofire-common';


/**
 * Migrates existing gig documents:
 * - Converts `coordinates` to a `geo` object with `geopoint` and `geohash` (for GeoFirestore)
 */
const migrateGigsToAddGeoHash = async () => {
  const gigsRef = collection(firestore, 'gigs');
  const snapshot = await getDocs(gigsRef);

  const batch = writeBatch(firestore);
  let updateCount = 0;

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const updates = {};

    if (Array.isArray(data.coordinates) && data.coordinates.length === 2) {
      const [lng, lat] = data.coordinates;
      const geopoint = new GeoPoint(lat, lng);
      const geohash = geohashForLocation([lat, lng]).substring(0, 8);


        updates.geopoint = geopoint;
        updates.geohash = geohash;
        // Remove old geo field
        updates.geo = deleteField();
        batch.update(docSnap.ref, updates);
        updateCount++;
        console.log(`Queued update for gig ${docSnap.id}`);
    }
  });

  if (updateCount === 0) {
    console.log('No gigs needed migration.');
    return;
  }

  try {
    await batch.commit();
    console.log(`✅ Migrated ${updateCount} gig(s) with new geo fields.`);
  } catch (err) {
    console.error('❌ Batch commit failed:', err);
  }
};

migrateGigsToAddGeoHash()
  .then(() => {
    console.log('✅ Migration completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Migration failed', err);
    process.exit(1);
  });

// const getBudgetValue = (budget) => {
//   if (typeof budget !== 'string') return null;
//   const cleaned = budget.replace(/[^0-9.]/g, '');
//   const parsed = parseFloat(cleaned);
//   return isNaN(parsed) ? null : parsed;
// };

// const updateBudgetValues = async () => {
//   const gigsRef = collection(firestore, 'gigs');
//   const snapshot = await getDocs(gigsRef);

//   const batch = writeBatch(firestore);
//   let updateCount = 0;

//   snapshot.forEach((docSnap) => {
//     const data = docSnap.data();

//     if (data.budgetValue != null) return;

//     const value = getBudgetValue(data.budget);
//     if (value != null) {
//       const ref = doc(firestore, 'gigs', docSnap.id);
//       batch.update(ref, { budgetValue: value });
//       updateCount++;
//     }
//   });

//   if (updateCount === 0) {
//     console.log('No gigs needed budgetValue updates.');
//     return;
//   }

//   await batch.commit();
//   console.log(`✅ Updated ${updateCount} gig(s) with budgetValue.`);
// };
  
//   updateBudgetValues()
//     .then(() => {
//       console.log('✅ Migration complete.');
//       process.exit(0);
//     })
//     .catch(err => {
//       console.error('❌ Migration failed:', err);
//       process.exit(1);
//     });