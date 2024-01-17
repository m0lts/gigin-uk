
// Uploads file to S3 bucket and returns the URL
export const handleMediaUpload = async (file) => {

    try {

      // Get the S3 upload URL from back end
      const response = await fetch('/api/CloudStorage/AWSS3Connection.js');
      const responseData = await response.json();

      // Use the obtained upload URL to upload the file to S3
      const uploadURL = responseData.uploadURL;

      const s3Response = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
      });

      if (s3Response.ok) {
        // Get the URL of the uploaded file
        const imageUrl = uploadURL.split('?')[0];
        return imageUrl;
      } else {
        console.error('Error uploading file:', s3Response.statusText);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };