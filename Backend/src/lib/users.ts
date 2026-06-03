import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { users } from "../db/schema";
/*So it is just a small database lookup function for a local user by their Clerk user ID. */
export async function getLocalUser( clerkUserId: string) {
    const [row] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
    return row;
}