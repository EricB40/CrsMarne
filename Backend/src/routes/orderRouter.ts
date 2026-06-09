import { Router } from "express";
import { createStreamChannel, createVideoInvite, getOrder, listOrders } from "../controllers/orderController";

const router = Router();

router.get("/", listOrders);
router.get("/:id", getOrder);
// Then for support chat:
router.post("/:id/stream-channel", createStreamChannel);
router.post("/:id/video-invite", createVideoInvite);

export default router;