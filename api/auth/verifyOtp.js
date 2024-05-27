import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { otpId, otp } = req.body;

  if (!otpId || !otp) {
    return res.status(400).json({ error: 'OTP and ID are required' });
  }

  let mongoClient;

  try {
    mongoClient = await new MongoClient(uri, options).connect();
    const db = mongoClient.db('gigin-v1');
    const otps = db.collection('otps');

    // Find and verify the OTP
    const record = await otps.findOne({ otpId, otp });

    if (!record || new Date() > new Date(record.expiresAt)) {
      return res.status(400).json({ error: '* Invalid verification code.' });
    }

    await otps.deleteOne({ otpId });

    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: '* Invalid verification code.' });
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}
