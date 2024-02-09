import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const options = {};

if (!process.env.MONGODB_URI) {
    throw new Error("Please add your Mongo URI to env.local")
}

export default async function handler(request, response) {
    let mongoClient;

    try {
        mongoClient = await (new MongoClient(uri, options)).connect();

        const db = mongoClient.db('gigin-gigs');
        const gigsCollection = db.collection('gigs');

        if (request.method === "POST") {
            const dataReceived = request.body;
            const userId = dataReceived.userId;
            const gigInformation = dataReceived.gigInformation;

            if (userId && gigInformation) {
                dataReceived.gigCreatedAt = new Date();
                await gigsCollection.insertOne(dataReceived);
                response.status(200).json({ message: "Event uploaded successfully." });
            } else {
                response.status(400).json({ message: "Missing data."})
            }
        }

    } catch (error) {
        console.error(error);
        response.status(500).json(error);
    } finally {
        if (mongoClient) {
            await mongoClient.close();
        }
    }
}