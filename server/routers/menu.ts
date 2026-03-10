import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { menuCategories, menuItems } from "../../drizzle/schema";
import {
  getDefaultCategory,
  organizeItemsByCategory,
  validateMenuItem,
  validateMenuCategory,
  getMenuSummary,
  getCategoryStats,
} from "../utils/menuEngine";

export const menuRouter = router({
  createCategory: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        name: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const validation = validateMenuCategory(input.name);
      if (!validation.valid) {
        throw new Error(validation.errors.join(", "));
      }

      const id = nanoid();
      const now = new Date();

      await db.insert(menuCategories).values({
        id,
        cafeteriaId: input.cafeteriaId,
        name: input.name,
        displayOrder: 0,
        createdAt: now,
      });

      return {
        id,
        cafeteriaId: input.cafeteriaId,
        name: input.name,
        description: input.description,
        createdAt: now,
      };
    }),

  getCategories: protectedProcedure
    .input(z.object({ cafeteriaId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db
        .select()
        .from(menuCategories)
        .where(eq(menuCategories.cafeteriaId, input.cafeteriaId));

      return result.map((cat) => ({
        id: cat.id,
        cafeteriaId: cat.cafeteriaId,
        name: cat.name,
        displayOrder: cat.displayOrder || 0,
        createdAt: cat.createdAt,
      }));
    }),

  createMenuItem: protectedProcedure
    .input(
      z.object({
        cafeteriaId: z.string(),
        categoryId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        price: z.number().positive(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const validation = validateMenuItem(input.name, input.price, input.categoryId);
      if (!validation.valid) {
        throw new Error(validation.errors.join(", "));
      }

      const id = nanoid();
      const now = new Date();

      await db.insert(menuItems).values({
        id,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        price: String(input.price),
        available: true,
        createdAt: now,
      });

      return {
        id,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        price: input.price,
        available: true,
        createdAt: now,
      };
    }),

  getMenuItems: protectedProcedure
    .input(
      z.object({
        categoryId: z.string().optional(),
        cafeteriaId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [];
      if (input.categoryId) {
        conditions.push(eq(menuItems.categoryId, input.categoryId));
      }

      const result = await db
        .select()
        .from(menuItems)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return result.map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description,
        price: Number(item.price) || 0,
        available: item.available,
        createdAt: item.createdAt,
      }));
    }),

  updateItemAvailability: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        available: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(menuItems)
        .set({ available: input.available })
        .where(eq(menuItems.id, input.itemId));

      return {
        success: true,
        itemId: input.itemId,
        available: input.available,
      };
    }),

  getMenuSummary: protectedProcedure
    .input(z.object({ cafeteriaId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const categories = await db
        .select()
        .from(menuCategories)
        .where(eq(menuCategories.cafeteriaId, input.cafeteriaId));

      const items = await db.select().from(menuItems);

      const summary = getMenuSummary(items, categories);

      return {
        cafeteriaId: input.cafeteriaId,
        ...summary,
      };
    }),

  getCategoryWithItems: protectedProcedure
    .input(z.object({ categoryId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const categoryResult = await db
        .select()
        .from(menuCategories)
        .where(eq(menuCategories.id, input.categoryId));

      if (categoryResult.length === 0) {
        throw new Error("Category not found");
      }

      const category = categoryResult[0];
      const items = await db
        .select()
        .from(menuItems)
        .where(eq(menuItems.categoryId, input.categoryId));

      return {
        id: category.id,
        name: category.name,
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: Number(item.price) || 0,
          available: item.available,
        })),
      };
    }),

  deleteMenuItem: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(menuItems).where(eq(menuItems.id, input.itemId));

      return {
        success: true,
        itemId: input.itemId,
      };
    }),

  deleteCategory: protectedProcedure
    .input(z.object({ categoryId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(menuCategories)
        .where(eq(menuCategories.id, input.categoryId));

      return {
        success: true,
        categoryId: input.categoryId,
      };
    }),
});
