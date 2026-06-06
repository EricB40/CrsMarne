import type { Env } from "./env";
/* This file will contain utility functions related to Polar, such as creating checkout sessions, handling webhooks, etc. */

type CheckoutCreateBody = {
    products: string[]; // array of product ids
    prices?: Record<
        string, // product id
        Array<{
            amount_type: "fixed";
            price_amount: number; // in cents
            price_currency: string; // ISO currency code, e.g., "USD"
        }>
    >;
    successUrl: string;
    return_url?: string;
    external_customer_id?: string;
    customer_email?: string;
    metadata?: Record<string, string | number | boolean>;
};

export async function polarCreateCheckout(env: Env, body: CheckoutCreateBody) {
    const token = env.POLAR_ACCESS_TOKEN;
    if(!token) throw new Error("Polar access token not configured");

    const res = await fetch(`${env.POLAR_API_BASE}/v1/checkouts`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Polar API error: ${res.status} ${errText}`);
    }
    const data = (await res.json()) as {
        id: string;
        url: string;
    };
    return { id: data.id, url: data.url };
    }
