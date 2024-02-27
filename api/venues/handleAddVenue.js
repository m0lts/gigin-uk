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

        const db = mongoClient.db("gigin-venues");
        const dbCollection = db.collection("venues");

        if (request.method === "POST") {
            const formData = request.body;
            const userId = formData.userId;
            const name = formData.name;

            const venueRecord = await dbCollection.findOne({ userId: userId, name: name });

            if (venueRecord) {
                response.status(400).json({ error: "Venue already exists" });
                return;
            }

            await dbCollection.insertOne(formData);
            response.status(200).json({ venueRecord });

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
