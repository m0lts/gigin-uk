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
        console.log("Just Connected!");

        const db = mongoClient.db("gigin-users");
        const dbCollection = db.collection("accounts");
        const passwordResetCollection = db.collection("reset-password");


        if (request.method === "POST") {
            const receivedData = request.body;
            const token = receivedData.token;
            const userId = receivedData.userId;

            const passwordResetUserRecord = await passwordResetCollection.findOne({ token, userId });

            if (!passwordResetUserRecord) {
                response.status(400).json({ error: 'Invalid reset password link.' });
                return;
            }

            if (passwordResetUserRecord.token === token && passwordResetUserRecord.userId === userId) {
                const hashedPassword = await bcrypt.hash(receivedData.password, 10);
                const userIdObject = new ObjectId(userId);
                await dbCollection.updateOne(
                    { _id: userIdObject },
                    { $set: { password: hashedPassword } }
                );
                // Delete the record associated with the token from the database
                await passwordResetCollection.deleteOne({ token, userId });
                response.status(200).json({ message: "Password reset." });
            } else {
                response.status(401).json({ error: 'Invalid reset password code.' });
                return;
            }

            } else {
                response.status(405).json({ error: "Method Not Allowed" });
            }


    } catch (error) {
        console.error(error);
        response.status(500).json(error);
    } finally {
        // Close database connection
        if (mongoClient) {
            await mongoClient.close();
            console.log("MongoDB connection closed.");
        }
    }
}