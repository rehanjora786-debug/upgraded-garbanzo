import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

const ORDER_STATUS_ORDER = [
  "PLACED",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED"
];

const nextStatusMap = {
  PLACED: "ACCEPTED",
  ACCEPTED: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
};

const validateStatus = (status) => ORDER_STATUS_ORDER.includes(status);

router.post("/", async (req, res) => {
  try {
    const { table, items, customerName, customerPhone, customerDob, notes } = req.body;

    if (!table || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "Table token and at least one menu item are required"
      });
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

    const normalizedItems = [];
    let subtotalPaise = 0;

    for (const item of items) {
      const menuItemId = item.menuItemId || item.id;
      const quantity = Number(item.quantity || 1);

      if (!menuItemId || !Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ error: "Each item needs a valid menu item ID and quantity" });
      }

      const menuItem = await prisma.menuItem.findFirst({
        where: {
          id: String(menuItemId),
          cafeId: cafeTable.cafeId,
          available: true
        }
      });

      if (!menuItem) {
        return res.status(404).json({ error: `Menu item ${menuItemId} not found` });
      }

      const lineTotalPaise = menuItem.pricePaise * quantity;
      subtotalPaise += lineTotalPaise;

      normalizedItems.push({
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        unitPricePaise: menuItem.pricePaise,
        quantity,
        lineTotalPaise
      });
    }

    const customerNameValue = customerName ? String(customerName).trim() : "Walk-in guest";
    const customerPhoneValue = customerPhone ? String(customerPhone).replace(/\D/g, "").slice(-10) : "0000000000";
    const birthdayValue = customerDob ? new Date(String(customerDob)) : null;
    const validBirthday = birthdayValue && !Number.isNaN(birthdayValue.getTime()) ? birthdayValue : null;
    const isBirthdayOffer = validBirthday && birthdayValue.getMonth() === new Date().getMonth() && birthdayValue.getDate() === new Date().getDate();
    const discountPaise = isBirthdayOffer ? Math.round(subtotalPaise * 0.3) : 0;
    const discountedSubtotalPaise = Math.max(0, subtotalPaise - discountPaise);
    const taxPaise = Math.round(discountedSubtotalPaise * 0.05);
    const totalPaise = discountedSubtotalPaise + taxPaise;

    const customer = customerPhone || customerName
      ? await prisma.customer.upsert({
          where: {
            cafeId_phone: {
              cafeId: cafeTable.cafeId,
              phone: customerPhoneValue
            }
          },
          update: {
            name: customerNameValue,
            birthday: validBirthday || undefined,
            lastVisit: new Date(),
            visits: { increment: 1 }
          },
          create: {
            cafeId: cafeTable.cafeId,
            name: customerNameValue,
            phone: customerPhoneValue,
            birthday: validBirthday || null,
            lastVisit: new Date(),
            visits: 1
          }
        })
      : null;

    const order = await prisma.order.create({
      data: {
        cafeId: cafeTable.cafeId,
        tableId: cafeTable.id,
        customerId: customer?.id ?? null,
        status: "PLACED",
        subtotalPaise: discountedSubtotalPaise,
        taxPaise,
        totalPaise,
        notes: notes ? String(notes).trim() : (isBirthdayOffer ? "Birthday 30% discount applied" : null),
        items: {
          create: normalizedItems.map((item) => ({
            menuItemId: item.menuItemId,
            itemName: item.itemName,
            unitPricePaise: item.unitPricePaise,
            quantity: item.quantity,
            lineTotalPaise: item.lineTotalPaise
          }))
        }
      },
      include: {
        items: true,
        table: true
      }
    });

    res.status(201).json({
      success: true,
      order: {
        id: order.id,
        table: order.table?.label,
        status: order.status,
        subtotalPaise: order.subtotalPaise,
        taxPaise: order.taxPaise,
        totalPaise: order.totalPaise,
        discountPaise,
        birthdayOffer: isBirthdayOffer,
        items: order.items
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create order" });
  }
});

