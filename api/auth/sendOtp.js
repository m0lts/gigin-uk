import sgMail from '@sendgrid/mail';
import { v4 as uuidv4 } from 'uuid';
import { MongoClient } from 'mongodb';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const uri = process.env.MONGODB_URI;
const options = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { email, name } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  let mongoClient;

  try {
    mongoClient = await new MongoClient(uri, options).connect();
    const db = mongoClient.db('gigin-v1');
    const otps = db.collection('otps');

    // Delete existing OTPs for this email
    await otps.deleteMany({ email });

    // Generate OTP and store it with a timestamp
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpId = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await otps.insertOne({ otpId, email, otp, expiresAt });

    // Send OTP to the user's email
    const msg = {
      to: email,
      from: {
        name: 'Gigin',
        email: 'hq.gigin@gmail.com'
      },
      templateId: 'd-1d0b6d4158f24d3daad0c3f8ce555895',
      dynamic_template_data: {
        otp: otp,
        name: name,
      }
    };

    await sgMail.send(msg);

    res.status(200).json({ message: 'OTP sent to email', otpId });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}
