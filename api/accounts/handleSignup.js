import { MongoClient } from "mongodb";
import bcrypt from 'bcrypt';
import sendgrid from '@sendgrid/mail';

// Send grid API key
sendgrid.setApiKey(process.env.SENDGRIDAPI_KEY);

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
            delete formData.verify_password;

            // Hash the user's password
            const hashedPassword = await bcrypt.hash(formData.password, 10);
            formData.password = hashedPassword;

            formData.verified = false;

            // Check if email or phone number already exists in database
            const email = formData.email;
            formData.email = email.toLowerCase();
            const phoneNumber = formData.phoneNumber;
            const emailInDatabase = await dbCollection.findOne({ email });
            const phoneInDatabase = await dbCollection.findOne({ phoneNumber });
            if (emailInDatabase) {
                response.status(400).json({ error: 'Email address taken.' });
                return;
            } else if (phoneInDatabase) {
                response.status(401).json({ error: 'Phone number taken.' });
                return;
            }


            await dbCollection.insertOne(formData);
            response.status(201).json({ message: 'Account created.' });

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
        }
    }
}

