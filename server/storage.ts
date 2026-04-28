import {
  type User, type InsertUser,
  type Product, type InsertProduct,
  type Category, type InsertCategory,
  type Sale, type InsertSale,
  type Notification, type InsertNotification,
  type AuditLog, type InsertAuditLog,
  type DailyEdit, type InsertDailyEdit,
  type Task, type InsertTask,
  type Order, type InsertOrder,
  type OrderReopen, type InsertOrderReopen,
  type Snapshot, type InsertSnapshot,
  users, products, categories, sales, notifications, auditLogs, dailyEdits, tasks, orders, orderReopens, snapshots
} from "@shared/schema";
import { db } from "../db";
import { eq, and, desc, sql, lt } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  verifyPassword(username: string, password: string): Promise<User | null>;

  // Categories
  getAllCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  deleteCategory(id: string): Promise<void>;

  // Products
  getAllProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<void>;
  updateStock(id: string, quantity: number): Promise<void>;

  // Sales
  getAllSales(): Promise<Sale[]>;
  getSale(id: string): Promise<Sale | undefined>;
  getSalesByUser(userId: string): Promise<Sale[]>;
  createSale(sale: InsertSale): Promise<Sale>;

  // Notifications
  getNotificationsByUser(userId: string | null): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;

  // Audit Logs
  getAllAuditLogs(): Promise<AuditLog[]>;
  getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsByUserAndDateRange(userId: string, startDate: string, endDate: string, startHour?: number, endHour?: number): Promise<AuditLog[]>;

  // Daily Edit Tracking
  getDailyEdits(userId: string, date: string): Promise<DailyEdit | undefined>;
  incrementDailyEdits(userId: string, date: string): Promise<void>;
  canUserEdit(userId: string, role: string): Promise<boolean>;

  // Tasks
  getAllTasks(): Promise<Task[]>;
  getTasksByUser(userId: string, role: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<Pick<Task, 'completed'>>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;

  // Orders (Unauthenticated customer orders)
  createOrder(order: InsertOrder, orderCode: string): Promise<Order>;
  getOrderByCode(code: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  updateOrderItems(orderCode: string, items: any[]): Promise<Order | undefined>;
  approveOrder(orderId: string, userId: string): Promise<Order | undefined>; // legacy alias for accept
  acceptOrder(orderId: string, userId: string): Promise<Order | undefined>;
  markOrderReady(orderId: string): Promise<Order | undefined>;
  completeOrder(orderId: string): Promise<Order | undefined>;
  setOrderStaffMessage(orderId: string, message: string | null): Promise<Order | undefined>;
  finalizeOrderAsSale(args: {
    orderId: string;
    saleId: string;
    userId: string;
    paymentMethod: Order['paymentMethod'];
    paymentProof?: string | null;
    last3Phone: string;
    customerNameOverride?: string | null;
  }): Promise<Order | undefined>;
  cancelOrder(orderId: string): Promise<Order | undefined>;
  deleteOrder(orderId: string): Promise<void>;
  reopenOrder(orderId: string): Promise<Order | undefined>;
  getReopensToday(userId: string, date: string): Promise<number>;
  trackReopen(reopen: InsertOrderReopen): Promise<OrderReopen>;

  // Snapshots (data rollback)
  createSnapshot(label: string, type: 'auto' | 'manual'): Promise<Snapshot>;
  listSnapshots(): Promise<Snapshot[]>;
  getSnapshot(id: string): Promise<Snapshot | undefined>;
  restoreSnapshot(id: string): Promise<{ restoredProducts: number; restoredCategories: number }>;
  pruneOldSnapshots(): Promise<void>;
  hasTodayAutoSnapshot(): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // USERS
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const [user] = await db.insert(users).values({
      ...insertUser,
      password: hashedPassword
    }).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const updateData: any = { ...updates };
    if (updates.password) {
      updateData.password = await bcrypt.hash(updates.password, 10);
    }
    const [updated] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async verifyPassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) return null;
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;
    
    return user;
  }

  // CATEGORIES
  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // PRODUCTS
  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(products.name);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return product;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db.update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updated;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async updateStock(id: string, quantity: number): Promise<void> {
    await db.update(products)
      .set({ stock: sql`${products.stock} - ${quantity}` })
      .where(eq(products.id, id));
  }

  // SALES
  async getAllSales(): Promise<Sale[]> {
    return await db.select().from(sales).orderBy(desc(sales.createdAt));
  }

  async getSale(id: string): Promise<Sale | undefined> {
    const [sale] = await db.select().from(sales).where(eq(sales.id, id));
    return sale;
  }

  async getSalesByUser(userId: string): Promise<Sale[]> {
    return await db.select().from(sales).where(eq(sales.userId, userId)).orderBy(desc(sales.createdAt));
  }

  async createSale(sale: InsertSale & { preview?: any }): Promise<Sale> {
    const { preview, ...saleData } = sale;
    const [newSale] = await db.insert(sales).values({
      ...saleData,
      preview: preview || null
    }).returning();
    
    // Update stock for each item
    for (const item of sale.items) {
      await this.updateStock(item.productId, item.quantity);
    }
    
    return newSale;
  }

  // NOTIFICATIONS
  async getNotificationsByUser(userId: string | null): Promise<Notification[]> {
    if (userId) {
      // Get user-specific + broadcast notifications
      return await db.select().from(notifications)
        .where(
          sql`${notifications.userId} = ${userId} OR ${notifications.userId} IS NULL`
        )
        .orderBy(desc(notifications.createdAt))
        .limit(50);
    } else {
      // Broadcast only
      return await db.select().from(notifications)
        .where(sql`${notifications.userId} IS NULL`)
        .orderBy(desc(notifications.createdAt))
        .limit(50);
    }
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id));
  }

  async deleteNotification(id: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  // AUDIT LOGS
  async getAllAuditLogs(): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(500);
  }

  async getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(200);
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  async getAuditLogsByUserAndDateRange(
    userId: string,
    startDate: string,
    endDate: string,
    startHour?: number,
    endHour?: number
  ): Promise<AuditLog[]> {
    let query = db.select().from(auditLogs).where(
      and(
        eq(auditLogs.userId, userId),
        sql`DATE(${auditLogs.createdAt}) >= ${startDate}`,
        sql`DATE(${auditLogs.createdAt}) <= ${endDate}`
      )
    );

    if (startHour !== undefined && endHour !== undefined) {
      query = query.where(
        sql`EXTRACT(HOUR FROM ${auditLogs.createdAt}) >= ${startHour} AND EXTRACT(HOUR FROM ${auditLogs.createdAt}) <= ${endHour}`
      );
    }

    return await query.orderBy(desc(auditLogs.createdAt));
  }

  // DAILY EDIT TRACKING
  async getDailyEdits(userId: string, date: string): Promise<DailyEdit | undefined> {
    const [edit] = await db.select().from(dailyEdits)
      .where(and(eq(dailyEdits.userId, userId), eq(dailyEdits.date, date)))
      .limit(1);
    return edit;
  }

  async incrementDailyEdits(userId: string, date: string): Promise<void> {
    const existing = await this.getDailyEdits(userId, date);
    
    if (existing) {
      await db.update(dailyEdits)
        .set({ editCount: sql`${dailyEdits.editCount} + 1` })
        .where(eq(dailyEdits.id, existing.id));
    } else {
      await db.insert(dailyEdits).values({ userId, date, editCount: 1 });
    }
  }

  async canUserEdit(userId: string, role: string): Promise<boolean> {
    if (role === 'admin') return true;
    if (role === 'manager') {
      // Managers have a limit of 20 edits per day
      const today = new Date().toISOString().split('T')[0];
      const dailyEdit = await this.getDailyEdits(userId, today);
      return !dailyEdit || dailyEdit.editCount < 20;
    }
    if (role === 'seller') {
      // Sellers have a limit of 5 edits per day
      const today = new Date().toISOString().split('T')[0];
      const dailyEdit = await this.getDailyEdits(userId, today);
      return !dailyEdit || dailyEdit.editCount < 5;
    }
    return false;
  }

  // TASKS
  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async getTasksByUser(userId: string, role: string): Promise<Task[]> {
    if (role === 'admin') {
      return await this.getAllTasks();
    }
    
    return await db.select().from(tasks)
      .where(
        sql`${tasks.assignedTo} = 'all' OR ${tasks.assignedTo} = ${role} OR ${tasks.assignedToId} = ${userId}`
      )
      .orderBy(desc(tasks.createdAt));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: string, updates: Partial<Pick<Task, 'completed'>>): Promise<Task | undefined> {
    const [updated] = await db.update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // ORDERS
  async createOrder(order: InsertOrder, orderCode: string): Promise<Order> {
    const [newOrder] = await db.insert(orders).values({ ...order, orderCode }).returning();
    return newOrder;
  }

  async getOrderByCode(code: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.orderCode, code)).limit(1);
    return order;
  }

  async getAllOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async updateOrderItems(orderCode: string, items: any[]): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ items, total: items.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0).toString() })
      .where(eq(orders.orderCode, orderCode))
      .returning();
    return updated;
  }

  async approveOrder(orderId: string, userId: string): Promise<Order | undefined> {
    // Backward compatibility: "approve" now means "accept"
    return this.acceptOrder(orderId, userId);
  }

  async acceptOrder(orderId: string, userId: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ status: 'accepted', acceptedBy: userId, acceptedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  }

  async markOrderReady(orderId: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ status: 'ready', readyAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  }

  async completeOrder(orderId: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  }

  async setOrderStaffMessage(orderId: string, message: string | null): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ staffMessage: message, staffMessageAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  }

  async finalizeOrderAsSale(args: {
    orderId: string;
    saleId: string;
    userId: string;
    paymentMethod: Order['paymentMethod'];
    paymentProof?: string | null;
    last3Phone: string;
    customerNameOverride?: string | null;
  }): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({
        status: 'completed',
        completedAt: new Date(),
        completedBy: args.userId,
        saleId: args.saleId,
        paymentMethod: args.paymentMethod,
        paymentProof: args.paymentProof ?? null,
        last3Phone: args.last3Phone,
        customerNameOverride: args.customerNameOverride ?? null,
      })
      .where(eq(orders.id, args.orderId))
      .returning();
    return updated;
  }

  async cancelOrder(orderId: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ status: 'cancelled' })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  }

  async deleteOrder(orderId: string): Promise<void> {
    await db.delete(orders).where(eq(orders.id, orderId));
  }

  async reopenOrder(orderId: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ status: 'pending' })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  }

  async getReopensToday(userId: string, date: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(orderReopens)
      .where(and(eq(orderReopens.userId, userId), eq(orderReopens.date, date)));
    return result[0]?.count || 0;
  }

  async trackReopen(reopen: InsertOrderReopen): Promise<OrderReopen> {
    const [newReopen] = await db.insert(orderReopens).values(reopen).returning();
    return newReopen;
  }

  // ── SNAPSHOTS ────────────────────────────────────────────────────────────

  async createSnapshot(label: string, type: 'auto' | 'manual'): Promise<Snapshot> {
    const [allProducts, allCategories, allSales, allOrders, allTasks] = await Promise.all([
      db.select().from(products),
      db.select().from(categories),
      db.select().from(sales),
      db.select().from(orders),
      db.select().from(tasks),
    ]);
    const dateKey = new Date().toISOString().slice(0, 10);
    const [snap] = await db.insert(snapshots).values({
      label,
      type,
      dateKey,
      data: { products: allProducts, categories: allCategories, sales: allSales, orders: allOrders, tasks: allTasks },
    }).returning();
    return snap;
  }

  async listSnapshots(): Promise<Snapshot[]> {
    return db.select().from(snapshots).orderBy(desc(snapshots.createdAt));
  }

  async getSnapshot(id: string): Promise<Snapshot | undefined> {
    const [snap] = await db.select().from(snapshots).where(eq(snapshots.id, id));
    return snap;
  }

  async restoreSnapshot(id: string): Promise<{ restoredProducts: number; restoredCategories: number }> {
    const snap = await this.getSnapshot(id);
    if (!snap) throw new Error('Snapshot não encontrado');

    const snapData = snap.data as { products: any[]; categories: any[]; sales?: any[]; orders?: any[]; tasks?: any[] };
    const { products: snapProducts, categories: snapCategories, sales: snapSales = [], orders: snapOrders = [], tasks: snapTasks = [] } = snapData;

    // 1. Restore categories
    await db.delete(categories);
    if (snapCategories.length > 0) await db.insert(categories).values(snapCategories).onConflictDoNothing();

    // 2. Restore products
    await db.delete(products);
    if (snapProducts.length > 0) await db.insert(products).values(snapProducts).onConflictDoNothing();

    // 3. Restore sales
    await db.delete(sales);
    if (snapSales.length > 0) await db.insert(sales).values(snapSales).onConflictDoNothing();

    // 4. Restore orders
    await db.delete(orders);
    if (snapOrders.length > 0) await db.insert(orders).values(snapOrders).onConflictDoNothing();

    // 5. Restore tasks
    await db.delete(tasks);
    if (snapTasks.length > 0) await db.insert(tasks).values(snapTasks).onConflictDoNothing();

    return {
      restoredProducts: snapProducts.length,
      restoredCategories: snapCategories.length,
      restoredSales: snapSales.length,
      restoredOrders: snapOrders.length,
      restoredTasks: snapTasks.length,
    };
  }

  async pruneOldSnapshots(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    await db.delete(snapshots).where(lt(snapshots.createdAt, cutoff));
  }

  async hasTodayAutoSnapshot(): Promise<boolean> {
    const dateKey = new Date().toISOString().slice(0, 10);
    const result = await db.select({ id: snapshots.id }).from(snapshots)
      .where(and(eq(snapshots.dateKey, dateKey), eq(snapshots.type, 'auto')));
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
