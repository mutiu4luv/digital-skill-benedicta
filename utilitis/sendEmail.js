// utils/sendEmail.js
import SibApiV3Sdk from "sib-api-v3-sdk";
import dotenv from "dotenv";

dotenv.config();

const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
const brevoEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

/**
 * Send email using Brevo (Sendinblue)
 * @param {string} to - Recipient email
 * @param {string} subject - Subject line
 * @param {string} htmlContent - HTML email body
 * @param {string} name - Recipient name
 */
export const sendEmail = async (to, subject, htmlContent, name = "") => {
  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail({
      sender: {
        name: process.env.SENDER_NAME,
        email: process.env.SENDER_EMAIL,
      },
      to: [{ email: to, name }],
      subject,
      htmlContent,
    });

    const response = await brevoEmailApi.sendTransacEmail(sendSmtpEmail);
    console.log("✅ Email sent successfully:", response);
  } catch (error) {
    console.error("❌ Email sending error:", error.response?.body || error);
  }
};
