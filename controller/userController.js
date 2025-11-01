import dotenv from "dotenv";
import User from "../module/userModule.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import cloudinary from "../config/cloudnary.js";

dotenv.config();

/* ✅ Setup Nodemailer (Gmail) */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ✅ Register Controller */
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

    if (acceptedTerms !== true && acceptedTerms !== "true")
      return res
        .status(400)
        .json({ message: "Please accept the terms & conditions" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already registered" });

    /* ✅ Upload image if provided */
    let profilePhoto = "";
    if (req.file) {
      const uploaded = await cloudinary.v2.uploader.upload(req.file.path, {
        folder: "hgsc_users",
        transformation: [{ width: 500, height: 500, crop: "fill" }],
      });
      profilePhoto = uploaded.secure_url;
    }

    /* ✅ Generate OTP */
    const verificationCode = Math.floor(100000 + Math.random() * 900000);

    /* ✅ Send email with Gmail */
    const mailOptions = {
      from: `"HGSC² Digital Skills" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your HGSC² Digital Skills Account",
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.6;">
          <h2>Welcome, ${fullName} 👋</h2>
          <p>Thank you for registering with <strong>HGSC² Digital Skills</strong>.</p>
          <p>Your verification code is:</p>
          <h1 style="background:#1976d2;color:#fff;display:inline-block;padding:10px 20px;border-radius:8px;">
            ${verificationCode}
          </h1>
          <p>This code expires in <b>10 minutes</b>.</p>
          <p>If you didn’t request this, please ignore this email.</p>
          <br/>
          <p>— The HGSC² Digital Skills Team</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

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
        profilePhoto,
        verificationCode,
      },
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    res.status(500).json({
      message: "Error during registration or sending verification email.",
      error: error.message,
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
