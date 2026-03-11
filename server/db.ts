import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import {
  users,
  marketers,
  cafeterias,
  rechargeRequests,
  ledgerEntries,
  marketerBalances,
  commissionDistributions,
  withdrawalRequests,
  cafeteriaMarketerRelationships,
  freeOperationPeriods,
  sections,
  cafeteriaTables,
  cafeteriaStaff,
  staffSectionAssignments,
  staffCategoryAssignments,
  menuCategories,
  menuItems,
  orders,
  systemConfigs,
  type MarketerBalance,
  type CommissionDistribution,
  type FreeOperationPeriod,
  type Cafeteria,
  type Marketer,
  type WithdrawalRequest,
  type InsertWithdrawalRequest,
  type User,
  type InsertUser,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { addPrecise, subtractPrecise, roundTo } from "./utils/precision";
import { generateUniqueReferenceCode } from "./utils/referenceCodeGenerator";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: pg.Pool | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes("supabase") ? { rejectUnauthorized: false } : false,
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser) {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[Database] Cannot upsert user: database not available");
      return;
    }

    const values: any = {
      openId: user.openId,
      updatedAt: new Date(),
    };

    const textFields = ["name", "email", "loginMethod", "preferredLanguage"] as const;
    
    textFields.forEach((field) => {
      const value = (user as any)[field];
      if (value !== undefined) {
        values[field] = value ?? null;
      }
    });

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
    }
    
    if (user.role !== undefined) {
      values.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    // PostgreSQL specific upsert
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: values,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrCreateMarketerBalance(marketerId: string): Promise<MarketerBalance> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select()
    .from(marketerBalances)
    .where(eq(marketerBalances.marketerId, marketerId))
    .limit(1);
  if (existing.length > 0) {
    return existing[0];
  }
  const { nanoid } = await import("nanoid");
  const id = nanoid();
  await db.insert(marketerBalances).values({
    id,
    marketerId,
    pendingBalance: "0",
    availableBalance: "0",
    totalWithdrawn: "0",
  });
  return {
    id,
    marketerId,
    pendingBalance: "0",
    availableBalance: "0",
    totalWithdrawn: "0",
    lastUpdated: new Date(),
  } as MarketerBalance;
}

export async function getMarketerBalance(marketerId: string): Promise<MarketerBalance | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .select()
    .from(marketerBalances)
    .where(eq(marketerBalances.marketerId, marketerId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function transitionCommissionsToAvailable(marketerId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    const pendingCommissions = await tx
      .select()
      .from(commissionDistributions)
      .where(
        and(
          eq(commissionDistributions.marketerId, marketerId),
          eq(commissionDistributions.status, "pending")
        )
      );
    
    if (pendingCommissions.length === 0) {
      return;
    }
    const totalPending = pendingCommissions.reduce((sum, c) => addPrecise(sum, Number(c.commissionAmount)), 0);
    if (totalPending > 0) {
      await tx
        .update(commissionDistributions)
        .set({ status: "available" })
        .where(and(eq(commissionDistributions.marketerId, marketerId), eq(commissionDistributions.status, "pending")));
      
      const balance = await tx.select().from(marketerBalances).where(eq(marketerBalances.marketerId, marketerId)).limit(1).then(res => res[0]);
      
      if (!balance) {
        const { nanoid } = await import("nanoid");
        const id = nanoid();
        await tx.insert(marketerBalances).values({
          id,
          marketerId,
          pendingBalance: '0',
          availableBalance: String(totalPending),
          totalWithdrawn: '0',
          lastUpdated: new Date(),
        });
      } else {
        const newPending = subtractPrecise(Number(balance.pendingBalance), totalPending);
        const newAvailable = addPrecise(Number(balance.availableBalance), totalPending);
        await tx
          .update(marketerBalances)
          .set({
            pendingBalance: String(Math.max(0, newPending)),
            availableBalance: String(newAvailable),
            lastUpdated: new Date(),
          })
          .where(eq(marketerBalances.marketerId, marketerId));
      }
    }
  });
}

export async function createWithdrawalRequest(
  marketerId: string,
  amount: number
): Promise<WithdrawalRequest> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const balance = await getMarketerBalance(marketerId);
  if (!balance || Number(balance.availableBalance) < amount) {
    throw new Error("Insufficient available balance");
  }
  const { nanoid } = await import("nanoid");
  const id = nanoid();
  const now = new Date();
  await db.insert(withdrawalRequests).values({
    id,
    marketerId,
    amount: String(amount),
    status: "pending",
    requestedAt: now,
  });
  return {
    id,
    marketerId,
    amount: String(amount),
    status: "pending" as const,
    requestedAt: now,
  } as WithdrawalRequest;
}
