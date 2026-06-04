import { Router } from "express";
import { createCheckout } from "../controllers/checkoutController";

const router = Router();
// will be prefixed by /api/checkout as set in index.ts
router.post("/", createCheckout);

export default router;