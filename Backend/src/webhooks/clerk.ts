
import type { Request, Response } from "express";
import { getEnv } from "../lib/env";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { parseRole } from "../lib/roles";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

/* This is a endpoint Clerk is going to call when a user is created, updated, or deleted, and here
we test if it's actually coming from Clerk, and thanks to the webhook secret, we can verify its authenticity.
If the event is user deleted, we will remove the user from our database and a response 'ok' will be sent....
cannot be tested untill deployed */
export async function clerkWebhookHandler(req: Request, res: Response) {
    const env = getEnv();

    try{
        /* For security, we will verify the webhook signature using the CLERK_WEBHOOK_SECRET environment variable.*/
        if (!env.CLERK_WEBHOOK_SECRET) {
            res.status(503).send("CLERK_WEBHOOK_SECRET is not set, cannot verify webhook signature");
            console.warn("CLERK_WEBHOOK_SECRET is not set, skipping webhook signature verification");
            return;
        } else {
            /* Clerk's verifier expects a web req with the raw body; Expres may give Buffer or string */
            const payload = req.body instanceof Buffer ? req.body.toString("utf-8") : String(req.body);
            const request = new Request("http://internal/webhooks/clerk", {
                method: "POST",
                headers: new Headers(req.headers as Record<string, string>),
                body: payload,
            });
            // throws if the signature is invalid, otherwise returns the parsed event object
            const evt = await verifyWebhook(request, {signingSecret: env.CLERK_WEBHOOK_SECRET});
            if (evt.type === "user.created" || evt.type === "user.updated") {
                const u = evt.data;
                const email = u.email_addresses?.find((e) => e.id === u.primary_email_address_id)?.email_address ??
                u.email_addresses?.[0]?.email_address;
                const displayName = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "Unknown User";
                console.log(`Received Clerk webhook for user ${displayName} with email ${email}`);
                const role = parseRole(u.public_metadata?.role);
                console.log(`User role: ${role}`);
                await db.insert(users).values({
                    clerkUserId: u.id,
                    email, 
                    role
                }).$dynamic().onConflictDoUpdate({
                    target: users.clerkUserId,
                    set: {
                        email,
                        displayName,
                        role,
                        updatedAt: new Date(),
                    }
                });
            }
            if (evt.type === "user.deleted") {
            const id = evt.data.id;
            if(id){
                await db.delete(users).where(eq(users.clerkUserId, id));
            }
            }   
        }
        res.json({ ok: true });

    } catch (error) {
        console.error("Error handling Clerk webhook:", error);
        res.status(400).json({ error: "Internal Server Error" });
    }
}