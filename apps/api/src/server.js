
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import customersRouter from "./routes/customers.js";
import tablesRouter from "./routes/tables.js";
import menuRouter from "./routes/menu.js";
import ordersRouter from "./routes/orders.js";

const app = express();
const port = Number(process.env.PORT || 4000);

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://localhost:3003",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3003",
  process.env.CLIENT_ORIGIN
].filter(Boolean));

app.use(helmet());

const apiDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
app.use("/uploads", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(apiDirectory, "uploads")));

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    const isLocalhostOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
    if (isLocalhostOrigin) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use("/api/menu/images", express.raw({
  type: ["image/jpeg", "image/png", "image/webp"],
  limit: "5mb"
}));
app.use(express.json({ limit: "100kb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "Trio Tales CafeDesk API",
    status: "running"
  });
});

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/customers", customersRouter);
app.use("/api/tables", tablesRouter);
app.use("/api/menu", menuRouter);
app.use("/api/orders", ordersRouter);

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path
  });
});

app.listen(port, () => {
  console.log(`CafeDesk API listening on http://localhost:${port}`);
});