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
        const templates = db.collection("templates");
        const venueProfiles = db.collection("venueProfiles");

        const { templateDataPacket } = req.body;

        const venueProfile = await venueProfiles.findOne({ venueId: templateDataPacket.venue.venueId });
        
        if (venueProfile.templates) {
            await venueProfiles.updateOne(
                { venueId: templateDataPacket.venue.venueId },
                { $addToSet: { templates: templateDataPacket.templateId } }
                );
            await templates.insertOne(templateDataPacket);
        } else {
            await venueProfiles.updateOne(
                { venueId: templateDataPacket.venue.venueId },
                { $set: { templates: [templateDataPacket.templateId] } }
            );
            await templates.insertOne(templateDataPacket);
        }

        res.status(200).json({ message: 'Template saved successfully.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (mongoClient) {
            await mongoClient.close();
        }
    }
}