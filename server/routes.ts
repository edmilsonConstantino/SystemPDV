import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import os from "os";
import { storage } from "./storage";
import { insertUserSchema, insertProductSchema, insertCategorySchema, insertSaleSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { seedDatabase } from "../db/init";
import { createScannerToken, consumeBarcodes, pushBarcode, pingToken, listSessions, revokeToken, renewToken, TOKEN_TTL_MS } from "./scannerToken";
import { getCachedProducts, getCachedCategories, bustProductsCache, bustCategoriesCache } from "./catalogCache";

// Session augmentation
declare module 'express-session' {
  interface SessionData {
    userId: string;
    username: string;
    role: 'admin' | 'manager' | 'seller';
    name: string;
  }
}

// Middleware to check authentication
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  next();
}

// Middleware to check admin role
function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.session.userId || req.session.role !== 'admin') {
    return res.status(403).json({ error: "Acesso negado. Apenas administradores podem realizar esta ação." });
  }
  next();
}

// Middleware to check admin or manager role
function requireAdminOrManager(req: Request, res: Response, next: Function) {
  if (!req.session.userId || (req.session.role !== 'admin' && req.session.role !== 'manager')) {
    return res.status(403).json({ error: "Acesso negado. Apenas administradores e gerentes podem realizar esta ação." });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ==================== AUTH ROUTES ====================
  
  // Login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
      }

      const user = await storage.verifyPassword(username, password);
      
      if (!user) {
        return res.status(401).json({ error: "Usuário ou senha incorretos" });
      }

      // Set session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.name = user.name;

      res.json({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        avatar: user.avatar
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Erro ao fazer login" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao fazer logout" });
      }
      res.json({ success: true });
    });
  });

  // Get current user
  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    res.json({
      id: req.session.userId,
      username: req.session.username,
      name: req.session.name,
      role: req.session.role
    });
  });

  // ==================== USER ROUTES ====================
  
  // Get all users (admin + manager view)
  app.get("/api/users", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(u => ({ ...u, password: undefined }))); // Remove passwords
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });

  // Update user (admin only)
  app.patch("/api/users/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateUser(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "UPDATE_USER",
        entityType: "user",
        entityId: updated.id,
        details: { changes: req.body }
      });

      res.json(updated);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "Erro ao atualizar usuário" });
    }
  });

  // Delete user (admin only)
  app.delete("/api/users/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const userToDelete = await storage.getUser(req.params.id);
      if (!userToDelete) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      await storage.deleteUser(req.params.id);

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "DELETE_USER",
        entityType: "user",
        entityId: req.params.id,
        details: { username: userToDelete.username }
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Erro ao deletar usuário" });
    }
  });

  // Create user (admin only)
  app.post("/api/users", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const newUser = await storage.createUser(data);

      // Create audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "CREATE_USER",
        entityType: "user",
        entityId: newUser.id,
        details: { username: newUser.username, role: newUser.role }
      });

      res.json({ ...newUser, password: undefined });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Create user error:", error);
      res.status(500).json({ error: "Erro ao criar usuário" });
    }
  });

  // ==================== CATEGORY ROUTES ====================
  
  app.get("/api/categories", async (req: Request, res: Response) => {
    try {
      const categories = await getCachedCategories(() => storage.getAllCategories());
      res.setHeader("Cache-Control", "private, max-age=30");
      res.json(categories);
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ error: "Erro ao buscar categorias" });
    }
  });

  app.post("/api/categories", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const data = insertCategorySchema.parse(req.body);
      const newCategory = await storage.createCategory(data);

      // Audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "CREATE_CATEGORY",
        entityType: "category",
        entityId: newCategory.id,
        details: { name: newCategory.name }
      });

      bustCategoriesCache();
      res.json(newCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Create category error:", error);
      res.status(500).json({ error: "Erro ao criar categoria" });
    }
  });

  app.delete("/api/categories/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteCategory(req.params.id);

      // Audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "DELETE_CATEGORY",
        entityType: "category",
        entityId: req.params.id,
        details: {}
      });

      bustCategoriesCache();
      res.json({ success: true });
    } catch (error) {
      console.error("Delete category error:", error);
      res.status(500).json({ error: "Erro ao deletar categoria" });
    }
  });

  // ==================== PRODUCT ROUTES ====================
  
  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const products = await getCachedProducts(() => storage.getAllProducts());
      res.setHeader("Cache-Control", "private, max-age=30");
      res.json(products);
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({ error: "Erro ao buscar produtos" });
    }
  });

  app.post("/api/products", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      // Check edit permission
      const canEdit = await storage.canUserEdit(req.session.userId!, req.session.role!);
      if (!canEdit) {
        return res.status(403).json({ 
          error: "Limite diário de edições atingido. Vendedores podem fazer 5 edições por dia." 
        });
      }

      const data = insertProductSchema.parse(req.body);
      const newProduct = await storage.createProduct(data);

      // Increment edit count for non-admins
      if (req.session.role !== 'admin') {
        const today = new Date().toISOString().split('T')[0];
        await storage.incrementDailyEdits(req.session.userId!, today);
      }

      // Audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "CREATE_PRODUCT",
        entityType: "product",
        entityId: newProduct.id,
        details: { name: newProduct.name, sku: newProduct.sku }
      });

      // Create notifications for sellers when admin creates product
      if (req.session.role === 'admin') {
        await storage.createNotification({
          userId: null, // Broadcast to all
          type: "info",
          message: `Novo produto adicionado: ${newProduct.name}`,
          metadata: { productId: newProduct.id }
        });
      }

      bustProductsCache();
      res.json(newProduct);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Create product error:", error);
      res.status(500).json({ error: "Erro ao criar produto" });
    }
  });

  app.patch("/api/products/:id", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      // Check edit permission
      const canEdit = await storage.canUserEdit(req.session.userId!, req.session.role!);
      if (!canEdit) {
        return res.status(403).json({ 
          error: "Limite diário de edições atingido. Vendedores podem fazer 5 edições por dia." 
        });
      }

      const oldProduct = await storage.getProduct(req.params.id);
      if (!oldProduct) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }

      const updated = await storage.updateProduct(req.params.id, req.body);

      if (!updated) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }

      // Increment edit count for non-admins
      if (req.session.role !== 'admin') {
        const today = new Date().toISOString().split('T')[0];
        await storage.incrementDailyEdits(req.session.userId!, today);
      }

      // Compute field-by-field diff for a meaningful audit trail
      const TRACKED_FIELDS = ['name', 'sku', 'barcode', 'price', 'costPrice', 'stock', 'minStock', 'unit', 'categoryId'] as const;
      const changes: Record<string, { de: any; para: any }> = {};
      for (const field of TRACKED_FIELDS) {
        if (req.body[field] !== undefined && String((oldProduct as any)[field] ?? '') !== String(req.body[field])) {
          changes[field] = { de: (oldProduct as any)[field], para: req.body[field] };
        }
      }

      // Audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "UPDATE_PRODUCT",
        entityType: "product",
        entityId: updated.id,
        details: { productName: oldProduct.name, changes }
      });

      // Create notifications for sellers when admin updates product
      if (req.session.role === 'admin') {
        await storage.createNotification({
          userId: null,
          type: "info",
          message: `Produto atualizado: ${updated.name}`,
          metadata: { productId: updated.id }
        });
      }

      bustProductsCache();
      res.json(updated);
    } catch (error) {
      console.error("Update product error:", error);
      res.status(500).json({ error: "Erro ao atualizar produto" });
    }
  });

  // Increase product stock (admin/manager only)
  app.post("/api/products/:id/increase-stock", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const { quantity, price } = req.body;
      
      if (!quantity || quantity <= 0) {
        return res.status(400).json({ error: "Quantidade deve ser maior que 0" });
      }

      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }

      const newStock = parseFloat(product.stock) + parseFloat(String(quantity));
      const updateData: any = { stock: String(newStock) };
      if (price !== undefined && price > 0) {
        updateData.price = String(price);
      }
      const updated = await storage.updateProduct(req.params.id, updateData);

      // Audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "INCREASE_STOCK",
        entityType: "product",
        entityId: updated!.id,
        details: { 
          productName: product.name,
          quantityAdded: quantity,
          previousStock: product.stock,
          newStock: String(newStock),
          ...(price && { priceChanged: true, previousPrice: product.price, newPrice: String(price) })
        }
      });

      // Notify all users
      const priceMsg = price ? ` | Preço: ${product.price} → ${price}` : '';
      await storage.createNotification({
        userId: null,
        type: "info",
        message: `Estoque aumentado: ${product.name} (+${quantity} ${product.unit})${priceMsg}`,
        metadata: { productId: product.id, action: "stock_increased" }
      });

      bustProductsCache();
      res.json(updated);
    } catch (error) {
      console.error("Increase stock error:", error);
      res.status(500).json({ error: "Erro ao aumentar estoque" });
    }
  });

  app.delete("/api/products/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const product = await storage.getProduct(req.params.id);
      
      if (!product) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }

      await storage.deleteProduct(req.params.id);

      // Audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "DELETE_PRODUCT",
        entityType: "product",
        entityId: req.params.id,
        details: { name: product.name }
      });

      // Notify all users
      await storage.createNotification({
        userId: null,
        type: "warning",
        message: `Produto removido: ${product.name}`,
        metadata: { productId: product.id }
      });

      bustProductsCache();
      res.json({ success: true });
    } catch (error) {
      console.error("Delete product error:", error);
      res.status(500).json({ error: "Erro ao deletar produto" });
    }
  });

  // ==================== SALES ROUTES ====================

  app.get("/api/sales/:id", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const sale = await storage.getSale(req.params.id);
      if (!sale) return res.status(404).json({ error: "Venda não encontrada" });

      const allProducts = await storage.getAllProducts();
      const productMap: Record<string, { name: string; unit: string }> = {};
      for (const p of allProducts) productMap[p.id] = { name: p.name, unit: p.unit };

      const items = ((sale.items as any[]) || []).map((item: any) => ({
        ...item,
        productName: productMap[item.productId]?.name || 'Produto desconhecido',
        unit: productMap[item.productId]?.unit || 'un',
      }));

      res.json({ ...sale, items });
    } catch (error) {
      console.error("Get sale error:", error);
      res.status(500).json({ error: "Erro ao buscar venda" });
    }
  });

  app.get("/api/sales", requireAuth, async (req: Request, res: Response) => {
    try {
      // Sellers only see their own sales, admins/managers see all
      const sales = req.session.role === 'seller' 
        ? await storage.getSalesByUser(req.session.userId!)
        : await storage.getAllSales();
      
      res.json(sales);
    } catch (error) {
      console.error("Get sales error:", error);
      res.status(500).json({ error: "Erro ao buscar vendas" });
    }
  });

  // Get sales with preview (admin only for audit/history)
  app.get("/api/sales/history/previews", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const sales = await storage.getAllSales();
      const withPreviews = sales.filter(s => s.preview).map(s => ({
        id: s.id,
        userId: s.userId,
        createdAt: s.createdAt,
        total: s.total,
        preview: s.preview
      }));
      res.json(withPreviews);
    } catch (error) {
      console.error("Get sales previews error:", error);
      res.status(500).json({ error: "Erro ao buscar histórico de vendas" });
    }
  });

  app.post("/api/sales", requireAuth, async (req: Request, res: Response) => {
    try {
      const { preview, ...bodyData } = req.body;
      const data = insertSaleSchema.parse({
        ...bodyData,
        userId: req.session.userId
      });

      const newSale = await storage.createSale({
        ...data,
        preview
      });

      // Enriquecer itens com nomes de produtos para o audit log
      const allProducts = await storage.getAllProducts();
      const productMap: Record<string, { name: string; unit: string }> = {};
      for (const p of allProducts) productMap[p.id] = { name: p.name, unit: p.unit };
      const saleItems = ((newSale.items as any[]) || []).map((item: any) => ({
        productId: item.productId,
        productName: productMap[item.productId]?.name || 'Produto desconhecido',
        unit: productMap[item.productId]?.unit || 'un',
        quantity: item.quantity,
        priceAtSale: item.priceAtSale,
      }));

      // Audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "CREATE_SALE",
        entityType: "sale",
        entityId: newSale.id,
        details: {
          total: newSale.total,
          paymentMethod: newSale.paymentMethod,
          amountReceived: newSale.amountReceived,
          change: newSale.change,
          items: saleItems,
        }
      });

      // Create notification for the seller (their own action)
      await storage.createNotification({
        userId: req.session.userId!,
        type: "success",
        message: `Venda realizada com sucesso! Total: MT ${newSale.total}`,
        metadata: { saleId: newSale.id }
      });

      bustProductsCache();
      res.json(newSale);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Create sale error:", error);
      res.status(500).json({ error: "Erro ao criar venda" });
    }
  });

  // ==================== NOTIFICATION ROUTES ====================
  
  app.get("/api/notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const notifications = await storage.getNotificationsByUser(req.session.userId!);
      res.json(notifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ error: "Erro ao buscar notificações" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.markNotificationAsRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark notification error:", error);
      res.status(500).json({ error: "Erro ao marcar notificação" });
    }
  });

  app.delete("/api/notifications/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.deleteNotification(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete notification error:", error);
      res.status(500).json({ error: "Erro ao deletar notificação" });
    }
  });

  // ==================== AUDIT LOG ROUTES ====================
  
  app.get("/api/audit-logs", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const logs = await storage.getAllAuditLogs();
      res.json(logs);
    } catch (error) {
      console.error("Get audit logs error:", error);
      res.status(500).json({ error: "Erro ao buscar logs de auditoria" });
    }
  });

  app.post("/api/audit-logs/filter", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const { userId, startDate, endDate, startHour, endHour } = req.body;
      
      if (!userId || !startDate || !endDate) {
        return res.status(400).json({ error: "userId, startDate e endDate são obrigatórios" });
      }

      const logs = await storage.getAuditLogsByUserAndDateRange(
        userId,
        startDate,
        endDate,
        startHour,
        endHour
      );

      // Convert to CSV if requested
      if (req.query.format === 'csv') {
        const headers = ['ID', 'Ação', 'Tipo', 'ID Entidade', 'Detalhes', 'Data/Hora'];
        const rows = logs.map(log => [
          log.id,
          log.action,
          log.entityType,
          log.entityId || '-',
          JSON.stringify(log.details || {}),
          new Date(log.createdAt).toLocaleString('pt-BR')
        ]);
        
        const csv = [headers, ...rows]
          .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          .join('\n');
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="auditoria_${startDate}_${endDate}.csv"`);
        res.send(csv);
      } else {
        res.json(logs);
      }
    } catch (error) {
      console.error("Filter audit logs error:", error);
      res.status(500).json({ error: "Erro ao filtrar logs de auditoria" });
    }
  });

  // ==================== ANALYTICS ROUTES ====================

  app.get("/api/analytics/financial", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const [products, sales] = await Promise.all([
        storage.getAllProducts(),
        storage.getAllSales(),
      ]);

      // Capital imobilizado em stock (custo × quantidade em stock)
      const capitalInStock = products.reduce((sum, p) => {
        const cost = parseFloat(p.costPrice ?? '0');
        const stock = parseFloat(p.stock ?? '0');
        return sum + cost * stock;
      }, 0);

      // Receita total histórica
      const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.total ?? '0'), 0);

      // CMV estimado: para cada item vendido, usa o costPrice actual do produto
      const productMap = new Map(products.map(p => [p.id, p]));
      let totalCostSold = 0;
      for (const sale of sales) {
        const items = (sale.items as Array<{ productId: string; quantity: number; priceAtSale: number }>) ?? [];
        for (const item of items) {
          const prod = productMap.get(item.productId);
          const cost = parseFloat(prod?.costPrice ?? '0');
          totalCostSold += cost * item.quantity;
        }
      }

      const grossProfit = totalRevenue - totalCostSold;
      const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      res.json({
        capitalInStock: Math.round(capitalInStock * 100) / 100,
        totalRevenue:   Math.round(totalRevenue   * 100) / 100,
        totalCostSold:  Math.round(totalCostSold  * 100) / 100,
        grossProfit:    Math.round(grossProfit     * 100) / 100,
        margin:         Math.round(margin          * 100) / 100,
        salesCount:     sales.length,
        productsCount:  products.length,
      });
    } catch (error) {
      console.error("Financial analytics error:", error);
      res.status(500).json({ error: "Erro ao calcular analytics financeiros" });
    }
  });

  // ==================== SYSTEM ROUTES ====================

  // Get edit count for current user
  app.get("/api/system/edit-count", requireAuth, async (req: Request, res: Response) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dailyEdit = await storage.getDailyEdits(req.session.userId!, today);
      const canEdit = await storage.canUserEdit(req.session.userId!, req.session.role!);
      
      const limit = req.session.role === 'seller' ? 5 : req.session.role === 'manager' ? 20 : 999;
      
      res.json({
        count: dailyEdit?.editCount || 0,
        limit,
        canEdit
      });
    } catch (error) {
      console.error("Get edit count error:", error);
      res.status(500).json({ error: "Erro ao buscar contagem de edições" });
    }
  });

  // ==================== TASKS ROUTES ====================
  
  app.get("/api/tasks", requireAuth, async (req: Request, res: Response) => {
    try {
      const tasks = await storage.getTasksByUser(req.session.userId!, req.session.role!);
      res.json(tasks);
    } catch (error) {
      console.error("Get tasks error:", error);
      res.status(500).json({ error: "Erro ao buscar tarefas" });
    }
  });

  app.post("/api/tasks", requireAuth, async (req: Request, res: Response) => {
    try {
      const taskData = {
        ...req.body,
        createdBy: req.session.userId!
      };
      const newTask = await storage.createTask(taskData);
      
      // Criar notificação para usuários afetados
      const assignees = new Set<string>();
      if (taskData.assignedTo === 'admin') {
        const allUsers = await storage.getAllUsers();
        allUsers.filter(u => u.role === 'admin').forEach(u => assignees.add(u.id));
      } else if (taskData.assignedTo === 'manager') {
        const allUsers = await storage.getAllUsers();
        allUsers.filter(u => u.role === 'manager').forEach(u => assignees.add(u.id));
      } else if (taskData.assignedTo === 'seller') {
        const allUsers = await storage.getAllUsers();
        allUsers.filter(u => u.role === 'seller').forEach(u => assignees.add(u.id));
      } else if (taskData.assignedTo === 'user' && taskData.assignedToId) {
        assignees.add(taskData.assignedToId);
      } else if (taskData.assignedTo === 'all') {
        const allUsers = await storage.getAllUsers();
        allUsers.forEach(u => assignees.add(u.id));
      }
      
      // Broadcast notification to assigned users
      for (const userId of assignees) {
        await storage.createNotification({
          userId,
          type: "info",
          message: `Nova tarefa atribuída: ${newTask.title}`,
          metadata: { taskId: newTask.id }
        });
      }
      
      res.json(newTask);
    } catch (error) {
      console.error("Create task error:", error);
      res.status(500).json({ error: "Erro ao criar tarefa" });
    }
  });

  app.patch("/api/tasks/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateTask(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Tarefa não encontrada" });
      }
      
      // Notificar quando tarefa é completada
      if (updated.completed) {
        await storage.createNotification({
          userId: null,
          type: "success",
          message: `Tarefa concluída: ${updated.title}`,
          metadata: { taskId: updated.id }
        });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Update task error:", error);
      res.status(500).json({ error: "Erro ao atualizar tarefa" });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.deleteTask(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete task error:", error);
      res.status(500).json({ error: "Erro ao deletar tarefa" });
    }
  });

  // ==================== ORDERS ROUTES (Cliente - Pedidos) ====================

  app.post("/api/orders", async (req: Request, res: Response) => {
    try {
      const { customerName, customerPhone, items, total, paymentMethod, paymentProof } = req.body;
      
      if (!customerName || !customerPhone || !items || !total) {
        return res.status(400).json({ error: "Dados incompletos" });
      }
      if (paymentMethod === 'transfer' && (!paymentProof || typeof paymentProof !== 'string')) {
        return res.status(400).json({ error: "Anexe o comprovativo para transferência" });
      }

      const orderCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const newOrder = await storage.createOrder({ 
        customerName, 
        customerPhone, 
        items, 
        total: total.toString(),
        paymentMethod,
        paymentProof: typeof paymentProof === 'string' ? paymentProof : undefined,
      }, orderCode);

      // Check for over-stock orders and notify
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (product && item.quantity > parseFloat(product.stock)) {
          await storage.createNotification({
            userId: null,
            type: "warning",
            message: `⚠️ Pedido ${orderCode}: ${product.name} - Quantidade (${item.quantity}) acima do estoque (${product.stock})`,
            metadata: { orderId: newOrder.id, productId: product.id, overstock: true }
          });
        }
      }

      // Notify all admins/managers about new order
      await storage.createNotification({
        userId: null,
        type: "info",
        message: `📦 Novo pedido: ${customerName} - Código: ${orderCode}`,
        metadata: { orderId: newOrder.id, action: "new_order" }
      });

      res.json(newOrder);
    } catch (error) {
      console.error("Create order error:", error);
      res.status(500).json({ error: "Erro ao criar pedido" });
    }
  });

  app.get("/api/orders/:code", async (req: Request, res: Response) => {
    try {
      const order = await storage.getOrderByCode(req.params.code.toUpperCase());
      if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
      res.json(order);
    } catch (error) {
      console.error("Get order error:", error);
      res.status(500).json({ error: "Erro ao buscar pedido" });
    }
  });

  // Auditoria profunda do pedido (admin/gestor)
  app.get("/api/orders/:code/audit", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const order = await storage.getOrderByCode(req.params.code.toUpperCase());
      if (!order) return res.status(404).json({ error: "Pedido não encontrado" });

      const orderLogs = await storage.getAuditLogsByEntity('order', order.id);
      const saleLogs = order.saleId ? await storage.getAuditLogsByEntity('sale', order.saleId) : [];

      res.json({
        order: {
          id: order.id,
          orderCode: order.orderCode,
          status: order.status,
          createdAt: order.createdAt,
          acceptedAt: order.acceptedAt,
          readyAt: order.readyAt,
          completedAt: order.completedAt,
          acceptedBy: order.acceptedBy,
          completedBy: (order as any).completedBy,
          saleId: (order as any).saleId,
          paymentMethod: order.paymentMethod,
          paymentProof: order.paymentProof,
          last3Phone: (order as any).last3Phone,
          customerNameOverride: (order as any).customerNameOverride,
          staffMessage: order.staffMessage,
          staffMessageAt: order.staffMessageAt,
        },
        audit: {
          order: orderLogs,
          sale: saleLogs,
        }
      });
    } catch (error) {
      console.error("Get order audit error:", error);
      res.status(500).json({ error: "Erro ao buscar auditoria do pedido" });
    }
  });

  app.get("/api/orders", requireAuth, async (req: Request, res: Response) => {
    try {
      if (req.session.role === 'seller') {
        return res.status(403).json({ error: "Acesso negado" });
      }
      const orders = await storage.getAllOrders();
      
      // Enrich orders with product names and stock info
      const enrichedOrders = await Promise.all(orders.map(async (order: any) => {
        const enrichedItems = await Promise.all(order.items.map(async (item: any) => {
          const product = await storage.getProduct(item.productId);
          return {
            ...item,
            productName: product?.name || 'Produto desconhecido',
            currentStock: product?.stock || '0',
            hasInsufficientStock: product ? item.quantity > parseFloat(product.stock) : true
          };
        }));
        return {
          ...order,
          items: enrichedItems,
          hasAnyInsufficientStock: enrichedItems.some(item => item.hasInsufficientStock)
        };
      }));
      
      res.json(enrichedOrders);
    } catch (error) {
      console.error("Get orders error:", error);
      res.status(500).json({ error: "Erro ao buscar pedidos" });
    }
  });

  app.patch("/api/orders/:id/approve", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const order = await storage.getAllOrders().then(orders => orders.find(o => o.id === req.params.id));
      if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
      
      // Validate stock for all items
      const insufficientItems = [];
      for (const item of order.items) {
        const product = await storage.getProduct(item.productId);
        if (!product || item.quantity > parseFloat(product.stock)) {
          insufficientItems.push({
            productId: item.productId,
            productName: product?.name || 'Produto desconhecido',
            requested: item.quantity,
            available: product?.stock || '0'
          });
        }
      }
      
      // Se há itens com estoque insuficiente, recusar aprovação
      if (insufficientItems.length > 0) {
        return res.status(400).json({ 
          error: "Não é possível aprovar pedido com estoque insuficiente",
          insufficientItems 
        });
      }

      const updated = await storage.approveOrder(req.params.id, req.session.userId!);
      
      await storage.createNotification({
        userId: null,
        type: "success",
        message: `✅ Pedido ${updated.orderCode} foi aceite!`,
        metadata: { orderId: updated.id }
      });

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "ACCEPT_ORDER",
        entityType: "order",
        entityId: updated.id,
        details: { orderCode: updated.orderCode, total: updated.total }
      });

      res.json(updated);
    } catch (error) {
      console.error("Approve order error:", error);
      res.status(500).json({ error: "Erro ao aprovar pedido" });
    }
  });

  // Alias explícito (novo endpoint) para aceitar
  app.patch("/api/orders/:id/accept", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      // Reutiliza a mesma validação de estoque do approve (approve virou alias de accept na storage)
      const order = await storage.getAllOrders().then(orders => orders.find(o => o.id === req.params.id));
      if (!order) return res.status(404).json({ error: "Pedido não encontrado" });

      const insufficientItems = [];
      for (const item of order.items) {
        const product = await storage.getProduct(item.productId);
        if (!product || item.quantity > parseFloat(product.stock)) {
          insufficientItems.push({
            productId: item.productId,
            productName: product?.name || 'Produto desconhecido',
            requested: item.quantity,
            available: product?.stock || '0'
          });
        }
      }

      if (insufficientItems.length > 0) {
        return res.status(400).json({
          error: "Não é possível aceitar pedido com estoque insuficiente",
          insufficientItems
        });
      }

      const updated = await storage.acceptOrder(req.params.id, req.session.userId!);
      if (!updated) return res.status(404).json({ error: "Pedido não encontrado" });

      await storage.createNotification({
        userId: null,
        type: "success",
        message: `✅ Pedido ${updated.orderCode} foi aceite!`,
        metadata: { orderId: updated.id }
      });

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "ACCEPT_ORDER",
        entityType: "order",
        entityId: updated.id,
        details: { orderCode: updated.orderCode, total: updated.total }
      });

      res.json(updated);
    } catch (error) {
      console.error("Accept order error:", error);
      res.status(500).json({ error: "Erro ao aceitar pedido" });
    }
  });

  app.patch("/api/orders/:id/ready", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const updated = await storage.markOrderReady(req.params.id);
      if (!updated) return res.status(404).json({ error: "Pedido não encontrado" });

      await storage.createNotification({
        userId: null,
        type: "info",
        message: `📦 Pedido ${updated.orderCode} está pronto`,
        metadata: { orderId: updated.id }
      });

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "MARK_ORDER_READY",
        entityType: "order",
        entityId: updated.id,
        details: { orderCode: updated.orderCode }
      });

      res.json(updated);
    } catch (error) {
      console.error("Ready order error:", error);
      res.status(500).json({ error: "Erro ao marcar pedido como pronto" });
    }
  });

  app.patch("/api/orders/:id/complete", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const updated = await storage.completeOrder(req.params.id);
      if (!updated) return res.status(404).json({ error: "Pedido não encontrado" });

      await storage.createNotification({
        userId: null,
        type: "success",
        message: `🏁 Pedido ${updated.orderCode} foi entregue`,
        metadata: { orderId: updated.id }
      });

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "COMPLETE_ORDER",
        entityType: "order",
        entityId: updated.id,
        details: { orderCode: updated.orderCode }
      });

      res.json(updated);
    } catch (error) {
      console.error("Complete order error:", error);
      res.status(500).json({ error: "Erro ao concluir pedido" });
    }
  });

  app.patch("/api/orders/:id/message", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      const updated = await storage.setOrderStaffMessage(req.params.id, message.length ? message : null);
      if (!updated) return res.status(404).json({ error: "Pedido não encontrado" });

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "SET_ORDER_MESSAGE",
        entityType: "order",
        entityId: updated.id,
        details: { orderCode: updated.orderCode, hasMessage: !!message.length }
      });

      res.json(updated);
    } catch (error) {
      console.error("Order message error:", error);
      res.status(500).json({ error: "Erro ao salvar mensagem do pedido" });
    }
  });

  // Finalizar pedido online: cria venda + marca pedido como concluído + histórico
  app.post("/api/orders/:id/checkout", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const order = await storage.getAllOrders().then((orders) => orders.find((o) => o.id === req.params.id));
      if (!order) return res.status(404).json({ error: "Pedido não encontrado" });

      const last3 = String(req.body?.last3Phone ?? '').replace(/\D/g, '').slice(-3);
      if (last3.length !== 3) {
        return res.status(400).json({ error: "Informe os últimos 3 dígitos do telefone" });
      }
      const phoneDigits = String(order.customerPhone ?? '').replace(/\D/g, '');
      const phoneLast3 = phoneDigits.slice(-3);
      if (phoneLast3 && phoneLast3 !== last3) {
        return res.status(400).json({ error: "Os 3 dígitos não correspondem ao telefone do pedido" });
      }

      const paymentMethodRaw = String(req.body?.paymentMethod ?? '').toLowerCase();
      const paymentMethod = (['cash', 'transfer', 'mpesa', 'emola', 'bank'] as const).includes(paymentMethodRaw as any)
        ? (paymentMethodRaw as any)
        : 'cash';

      const paymentProof = typeof req.body?.paymentProof === 'string' ? req.body.paymentProof.trim() : '';
      const customerNameOverride = typeof req.body?.customerName === 'string' ? req.body.customerName.trim() : '';

      // Revalidar stock (pode ter mudado após o pedido)
      const insufficientItems = [];
      for (const item of order.items) {
        const product = await storage.getProduct(item.productId);
        if (!product || item.quantity > parseFloat(product.stock)) {
          insufficientItems.push({
            productId: item.productId,
            productName: product?.name || 'Produto desconhecido',
            requested: item.quantity,
            available: product?.stock || '0'
          });
        }
      }
      if (insufficientItems.length > 0) {
        return res.status(400).json({
          error: "Não é possível finalizar com estoque insuficiente",
          insufficientItems
        });
      }

      // Criar venda (usando itens do pedido)
      const sale = await storage.createSale({
        userId: req.session.userId!,
        total: order.total,
        paymentMethod,
        items: order.items,
        preview: {
          items: await Promise.all(order.items.map(async (it) => {
            const p = await storage.getProduct(it.productId);
            return {
              productId: it.productId,
              quantity: it.quantity,
              priceAtSale: it.priceAtSale,
              productName: p?.name || 'Produto',
              productUnit: (p as any)?.unit || 'un',
            };
          })),
          subtotal: Number(order.total),
          discount: { type: 'none', value: 0 },
          discountAmount: 0,
          total: Number(order.total),
          paymentMethod,
          order: {
            orderId: order.id,
            orderCode: order.orderCode,
            customerName: customerNameOverride || order.customerName,
            customerPhone: order.customerPhone,
            last3Phone: last3,
            paymentProof: paymentProof || undefined,
          },
        },
      } as any);

      const updated = await storage.finalizeOrderAsSale({
        orderId: order.id,
        saleId: sale.id,
        userId: req.session.userId!,
        paymentMethod,
        paymentProof: paymentProof || null,
        last3Phone: last3,
        customerNameOverride: customerNameOverride || null,
      });

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "CHECKOUT_ORDER",
        entityType: "order",
        entityId: order.id,
        details: {
          orderCode: order.orderCode,
          saleId: sale.id,
          paymentMethod,
          hasProof: !!paymentProof,
        }
      });

      await storage.createNotification({
        userId: null,
        type: "success",
        message: `🧾 Pedido ${order.orderCode} finalizado como venda`,
        metadata: { orderId: order.id, saleId: sale.id, action: "order_checked_out" }
      });

      bustProductsCache();
      res.json({ order: updated, sale });
    } catch (error) {
      console.error("Checkout order error:", error);
      res.status(500).json({ error: "Erro ao finalizar pedido" });
    }
  });

  app.patch("/api/orders/:id/cancel", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const updated = await storage.cancelOrder(req.params.id);
      if (!updated) return res.status(404).json({ error: "Pedido não encontrado" });
      
      await storage.createNotification({
        userId: null,
        type: "error",
        message: `❌ Pedido ${updated.orderCode} foi cancelado`,
        metadata: { orderId: updated.id }
      });

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "CANCEL_ORDER",
        entityType: "order",
        entityId: updated.id,
        details: { orderCode: updated.orderCode }
      });

      res.json(updated);
    } catch (error) {
      console.error("Cancel order error:", error);
      res.status(500).json({ error: "Erro ao cancelar pedido" });
    }
  });

  app.patch("/api/orders/:id/reopen", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const isAdmin = req.session.role === 'admin';
      
      // Se não é admin, verificar limite de 5 reabertas/dia
      if (!isAdmin) {
        const today = new Date().toISOString().split('T')[0];
        const reopensToday = await storage.getReopensToday(req.session.userId!, today);
        
        if (reopensToday >= 5) {
          return res.status(403).json({ 
            error: "Limite de reabertas atingido",
            message: "Você atingiu o limite de 5 reabertas por dia. Apenas admins podem reabrir sem limites."
          });
        }
      }

      const updated = await storage.reopenOrder(req.params.id);
      if (!updated) return res.status(404).json({ error: "Pedido não encontrado" });
      
      // Registrar reabertura
      const today = new Date().toISOString().split('T')[0];
      await storage.trackReopen({
        orderId: req.params.id,
        userId: req.session.userId!,
        date: today
      });

      await storage.createNotification({
        userId: null,
        type: "info",
        message: `🔄 Pedido ${updated.orderCode} foi reaberto para aprovação`,
        metadata: { orderId: updated.id }
      });

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "REOPEN_ORDER",
        entityType: "order",
        entityId: updated.id,
        details: { orderCode: updated.orderCode }
      });

      res.json(updated);
    } catch (error) {
      console.error("Reopen order error:", error);
      res.status(500).json({ error: "Erro ao reabrir pedido" });
    }
  });

  // ==================== ADMIN ROUTES (Sistema) ====================
  
  // Verifica se banco está vazio (para setup initial)
  app.get("/api/admin/check-empty", async (_req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json({ isEmpty: users.length === 0 });
    } catch (error) {
      res.json({ isEmpty: false }); // Assume not empty on error
    }
  });
  
  // Rota para forçar inicialização do banco (apenas em produção, sem autenticação para permitir setup inicial)
  app.post("/api/admin/force-seed", async (req: Request, res: Response) => {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Verificar se há usuários no banco
      const users = await storage.getAllUsers();
      
      if (users.length > 0) {
        return res.status(400).json({ 
          error: "Banco de dados já contém usuários",
          message: "Para segurança, esta operação só pode ser executada em um banco vazio. Use a interface de administração para gerenciar usuários.",
          userCount: users.length
        });
      }

      console.log(`🔧 ADMIN: Forçando inicialização do banco (${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'})...`);
      
      await seedDatabase();
      
      res.json({ 
        success: true,
        message: "Banco de dados inicializado com sucesso! Você pode fazer login com: admin/senha123"
      });
    } catch (error) {
      console.error("Force seed error:", error);
      res.status(500).json({ 
        error: "Erro ao inicializar banco de dados",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ==================== NETWORK ROUTES ====================

  app.get("/api/network/local-access", (req: Request, res: Response) => {
    try {
      const port = parseInt(String(process.env.PORT || req.get('host')?.split(':')[1] || 9001), 10);
      const protocol = (process.env.HTTPS === "1" || process.env.HTTPS === "true") ? "https" : (req.protocol || "http");
      const ips: string[] = [];
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          const isIPv4 = net.family === 'IPv4' || (net as { family?: number }).family === 4;
          if (isIPv4 && !net.internal) ips.push(net.address);
        }
      }
      const baseUrl = ips.length > 0 ? `${protocol}://${ips[0]}:${port}` : null;
      res.json({ baseUrl, ips, port });
    } catch (error) {
      console.error("Network local-access error:", error);
      res.status(500).json({ error: "Erro ao obter IP" });
    }
  });

  // ==================== SCANNER ROUTES ====================

  app.post("/api/scanner/start", requireAuth, (req: Request, res: Response) => {
    try {
      const ua = (req.headers['user-agent'] as string) || '';
      const { token } = createScannerToken(req.session.userId!, req.session.name || req.session.username || '', ua);
      const port = parseInt(String(process.env.PORT || req.get('host')?.split(':')[1] || 9001), 10);
      const protocol = (process.env.HTTPS === "1" || process.env.HTTPS === "true") ? "https" : (req.protocol || "http");
      const origin = req.get('origin') || req.get('referer')?.replace(/\/[^/]*$/, '') || `${protocol}://${req.get('host')}`;
      let baseUrl = origin;
      const nets = os.networkInterfaces();
      outer: for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          const isIPv4 = net.family === 'IPv4' || (net as { family?: number }).family === 4;
          if (isIPv4 && !net.internal) {
            baseUrl = `${protocol}://${net.address}:${port}`;
            break outer;
          }
        }
      }
      const url = `${baseUrl}/scanner/${token}`;
      res.json({ token, url });
    } catch (error) {
      console.error("Scanner start error:", error);
      res.status(500).json({ error: "Erro ao gerar link do scanner" });
    }
  });

  app.get("/api/scanner/poll/:token", requireAuth, (req: Request, res: Response) => {
    try {
      const barcodes = consumeBarcodes(req.params.token, req.session.userId!);
      res.json({ barcodes });
    } catch (error) {
      console.error("Scanner poll error:", error);
      res.status(500).json({ error: "Erro ao obter códigos" });
    }
  });

  app.post("/api/scanner/send", async (req: Request, res: Response) => {
    try {
      const { token, barcode } = req.body;
      const ua = (req.headers['user-agent'] as string) || '';
      if (!token || typeof barcode !== 'string' || !barcode.trim()) {
        return res.status(400).json({ error: "token e barcode são obrigatórios" });
      }
      const ok = pushBarcode(token, barcode.trim(), ua);
      if (!ok) return res.status(404).json({ error: "Link expirado ou inválido" });
      const product = await storage.getProductBySku(barcode.trim());
      res.json({ ok: true, product: product ? { name: product.name } : undefined });
    } catch (error) {
      console.error("Scanner send error:", error);
      res.status(500).json({ error: "Erro ao enviar código" });
    }
  });

  app.post("/api/scanner/ping", (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      const ua = (req.headers['user-agent'] as string) || '';
      if (!token) return res.status(400).json({ error: "token obrigatório" });
      const session = pingToken(token, ua);
      if (!session) return res.status(404).json({ error: "Link expirado ou inválido" });
      res.json({
        ok: true,
        expiresIn: Math.max(0, Math.floor((TOKEN_TTL_MS - (Date.now() - session.createdAt)) / 1000)),
        deviceType: session.deviceType,
      });
    } catch (error) {
      console.error("Scanner ping error:", error);
      res.status(500).json({ error: "Erro" });
    }
  });

  app.get("/api/scanner/sessions", requireAuth, (req: Request, res: Response) => {
    try {
      const sessions = listSessions(req.session.userId!);
      res.json(sessions);
    } catch (error) {
      console.error("Scanner sessions error:", error);
      res.status(500).json({ error: "Erro ao listar sessões" });
    }
  });

  app.post("/api/scanner/revoke/:token", requireAuth, (req: Request, res: Response) => {
    try {
      const ok = revokeToken(req.params.token, req.session.userId!);
      if (!ok) return res.status(404).json({ error: "Sessão não encontrada ou já expirada" });
      res.json({ ok: true });
    } catch (error) {
      console.error("Scanner revoke error:", error);
      res.status(500).json({ error: "Erro ao revogar" });
    }
  });

  app.post("/api/scanner/renew", requireAuth, (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "token obrigatório" });
      const result = renewToken(token, req.session.userId!, req.session.name || req.session.username || '');
      if (!result) return res.status(404).json({ error: "Sessão não encontrada ou já expirada" });
      const port = parseInt(String(process.env.PORT || req.get('host')?.split(':')[1] || 9001), 10);
      const protocol = (process.env.HTTPS === "1" || process.env.HTTPS === "true") ? "https" : (req.protocol || "http");
      const origin = req.get('origin') || req.get('referer')?.replace(/\/[^/]*$/, '') || `${protocol}://${req.get('host')}`;
      let baseUrl = origin;
      const nets = os.networkInterfaces();
      outer: for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          const isIPv4 = net.family === 'IPv4' || (net as { family?: number }).family === 4;
          if (isIPv4 && !net.internal) { baseUrl = `${protocol}://${net.address}:${port}`; break outer; }
        }
      }
      const url = `${baseUrl}/scanner/${result.token}`;
      res.json({ token: result.token, url });
    } catch (error) {
      console.error("Scanner renew error:", error);
      res.status(500).json({ error: "Erro ao renovar" });
    }
  });

  // ==================== END SCANNER ROUTES ====================

  // ==================== SNAPSHOT / ROLLBACK ROUTES ====================

  // List all snapshots (last 14 days)
  app.get("/api/snapshots", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const list = await storage.listSnapshots();
      res.json(list);
    } catch (error) {
      console.error("List snapshots error:", error);
      res.status(500).json({ error: "Erro ao listar snapshots" });
    }
  });

  // Create a manual snapshot
  app.post("/api/snapshots", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const label = req.body.label?.trim() || `Manual — ${new Date().toLocaleString('pt-MZ')}`;
      const snap = await storage.createSnapshot(label, 'manual');
      res.json(snap);
    } catch (error) {
      console.error("Create snapshot error:", error);
      res.status(500).json({ error: "Erro ao criar snapshot" });
    }
  });

  // Preview what a restore would change
  app.get("/api/snapshots/:id/preview", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const snap = await storage.getSnapshot(req.params.id);
      if (!snap) return res.status(404).json({ error: "Snapshot não encontrado" });

      const { products: snapProducts, categories: snapCategories } = snap.data as { products: any[]; categories: any[] };
      const currentProducts = await storage.getAllProducts();
      const currentCategories = await storage.getAllCategories();

      const productChanges = snapProducts.map((sp: any) => {
        const cur = currentProducts.find((p) => p.id === sp.id);
        if (!cur) return { id: sp.id, name: sp.name, status: 'recreate' as const, changes: {} };
        const changes: Record<string, { from: any; to: any }> = {};
        for (const field of ['name', 'price', 'costPrice', 'stock', 'minStock', 'unit', 'categoryId'] as const) {
          if (String(cur[field] ?? '') !== String(sp[field] ?? '')) {
            changes[field] = { from: cur[field], to: sp[field] };
          }
        }
        return { id: sp.id, name: sp.name, status: Object.keys(changes).length > 0 ? 'update' as const : 'unchanged' as const, changes };
      }).filter((p: any) => p.status !== 'unchanged');

      res.json({
        snapshot: { id: snap.id, label: snap.label, createdAt: snap.createdAt },
        productChanges,
        categoryCount: snapCategories.length,
        totalAffected: productChanges.length,
      });
    } catch (error) {
      console.error("Snapshot preview error:", error);
      res.status(500).json({ error: "Erro ao gerar pré-visualização" });
    }
  });

  // Restore from snapshot
  app.post("/api/snapshots/:id/restore", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const snap = await storage.getSnapshot(req.params.id);
      if (!snap) return res.status(404).json({ error: "Snapshot não encontrado" });

      // Save current state before restoring so the user can undo
      await storage.createSnapshot(`↩ Antes do restauro — ${snap.label}`, 'manual');

      const result = await storage.restoreSnapshot(req.params.id);

      // Log the restore action
      await storage.createAuditLog({
        userId: (req as any).user.id,
        action: "RESTORE_SNAPSHOT",
        entityType: "snapshot",
        entityId: snap.id,
        details: {
          snapshotLabel: snap.label,
          snapshotDate: snap.createdAt,
          ...result,
        },
      });

      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Restore snapshot error:", error);
      res.status(500).json({ error: "Erro ao restaurar snapshot" });
    }
  });

  // Rollback from audit logs — reconstruct product state at a given date
  app.get("/api/snapshots/audit-rollback/preview", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const targetDate = req.query.date as string; // YYYY-MM-DD
      if (!targetDate) return res.status(400).json({ error: "Parâmetro 'date' obrigatório" });

      const allLogs = await storage.getAllAuditLogs();
      const currentProducts = await storage.getAllProducts();

      // Find product update logs AFTER the target date, ordered newest first
      const targetTs = new Date(targetDate + 'T23:59:59Z').getTime();
      const relevantLogs = allLogs
        .filter((l) => l.action === 'UPDATE_PRODUCT' && new Date(l.createdAt).getTime() > targetTs)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // For each product, accumulate which fields would be reverted to their "de" value
      const revertMap: Record<string, { productName: string; revert: Record<string, any> }> = {};

      for (const log of relevantLogs) {
        if (!log.entityId) continue;
        const details = log.details as any;
        if (!details?.changes) continue;
        if (!revertMap[log.entityId]) {
          const cur = currentProducts.find((p) => p.id === log.entityId);
          revertMap[log.entityId] = { productName: details.productName || cur?.name || log.entityId, revert: {} };
        }
        for (const [field, diff] of Object.entries(details.changes as Record<string, { de: any; para: any }>)) {
          // Only set the revert value if we haven't already (we want the OLDEST "de" value)
          if (!(field in revertMap[log.entityId].revert)) {
            revertMap[log.entityId].revert[field] = diff.de;
          }
        }
      }

      const changes = Object.entries(revertMap).map(([id, { productName, revert }]) => ({
        id,
        productName,
        revert,
      }));

      res.json({ targetDate, changes, totalAffected: changes.length });
    } catch (error) {
      console.error("Audit rollback preview error:", error);
      res.status(500).json({ error: "Erro ao pré-visualizar reversão" });
    }
  });

  app.post("/api/snapshots/audit-rollback/apply", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const { targetDate } = req.body;
      if (!targetDate) return res.status(400).json({ error: "Parâmetro 'targetDate' obrigatório" });

      // Save current state before reverting so the user can undo
      await storage.createSnapshot(`↩ Antes da reversão para ${targetDate}`, 'manual');

      const allLogs = await storage.getAllAuditLogs();
      const currentProducts = await storage.getAllProducts();

      const targetTs = new Date(targetDate + 'T23:59:59Z').getTime();
      const relevantLogs = allLogs
        .filter((l) => l.action === 'UPDATE_PRODUCT' && new Date(l.createdAt).getTime() > targetTs)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const revertMap: Record<string, Record<string, any>> = {};
      for (const log of relevantLogs) {
        if (!log.entityId) continue;
        const details = log.details as any;
        if (!details?.changes) continue;
        if (!revertMap[log.entityId]) revertMap[log.entityId] = {};
        for (const [field, diff] of Object.entries(details.changes as Record<string, { de: any; para: any }>)) {
          if (!(field in revertMap[log.entityId])) {
            revertMap[log.entityId][field] = diff.de;
          }
        }
      }

      let applied = 0;
      for (const [productId, fields] of Object.entries(revertMap)) {
        const exists = currentProducts.find((p) => p.id === productId);
        if (!exists) continue;
        await storage.updateProduct(productId, fields);
        applied++;
      }

      await storage.createAuditLog({
        userId: (req as any).user.id,
        action: "AUDIT_ROLLBACK",
        entityType: "snapshot",
        entityId: null as any,
        details: { targetDate, productsReverted: applied },
      });

      res.json({ success: true, productsReverted: applied });
    } catch (error) {
      console.error("Audit rollback apply error:", error);
      res.status(500).json({ error: "Erro ao aplicar reversão" });
    }
  });

  // ==================== END SNAPSHOT ROUTES ====================

  const httpServer = createServer(app);

  return httpServer;
}
