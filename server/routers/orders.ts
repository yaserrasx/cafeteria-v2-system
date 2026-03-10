import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import {
  orders,
  orderItems,
  cafeterias,
  shiftSales,
  ledgerEntries,
  cafeteriaTables,
} from "../../drizzle/schema";
import { logger } from "../utils/logger";
import { asc } from "drizzle-orm";
import {
  calculateBillTotal,
  convertBillToPoints,
  calculateOrderSummary,
  validateOrderForClosure,
  calculatePointsDeduction,
  canTransitionItemStatus,
  calculateOrderCompletion,
} from "../utils/orderEngine";

export const ordersRouter = router({
  createOrder: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        tableId: z.string().optional(),
        waiterId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const id = nanoid();
      const now = new Date();

      await db.insert(orders).values({
        id,
        cafeteriaId: input.cafeteriaId,
        tableId: input.tableId,
        waiterId: input.waiterId,
        status: "open",
        totalAmount: "0",
        pointsConsumed: "0",
        createdAt: now,
      });

      return {
        id,
        status: "open",
        createdAt: now,
      };
    }),

  addItem: protectedProcedure
    .input(
      z.object({
        orderId: z.string(),
        menuItemId: z.string(),
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const id = nanoid();
      const totalPrice = input.quantity * input.unitPrice;

      await db.insert(orderItems).values({
        id,
        orderId: input.orderId,
        menuItemId: input.menuItemId,
        quantity: input.quantity,
        unitPrice: String(input.unitPrice),
        totalPrice: String(totalPrice),
        status: "pending",
        notes: input.notes,
        createdAt: new Date(),
      });

      return {
        id,
        status: "pending",
        totalPrice,
      };
    }),

  getOrder: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const orderResult = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId));

      if (orderResult.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderResult[0];
      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, input.orderId));

      return {
        id: order.id,
        cafeteriaId: order.cafeteriaId,
        tableId: order.tableId,
        waiterId: order.waiterId,
        totalAmount: Number(order.totalAmount) || 0,
        status: order.status,
        pointsConsumed: Number(order.pointsConsumed) || 0,
        items: items.map((item) => ({
          id: item.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice) || 0,
          totalPrice: Number(item.totalPrice) || 0,
          status: item.status,
          notes: item.notes,
        })),
        createdAt: order.createdAt,
        closedAt: order.closedAt,
      };
    }),

  sendToKitchen: protectedProcedure
    .input(z.object({ orderItemId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const now = new Date();

      await db
        .update(orderItems)
        .set({
          status: "sent_to_kitchen",
          sentToKitchenAt: now,
        })
        .where(eq(orderItems.id, input.orderItemId));

      return {
        success: true,
        itemId: input.orderItemId,
        status: "sent_to_kitchen",
      };
    }),

  updateItemStatus: protectedProcedure
    .input(
      z.object({
        orderItemId: z.string(),
        newStatus: z.enum(["in_preparation", "ready", "served", "cancelled"]),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const itemResult = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.id, input.orderItemId));

        if (itemResult.length === 0) {
          throw new Error("Order item not found");
        }

        const item = itemResult[0];

        if (!canTransitionItemStatus(item.status || "pending", input.newStatus)) {
          logger.warn("INVALID_STATUS_TRANSITION", `Attempted invalid transition from ${item.status} to ${input.newStatus}`, { itemId: input.orderItemId });
          throw new Error(
            `Cannot transition from ${item.status} to ${input.newStatus}`
          );
        }

        const updateData: Record<string, any> = { status: input.newStatus };

        if (input.newStatus === "ready") {
          updateData.readyAt = new Date();
        } else if (input.newStatus === "served") {
          updateData.servedAt = new Date();
        }

        await db
          .update(orderItems)
          .set(updateData)
          .where(eq(orderItems.id, input.orderItemId));

        // TASK 2 — Logging: order accepted, ready, served
        if (input.newStatus === "in_preparation") {
          logger.info("ORDER_ACCEPTED", `Chef started preparing item ${input.orderItemId}`, { itemId: input.orderItemId });
        } else if (input.newStatus === "ready") {
          logger.info("ORDER_READY", `Item ${input.orderItemId} is ready for service`, { itemId: input.orderItemId });
        } else if (input.newStatus === "served") {
          logger.info("ORDER_SERVED", `Item ${input.orderItemId} has been served`, { itemId: input.orderItemId });
        }

        return {
          success: true,
          itemId: input.orderItemId,
          newStatus: input.newStatus,
        };
      } catch (error: any) {
        logger.error("ORDER_UPDATE_ERROR", error.message, { input });
        throw new Error(  getKitchenOrders: protectedProcedure
    .input(z.object({ chefId: z.string(), cafeteriaId: z.string() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // TASK 4 — Kitchen Queue Optimization: Sort by oldest first (waiting longest)
        const items = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.status, "sent_to_kitchen"))
          .orderBy(asc(orderItems.sentToKitchenAt));

        return items.map((item) => ({
          id: item.id,
          orderId: item.orderId,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice) || 0,
          totalPrice: Number(item.totalPrice) || 0,
          status: item.status,
          notes: item.notes,
          sentToKitchenAt: item.sentToKitchenAt,
        }));
      } catch (error: any) {
        logger.error("DATABASE_TIMEOUT", "Failed to fetch kitchen orders", { error: error.message });
        throw new Error("Kitchen queue is temporarily unavailable. Please refresh.");
      }
    }),edure
    .input(
      z.object({
        orderId: z.string(),
        exchangeRate: z.number().positive(),
        shiftId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const orderResult = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId));

      if (orderResult.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderResult[0];
      const totalAmount = Number(order.totalAmount) || 0;

      const cafeteriaResult = await db
        .select()
        .from(cafeterias)
        .where(eq(cafeterias.id, order.cafeteriaId));

      if (cafeteriaResult.length === 0) {
        throw new Error("Cafeteria not found");
      }

      const cafeteria = cafeteriaResult[0];
      const currentBalance = Number(cafeteria.pointsBalance) || 0;

      const pointsDeduction = convertBillToPoints(totalAmount, input.exchangeRate);

      if (currentBalance < pointsDeduction) {
        throw new Error("Insufficient points balance");
      }

      const newBalance = currentBalance - pointsDeduction;
      const now = new Date();

      await db
        .update(orders)
        .set({
          status: "closed",
          pointsConsumed: String(pointsDeduction),
          closedAt: now,
        })
        .where(eq(orders.id, input.orderId));

      await db
        .update(cafeterias)
        .set({ pointsBalance: String(newBalance) })
        .where(eq(cafeterias.id, order.cafeteriaId));

      await db.insert(ledgerEntries).values({
        id: nanoid(),
        type: "order_closed",
        ledgerType: "points_deduction",
        description: `Order ${input.orderId} closed: ${pointsDeduction} points deducted`,
        cafeteriaId: order.cafeteriaId,
        amount: String(pointsDeduction),
        refId: input.orderId,
        createdAt: now,
      });

      if (input.shiftId) {
        await db.insert(shiftSales).values({
          id: nanoid(),
          shiftId: input.shiftId,
          orderId: input.orderId,
          amount: String(totalAmount),
          pointsDeducted: String(pointsDeduction),
          createdAt: now,
        });
      }

      // Table Status Automation: When order is closed, check if table should be available
      if (order.tableId) {
        // Safety Check 3: Ensure table cannot be closed if active orders exist
        const otherOpenOrders = await db
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.tableId, order.tableId),
              eq(orders.status, "open")
            )
          );

        if (otherOpenOrders.length === 0) {
          await db
            .update(cafeteriaTables)
            .set({ status: "available" })
            .where(eq(cafeteriaTables.id, order.tableId));
        }
      }

      return {
        success: true,
        orderId: input.orderId,
        totalAmount,
        pointsDeducted: pointsDeduction,
        newBalance,
      };
    }),

  getOrders: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        status: z.enum(["open", "closed"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [eq(orders.cafeteriaId, input.cafeteriaId)];
      if (input.status) {
        conditions.push(eq(orders.status, input.status));
      }

      const result = await db
        .select()
        .from(orders)
        .where(and(...conditions));

      return result.map((order) => ({
        id: order.id,
        tableId: order.tableId,
        waiterId: order.waiterId,
        totalAmount: Number(order.totalAmount) || 0,
        status: order.status,
        pointsConsumed: Number(order.pointsConsumed) || 0,
        createdAt: order.createdAt,
        closedAt: order.closedAt,
      }));
    }),

  getOrderCompletion: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, input.orderId));

      const completion = calculateOrderCompletion(items);

      return {
        orderId: input.orderId,
        ...completion,
      };
    }),

  getWaiterOrders: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        waiterId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [
        eq(orders.cafeteriaId, input.cafeteriaId),
        eq(orders.status, "open"),
      ];

      if (input.waiterId) {
        conditions.push(eq(orders.waiterId, input.waiterId));
      }

      const result = await db
        .select()
        .from(orders)
        .where(and(...conditions));

      const ordersWithItems = await Promise.all(
        result.map(async (order) => {
          const items = await db
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, order.id));

          return {
            id: order.id,
            tableId: order.tableId,
            waiterId: order.waiterId,
            totalAmount: Number(order.totalAmount) || 0,
            status: order.status,
            source: order.source,
            items: items.map((item) => ({
              id: item.id,
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              status: item.status,
              notes: item.notes,
            })),
            createdAt: order.createdAt,
          };
        })
      );

      return ordersWithItems;
    }),

  getChefOrders: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.status, "sent_to_kitchen"));

      const ordersInCafeteria = await db
        .select()
        .from(orders)
        .where(eq(orders.cafeteriaId, input.cafeteriaId));

      const cafeteriaOrderIds = ordersInCafeteria.map((o) => o.id);

      const chefItems = items.filter((item) =>
        cafeteriaOrderIds.includes(item.orderId)
      );

      const itemsWithOrderDetails = await Promise.all(
        chefItems.map(async (item) => {
          const order = ordersInCafeteria.find((o) => o.id === item.orderId);
          return {
            id: item.id,
            orderId: item.orderId,
            tableId: order?.tableId,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            status: item.status,
            notes: item.notes,
            sentToKitchenAt: item.sentToKitchenAt,
          };
        })
      );

      return itemsWithOrderDetails;
    }),
});
