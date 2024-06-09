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

        const { venueId, userId } = req.body;

        const deleteVenueProfile = await venueProfiles.deleteOne({ venueId: venueId });

        if (deleteVenueProfile) {
            await accounts.updateOne(
                { userId: userId },
                { $pull: { venueProfiles: venueId } }
            );
            res.status(200).json({ message: 'Venue profile deleted successfully' });
        } else {
            res.status(404).json({ error: 'Venue profile not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (mongoClient) {
            await mongoClient.close();
        }
    }
}