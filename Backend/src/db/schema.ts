import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, boolean, jsonb, integer } from 'drizzle-orm/pg-core';


// Define TypeScript types for our database schema
export type OrderStatus = 'pending' | 'paid' | 'failed';
export type UserRole = 'customer' | 'support' | 'admin';
export type CheckoutSessionLine = {
    productId: string;
    quantity: number;
    unitPriceCents: number; 
};

// Here we define the users table schema using drizzle-orm's pgTable function
// We just have to read the doc.
// clerUserId is a string that references the Clerk user ID, which is a unique identifier for each user in the Clerk 
// authentication system. This allows us to link our users in the database with their corresponding accounts in Clerk,
//  enabling us to manage user
//  authentication and authorization effectively.   
export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    clerkUserId: text('clerk_user_id').notNull().unique(),
    email: text('email').notNull().unique().default(''),
    displayName: text('display_name'),
    role: text('role').$type<UserRole>().notNull().default('customer'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
// the slug  is a unique identifier, for example  Nike shoes could have a slug of "nike-shoes".
// This makes it easier to reference products in URLs and other parts of the application
/* price in cents is a convention for storing monetary values in the database to avoid floating-point precision issues */
/* imageKitFileId is a unique identifier for the image file in ImageKit so we can retrieve it later */
/* active is a boolean flag to indicate whether the product is currently available for sale */
export const products = pgTable('products', {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    category: text('category').notNull().default('general'),
    description: text('description').notNull().default(''),
    priceCents: text('price_cents').notNull().default('0'),
    currency: text('currency').notNull().default('USD'),
    imageUrl: text('image_url'),
    imageKitFileId: text('image_kit_file_id'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
/*line:...In short: this line adds a required JSONB field lines to checkout_sessions,
and in TypeScript it is typed as an array of checkout session line items. In one order, we could have multiple line items.
For instance in the order, 2 cameras would be one line item */
export const checkoutSessions = pgTable('checkout_sessions', {
    id: uuid('id').primaryKey().defaultRandom() ,
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    polarCheckoutId: text('polar_checkout_id').unique(),
    lines: jsonb('lines').$type<CheckoutSessionLine[]>().notNull(),
    totalCents: integer('total_cents').notNull(),
    currency: text('currency').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export const orders = pgTable('orders', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    status: text('status').$type<OrderStatus>().notNull().default('pending'),
    polarCheckoutId: text('polar_checkout_id'),
    polarOrderId: text('polar_order_id').unique(),
    totalCents: integer('total_cents').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
export const orderItems = pgTable('order_items', {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
})
/* Now we must define the relationships between the tables, we will have 4 of them */
/* A user can have many orders over time, but each order belongs to one user.
This is a one-to-many relationship between users and orders.*/
export const usersRelations = relations(users, ({many}) => ({orders: many(orders)}))
// The same product can show up on many orders lines
export const productsRelations = relations(products, ({many}) => ({orderItems: many(orderItems)}))
// each order belongs to exactly one user; each order can have many line items.
export const ordersRelations = relations(orders, ({one, many}) => ({user: one(users, { fields: [orders.userId], references: [users.id]}), items: many(orderItems)}))
// each line item belongs to exactly one order; each line item references exactly one product.
export const orderItemsRelations = relations(orderItems, ({one}) => ({order: one(orders, { fields: [orderItems.orderId], references: [orders.id]}), product: one(products, { fields: [orderItems.productId], references: [products.id]})}))