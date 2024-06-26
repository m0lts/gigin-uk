import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const options = {};

if (!process.env.MONGODB_URI) {
    throw new Error("Please add your Mongo URI to env.local");
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
        return;
    }

    let mongoClient;

    try {
        mongoClient = await (new MongoClient(uri, options)).connect();

        const db = mongoClient.db("gigin-v1");
        const accounts = db.collection("accounts");
        const venueProfiles = db.collection("venueProfiles");

        const { userId, venueData } = req.body;

        const existingVenueProfile = await venueProfiles.findOne({ venueId: venueData.venueId });

        if (existingVenueProfile) {
            await venueProfiles.updateOne(
                { venueId: venueData.venueId },
                { $set: venueData }
            );
        } else {
            await accounts.updateOne(
                { userId: userId },
                { $addToSet: { venueProfiles: venueData.venueId } }
            );

            venueData.userId = userId;

            await venueProfiles.insertOne(venueData);
        }

        res.status(200).json({ message: 'Venue profile processed successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (mongoClient) {
            await mongoClient.close();
        }
    }
}
