// utils/sendEmail.js
import SibApiV3Sdk from "sib-api-v3-sdk";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
const brevoEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();
const EMAIL_TIMEOUT_MS = 15000;

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    ),
  ]);

const sanitizeSenderValue = (value) =>
  String(value || "")
    .trim()
    .replace(/^['"]+|['"]+$/g, "");

/**
 * Send email using Brevo (Sendinblue)
 * @param {string} to - Recipient email
 * @param {string} subject - Subject line
 * @param {string} htmlContent - HTML email body
 * @param {string} name - Recipient name
 */
export const sendEmail = async (to, subject, htmlContent, name = "") => {
  const senderCandidates = [
    ["BREVO_SENDER_EMAIL", process.env.BREVO_SENDER_EMAIL],
    ["BREVO_FROM_EMAIL", process.env.BREVO_FROM_EMAIL],
    ["BREVO_FROM", process.env.BREVO_FROM],
    ["BREVO_SENDER", process.env.BREVO_SENDER],
    ["EMAIL_SENDER", process.env.EMAIL_SENDER],
    ["MAIL_FROM", process.env.MAIL_FROM],
    ["SENDER", process.env.SENDER],
    ["SENDER_EMAIL", process.env.SENDER_EMAIL],
    ["EMAIL_USER", process.env.EMAIL_USER],
  ];
  const firstSenderCandidate = senderCandidates.find(
    ([, value]) => sanitizeSenderValue(value)
  );
  const senderSourceKey = firstSenderCandidate?.[0] || "none";
  const senderEmailInput = sanitizeSenderValue(firstSenderCandidate?.[1]);
  const looksLikeDomainOnly =
    /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(senderEmailInput) &&
    !senderEmailInput.includes("@");
  const senderEmail = looksLikeDomainOnly
    ? `noreply@${senderEmailInput}`
    : senderEmailInput;
  const senderName =
    process.env.SENDER_NAME ||
    process.env.BREVO_SENDER_NAME ||
    process.env.BREVO_FROM_NAME ||
    "HGSC² Digital Skills";
  const canUseSmtpFallback = Boolean(
    process.env.EMAIL_USER && process.env.EMAIL_PASS
  );
  const hasValidSenderEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail);
  const maskedSenderPreview = senderEmail
    ? `${senderEmail.slice(0, 2)}***@${senderEmail.split("@")[1] || "unknown"}`
    : "none";

  const sendViaSmtp = async () => {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      connectionTimeout: EMAIL_TIMEOUT_MS,
      greetingTimeout: EMAIL_TIMEOUT_MS,
      socketTimeout: EMAIL_TIMEOUT_MS,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await withTimeout(
      transporter.sendMail({
        from: `"${senderName}" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html: htmlContent,
      }),
      EMAIL_TIMEOUT_MS,
      "SMTP send"
    );

    console.log("✅ Email sent successfully via SMTP fallback");
    return { provider: "smtp_fallback" };
  };

  if (!hasValidSenderEmail) {
    console.error("❌ Email sender config invalid", {
      senderSourceKey,
      maskedSenderPreview,
      looksLikeDomainOnly,
      hasValidSenderEmail,
      hasBrevoApiKey: Boolean(process.env.BREVO_API_KEY),
      hasSmtpUser: Boolean(process.env.EMAIL_USER),
      hasSmtpPass: Boolean(process.env.EMAIL_PASS),
    });
    if (canUseSmtpFallback) {
      try {
        return await sendViaSmtp();
      } catch (smtpError) {
        console.error("❌ SMTP fallback email error:", smtpError);
      }
    }
    throw Object.assign(
      new Error(
        "Missing/invalid sender email configuration. Set BREVO_SENDER_EMAIL (or BREVO_FROM_EMAIL / EMAIL_SENDER)."
      ),
      {
      stage: "brevo",
      }
    );
  }

  const sendSmtpEmail = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [{ email: to, name }],
    subject,
    htmlContent,
  };

  try {
    console.log("📨 Attempting Brevo send", {
      senderSourceKey,
      maskedSenderPreview,
      hasValidSenderEmail,
      hasBrevoApiKey: Boolean(process.env.BREVO_API_KEY),
    });
    const response = await withTimeout(
      brevoEmailApi.sendTransacEmail(sendSmtpEmail),
      EMAIL_TIMEOUT_MS,
      "Brevo send"
    );
    console.log("✅ Email sent successfully via Brevo:", response);
    return { provider: "brevo" };
  } catch (brevoError) {
    console.error(
      "❌ Brevo email sending error:",
      brevoError.response?.body || brevoError
    );

    if (!canUseSmtpFallback) {
      throw Object.assign(
        new Error(
          brevoError.response?.body?.message ||
            brevoError.message ||
            "Brevo failed"
        ),
        { stage: "brevo" }
      );
    }

    try {
      return await sendViaSmtp();
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
