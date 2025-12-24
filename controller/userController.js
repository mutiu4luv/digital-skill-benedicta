import dotenv from "dotenv";
dotenv.config();
import cloudinary from "../config/cloudnary.js";

import SibApiV3Sdk from "sib-api-v3-sdk";
import streamifier from "streamifier";
import User from "../module/userModule.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utilitis/sendEmail.js";

// ✅ Initialize Brevo client safely
const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
const brevoEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();
console.log(process.env.BREVO_API_KEY);

// ✅ Cloudinary configuration
// cloudinary.v2.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// Temporary in-memory store for unverified users
const pendingUsers = new Map();

/**
 * REGISTER USER (Stage 1)
 * Generate OTP and send verification email using Brevo.
 */
export const registerUser = async (req, res) => {
  try {
    const { fullName, email, password, phoneNumber, country, acceptedTerms } =
      req.body;

    // Basic validations
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

    // ✅ Upload profile photo if provided
    let profilePhoto = "";
    if (req.file && req.file.buffer) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "hgsc_users",
            transformation: [{ width: 500, height: 500, crop: "fill" }],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

      profilePhoto = uploadResult.secure_url;
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Generate 6-digit OTP
    const verificationCode = Math.floor(100000 + Math.random() * 900000);

    // ✅ Save temporarily in memory
    pendingUsers.set(email, {
      fullName,
      email,
      hashedPassword,
      phoneNumber,
      country,
      acceptedTerms,
      profilePhoto,
      verificationCode,
      createdAt: Date.now(),
    });

    // ✅ Setup Brevo client here
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    defaultClient.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
    const brevoEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

    // ✅ Construct email content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height:1.6;">
        <h2 style="color: green;">Welcome, ${fullName} 👋</h2>
        <p>Thank you for registering with <strong>HGSC² Digital Skills</strong>.</p>
        <p>Your verification code is:</p>
        <h1 style="background:green;color:#fff;display:inline-block;padding:10px 20px;border-radius:8px;">
          ${verificationCode}
        </h1>
        <p>This code expires in <b>10 minutes</b>.</p>
      </div>
    `;

    const emailData = {
      sender: { email: process.env.EMAIL_SENDER, name: "HGSC² Digital Skills" },
      to: [{ email, name: fullName }],
      subject: "Verify Your HGSC² Digital Skills Account",
      htmlContent,
    };

    // ✅ Send email with Brevo
    await brevoEmailApi.sendTransacEmail(emailData);

    console.log(`✅ Verification email sent to ${email}`);

    // ✅ Send success response
    res.status(200).json({
      message:
        "Verification code sent to your email. Please check your inbox or spam folder.",
    });
  } catch (error) {
    console.error("❌ Registration error:", error.response?.body || error);
    res.status(500).json({
      message: "Error during registration or sending verification email.",
      error: error.response?.body?.message || error.message,
    });
  }
};

/**
 * VERIFY OTP (Stage 2)
 * Confirms user OTP and saves to database.
 */
export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return res.status(400).json({ message: "Email and OTP required" });

    // 🔍 Check if this user exists in pending memory
    const pending = pendingUsers.get(email);
    if (!pending)
      return res.status(400).json({ message: "No pending verification found" });

    // 🔢 Compare OTP
    if (pending.verificationCode !== Number(otp))
      return res.status(400).json({ message: "Invalid OTP" });

    // ⏰ Check expiration (10 minutes)
    if (Date.now() - pending.createdAt > 10 * 60 * 1000)
      return res
        .status(400)
        .json({ message: "OTP expired, please register again" });

    // 🔎 Check if user already exists in the DB
    let user = await User.findOne({ email });

    if (user) {
      // ✅ If already exists, just update verification fields
      user.isVerified = true;
      user.verificationCode = null;
      await user.save();
    } else {
      // ✅ If not found (first registration), create the user and mark verified
      user = await User.create({
        fullName: pending.fullName,
        email: pending.email,
        password: pending.hashedPassword,
        phoneNumber: pending.phoneNumber,
        country: pending.country,
        acceptedTerms: pending.acceptedTerms,
        profilePhoto: pending.profilePhoto,
        isVerified: true,
        verificationCode: null,
      });
    }

    // 🧹 Remove from pending memory
    pendingUsers.delete(email);

    // ✅ Response
    res.status(200).json({
      message: "✅ Email verified successfully! You can now log in.",
      user,
    });
  } catch (error) {
    console.error("❌ OTP verification error:", error);
    res.status(500).json({
      message: "OTP verification failed",
      error: error.message,
    });
  }
};

/* ---------------------------------------------
   📌 LOGIN
---------------------------------------------- */
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(401).json({ message: "Invalid password" });

    if (!user.isVerified)
      return res.status(403).json({
        message: "Please verify your email before logging in.",
      });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        role: user.role,
        email: user.email,
        photo: user.profilePhoto,
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

/* ---------------------------------------------
   📌 GET ALL USERS
---------------------------------------------- */
// 📁 controllers/userController.js
// controllers/userController.js
// controllers/userController.js
export const getAllUsers = async (req, res) => {
  try {
    // ✅ Sort by creation date (newest first)
    const users = await User.find().select("-password").sort({ createdAt: -1 });

    res.status(200).json(users);
  } catch (error) {
    console.error("❌ Fetch users error:", error);
    res.status(500).json({
      message: "Error fetching users",
      error: error.message,
    });
  }
};

// 🗑 Delete user (Owner only)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await User.findByIdAndDelete(id);
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("❌ Delete user error:", error);
    res
      .status(500)
      .json({ message: "Failed to delete user", error: error.message });
  }
};

// ✏️ Edit user (Owner only)
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, role, phoneNumber } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.fullName = fullName || user.fullName;
    user.email = email || user.email;
    user.role = role || user.role;
    user.phoneNumber = phoneNumber || user.phoneNumber;

    await user.save();
    res.status(200).json({ message: "User updated successfully", user });
  } catch (error) {
    console.error("❌ Update user error:", error);
    res
      .status(500)
      .json({ message: "Failed to update user", error: error.message });
  }
};

export const getAllCoaches = async (req, res) => {
  try {
    // 🚀 PRODUCTION QUERY: Fetch only users where the role is exactly "coach"
    const coaches = await User.find({ role: "coach" }).select(
      "fullName email phoneNumber country profilePhoto"
    );

    res.status(200).json({
      success: true,
      total: coaches.length,
      coaches, // The array now contains only the filtered coach objects
    });
  } catch (error) {
    console.error("❌ Error fetching coaches:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching coaches",
      error: error.message,
    });
  }
};

// update profile by student, coach and owner
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, phoneNumber, country, oldPassword, newPassword } =
      req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    /* -----------------------------------
       ✅ Update basic profile fields
    ----------------------------------- */
    if (fullName) user.fullName = fullName;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (country) user.country = country;

    /* -----------------------------------
       🔐 PASSWORD UPDATE LOGIC
    ----------------------------------- */
    if (newPassword) {
      // Old password is required
      if (!oldPassword) {
        return res.status(400).json({
          message: "Old password is required to update password",
        });
      }

      // Compare old password
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({
          message: "Old password is incorrect",
        });
      }

      // Validate new password
      if (newPassword.length < 5) {
        return res.status(400).json({
          message: "New password must be at least 5 characters long",
        });
      }

      // Hash and update password
      user.password = await bcrypt.hash(newPassword, 10);
    }

    /* -----------------------------------
       🖼 Profile photo update (Cloudinary)
    ----------------------------------- */
    if (req.file && req.file.buffer) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "hgsc_users",
            transformation: [{ width: 500, height: 500, crop: "fill" }],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

      user.profilePhoto = uploadResult.secure_url;
    }

    await user.save();

    /* -----------------------------------
       ✅ RESPONSE
    ----------------------------------- */
    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        country: user.country,
        photo: user.profilePhoto,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("❌ Update profile error:", error);
    res.status(500).json({
      message: "Failed to update profile",
      error: error.message,
    });
  }
};

//get my profile
export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      country: user.country,
      photo: user.profilePhoto,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

// forgot password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Email Does not Exist" });

    // 🔢 Generate 6-digit OTP
    const resetCode = Math.floor(100000 + Math.random() * 900000);

    // ⏰ Expires in 10 minutes
    user.resetPasswordCode = resetCode;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;

    await user.save();

    // ✉️ Email content
    const htmlContent = `
      <div style="font-family: Arial; line-height:1.6;">
        <h2>Password Reset Request 🔐</h2>
        <p>Hello ${user.fullName},</p>
        <p>Your password reset code is:</p>
        <h1 style="background:#0a7;color:#fff;padding:10px;border-radius:8px;">
          ${resetCode}
        </h1>
        <p>This code expires in <b>10 minutes</b>.</p>
      </div>
    `;

    const emailData = {
      sender: {
        email: process.env.EMAIL_SENDER,
        name: "HGSC² Digital Skills",
      },
      to: [{ email: user.email, name: user.fullName }],
      subject: "Reset Your Password",
      htmlContent,
    };

    await brevoEmailApi.sendTransacEmail(emailData);

    res.status(200).json({
      message: "Password reset code sent to your email",
    });
  } catch (error) {
    console.error("❌ Forgot password error:", error);
    res.status(500).json({
      message: "Failed to send reset code",
      error: error.message,
    });
  }
};
// reset password

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: "All fields are required" });

    if (newPassword.length < 5)
      return res
        .status(400)
        .json({ message: "Password must be at least 5 characters" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // ❌ OTP mismatch
    if (user.resetPasswordCode !== Number(otp))
      return res.status(400).json({ message: "Invalid reset code" });

    // ❌ OTP expired
    if (Date.now() > user.resetPasswordExpires)
      return res.status(400).json({ message: "Reset code expired" });

    // 🔐 Hash new password
    user.password = await bcrypt.hash(newPassword, 10);

    // 🧹 Clear reset fields
    user.resetPasswordCode = null;
    user.resetPasswordExpires = null;

    await user.save();

    res.status(200).json({
      message: "✅ Password reset successful. You can now log in.",
    });
  } catch (error) {
    console.error("❌ Reset password error:", error);
    res.status(500).json({
      message: "Password reset failed",
      error: error.message,
    });
  }
};
