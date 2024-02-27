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

        const db = mongoClient.db("gigin-gigs");
        const dbCollection = db.collection("gigs");

        if (request.method === "POST") {
            const formData = request.body;
            const userId = formData.userId;

            // Return all venues for the user that have a matching userId
            const gigs = await dbCollection.find({ userId: userId }).toArray();
            response.status(200).json(gigs);

        } else {
            response.status(405).json({ error: "Method Not Allowed" });
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