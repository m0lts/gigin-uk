import { MongoClient } from "mongodb";
import sendgrid from "@sendgrid/mail";
import client from "@sendgrid/client";
import jwt from "jsonwebtoken";

const uri = process.env.MONGODB_URI;
const options = {};

sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
client.setApiKey(process.env.SENDGRID_API_KEY);

if (!process.env.MONGODB_URI) {
    throw new Error("Please add your Mongo URI to env.local")
}

export default async function handler(request, response) {
    let mongoClient;

    try {
        mongoClient = await (new MongoClient(uri, options)).connect();

        const usersDb = mongoClient.db("gigin-users");
        const waitingListCollection = usersDb.collection("waiting-list");

        if (request.method === "POST") {
            const formData = request.body;
            const email = formData.email;

            const userRecord = await waitingListCollection.findOne({ email });

            if (email === 'moltontom6@gmail.com' || email === 'gardner.b.toby@gmail.com') {
                const jwtToken = jwt.sign({ 
                    email: email, 
                    name: formData.name, 
                }, process.env.JWT_SECRET, { expiresIn: '14d' });
                response.setHeader('Set-Cookie', `token=${jwtToken}; HttpOnly; Secure; Path=/; Max-Age=1209600; SameSite=Strict`);
                response.status(201).json({
                    message: 'Authentication successful',
                    user: {
                        email: email,
                        name: formData.name,
                    }
                });
                return;
            }

            if (userRecord) {
                response.status(200).json({ message: "User already joined waiting list" });
                return;
            }

            const msg = {
                to: email,
                from: {
                    name: 'Gigin',
                    email: 'hq.gigin@gmail.com'
                },
                templateId: 'd-93eb565091794df2a316f81c541142d6',
                dynamic_template_data: {
                    name: formData.name,
                }
            };

            const sendEmail = await sendgrid.send(msg);

            const contactData = {
                "contacts": [
                    {
                        "email": email,
                        "first_name": formData.name.split(' ')[0],
                        "last_name": formData.name.split(' ')[1],
                    }
                ],
                "list_ids": ['0babb87e-82d2-4b5e-b160-360005604b2d'],
            };

            const contactRequest = {
                method: 'PUT',
                url: '/v3/marketing/contacts',
                body: contactData,
            };

            const contactAdded = await client.request(contactRequest);

            if (!sendEmail || !contactAdded) {
                response.status(400).json({ error: "Email not sent" });
                return;
            } else {
                await waitingListCollection.insertOne(formData);
                response.status(200).json({ message: "Email sent successfully", formData });
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