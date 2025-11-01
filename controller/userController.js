import User from "../module/userModule.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import SibApiV3Sdk from "sib-api-v3-sdk";
import dotenv from "dotenv";

dotenv.config();

// ✅ Setup Brevo client properly
const brevoClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = brevoClient.authentications["api-key"];
apiKey.apiKey = process.env.EMAIL_API_KEY; // ✅ Use the correct Brevo API key variable

const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

// ✅ Register user and send OTP
export const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "User already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    user.otp = otp;
    await user.save();

    // Prepare Brevo email
    const sender = {
      email: process.env.EMAIL_USER, // ✅ Your verified Brevo sender email (e.g. 9a743f001@smtp-brevo.com)
      name: "HGSC² Digital Skills",
    };

    const receivers = [{ email: user.email }];

    const emailContent = {
      sender,
      to: receivers,
      subject: "Email Verification Code",
      htmlContent: `
        <p>Hi ${user.firstName || "there"},</p>
        <p>Your verification code is <b>${otp}</b>.</p>
        <p>This code expires in 10 minutes.</p>
        <br/>
        <p>HGSC² Digital Skills Team</p>
      `,
    };

    // ✅ Send the transactional email via Brevo
    await tranEmailApi.sendTransacEmail(emailContent);

    res.status(201).json({
      message: "User registered. Verification email sent successfully.",
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    res.status(500).json({
      message: "Error sending verification email",
      error: error.message,
    });
  }
};

// ✅ Verify Email and Register (OTP confirmation)
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
      sentCode,
    } = req.body;

    if (!email || !code)
      return res.status(400).json({ message: "Email and code are required" });

    if (code !== sentCode)
      return res.status(400).json({ message: "Invalid verification code" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role: role || "student",
      phoneNumber,
      country,
      acceptedTerms,
      isVerified: true,
    });

    res.status(201).json({
      message: "Email verified and user registered successfully",
      userId: newUser._id,
    });
  } catch (error) {
    console.error("❌ Verification error:", error);
    res
      .status(500)
      .json({ message: "Verification failed", error: error.message });
  }
};

// ✅ Login
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(401).json({ message: "Invalid credentials" });

    if (!user.isVerified)
      return res
        .status(403)
        .json({ message: "Please verify your email first" });

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
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

// ✅ Get All Users (admin only)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
};
