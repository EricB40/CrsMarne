import express from "express";
import cors from "cors";
import "dotenv/config";
import { clerkMiddleware } from "@clerk/express"
import {clerkWebhookHandler} from "./webhooks/clerk";
import { getEnv } from "./lib/env";

import fs from "node:fs";
import path from "node:path";

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

app.use(rawJson);
app.use(cors());
app.use(clerkMiddleware());
// concerting our public directory and convert to a static asset directory, this is where we will store the uploaded
//  files from the users, and serve them as static assets
/* here after if request is not from API we can redirect to frontend and receive the response */
const publicDir = path.join(process.cwd(), "public");
if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get("*", (req, res, next) => {
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

/* instead of hardcoding the port, we will create an env.ts file in the src/lib folder */
app.listen(env.PORT, () => {
    console.log(`${name} is running on port ${env.PORT}`);
});