import { Router } from "express";
import { getLocalUser } from "../lib/users";
import { getAuth } from "@clerk/express";

const router = Router();

router.get("/", async (req, res, next) => {
    try {
        /* we can reach the authenticated user from req.auth, which is added by 
        clerkMiddleware */
        const { userId, isAuthenticated } = getAuth(req);
        if (!isAuthenticated || !userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const user = await getLocalUser(userId);
        res.json({user});
    } catch (error) {
        next(error);
    }
});

export default router;