// utils/sendEmail.js
import SibApiV3Sdk from "sib-api-v3-sdk";
import nodemailer from "nodemailer";
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
  const senderEmail =
    process.env.EMAIL_SENDER || process.env.SENDER_EMAIL || process.env.EMAIL_USER;
  const senderName = process.env.SENDER_NAME || "HGSC² Digital Skills";

  if (!senderEmail) {
    throw Object.assign(new Error("Missing sender email configuration"), {
      stage: "brevo",
    });
  }

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail({
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [{ email: to, name }],
    subject,
    htmlContent,
  });

  try {
    const response = await brevoEmailApi.sendTransacEmail(sendSmtpEmail);
    console.log("✅ Email sent successfully via Brevo:", response);
    return { provider: "brevo" };
  } catch (brevoError) {
    console.error(
      "❌ Brevo email sending error:",
      brevoError.response?.body || brevoError
    );

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw Object.assign(
        new Error(
          brevoError.response?.body?.message || brevoError.message || "Brevo failed"
        ),
        { stage: "brevo" }
      );
    }

    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: `"${senderName}" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html: htmlContent,
      });

      console.log("✅ Email sent successfully via SMTP fallback");
      return { provider: "smtp_fallback" };
    } catch (smtpError) {
      console.error("❌ SMTP fallback email error:", smtpError);
      throw Object.assign(
        new Error(
          brevoError.response?.body?.message ||
            smtpError.message ||
            "Email delivery failed"
        ),
        { stage: "brevo" }
      );
    }
  }
};
