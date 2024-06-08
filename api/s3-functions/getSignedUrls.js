import aws from 'aws-sdk';
import crypto from 'crypto';

const region = "eu-west-2";
const bucketName = process.env.S3_BUCKET_NAME;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const s3 = new aws.S3({
    region,
    accessKeyId,
    secretAccessKey,
    signatureVersion: 'v4'
});

export default async function handler(request, response) {
    const { files, venueId } = request.body; // Get venueId from the request body

    const signedUrls = await Promise.all(files.map(async () => {
        const imageName = `${venueId}/${crypto.randomBytes(16).toString('hex')}`; // Use venueId as folder name

        const params = {
            Bucket: bucketName,
            Key: imageName,
            Expires: 60,
        };

        return {
            url: await s3.getSignedUrlPromise('putObject', params),
            imageName
        };
    }));

    response.status(200).json({ signedUrls });
}
