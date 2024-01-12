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
        const templatesCollection = db.collection('templates');

        if (request.method === "POST") {
            const dataReceived = request.body;
            const userID = dataReceived.userID;

            if (userID) {
                const userTemplates = await templatesCollection.findOne({ userID: userID});
                if (userTemplates) {
                    // Return all the user's templates
                    const templates = userTemplates.templates;
                    response.status(200).json({ templates });
                } else {
                    response.status(404).json({ message: "User has no templates."});
                }
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