router.use(authenticate);
router.use(authorize("OWNER", "MANAGER", "KITCHEN", "CASHIER"));

router.get("/", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        cafeId: req.user.cafeId
      },
      include: {
        table: true,
        customer: true,
        items: true,
        payment: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.json({
      success: true,
      orders: orders.map((order) => ({
        id: order.id,
        status: order.status,
        table: order.table?.label || "Takeaway",
        customer: order.customer?.name || "Walk-in guest",
        subtotalPaise: order.subtotalPaise,
        totalPaise: order.totalPaise,
        createdAt: order.createdAt,
        payment: order.payment
          ? {
              status: order.payment.status,
              method: order.payment.method,
              amountPaise: order.payment.amountPaise
            }
          : null,
        items: order.items.map((item) => ({
          id: item.id,
          name: item.itemName,
          quantity: item.quantity,
          lineTotalPaise: item.lineTotalPaise
        }))
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load orders" });
  }
});

router.get("/kitchen", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        cafeId: req.user.cafeId,
        status: {
          in: ["PLACED", "ACCEPTED", "PREPARING", "READY"]
        }
      },
      include: {
        table: true,
        items: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    res.json({
      success: true,
      orders: orders.map((order) => ({
        id: order.id,
        status: order.status,
        table: order.table?.label || "Takeaway",
        createdAt: order.createdAt,
        items: order.items.map((item) => ({
          id: item.id,
          name: item.itemName,
          quantity: item.quantity,
          lineTotalPaise: item.lineTotalPaise
        }))
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load kitchen queue" });
  }
});

router.post("/:id/payment", async (req, res) => {
  try {
    const { id } = req.params;
    const { method = "CASH", status = "PAID", amountPaise, providerReference } = req.body;

    const order = await prisma.order.findFirst({
      where: {
        id,
        cafeId: req.user.cafeId
      }
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const validMethods = ["CASH", "UPI", "CARD", "ONLINE"];
    if (!validMethods.includes(method)) {
      return res.status(400).json({ error: "Unsupported payment method" });
    }

    const validStatuses = ["PENDING", "PAID", "FAILED", "REFUNDED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Unsupported payment status" });
    }

    const paymentAmount = typeof amountPaise === "number" ? Math.round(amountPaise) : order.totalPaise;

    const payment = await prisma.payment.upsert({
      where: { orderId: id },
      update: {
        method,
        status,
        amountPaise: paymentAmount,
        providerReference: providerReference ? String(providerReference).trim() : null,
        verifiedAt: status === "PAID" ? new Date() : null
      },
      create: {
        orderId: id,
        method,
        status,
        amountPaise: paymentAmount,
        providerReference: providerReference ? String(providerReference).trim() : null,
        verifiedAt: status === "PAID" ? new Date() : null
      }
    });

    res.json({
      success: true,
      payment: {
        orderId: payment.orderId,
        method: payment.method,
        status: payment.status,
        amountPaise: payment.amountPaise
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not record payment" });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, advance } = req.body;

    const order = await prisma.order.findFirst({
      where: {
        id,
        cafeId: req.user.cafeId
      }
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const nextStatus = advance ? nextStatusMap[order.status] : status;

    if (!nextStatus || !validateStatus(nextStatus)) {
      return res.status(400).json({ error: "Unsupported order status" });
    }

    if (nextStatus === order.status) {
      return res.json({ success: true, order: { id: order.id, status: order.status } });
    }

    const orderStatusOrder = ORDER_STATUS_ORDER.indexOf(order.status);
    const targetOrderIndex = ORDER_STATUS_ORDER.indexOf(nextStatus);

    if (targetOrderIndex < orderStatusOrder) {
      return res.status(409).json({ error: "Order status cannot move backwards" });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: nextStatus }
    });

    res.json({
      success: true,
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not update order status" });
  }
});

export default router;
