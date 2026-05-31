/* we use the package 'zod' already installed, a small library for schema validation, describing the shape
of data and checking it at runtime  */
/* example:
import { z } from "zod";
then we can define a schema for a user object like this:
const UserSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
});
after that we infer the TypeScript type from the schema like this:
type User = z.infer<typeof UserSchema>;
next to validate:
const userData = { name: "Alice", age: 30 };
const parseResult = UserSchema.safeParse(userData); (get an error instead of throwing if invalid)
or:
const user: User = UserSchema.parse(userData); (which will throw an error if invalid)
 */
import { z } from "zod";

/* we will use zod to define a schema for our environment variables, this way we can ensure that all required
variables are present and have the correct type */
//.coerce will convert the string to a number if it's a string.
// FRONTEND_URL defined in .env file which must be a valid URL (will be changed when in production)
const EnvSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().min(1),

    CLERK_PUBLISHABLE_KEY: z.string().min(1),
    CLERK_SECRET_KEY: z.string().min(1),
    CLERK_WEBHOOK_SECRET: z.string().optional(),

    FRONTEND_URL: z.url(),

    POLAR_ACCESS_TOKEN: z.string().optional(),
    POLAR_WEBHOOK_SECRET: z.string().optional(),
    POLAR_API_BASE: z.url().default("https://api.polar.sh/v1"),
    // fix later to be uuid() since for now we have type a simple string in the .env file for testing,
    //  but in production it will be a uuid
    POLAR_CHECKOUT_PRODUCT_ID: z.string(),

    STREAM_API_KEY: z.string().min(1),
    STREAM_API_SECRET: z.string().min(1),

    IMAGEKIT_PUBLIC_KEY: z.string().min(1),
    IMAGEKIT_PRIVATE_KEY: z.string().min(1),
    IMAGEKIT_URL_ENDPOINT: z.url(),

    SENTRY_DSN: z.url().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
        throw new Error("Invalid environment variables");
    }
    return parsed.data;
}

let cachedEnv: Env | null = null;
// And for performance reasons, we will cache the loaded environment variables
// in memory, so we don't have to parse them every time we need them.
export function getEnv(): Env {
    if (!cachedEnv) {
        cachedEnv = loadEnv();
    }
    return cachedEnv;
}