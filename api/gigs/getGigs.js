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
        mongoClient = await MongoClient.connect(uri, options);

        const db = mongoClient.db("gigin-v1");
        const gigs = db.collection("gigs");

        // Fetch upcoming gigs
        const currentDate = new Date();
        const upcomingGigs = await gigs.find({ date: { $gte: currentDate.toISOString() } }).toArray();
        
        res.status(200).json({ upcomingGigs });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (mongoClient) {
            await mongoClient.close();
        }
    }
}
