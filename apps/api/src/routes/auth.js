
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export const authRouter = Router();

// One-time initial owner registration
authRouter.post("/setup-owner", async (req, res) => {
  try {
    let { name, email, password, setupKey } = req.body;

    if (setupKey !== process.env.SETUP_KEY) {
      return res.status(403).json({
        error: "Invalid setup key"
      });
    }

    const ownerName = (name || "Md Samee I Jora").trim();

    if (!email || !password || password.length < 8) {
      return res.status(400).json({
        error: "Valid email and password (minimum 8 characters) required"
      });
    }

    const existing = await prisma.user.findFirst();

    if (existing) {
      return res.status(403).json({
        error: "Owner setup is already completed"
      });
    }

    let cafe = await prisma.cafe.findFirst();

    if (!cafe) {
      cafe = await prisma.cafe.create({
        data: {
          name: "Trio Tales",
          slug: "trio-tales",
          phone: "9380160062",
          currency: "INR"
        }
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        cafeId: cafe.id,
        name: ownerName,
        email: email.toLowerCase().trim(),
        passwordHash,
        role: "OWNER"
      }
    });

    res.status(201).json({
      message: "Owner account created",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Owner registration failed"
    });
  }
});

authRouter.post("/create-user", async (req, res) => {
  try {
    const { name, email, password, role = "KITCHEN", setupKey } = req.body;

    if (setupKey !== process.env.SETUP_KEY) {
      return res.status(403).json({ error: "Invalid setup key" });
    }

    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: "Valid email and password (minimum 8 characters) required" });
    }

    const normalizedRole = ["OWNER", "MANAGER", "KITCHEN", "CASHIER"].includes(role) ? role : "KITCHEN";
    const storedCafe = await prisma.cafe.findFirst();

    if (!storedCafe) {
      return res.status(404).json({ error: "Create the cafe first via setup-owner" });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: String(email).toLowerCase().trim()
      }
    });

    if (existingUser) {
      return res.status(409).json({ error: "A user already exists with that email" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        cafeId: storedCafe.id,
        name: (name || "Kitchen Staff").trim() || "Kitchen Staff",
        email: String(email).toLowerCase().trim(),
        passwordHash,
        role: normalizedRole
      }
    });

    res.status(201).json({
      message: "Staff account created",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Staff creation failed" });
  }
});

// Login
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password required"
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email: email.toLowerCase().trim()
      }
    });

    if (!user || !user.active) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    const valid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!valid) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        cafeId: user.cafeId,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        cafeId: user.cafeId
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Login failed"
    });
  }
});