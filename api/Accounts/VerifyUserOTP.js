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

        const db = mongoClient.db('gigin-users');
        const accountsCollection = db.collection('accounts');
        const resetPasswordCollection = db.collection('reset-password');


        if (request.method === "POST") {
            const dataReceived = request.body;
            const email = dataReceived.userEmail;
            const OTP = dataReceived.userOTP;

            const resetPasswordDetails = await resetPasswordCollection.findOne({ passwordResetToken: OTP });

            if (resetPasswordDetails) {
                if (resetPasswordDetails.userEmail === email) {
                    response.status(201).json({ message: 'One time passcode correct'})
                } else {
                    response.status(401).json({ error: 'One-time passcode incorrect.'})
                }
            } else {
                response.status(401).json({ error: 'One-time passcode incorrect.'})
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