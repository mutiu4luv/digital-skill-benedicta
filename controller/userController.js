import dotenv from "dotenv";
dotenv.config();

import SibApiV3Sdk from "sib-api-v3-sdk";
import cloudinary from "../config/cloudnary.js";
import streamifier from "streamifier";
import User from "../module/userModule.js"; // adjust path
import bcrypt from "bcryptjs";
import Brevo from "@getbrevo/brevo";
import jwt from "jsonwebtoken";

const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
const brevoEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();
export const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    // 🔹 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔹 Upload image to Cloudinary
    let imageUrl = "";
    if (req.file) {
      const uploadedImage = await cloudinary.v2.uploader.upload(req.file.path, {
        folder: "students",
      });
      imageUrl = uploadedImage.secure_url;
    }

    // 🔹 Create new user (auto role = student)
    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      image: imageUrl,
      role: "student",
      isVerified: false,
    });
    await newUser.save();

    // 🔹 Generate verification token
    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // 🔹 Prepare Brevo client
    const apiInstance = new Brevo.TransactionalEmailsApi();
    const apiKey = apiInstance.authentications["apiKey"];
    apiKey.apiKey = process.env.BREVO_API_KEY;

    // 🔹 Email content
    const verificationLink = `https://hgsccdigitalskills.vercel.app/verify-email?token=${token}`;
    const sendSmtpEmail = new Brevo.SendSmtpEmail();

    sendSmtpEmail.subject = "Verify Your HGSC² Digital Skills Account";
    sendSmtpEmail.to = [{ email, name: `${firstName} ${lastName}` }];
    sendSmtpEmail.sender = {
      name: "HGSC² Digital Skills",
      email: process.env.EMAIL_SENDER,
    };
    sendSmtpEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Welcome, ${firstName}!</h2>
        <p>Thank you for registering with <b>HGSC² Digital Skills</b>.</p>
        <p>Please verify your email address by clicking the button below:</p>
        <a href="${verificationLink}" 
           style="background-color:#007bff;color:#fff;padding:10px 20px;
           border-radius:5px;text-decoration:none;">Verify Email</a>
        <p>This link will expire in 1 hour.</p>
      </div>
    `;

    // 🔹 Send verification email
    await apiInstance.sendTransacEmail(sendSmtpEmail);

    res.status(201).json({
      message:
        "Registration successful! Please check your email to verify your account.",
      user: { firstName, lastName, email, image: imageUrl, role: "student" },
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    res.status(500).json({
      message: "Error during registration or sending verification email.",
      error: error.message || error,
    });
  }
};

/* ✅ Verify Email Controller */
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
      profilePhoto, // pass from frontend
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
      role: role?.toLowerCase() || "student",
      phoneNumber,
      country,
      acceptedTerms,
      profilePhoto,
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
