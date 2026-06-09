import { Router } from "express";
import { listOrders } from "../controllers/orderController";

const router = Router();

router.get("/", listOrders)

export default router;