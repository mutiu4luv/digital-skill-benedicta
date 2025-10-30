import User from "../module/userModule.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import cloudinary from "../config/cloudnary.js";
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

    console.log("📩 Register route reached with:", req.body);

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

    // ✅ Upload image to Cloudinary (using buffer)
    let uploadedPhotoUrl = "";
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload_stream(
        { folder: "hgsc_users" },
        async (error, result) => {
          if (error) {
            console.error("❌ Cloudinary upload failed:", error);
            return res
              .status(500)
              .json({ message: "Cloudinary upload failed" });
          }

          uploadedPhotoUrl = result.secure_url;

          // Continue user creation once image uploaded
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(password, salt);
          const verificationCode = Math.floor(100000 + Math.random() * 900000);

          const newUser = await User.create({
            fullName,
            email,
            password: hashedPassword,
            role: role || "student",
            phoneNumber,
            country,
            profilePhoto: uploadedPhotoUrl,
            acceptedTerms,
            verificationCode,
            isVerified: false,
          });

          // Send email verification
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
            },
          });

          await transporter.sendMail({
            from: `"HGSC² Digital Skills" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Verify Your HGSC² Account",
            html: `
                <h2>Welcome, ${fullName}</h2>
                <p>Your verification code is:</p>
                <h1>${verificationCode}</h1>
                <p>This code expires in 10 minutes.</p>
              `,
          });

          console.log("✅ Registration successful");
          res.status(201).json({
            message: "Registration successful! Please verify your email.",
            userId: newUser._id,
          });
        }
      );

      // 🔹 Pipe buffer to Cloudinary
      uploadResult.end(req.file.buffer);
      return; // stop further execution until upload completes
    }

    // If no photo uploaded, continue normally
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const verificationCode = Math.floor(100000 + Math.random() * 900000);

    const newUser = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role: role || "student",
      phoneNumber,
      country,
      acceptedTerms,
      verificationCode,
      isVerified: false,
    });

    res.status(201).json({
      message: "Registration successful (no photo)",
      userId: newUser._id,
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    res
      .status(500)
      .json({ message: "Error registering user", error: error.message });
  }
};

// 📌 Verify Email
export const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code)
      return res.status(400).json({ message: "Email and code are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.verificationCode !== code)
      return res.status(400).json({ message: "Invalid verification code" });

    user.isVerified = true;
    user.verificationCode = null;
    await user.save();

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
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

// 📌 Get All Users (owner only)
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
