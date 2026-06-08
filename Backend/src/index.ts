import express from "express";
import cors from "cors";
import "dotenv/config";
import { clerkMiddleware } from "@clerk/express"
import {clerkWebhookHandler} from "./webhooks/clerk";
import { polarWebhookHandler } from "./webhooks/polar";
import { getEnv } from "./lib/env";
import  meRouter  from "./routes/meRouter";
import  productsRouter  from "./routes/productsRouter";
import streamRouter from "./routes/streamRouter";
import checkoutRouter from "./routes/checkoutRouter";
import adminRouter from "./routes/adminRouter"


import fs from "node:fs";
import path from "node:path";

import * as Sentry from "@sentry/node";
import { sentryClerkUserMiddleware } from "./middlewares/sentryClerkUser";



const name: string = "Codesistency Backend";
const env = getEnv();
const app = express();

const rawJson = express.raw({ type: "application/json", limit: "10mb" });
/* It's important that you don't parse the webhook event data, it should be passed as-is */
/* overall, this route accepts Clerk webhook POSTs with raw JSON body data and forwards
the request to clerkWebhookHandler for processing.*/
app.post("/webhooks/clerk", rawJson, (req, res) => {
    void clerkWebhookHandler(req, res);
});
app.post("/webhooks/polar", rawJson, (req, res) => {
    void polarWebhookHandler(req, res);
});

app.use(rawJson);
app.use(cors());
app.use(clerkMiddleware());
app.use(sentryClerkUserMiddleware);


// to reachout the currently authenticated user in the frontend,
// we can create a route that returns the user info, and we can call
//  this route from the frontend to get the user info, and we can also
//  use this route to test if the authentication is working properly
/* we fetch this user from db as a record and sent it back to a client */
/* idem for products, by this we can get products, catergories... */
/* Also Stream (getstream.io) is the platform for building real-time chat and activity feeds
a user having purchased items can have support, but stream must authenticate user from the server side which
is different than clerk, for that we need a router */
app.use("/api/me", meRouter);
app.use("/api/products", productsRouter);
app.use("/api/stream", streamRouter);
app.use("/api/checkout", checkoutRouter);
app.use('/api/admin', adminRouter);


// concerting our public directory and convert to a static asset directory, this is where we will store the uploaded
//  files from the users, and serve them as static assets
/* here after if request is not from API we can redirect to frontend and receive the response */
const publicDir = path.join(process.cwd(), "public");
if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get("/{*any}", (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") {
            next();
            return;
        }
        if (req.path.startsWith("/api") || req.path.startsWith("/webhooks")) {
            next();
            return;
        }
        res.sendFile(path.join(publicDir, "index.html"), (err) => next(err));
    });
}
// todo, we can also add a 404 handler here for any unmatched routes, and a global error handler to catch any errors that may occur in the route handlers and return a proper error response to the client.
Sentry.setupExpressErrorHandler(app)
app.use((_err: unknown, _req: express.Request , res: express.Response , _next: express.NextFunction) => {
    const sentryId = (res as express.Response & {sentry?: string}).sentry

    res.status(500).json({
        error: "Internal server error",
        ...(sentryId !== undefined && {sentryId})
    })
});
/* instead of hardcoding the port, we will create an env.ts file in the src/lib folder */
app.listen(env.PORT, () => {
    console.log(`${name} is running on port ${env.PORT}`);
});