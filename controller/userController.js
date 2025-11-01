import User from "../module/userModule.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import cloudinary from "../config/cloudnary.js";

// 📌 Register User and Send OTP
export const registerUser = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      role,
      phoneNumber,
      country,
      acceptedTerms,
    } = req.body;

    if (!fullName || !email || !password)
      return res
        .status(400)
        .json({ message: "All required fields are needed" });

    if (password.length < 5)
      return res.status(400).json({ message: "Password too short" });

    if (!acceptedTerms)
      return res
        .status(400)
        .json({ message: "Please accept the terms & conditions" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already registered" });

    // Generate OTP
    const verificationCode = Math.floor(100000 + Math.random() * 900000);

    // ✅ Setup Brevo API
    const apiInstance = new Brevo.TransactionalEmailsApi();
    const apiKey = apiInstance.authentications["apiKey"];
    apiKey.apiKey = process.env.EMAIL_API_KEY;

    const sendSmtpEmail = {
      sender: {
        name: "HGSC² Digital Skills",
        email: process.env.EMAIL_USER,
      },
      to: [{ email, name: fullName }],
      subject: "Verify Your HGSC² Account",
      htmlContent: `
        <h2>Welcome, ${fullName}</h2>
        <p>Your verification code is:</p>
        <h1 style="color:#1976d2;">${verificationCode}</h1>
        <p>This code expires in 10 minutes.</p>
      `,
    };

    await apiInstance.sendTransacEmail(sendSmtpEmail);

    // ✅ Return temporary data for frontend OTP verification
    res.status(200).json({
      message: "Verification code sent to your email.",
      tempUser: {
        fullName,
        email,
        password,
        role,
        phoneNumber,
        country,
        acceptedTerms,
        verificationCode,
      },
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    res.status(500).json({
      message: "Error sending verification email",
      error: error.message,
    });
  }
};

// 📌 Verify Email and Register
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

// 📌 Login
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

// 📌 Get All Users (admin only)
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
