import { MongoClient } from "mongodb";
import { v4 as uuidv4 } from 'uuid';
import { addDays, addWeeks, addMonths } from 'date-fns';
import { formatISO } from 'date-fns';

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

    let mongoClient;

    try {
        mongoClient = await (new MongoClient(uri, options)).connect();

        const db = mongoClient.db("gigin-v1");
        const gigs = db.collection("gigs");
        const venueProfiles = db.collection("venueProfiles");

        const { gigDataPacket } = req.body;

        const existingGig = await gigs.findOne({ gigId: gigDataPacket.gigId });

        if (existingGig) {

            const { _id, ...updateData } = gigDataPacket;

            // Update existing gig
            await gigs.updateOne(
                { gigId: gigDataPacket.gigId },
                { $set: updateData }
            );
            res.status(200).json({ message: 'Gig updated successfully.' });
        } else {
            // New gig document
            if (gigDataPacket.complete === false) {
                const venueProfile = await venueProfiles.findOne({ venueId: gigDataPacket.venue.venueId });
                
                if (venueProfile.gigs) {
                    await venueProfiles.updateOne(
                        { venueId: gigDataPacket.venue.venueId },
                        { $addToSet: { gigs: gigDataPacket.gigId } }
                    );
                } else {
                    await venueProfiles.updateOne(
                        { venueId: gigDataPacket.venue.venueId },
                        { $set: { gigs: [gigDataPacket.gigId] } }
                    );
                }
            }

            // Ensure the date is correctly parsed and adjusted for time zone differences
            const startDate = new Date(gigDataPacket.date);

            // Calculate repeat dates if repeatData exists
            let gigDocuments = [];
            if (gigDataPacket.repeatData.repeat !== 'no') {
                const repeatType = gigDataPacket.repeatData.repeat;
                const endAfter = parseInt(gigDataPacket.repeatData.endAfter, 10);
                const endDate = gigDataPacket.repeatData.endDate ? new Date(gigDataPacket.repeatData.endDate) : null;

                let i = 0;

                while (true) {
                    let newDate;
                    switch (repeatType) {
                        case 'daily':
                            newDate = addDays(startDate, i);
                            break;
                        case 'weekly':
                            newDate = addWeeks(startDate, i);
                            break;
                        case 'monthly':
                            newDate = addMonths(startDate, i);
                            break;
                        default:
                            newDate = startDate;
                    }

                    // Adjust to the same local time as the original date
                    const localDate = new Date(newDate.toLocaleString("en-US", { timeZone: "Europe/London" }));

                    // Break the loop if the newDate exceeds the end date
                    if (endDate && localDate > endDate) {
                        break;
                    }

                    const newGig = {
                        ...gigDataPacket,
                        gigId: uuidv4(),
                        date: formatISO(localDate, { representation: 'date' }), // ISO format maintaining local date
                        createdAt: new Date(),
                    };

                    delete newGig.repeatData; // Remove repeatData

                    gigDocuments.push(newGig);

                    i++;
                    if (endAfter && i >= endAfter) {
                        break;
                    }
                }
            } else {
                const singleGig = {
                    ...gigDataPacket,
                    createdAt: new Date(),
                };
                delete singleGig.repeatData; // Remove repeatData
                gigDocuments.push(singleGig);
            }

            // Insert multiple gig documents
            await gigs.insertMany(gigDocuments);

            // Update venue profile with new gig IDs
            const gigIds = gigDocuments.map(gig => gig.gigId);
            await venueProfiles.updateOne(
                { venueId: gigDataPacket.venue.venueId },
                { $addToSet: { gigs: { $each: gigIds } } }
            );

            res.status(200).json({ message: 'Gigs posted successfully.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (mongoClient) {
            await mongoClient.close();
        }
    }
}


