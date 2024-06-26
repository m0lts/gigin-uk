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

        const { userId, requestType } = req.body;

        if (requestType === 'Incomplete') {
            const userAccount = await accounts.findOne({ userId });
            if (!userAccount) {
                res.status(201).json({ error: 'User not found' });
                return;
            }

            const userVenueProfiles = userAccount.venueProfiles;
            for (const venueId of userVenueProfiles) {
                const incompleteProfile = await venueProfiles.findOne({
                    venueId: venueId,
                    completed: false,
                });
                if (incompleteProfile) {
                    res.status(200).json({ incompleteProfile });
                    return;
                }
            }
        }

        if (requestType === 'Complete profiles') {
            const userAccount = await accounts.findOne({ userId });
            if (!userAccount) {
                res.status(201).json({ error: 'User not found' });
                return;
            }

            const userVenueProfiles = userAccount.venueProfiles;
            let completeProfiles = [];

            console.log(userVenueProfiles)

            for (const venueId of userVenueProfiles) {
                const profiles = await venueProfiles.find({
                    venueId: venueId,
                    completed: true,
                }).toArray();

                if (profiles) {
                    completeProfiles = completeProfiles.concat(profiles);
                }

            }

            res.status(200).json({ completeProfiles });

        }

        if (requestType === 'Venue Id') {
            console.log(requestType);
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