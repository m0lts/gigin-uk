import { MongoClient, ObjectId } from "mongodb";
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
            const receivedData = request.body;
            const token = receivedData.token;
            const userEmail = receivedData.userEmail;

            const userAccount = await dbCollection.findOne({ verificationToken: token, email: userEmail });

            if (!userAccount) {
                response.status(400).json({ error: 'No user associated with this link.' });
                return;
            }

            if (userAccount.verificationToken === token && userAccount.email === userEmail) {
                await dbCollection.updateOne(
                    { verificationToken: token, email: userEmail },
                    { $set: { verified: true }, $unset: { verificationToken: "" } }
                );

                const updatedUserAccount = await dbCollection.findOne({ email: userEmail });
                response.status(200).json({ message: "User verified.", updatedUserAccount });
                
            } else {
                response.status(401).json({ error: 'Invalid verification link.' });
                return;
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