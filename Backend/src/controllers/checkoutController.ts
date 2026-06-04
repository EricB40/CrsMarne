import type { Request, Response, NextFunction } from "express";
import { getEnv } from "../lib/env";
import { z } from "zod";
import { getAuth } from "@clerk/express";
import { getLocalUser } from "../lib/users";
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db';
import { CheckoutSessionLine, checkoutSessions, products } from '../db/schema';
import { polarCreateCheckout } from "../lib/polar";


const env = getEnv();
// we create a schema for zod validation
const cartSchema = z.object({
    items: z.array(
        z.object({
            productId: z.uuid(),
            quantity: z.number().int().positive(),
        })
    ).min(1)
});
// we check some authentification and if the cart is valid
// we got the polar access token
// then we got the products and calculate the total price on the server side
// then we create a checkout session in the db
// then create some data like successUrl and returnUrl
// then call our method polarCreateCheckout to send the Request to Polar
// which permits to create the checkout page
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
        // when on the checkout page, we create a checkout session in 'pending' state

        // Unless paid, there will be no order in the db
        // Later we will use this session in the polare records
        const inserted = await db
        .insert(checkoutSessions)
        .values({
            userId: localUser.id,
            lines: lines,
            totalCents: totalCents,
            currency: "EUR"
        })
        .returning();
        const session = inserted[0];
        if (!session) {
            return res.status(500).json({ error: "Failed to create checkout session" });
        }
        // After we need 2 url: the one if the user hit the return on the checkout screen, will return to cart page
        const returnUrl = `${env.FRONTEND_URL}/cart`;
        // the one if the user complete the payment, will return to a success page
        const successUrl = `${env.FRONTEND_URL}/checkout/return?checkout_id=${CHECKOUT_ID}`;
        // Here you would typically create a checkout session with your payment provider (e.g., Stripe)
        // and return the session ID or URL to the client.

        const checkout = await polarCreateCheckout(env, {
            products: [env.POLAR_CHECKOUT_PRODUCT_ID], // we will have one product in polar which is a generic product, and we will pass the actual products in the metadata
            prices: {
                [env.POLAR_CHECKOUT_PRODUCT_ID]: [{
                        amount_type: "fixed",
                        price_amount: totalCents,
                        price_currency: "EUR"
                }]
            },
            successUrl: successUrl,
            return_url: returnUrl,
            external_customer_id: userId,
            metadata: { checkout_session_id: session.id }
        });
        await db.update(checkoutSessions).set({polarCheckoutId:checkout.id}).where(eq(checkoutSessions.id, session.id))

        res.json({ checkoutUrl: checkout.url });
    } catch (error) {
        next(error);
    }
}
