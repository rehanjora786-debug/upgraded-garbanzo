import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

export const customersRouter = Router();

customersRouter.use(authenticate);
customersRouter.use(authorize("OWNER", "MANAGER"));

const formatCurrency = (amountPaise) => `₹ ${(Number(amountPaise || 0) / 100).toFixed(2)}`;

const buildWhatsAppLink = (phone, message) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return `https://wa.me/91${digits}?text=${encodeURIComponent(message)}`;
};

customersRouter.get("/", async (req, res) => {
  try {
    const cafeId = req.user.cafeId;
    const cafe = await prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { name: true }
    });

    const customers = await prisma.customer.findMany({
      where: { cafeId },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          include: {
            payment: true
          }
        }
      },
      orderBy: {
        lastVisit: "desc"
      }
    });

    const now = new Date();
    const customerList = customers.map((customer) => {
      const paidOrders = (customer.orders || []).filter((order) => order.payment?.status === "PAID");
      const totalSpentPaise = paidOrders.reduce((total, order) => total + (order.totalPaise || 0), 0);
      const lastPaidOrder = paidOrders[0] || null;
      const birthday = customer.birthday ? new Date(customer.birthday) : null;
      const birthdayLabel = birthday
        ? birthday.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        : "No birthday saved";
      const birthdayToday = Boolean(
        birthday &&
        birthday.getMonth() === now.getMonth() &&
        birthday.getDate() === now.getDate()
      );

      const birthdayMessage = `Happy birthday ${customer.name}! We’re celebrating your special day at ${cafe?.name || "Trio Tales"}. Please enjoy a 30% birthday surprise on us today.`;
      const weeklyOfferMessage = `Hi ${customer.name}! This week at ${cafe?.name || "Trio Tales"}, we’re sending a little thank-you for your loyalty. Visit us for a special cafe treat and a surprise on your next order.`;
      const reviewMessage = `Hi ${customer.name}! We’d love your feedback for ${cafe?.name || "Trio Tales"}. A quick Google review helps us keep serving you better. Thank you for visiting us.`;

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        birthday: birthday ? birthday.toISOString().slice(0, 10) : null,
        birthdayLabel,
        birthdayToday,
        visits: customer.visits,
        lastVisit: customer.lastVisit,
        totalSpentPaise,
        totalSpentDisplay: formatCurrency(totalSpentPaise),
        lastPaidAmountPaise: lastPaidOrder?.totalPaise || 0,
        lastPaidDisplay: formatCurrency(lastPaidOrder?.totalPaise || 0),
        whatsappBirthdayLink: buildWhatsAppLink(customer.phone, birthdayMessage),
        whatsappWeeklyOfferLink: buildWhatsAppLink(customer.phone, weeklyOfferMessage),
        reviewLink: `https://www.google.com/search?q=${encodeURIComponent(`${cafe?.name || "Trio Tales"} cafe review`)}`,
        reviewMessage,
        birthdayMessage,
        weeklyOfferMessage
      };
    });

    res.json({
      success: true,
      customers: customerList,
      automation: {
        weeklyOfferMessage: `This week at ${cafe?.name || "Trio Tales"}, send a quick thank-you WhatsApp note to loyal guests and invite them to visit again for a fresh cafe offer.`,
        birthdayMessageTemplate: `Happy birthday! Enjoy a special surprise gift and a 30% birthday offer at ${cafe?.name || "Trio Tales"}.`,
        reviewMessageTemplate: `Please leave a quick Google review for ${cafe?.name || "Trio Tales"}. Your feedback helps the cafe grow and keeps our service improving.`
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load customer CRM data" });
  }
});

export default customersRouter;
