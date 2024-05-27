import { MongoClient } from "mongodb";
import { v4 as uuidv4 } from 'uuid';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import client from "@sendgrid/client";

client.setApiKey(process.env.SENDGRID_API_KEY);
const uri = process.env.MONGODB_URI;
const options = {};

if (!process.env.MONGODB_URI) {
    throw new Error("Please add your Mongo URI to env.local");
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
        return;
    }

    const { name, email, phoneNumber, password, marketingConsent } = req.body;

    if (!name || !email || !phoneNumber || !password) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }

    let mongoClient;

    try {
        mongoClient = await (new MongoClient(uri, options)).connect();

        const db = mongoClient.db("gigin-v1");
        const accounts = db.collection("accounts");

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            userId: uuidv4(),
            name,
            email,
            phoneNumber,
            password: hashedPassword,
            createdAt: new Date(),
        };

        
        const contactData = {
            "contacts": [
                {
                    "email": email,
                    "first_name": name.split(' ')[0],
                    "last_name": name.split(' ')[1],
                    "phone_number": phoneNumber,
                    "external_id": newUser.userId,
                }
            ],
            "list_ids": marketingConsent ? ['6e32fdc7-9a2d-49cf-afe3-1540ddfe8a3b'] : [],
        };
        
        const contactRequest = {
            method: 'PUT',
            url: '/v3/marketing/contacts',
            body: contactData,
        };
        
        const contactAdded = await client.request(contactRequest);
        
        if (!contactAdded) {
            res.status(401).json({ error: 'Error adding user to Sendgrid contacts.' });
            return;
        }

        const result = await accounts.insertOne(newUser);

        const token = jwt.sign(
            { userId: result.insertedId, email: newUser.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(201).json({ token });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (mongoClient) {
            await mongoClient.close();
        }
    }
}
