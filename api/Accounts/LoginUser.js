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
        const profilesCollection = db.collection('profiles');

        if (request.method === "POST") {
            const dataReceived = request.body;

            // Check if email already exists in any collection
            const email = dataReceived.userEmail;
            const userAccount = await accountsCollection.findOne({ userEmail: email });

            if (userAccount) {
                const accountPassword = userAccount.userPassword;
                const enteredPassword = dataReceived.userPassword;
                const passwordMatch = await bcrypt.compare(enteredPassword, accountPassword);
    
    
                if (passwordMatch) {
                    response.status(201).json({ userAccount });
                } else {
                    response.status(401).json({ error: 'Incorrect password' });
                }
            } else {
                response.status(400).json({error: 'No account associated with that email address.'})
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
