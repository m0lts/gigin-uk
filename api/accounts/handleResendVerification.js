import { MongoClient } from "mongodb";
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

            // Check if email or username already exists in database
            const email = formData.email;
            const emailInDatabase = await dbCollection.findOne({ email });

            const generateRandomToken = (length) => {
                const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
                let token = '';
                for (let i = 0; i < length; i++) {
                    const randomIndex = Math.floor(Math.random() * characters.length);
                    token += characters[randomIndex];
                }
                return token;
            };

            if (emailInDatabase) {
                const verificationToken = generateRandomToken(24);

                await dbCollection.updateOne({ email }, { $set: { verificationToken } });
                
                const verificationLink = `https://www.f1gridlock.com/verifyaccount?email=${email}&token=${verificationToken}`;

                const msg = {
                    to: email,
                    from: 'gridlock.contact@gmail.com',
                    templateId: 'd-f9b818d2289e4c2da46e434c87a9b9e9',
                    dynamic_template_data: {
                        verificationLink: verificationLink,
                    }
                };
    
                const sendEmail = await sendgrid.send(msg);
    
                if (!sendEmail) {
                    response.status(401).json({ error: "Error sending verification email." });
                    return;
                } else {
                    response.status(201).json({ message: 'Email successfully sent' });
                }
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