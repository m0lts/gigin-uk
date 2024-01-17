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
    const imageName = crypto.randomBytes(16).toString('hex');
  
    const params = {
      Bucket: bucketName,
      Key: imageName,
      Expires: 60,
    };
  
    try {
      const uploadURL = await s3.getSignedUrlPromise('putObject', params);
  
      response.status(200).json({ uploadURL });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: 'Internal Server Error' });
    }
  }