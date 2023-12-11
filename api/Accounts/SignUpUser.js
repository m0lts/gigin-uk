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

        const db = mongoClient.db('gigin-users');
        const accountsCollection = db.collection('accounts');

        if (request.method === "POST") {
            const dataReceived = request.body;

            // Check if email already exists in any collection
            const email = dataReceived.userEmail;
            const emailTaken = await accountsCollection.findOne({ userEmail: email });

            // Return error if email already taken
            if (emailTaken) {
                response.status(400).json({ error: 'Email address taken.' });
                return;
            } else {
                // Hash password
                const hashedPassword = await bcrypt.hash(dataReceived.userPassword, 10);
                dataReceived.userPassword = hashedPassword;
                
                // Upload account to musicians collection
                await accountsCollection.insertOne(dataReceived);
                
                response.status(201).json({ dataReceived });
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
