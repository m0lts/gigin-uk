// const { onRequest } = require("firebase-functions/v2/https");
// const logger = require("firebase-functions/logger");
// const nodemailer = require("nodemailer");

// // Configure the email transport using your email service credentials
// // This example uses Gmail; replace with your own email service credentials
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: 'hq.gigin@gmail.com',
//     pass: 'your-email-password',
//   },
// });

// // Cloud function to send an email
// exports.sendEmail = onRequest(async (req, res) => {
//   // Log the request for debugging purposes
//   logger.info("Received request to send email", { structuredData: true });

//   // Extract email data from the request body
//   const { email, subject, message } = req.body;

//   if (!email || !subject || !message) {
//     res.status(400).send('Missing email, subject, or message');
//     return;
//   }

//   // Set up email options
//   const mailOptions = {
//     from: 'your-email@gmail.com', // Sender address (your email)
//     to: email, // Recipient email
//     subject: subject, // Subject line
//     text: message, // Plain text body
//   };

//   try {
//     // Send the email
//     await transporter.sendMail(mailOptions);
//     logger.info(`Email sent to ${email}`);
//     res.status(200).send(`Email sent to ${email}`);
//   } catch (error) {
//     logger.error('Error sending email:', error);
//     res.status(500).send('Failed to send email');
//   }
// });

