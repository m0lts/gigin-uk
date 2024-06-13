import { MongoClient } from "mongodb";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

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

    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).json({ error: 'Missing email or password' });
        return;
    }

    let mongoClient;

    try {
        mongoClient = await (new MongoClient(uri, options)).connect();

        const db = mongoClient.db("gigin-v1");
        const accounts = db.collection("accounts");

        // Find the user by email
        const user = await accounts.findOne({ email });

        if (!user) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }

        // Compare the hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }

        // Create JWT token
        const token = jwt.sign(
            { userId: user.userId, email: user.email, name: user.name, phoneNumber: user.phoneNumber },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.setHeader('Set-Cookie', `jwt=${token}; HttpOnly; Secure; Path=/; Max-Age=3600`);
        res.status(200).json({ user: { userId: user.userId, email: user.email, name: user.name, phoneNumber: user.phoneNumber } });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (mongoClient) {
            await mongoClient.close();
        }
    }
}

