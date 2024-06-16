import { MongoClient } from 'mongodb';

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

    const { gigId, venueId } = req.body;

    let mongoClient;

    try {
        mongoClient = await (new MongoClient(uri, options)).connect();
        const db = mongoClient.db("gigin-v1");
        const gigs = db.collection("gigs");
        const venueProfiles = db.collection("venueProfiles");

        await gigs.deleteOne({ gigId });

        await venueProfiles.updateOne(
            { venueId },
            { $pull: { gigs: gigId } }
        );

        res.status(200).json({ message: 'Gig deleted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (mongoClient) {
            await mongoClient.close();
        }
    }
}
