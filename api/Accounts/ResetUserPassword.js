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
        const resetPasswordCollection = db.collection('reset-password');


        if (request.method === "POST") {
            const dataReceived = request.body;
            const email = dataReceived.userEmail;

            const hashedPassword = await bcrypt.hash(dataReceived.userPassword, 10);
            
            const userAccount = await accountsCollection.findOne({ userEmail: email });

            if (userAccount) {
                await accountsCollection.updateOne({ userEmail: email }, { $set: { userPassword: hashedPassword } });
                await resetPasswordCollection.deleteOne({ passwordResetToken: dataReceived.userOTP });
                response.status(201).json({ message: 'Password updated.' });
            } else {
                response.status(401).json({ error: 'There has been an error resetting your password.'})
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