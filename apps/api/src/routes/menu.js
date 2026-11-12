
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

router.get("/", async (req, res) => {
  try {
    const { table } = req.query;

    if (!table) {
      return res.status(400).json({ error: "Table QR token is required" });
    }

    const cafeTable = await prisma.cafeTable.findFirst({
      where: {
        qrToken: String(table),
        active: true
      },
      include: {
        cafe: true
      }
    });

    if (!cafeTable) {
      return res.status(404).json({ error: "Invalid table QR code" });
    }

    const categories = await prisma.menuCategory.findMany({
      where: { cafeId: cafeTable.cafeId },
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          where: { available: true },
          orderBy: { name: "asc" }
        }
      }
    });

    const visibleCategories = categories.filter((category) => (category.items || []).length > 0);

    res.json({
      success: true,
      cafe: cafeTable.cafe.name,
      table: cafeTable.label,
      categories: visibleCategories
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load menu" });
  }
});

router.use(authenticate);
router.use(authorize("OWNER", "MANAGER"));

const imageDirectory = fileURLToPath(new URL("../../uploads/menu/", import.meta.url));
const imageTypes = {
  "image/jpeg": {
    extension: "jpg",
    isValid: (image) => image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
  },
  "image/png": {
    extension: "png",
    isValid: (image) => image.length >= 8 && image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  },
  "image/webp": {
    extension: "webp",
    isValid: (image) => image.length >= 12 && image.toString("ascii", 0, 4) === "RIFF" && image.toString("ascii", 8, 12) === "WEBP"
  }
};

router.post("/images", async (req, res) => {
  const image = req.body;
  const contentType = req.get("content-type")?.split(";")[0].trim().toLowerCase();
  const imageType = imageTypes[contentType];

  if (!Buffer.isBuffer(image) || image.length === 0) {
    return res.status(400).json({ error: "Choose an image to upload" });
  }

  if (!imageType || !imageType.isValid(image)) {
    return res.status(415).json({ error: "Upload a valid JPG, PNG, or WebP image" });
  }

  try {
    await mkdir(imageDirectory, { recursive: true });
    const filename = `${randomUUID()}.${imageType.extension}`;
    await writeFile(path.join(imageDirectory, filename), image, { flag: "wx" });

    res.status(201).json({
      success: true,
      imageUrl: `/uploads/menu/${filename}`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not save menu image" });
  }
});

router.get("/admin", async (req, res) => {
  try {
    const cafeId = req.user.cafeId;

    const categories = await prisma.menuCategory.findMany({
      where: { cafeId },
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          orderBy: { name: "asc" }
        }
      }
    });

    res.json({ success: true, categories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load menu catalog" });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const { name, sortOrder = 0 } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const category = await prisma.menuCategory.create({
      data: {
        cafeId: req.user.cafeId,
        name: String(name).trim(),
        sortOrder: Number(sortOrder) || 0
      }
    });

    res.status(201).json({ success: true, category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create menu category" });
  }
});

router.post("/items", async (req, res) => {
  try {
    const {
      name,
      description,
      pricePaise,
      categoryId,
      available = true,
      imageUrl
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Item name is required" });
    }

    if (!categoryId) {
      return res.status(400).json({ error: "Category is required" });
    }

    const parsedPrice = Number(pricePaise);

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: "Valid price in paise is required" });
    }

    const item = await prisma.menuItem.create({
      data: {
        cafeId: req.user.cafeId,
        categoryId,
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
        pricePaise: Math.round(parsedPrice),
        available: Boolean(available),
        imageUrl: imageUrl ? String(imageUrl).trim() : null
      }
    });

    res.status(201).json({ success: true, item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create menu item" });
  }
});

router.patch("/items/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, pricePaise, categoryId, available, imageUrl } = req.body;

    const existing = await prisma.menuItem.findFirst({
      where: { id, cafeId: req.user.cafeId }
    });

    if (!existing) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        name: name ? String(name).trim() : existing.name,
        description: description === null ? null : (description ? String(description).trim() : existing.description),
        pricePaise: typeof pricePaise !== "undefined" ? Math.round(Number(pricePaise)) : existing.pricePaise,
        categoryId: categoryId || existing.categoryId,
        available: typeof available === "boolean" ? available : existing.available,
        imageUrl: imageUrl === null ? null : (imageUrl ? String(imageUrl).trim() : existing.imageUrl)
      }
    });

    res.json({ success: true, item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not update menu item" });
  }
});

router.delete("/items/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.menuItem.findFirst({
      where: { id, cafeId: req.user.cafeId }
    });

    if (!existing) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    await prisma.menuItem.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not delete menu item" });
  }
});

export default router;