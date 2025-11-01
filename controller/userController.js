import User from "../module/userModule.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import SibApiV3Sdk from "sib-api-v3-sdk";
import dotenv from "dotenv";

dotenv.config();

/* ✅ Configure Brevo API Client */
const brevoClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = brevoClient.authentications["api-key"];
apiKey.apiKey = process.env.EMAIL_API_KEY;

const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

export const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists." });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Create user with OTP
    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      otp,
      isVerified: false,
    });

    /* ✅ Email setup */
    const sender = {
      email: process.env.EMAIL_USER, // verified sender in Brevo
      name: "HGSC² Digital Skills",
    };

    const receivers = [{ email: user.email }];

    const emailContent = {
      sender,
      to: receivers,
      subject: "Email Verification Code - HGSC² Digital Skills",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Hello ${user.firstName},</h2>
          <p>Thank you for registering with <b>HGSC² Digital Skills</b>.</p>
          <p>Your verification code is:</p>
          <h1 style="background:#222;color:#fff;display:inline-block;padding:10px 20px;border-radius:8px;">
            ${otp}
          </h1>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn’t request this, please ignore this email.</p>
          <br/>
          <p>— The HGSC² Digital Skills Team</p>
        </div>
      `,
    };

    /* ✅ Send the transactional email */
    await tranEmailApi.sendTransacEmail(emailContent);

    res.status(201).json({
      message: "User registered successfully. Verification email sent.",
      email: user.email,
      otp, // only for testing — remove this in production
    });
  } catch (error) {
    console.error("❌ Full registration error:", error);
    res.status(500).json({
      message: "Error sending verification email",
      error: error.message || error,
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      role,
      phoneNumber,
      country,
      acceptedTerms,
      code,
    } = req.body;

    if (!email || !code)
      return res
        .status(400)
        .json({ message: "Email and verification code are required." });

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ message: "User not found. Please register first." });

    if (user.isVerified)
      return res.status(400).json({ message: "User already verified." });

    if (String(user.otp) !== String(code))
      return res
        .status(400)
        .json({ message: "Invalid or incorrect verification code." });

    // Mark as verified
    user.isVerified = true;
    user.otp = null; // clear OTP
    user.fullName = fullName || `${user.firstName} ${user.lastName}`;
    user.role = role || "student";
    user.phoneNumber = phoneNumber;
    user.country = country;
    user.acceptedTerms = acceptedTerms;
    await user.save();

    res.status(200).json({
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    console.error("❌ Verification error:", error);
    res.status(500).json({
      message: "Verification failed.",
      error: error.message || error,
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required." });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(401).json({ message: "Invalid credentials." });

    if (!user.isVerified)
      return res
        .status(403)
        .json({ message: "Please verify your email first." });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        fullName: user.fullName || `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Login failed.", error: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (error) {
    console.error("❌ Fetch users error:", error);
    res.status(500).json({
      message: "Error fetching users.",
      error: error.message,
    });
  }
};
