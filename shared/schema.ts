import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, serial, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// USERS TABLE
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().$type<'admin' | 'manager' | 'seller'>(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// CATEGORIES TABLE
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color").notNull(), // Tailwind classes like "bg-green-100 text-green-800"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// PRODUCTS TABLE
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  categoryId: varchar("category_id").references(() => categories.id),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }).default('0'),
  stock: decimal("stock", { precision: 10, scale: 3 }).notNull().default('0'), // Decimal for kg support
  minStock: decimal("min_stock", { precision: 10, scale: 3 }).default('5'),
  unit: text("unit").notNull().$type<'un' | 'kg' | 'g' | 'pack' | 'box'>(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// SALES TABLE
export const sales = pgTable("sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  amountReceived: decimal("amount_received", { precision: 10, scale: 2 }),
  change: decimal("change", { precision: 10, scale: 2 }),
  paymentMethod: text("payment_method").notNull().$type<'cash' | 'card' | 'pix' | 'mpesa' | 'emola' | 'pos' | 'bank'>(),
  items: jsonb("items").notNull().$type<Array<{
    productId: string;
    quantity: number;
    priceAtSale: number;
  }>>(),
  preview: jsonb("preview").$type<{
    items: Array<{ productId: string; quantity: number; priceAtSale: number; productName: string; productUnit: string }>;
    subtotal: number;
    discount: { type: 'none' | 'percentage' | 'fixed'; value: number };
    discountAmount: number;
    total: number;
    paymentMethod: string;
    amountReceived?: number;
    change?: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSaleSchema = createInsertSchema(sales).omit({ id: true, createdAt: true });
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;

// NOTIFICATIONS TABLE
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // null = all users
  type: text("type").notNull().$type<'info' | 'warning' | 'success' | 'error'>(),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  metadata: jsonb("metadata"), // Extra info like productId, saleId, etc
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// AUDIT LOG TABLE
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: text("action").notNull(), // "CREATE_PRODUCT", "UPDATE_PRODUCT", "DELETE_PRODUCT", "SALE", etc
  entityType: text("entity_type").notNull(), // "product", "sale", "user", etc
  entityId: varchar("entity_id"),
  details: jsonb("details"), // Snapshot of the change
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// DAILY EDIT TRACKER (for seller limit of 5 edits per day)
export const dailyEdits = pgTable("daily_edits", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: text("date").notNull(), // Format: YYYY-MM-DD
  editCount: integer("edit_count").default(0).notNull(),
});

export const insertDailyEditSchema = createInsertSchema(dailyEdits).omit({ id: true });
export type InsertDailyEdit = z.infer<typeof insertDailyEditSchema>;
export type DailyEdit = typeof dailyEdits.$inferSelect;

// TASKS TABLE
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  completed: boolean("completed").default(false).notNull(),
  assignedTo: text("assigned_to").notNull().$type<'all' | 'admin' | 'manager' | 'seller' | 'user'>(), // 'user' means specific user
  assignedToId: varchar("assigned_to_id").references(() => users.id), // Only used if assignedTo = 'user'
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// ORDERS TABLE (Unauthenticated customer orders)
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderCode: varchar("order_code", { length: 8 }).notNull().unique(), // Like "ABC12345"
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  items: jsonb("items").notNull().$type<Array<{
    productId: string;
    quantity: number;
    priceAtSale: number;
  }>>(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status")
    .notNull()
    .$type<'pending' | 'accepted' | 'ready' | 'completed' | 'cancelled'>()
    .default('pending'),
  paymentMethod: text("payment_method").notNull().$type<'cash' | 'transfer' | 'mpesa' | 'emola' | 'bank'>(),
  paymentProof: text("payment_proof"), // URL to uploaded proof for transfers
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Estado operacional (gestor/admin)
  acceptedBy: varchar("accepted_by").references(() => users.id),
  acceptedAt: timestamp("accepted_at"),
  readyAt: timestamp("ready_at"),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id),
  saleId: varchar("sale_id").references(() => sales.id),
  last3Phone: varchar("last3_phone", { length: 3 }),
  customerNameOverride: text("customer_name_override"),
  // Mensagem do staff visível para o cliente (tracking por código)
  staffMessage: text("staff_message"),
  staffMessageAt: timestamp("staff_message_at"),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  orderCode: true,
  status: true,
  createdAt: true,
  acceptedBy: true,
  acceptedAt: true,
  readyAt: true,
  completedAt: true,
  completedBy: true,
  saleId: true,
  last3Phone: true,
  customerNameOverride: true,
  staffMessage: true,
  staffMessageAt: true,
});
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// ORDER REOPENS TRACKING (para rastrear reabertas de pedidos aprovados - máximo 5/dia para não-admin)
export const orderReopens = pgTable("order_reopens", {
  id: serial("id").primaryKey(),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: text("date").notNull(), // Format: YYYY-MM-DD
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrderReopenSchema = createInsertSchema(orderReopens).omit({ id: true, createdAt: true });
export type InsertOrderReopen = z.infer<typeof insertOrderReopenSchema>;
export type OrderReopen = typeof orderReopens.$inferSelect;
