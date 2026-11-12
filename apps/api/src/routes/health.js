import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "trio-tales-cafedesk-api",
    timestamp: new Date().toISOString()
  });
});
