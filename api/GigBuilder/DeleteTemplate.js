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
            const userTemplate = dataReceived.template;
            const templateName = userTemplate.templateName;
        
            const templatesExist = await templatesCollection.findOne({ userID: userID});

            if (templatesExist) {
                // Find the template that has he same name as the one received
                const templateNameTaken = templatesExist.templates.some(template => template.templateName === templateName);
            
                await templatesCollection.updateOne(
                    { userID: userID },
                    { $pull: { templates: { templateName: templateName } } }
                );

                const updatedTemplatesDocument = await templatesCollection.findOne({ userID: userID });
                response.status(201).json({ updatedTemplatesDocument, message: "Template deleted" });
                
            } else {
                response.status(200).json({ message: "No templates found" });
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