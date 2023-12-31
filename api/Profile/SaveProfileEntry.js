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

        const db = mongoClient.db('gigin-users');
        const profilesCollection = db.collection('profiles');

        if (request.method === "POST") {
            const dataReceived = request.body;
            const userID = dataReceived.userID;
            const profileID = dataReceived.userProfile.profileID;
            const userProfile = dataReceived.userProfile;
            const profileImages = dataReceived.userProfile.profileImages;
        

            const userProfileDocument = await profilesCollection.findOne({ userID: userID});

            if (userProfileDocument) {
                // Check if the profiles array has a profile with the same profileID as the one received
                const profileExists = userProfileDocument.profiles.some(profile => profile.profileID === profileID);
            
                if (profileExists) {
                    // Update the existing profile within the profiles array
                    await profilesCollection.updateOne(
                        { userID: userID, 'profiles.profileID': profileID },
                        { $set: { 'profiles.$': userProfile } }
                    );
            
                    const updatedProfileDocument = await profilesCollection.findOne({ userID: userID });
                    response.status(200).json({ updatedProfileDocument });
                } else {
                    // Insert a new profile into the profiles array
                    await profilesCollection.updateOne(
                        { userID: userID },
                        { $push: { profiles: userProfile } }
                    );
            
                    const updatedProfileDocument = await profilesCollection.findOne({ userID: userID });
                    response.status(201).json({ updatedProfileDocument });
                }
            } else {
                // If the user profile document doesn't exist, create a new one with the received profile
                await profilesCollection.insertOne({
                    userID: userID,
                    profiles: [userProfile]
                });
            
                const updatedProfileDocument = await profilesCollection.findOne({ userID: userID });
                response.status(201).json({ updatedProfileDocument });
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