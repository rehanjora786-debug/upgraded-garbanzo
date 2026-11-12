
import { Router } from "express";
import QRCode from "qrcode";
import { PrismaClient } from "@prisma/client";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(authorize("OWNER", "MANAGER"));

router.get("/qr", async (req, res) => {
  try {
    const tables = await prisma.cafeTable.findMany({
      where: { cafeId: req.user.cafeId, active: true },
      orderBy: { label: "asc" }
    });

    const baseUrl = (req.get("origin") || process.env.CLIENT_ORIGIN || "http://localhost:3003").replace(/\/$/, "");
    const results = await Promise.all(
      tables.map(async (table) => {
        const menuUrl = `${baseUrl}/menu?table=${encodeURIComponent(table.qrToken)}`;
        const qrImage = await QRCode.toDataURL(menuUrl, { width: 400, margin: 2 });

        return {
          table: table.label,
          qrToken: table.qrToken,
          menuUrl,
          qrImage
        };
      })
    );

    res.json({ success: true, tables: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not generate QR codes" });
  }
});

router.get("/", async (req, res) => {
  try {
    const tables = await prisma.cafeTable.findMany({
      where: { cafeId: req.user.cafeId },
      orderBy: { label: "asc" }
    });

    res.json({ success: true, tables });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load tables" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { label } = req.body;

    if (!label || !String(label).trim()) {
      return res.status(400).json({ error: "Table label is required" });
    }

    const table = await prisma.cafeTable.create({
      data: {
        cafeId: req.user.cafeId,
        label: String(label).trim(),
        qrToken: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
        active: true
      }
    });

    res.status(201).json({ success: true, table });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create table" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { label, active } = req.body;

    const table = await prisma.cafeTable.findFirst({
      where: { id, cafeId: req.user.cafeId }
    });

    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }

    const updated = await prisma.cafeTable.update({
      where: { id },
      data: {
        label: label ? String(label).trim() : table.label,
        active: typeof active === "boolean" ? active : table.active
      }
    });

    res.json({ success: true, table: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not update table" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const table = await prisma.cafeTable.findFirst({
      where: { id, cafeId: req.user.cafeId }
    });

    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }

    await prisma.cafeTable.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not delete table" });
  }
});

export default router;