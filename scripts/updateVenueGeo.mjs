import { collection, getDocs, writeBatch, GeoPoint, deleteField } from 'firebase/firestore';
import { firestore } from './firebaseConfig.mjs';
import { geohashForLocation } from 'geofire-common';

const BATCH_SIZE = 400;

const migrateVenuesAddGeo = async () => {
  const venuesRef = collection(firestore, 'venueProfiles');
  const snapshot = await getDocs(venuesRef);

  let batch = writeBatch(firestore);
  let opsInBatch = 0;
  let updateCount = 0;



  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (Array.isArray(data.coordinates) && data.coordinates.length === 2) {
      const [lng, lat] = data.coordinates;
      const geopoint = new GeoPoint(lat, lng);
      const geohash = geohashForLocation([lat, lng]).substring(0, 8);

      batch.update(docSnap.ref, {
        geopoint,
        geohash,
      });

      opsInBatch++;
      updateCount++;

      if (opsInBatch >= BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(firestore);
        opsInBatch = 0;
      }
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
  }

  console.log(`✅ Migrated ${updateCount} venue(s) with geopoint+geohash.`);
};

migrateVenuesAddGeo()
  .then(() => {
    console.log('✅ Migration completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Migration failed', err);
    process.exit(1);
  });