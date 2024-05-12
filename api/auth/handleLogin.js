import { MongoClient } from "mongodb";
import jwt from "jsonwebtoken";

const uri = process.env.MONGODB_URI;
const options = {};

if (!process.env.MONGODB_URI) {
    throw new Error("Please add your Mongo URI to env.local")
}

export default async function handler(request, response) {
    let mongoClient;

    try {
        mongoClient = await (new MongoClient(uri, options)).connect();

        const usersDb = mongoClient.db("gigin-users");
        const accountsCollection = usersDb.collection("accounts");

        console.log('recieved')
        const formData = request.body;
        const email = formData.email;

        const userRecord = await accountsCollection.findOne({ email });

        if (!userRecord) {
            response.status(401).json({ message: "User not authorised." })
        }

        if (userRecord) {
            const jwtToken = jwt.sign({ 
                email: email, 
                name: userRecord.forename + ' ' + userRecord.surname,
                forename: userRecord.forename,
                surname: userRecord.surname
            }, process.env.JWT_SECRET, { expiresIn: '14d' });
            response.setHeader('Set-Cookie', `token=${jwtToken}; HttpOnly; Secure; Path=/; Max-Age=1209600; SameSite=Strict`);
            response.status(201).json({
                message: 'Authorisation successful',
                user: {
                    email: email, 
                    name: userRecord.forename + ' ' + userRecord.surname,
                    forename: userRecord.forename,
                    surname: userRecord.surname
                }
            });
            return;
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