import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const { email, phoneNumber } = req.body;

  if (!email || !phoneNumber) {
    res.status(400).json({ error: 'Email and phone number are required' });
    return;
  }

  let mongoClient;

  try {
    mongoClient = await new MongoClient(uri, options).connect();
    const db = mongoClient.db('gigin-v1');
    const accounts = db.collection('accounts');

    const existingUser = await accounts.findOne({ $or: [{ email }, { phoneNumber }] });
    if (existingUser) {
      res.status(400).json({ error: 'User with this email or phone number already exists' });
      return;
    }

    res.status(200).json({ message: 'User can proceed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}
