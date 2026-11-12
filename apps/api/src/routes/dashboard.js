import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);
dashboardRouter.use(authorize("OWNER", "MANAGER"));

dashboardRouter.get("/overview", async (req, res) => {
  try {
    const cafeId = req.user.cafeId;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [ordersToday, activeRewards, customerOrderCounts] = await Promise.all([
      prisma.order.findMany({
        where: {
          cafeId,
          createdAt: {
            gte: todayStart
          }
        },
        select: {
          id: true,
          totalPaise: true,
          customerId: true
        }
      }),
      prisma.reward.count({
        where: {
          cafeId,
          redeemedAt: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date() } }
          ]
        }
      }),
      prisma.order.groupBy({
        by: ["customerId"],
        where: {
          cafeId,
          customerId: { not: null }
        },
        _count: {
          customerId: true
        }
      })
    ]);

    const todayOrderCount = ordersToday.length;
    const todayRevenuePaise = ordersToday.reduce((total, order) => total + (order.totalPaise || 0), 0);
    const repeatCustomers = customerOrderCounts.filter((entry) => entry._count.customerId > 1).length;

    res.json({
      success: true,
      overview: {
        todayOrders: todayOrderCount,
        todayRevenuePaise,
        repeatCustomers,
        activeRewards
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load dashboard overview" });
  }
});
