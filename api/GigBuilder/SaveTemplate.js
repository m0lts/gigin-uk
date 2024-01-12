import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const options = {};

if (!process.env.MONGODB_URI) {
    throw new Error("Please add your Mongo URI to env.local")
}

export default async function handler(request, response) {
    let mongoClient;

    try {
        mongoClient = await (new MongoClient(uri, options)).connect();

        const db = mongoClient.db('gigin-gigs');
        const templatesCollection = db.collection('templates');

        if (request.method === "POST") {
            const dataReceived = request.body;
            const userID = dataReceived.userID;
            const userTemplate = dataReceived.templateInformation;
            const templateName = dataReceived.templateInformation.templateName;
        
            const templatesExist = await templatesCollection.findOne({ userID: userID});

            if (templatesExist) {
                // Check if the templates array has a template with the same name as the one received
                const templateNameTaken = templatesExist.templates.some(template => template.templateName === templateName);
            
                if (templateNameTaken) {
                    // Alert the user that they already have a template with that name          
                    response.status(400).json({ message: "* You already have a template with that name." });
                } else {
                    // Insert a new profile into the profiles array
                    await templatesCollection.updateOne(
                        { userID: userID },
                        { $push: { templates: userTemplate } }
                    );
            
                    const updatedTemplateDocument = await templatesCollection.findOne({ userID: userID });
                    response.status(201).json({ updatedTemplateDocument });
                }
            } else {
                // If the user template document doesn't exist, create a new one with the received template
                await templatesCollection.insertOne({
                    userID: userID,
                    templates: [userTemplate]
                });
            
                const updatedTemplateDocument = await templatesCollection.findOne({ userID: userID });
                response.status(201).json({ updatedTemplateDocument });
            }
            
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