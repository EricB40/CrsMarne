// HELPER file for stream related operations, such as creating a token for stream
//  client side authentication, and other stream related operations

import { StreamChat } from "stream-chat";
import { Env } from "./env";
import type { UserRole } from "../db/schema";

export function streamChatDisplayName(
    role: UserRole,
    displayName: string | null,
    email: string,
): string {
    const base = displayName ?? email.split("@")[0] ?? "";
    if (role === "support") {
        return `${base} (Support)`;
    }
    if (role === "admin") {
        return `${base} (Admin)`;
    }
    return base;
}

export function getStreamChatServer(env: Env){
    return StreamChat.getInstance(env.STREAM_API_KEY, env.STREAM_API_SECRET);
}

export function streamUserId(clerkUserId: string){
    return `clerk-${clerkUserId}`;
}