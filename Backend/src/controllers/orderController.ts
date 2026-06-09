import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { getLocalUser } from "../lib/users";
import { isStaff } from "../lib/roles";
import { db } from "../db";
import { orderItems, orders, products } from "../db/schema";
import { desc, asc, eq, count, inArray } from "drizzle-orm"

export async function listOrders(req: Request, res: Response, next: NextFunction){
    try {
        const { userId, isAuthenticated } = getAuth(req);
        if (!isAuthenticated || !userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const localUser = await getLocalUser(userId);
        if (!localUser) {
            res.status(503).json({ error: "Account not synced yet" });
            return;
        }
        
        const rows = isStaff(localUser.role)
            ? await db.select().from(orders).orderBy(desc(orders.createdAt))
            : await db
            .select()
            .from(orders)
            .where(eq(orders.userId, localUser.id))
            .orderBy(desc(orders.createdAt));

        const orderIds = rows.map((r) => r.id);

        const previewByOrder = new Map();

        if (orderIds.length > 0) {
            const itemRows = await db
            .select({
            orderId: orderItems.orderId,
            quantity: orderItems.quantity,
            name: products.name,
            slug: products.slug,
            imageUrl: products.imageUrl,
            })
            .from(orderItems)
            .innerJoin(products, eq(orderItems.productId, products.id))
            .where(inArray(orderItems.orderId, orderIds))
            .orderBy(asc(orderItems.id));

            for (const row of itemRows) {
                const list = previewByOrder.get(row.orderId) ?? [];
                list.push({
                    name: row.name,
                    slug: row.slug,
                    imageUrl: row.imageUrl,
                    quantity: row.quantity,
                });
            previewByOrder.set(row.orderId, list);
            }
        }

        const ordersPayload = rows.map((o) => ({
        ...o,
        previewItems: previewByOrder.get(o.id) ?? [],
        }));

        res.json({ orders: ordersPayload });

    }catch(e){
        next(e)
    }
}