import { MongoClient } from "mongodb";
import sendgrid from '@sendgrid/mail';

// Send grid API key
sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

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

            const userAccount = await accountsCollection.findOne({ userEmail: email });

            const generateRandomToken = (length) => {
                const characters = '0123456789';
                let token = '';
                for (let i = 0; i < length; i++) {
                const randomIndex = Math.floor(Math.random() * characters.length);
                token += characters[randomIndex];
                }
                return token;
            };

            if (userAccount) {
                const passwordResetToken = generateRandomToken(6);
                const resetPasswordData = {
                    userEmail: email,
                    passwordResetToken: passwordResetToken,
                    createdAt: new Date(),
                }
                await resetPasswordCollection.insertOne(resetPasswordData);
                const msg = {
                    to: email,
                    from: 'hq.gigin@gmail.com',
                    subject: 'Reset Your Password',
                    text: `Please use this one-time-password code to reset your password: ${passwordResetToken}`,
                };
                await sendgrid.send(msg);
                response.status(201).json({ message: 'Password reset email sent.' });
            } else {
                response.status(201).json({ message: 'Password reset email sent.' });
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