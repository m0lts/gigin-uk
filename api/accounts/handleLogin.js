import { MongoClient } from "mongodb";
import bcrypt from 'bcrypt';

const uri = process.env.MONGODB_URI;
const options = {};

if (!process.env.MONGODB_URI) {
    throw new Error("Please add your Mongo URI to env.local")
}

export default async function handler(request, response) {
    let mongoClient;

    try {
        mongoClient = await (new MongoClient(uri, options)).connect();

        const db = mongoClient.db("gigin-users");
        const dbCollection = db.collection("accounts");

        if (request.method === "POST") {
            const formData = request.body;
            const email = formData.email;
            const password = formData.password;

            const userRecord = await dbCollection.findOne({ email});

            if (!userRecord) {
                response.status(400).json({ error: "User not found" });
                return;
            }

            const dbPassword = userRecord.password;
            const passwordMatch = await bcrypt.compare(password, dbPassword);

            if (passwordMatch) {
                response.status(200).json({ userRecord });
            } else {
                response.status(401).json({ error: 'Incorrect password' });
            }


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

