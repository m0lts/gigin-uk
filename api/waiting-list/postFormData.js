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

        const usersDb = mongoClient.db("gigin-users");
        const waitingListCollection = usersDb.collection("waiting-list");

        if (request.method === "POST") {
            const formData = request.body;
            const email = formData.email;

            const userRecord = await waitingListCollection.findOne({ email });

            if (userRecord) {
                response.status(400).json({ message: "User already joined waiting list" });
                return;
            }

            if (email === 'moltontom6@gmail.com' || email === 'gardner.b.toby@gmail.com') {
                response.status(201).json({ message: "User allowed further access" });
                return;
            }

            await waitingListCollection.insertOne(formData);

            response.status(200).json({ message: "User added to the waiting list", formData });


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