import dotenv from "dotenv";
import User from "../module/userModule.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import cloudinary from "../config/cloudnary.js";
import streamifier from "streamifier";
import SibApiV3Sdk from "sib-api-v3-sdk";

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Configure Brevo client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const transactionalEmailsApi = new SibApiV3Sdk.TransactionalEmailsApi();

export const registerUser = async (req, res) => {
  try {
    const { fullName, email, password, phoneNumber, country, acceptedTerms } =
      req.body;

    // Automatically set role to "student"
    const role = "student";

    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({ message: "All required fields are needed" });
    }

    if (password.length < 5) {
      return res.status(400).json({ message: "Password too short" });
    }

    if (acceptedTerms !== true && acceptedTerms !== "true") {
      return res
        .status(400)
        .json({ message: "Please accept the terms & conditions" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Upload profile photo (if any)
    let profilePhoto = "";
    if (req.file) {
      const streamUpload = () => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "hgsc_users",
              transformation: [{ width: 500, height: 500, crop: "fill" }],
            },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });
      };
      const uploaded = await streamUpload();
      profilePhoto = uploaded.secure_url;
    }

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000);

    // Save user temporarily in DB or send as tempUser
    // (you can hash password later after verification if desired)
    const tempUser = {
      fullName,
      email,
      password,
      role,
      phoneNumber,
      country,
      acceptedTerms,
      profilePhoto,
      verificationCode,
    };

    // Send email via Brevo
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: "HGSC² Digital Skills",
      email: process.env.EMAIL_SENDER,
    };
    sendSmtpEmail.to = [{ email, name: fullName }];
    sendSmtpEmail.subject = "Verify Your HGSC² Digital Skills Account";
    sendSmtpEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height:1.6;">
        <h2>Welcome, ${fullName} 👋</h2>
        <p>Thank you for registering with <strong>HGSC² Digital Skills</strong>.</p>
        <p>Your verification code is:</p>
        <h1 style="background:#1976d2;color:#fff;display:inline-block;padding:10px 20px;border-radius:8px;">
          ${verificationCode}
        </h1>
        <p>This code expires in <b>10 minutes</b>.</p>
      </div>
    `;

    await transactionalEmailsApi.sendTransacEmail(sendSmtpEmail);

    res.status(200).json({
      message: "Verification code sent to your email.",
      tempUser,
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
