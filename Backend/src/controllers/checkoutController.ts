import type { Request, Response, NextFunction } from "express";
import { getEnv } from "../lib/env";
import { z } from "zod";
import { getAuth } from "@clerk/express";
import { getLocalUser } from "../lib/users";
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db';
import { CheckoutSessionLine, products } from '../db/schema';


const env = getEnv();

const cartSchema = z.object({
    items: z.array(
        z.object({
            productId: z.uuid(),
            quantity: z.number().int().positive(),
        })
    ).min(1)
});

export async function createCheckout(req: Request, res: Response, next: NextFunction){
    try {
        const { userId, isAuthenticated } = getAuth(req);
        if (!isAuthenticated || !userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const parsedData = cartSchema.safeParse(req.body);
        if (!parsedData.success) {
            return res.status(400).json({ error: "Invalid cart data", details: parsedData.error.issues });
        }
        // Here you would typically create a checkout session with your payment provider (e.g., Stripe)
        // and return the session ID or URL to the client.
        // polar access token required error 503 because it's on the server side
        if (!env.POLAR_ACCESS_TOKEN) {
            return res.status(503).json({ error: "Payment provider not configured" });
        }
        // check if user is in the db
        const localUser = await getLocalUser(userId);
        if (!localUser) {
            return res.status(503).json({ error: "User not found" });
        }
        // get the product ids
        const ids = parsedData.data.items.map(item => item.productId);
        // check in the db products exist with these ids, if not return error
        const prodRows = await db
        .select()
        .from(products)
        .where(and(inArray(products.id, ids), eq(products.active, true)));

        if (prodRows.length !== ids.length) {
            return res.status(400).json({ error: "One or more products not found" });
        }
        // calculate the actual secured price
        const byId = new Map(prodRows.map((p) => [p.id, p]));
        let totalCents = 0;
        const lines: CheckoutSessionLine[] = [];
        for (const line of parsedData.data.items) {
            const p = byId.get(line.productId)!;
            totalCents += p.priceCents * line.quantity;
            lines.push({
                productId: p.id,
                quantity: line.quantity,
                unitPriceCents: p.priceCents
            });
        }
        if (totalCents < 10) {
            return res.status(400).json({ error: "Total below Polar minimum" });
        }

        res.json({ message: "Checkout session created successfully" });
    } catch (error) {
        next(error);
    }
}
