import { Router } from "express";
import { createStreamToken } from "../controllers/streamController";

const router = Router();
// will be prefixed with /api/stream, so the full route will be /api/stream/token
router.post("/token", createStreamToken);


export default router;