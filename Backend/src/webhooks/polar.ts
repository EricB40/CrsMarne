import type { Request, Response } from "express";
import { checkoutSessions, orderItems, orders } from "../db/schema";    
import { getEnv } from "../lib/env"
import { eq } from "drizzle-orm";
import { db } from "../db/index"
import { Webhook } from "standardwebhooks"
// this last Webhook allow us to verify the event sent by Polar


function headerString(headers: Request["headers"], name: string){
    const value = headers[name];
    return Array.isArray(value) ? value[0] : value;
}
async function alreadyPaid(polarOrderId?: string, checkoutId?: string){
    if(polarOrderId){
        const [row] = await db
        .select()
        .from(orders)
        .where(eq(orders.polarOrderId, polarOrderId))
        .limit(1);
        if (row?.status === "paid") return true;
    }
    if(checkoutId){
        const [row] = await db
        .select()
        .from(orders)
        .where(eq(orders.polarCheckoutId, checkoutId))
        .limit(1);
        if(row?.status === "paid") return true;
    }
    return false
}
function checkoutSessionIdFromMetadata(order: Record<string, unknown>){
    const metadata = order.metadata;
    if(!metadata || typeof metadata !== "object") return undefined;
    const sessionId = (metadata as Record<string, unknown>).checkout_session_id;
    return typeof sessionId === "string" ? sessionId : undefined;

}
async function fulfillCheckoutSession(
    sessionId: string,
    polarOrderId: string | undefined,
    checkoutId: string | undefined
){
    // creation of a database 'transaction' which means that if there are multiple queries
    // at once, to prevent inconsistencies (one query works but the other not)
    // we want all works or neither of them
    return await db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(checkoutSessions)
      .where(eq(checkoutSessions.id, sessionId))
      .for("update");

    if (!session) return false;

    const [order] = await tx
      .insert(orders)
      .values({
        userId: session.userId,
        status: "paid",
        totalCents: session.totalCents,
        polarCheckoutId: checkoutId ?? session.polarCheckoutId ?? null,
        ...(polarOrderId ? { polarOrderId } : {}),
      })
      .returning();

    if (!order) return false;

    if (session.lines.length) {
      await tx.insert(orderItems).values(
        session.lines.map((line) => ({
          orderId: order.id,
          productId: line.productId,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
        })),
      );
    }

    await tx.delete(checkoutSessions).where(eq(checkoutSessions.id, sessionId));

    return true;
  });
}

export async function polarWebhookHandler(req: Request, res:Response){
    const env = getEnv();

    try{
        // check if we have the Polar Webhook Secret. 503 means error on server side
        if(!env.POLAR_WEBHOOK_SECRET){
            res.status(503).send("Polar Webhooks not configured");
            return;
        }
        //In short: if req.body is already raw bytes, keep it, otherwise convert to bytes
        const raw = req.body instanceof Buffer ? req.body : Buffer.from(String(req.body));
        // convert UTF-8 secret to rax, turn it to Base64 that is needed for Webhook constructor
        const wh = new Webhook(Buffer.from(env.POLAR_WEBHOOK_SECRET, "utf-8").toString("base64"));
        // within the Webhook object we have a timestamp, id and signature which are useful
        // to check if it's valid
        // the function headerString defined above gives the value asked by its key ex: webhook-id
        const id = headerString(req.headers, "webhook-id");
        const ts = headerString(req.headers, "webhook-timestamp");
        const sig = headerString(req.headers, "webhook-signature");

        if (!id || !ts || !sig){
            res.status(400).json({error: "Missing webhook headers"});
            return;
        }
        // next we use the verify() method of webhook
        wh.verify(raw, {"webhook-id": id, "webhook-timestamp": ts, "webhook-signature": sig});
        // If all checks are ok we can send the event
        const event = JSON.parse(raw.toString("utf-8")) as {
            type: string;
            data?: Record<string, unknown>;
        };
        if(event.type === "order.paid" && event.data){
            const data = event.data;
            const polarOrderId = typeof data.id === "string" ? data.id : undefined;
            const checkoutId = typeof data.checkout_id === "string" ? data.checkout_id : undefined;

            if(await alreadyPaid(polarOrderId, checkoutId)){
                res.json({ok: true, duplicate: true})
                return;
            }
            const sessionId = checkoutSessionIdFromMetadata(data);
            if(sessionId){
                const ok = await fulfillCheckoutSession(sessionId, polarOrderId, checkoutId);
                if(ok){
                    res.json({ok: true});
                    return;
                }
                if(await alreadyPaid(polarOrderId, checkoutId)){
                    res.json({ok: true, duplicate: true});
                    return;
                }
                console.error("Polar order.paid: could not fulfill checkout session", {
                    sessionId,
                    checkoutId
                });
                res.status(500).json({error: "Checkout fulfillment failed"});
                return;
            }
        }
        res.json({ok: true});

    } catch(error) {
        console.error('Polar webhook error', error);
        res.status(400).json({error: "Invalid webhook"});
    }
}