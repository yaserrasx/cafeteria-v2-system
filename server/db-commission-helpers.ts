
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import {
  marketers,
  commissionConfigs,
  rechargeRequests,
  commissionDistributions,
  freeOperationPeriods,
  marketerBalances,
} from "../drizzle/schema";
import {
  calculateCommissionDistributions,
} from "./utils/commissionEngine";
import {
  shouldGenerateCommissions,
} from "./utils/freeOperationEngine";
import { addPrecise, subtractPrecise, roundTo } from "./utils/precision";
import { nanoid } from "nanoid";

// Define a type for the transaction object
type Transaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export async function getMarketerHierarchy(
  db: Transaction | Awaited<ReturnType<typeof getDb>>,
  cafeteriaMarketerIdOrId: string
): Promise<Array<{ id: string; parentId: string | null; referenceCode: string }>> {
  if (!db) throw new Error("Database not available");

  const hierarchy: Array<{ id: string; parentId: string | null; referenceCode: string }> = [];
  let currentMarketerId: string | null = cafeteriaMarketerIdOrId;

  while (currentMarketerId) {
    const result = await db
      .select()
      .from(marketers)
      .where(eq(marketers.id, currentMarketerId))
      .limit(1);

    if (result.length === 0) break;

    const marketer = result[0];
    hierarchy.push({
      id: marketer.id,
      parentId: marketer.parentId,
      referenceCode: marketer.referenceCode || "",
    });

    currentMarketerId = marketer.parentId;
  }

  return hierarchy;
}

export async function getCommissionRatesForMarketers(
  db: Transaction | Awaited<ReturnType<typeof getDb>>,
  marketerIds: string[]
): Promise<Map<string, number>> {
  if (!db) throw new Error("Database not available");

  const rates = new Map<string, number>();

  for (const marketerId of marketerIds) {
    const result = await db
      .select()
      .from(commissionConfigs)
      .where(eq(commissionConfigs.marketerId, marketerId))
      .limit(1);

    if (result.length > 0) {
      rates.set(marketerId, Number(result[0].rate) || 0);
    } else {
      rates.set(marketerId, 0);
    }
  }

  return rates;
}

export async function isCafeteriaInFreePeriod(
  db: Transaction | Awaited<ReturnType<typeof getDb>>,
  cafeteriaId: string
): Promise<boolean> {
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const result = await db
    .select()
    .from(freeOperationPeriods)
    .where(
      and(
        eq(freeOperationPeriods.cafeteriaId, cafeteriaId),
        // This is a simplified check; in production, use proper date comparison
      )
    );

  return result.some((period) => now >= period.startDate && now <= period.endDate);
}

async function transitionCommissionsToAvailable(tx: Transaction, marketerId: string): Promise<void> {
    const pendingCommissions = await tx
        .select()
        .from(commissionDistributions)
        .where(
            and(
                eq(commissionDistributions.marketerId, marketerId),
                eq(commissionDistributions.status, "pending")
            )
        );

    const totalPending = pendingCommissions.reduce((sum, c) => addPrecise(sum, c.commissionAmount), 0);

    if (totalPending > 0) {
        for (const commission of pendingCommissions) {
            await tx
                .update(commissionDistributions)
                .set({ status: "available" })
                .where(eq(commissionDistributions.id, commission.id));
        }

        const balance = await tx.select().from(marketerBalances).where(eq(marketerBalances.marketerId, marketerId)).limit(1).then(res => res[0]);
        const newPending = subtractPrecise(balance?.pendingBalance ?? '0', totalPending);
        const newAvailable = addPrecise(balance?.availableBalance ?? '0', totalPending);

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

export async function processCommissionsForRecharge(
  tx: Transaction,
  rechargeRequestId: string,
  cafeteriaMarketerId: string,
  rechargeAmount: number,
  cafeteriaId: string
): Promise<void> {
  try {
    const inFreePeriod = await isCafeteriaInFreePeriod(tx, cafeteriaId);
    const shouldGenerate = shouldGenerateCommissions(inFreePeriod);

    if (!shouldGenerate) {
      await tx
        .update(rechargeRequests)
        .set({ commissionCalculated: true })
        .where(eq(rechargeRequests.id, rechargeRequestId));
      return;
    }

    const hierarchy = await getMarketerHierarchy(tx, cafeteriaMarketerId);

    if (hierarchy.length === 0) {
      throw new Error("No marketer hierarchy found for cafeteria");
    }

    const marketerIds = hierarchy.map((m) => m.id);
    const commissionRates = await getCommissionRatesForMarketers(tx, marketerIds);

    const distributions = calculateCommissionDistributions(
      rechargeAmount,
      hierarchy,
      commissionRates
    );

    for (const marketer of hierarchy) {
      await transitionCommissionsToAvailable(tx, marketer.id);
    }

    let totalNewCommissions = 0;
    for (const distribution of distributions) {
      await tx.insert(commissionDistributions).values({
        id: nanoid(),
        rechargeRequestId,
        marketerId: distribution.marketerId,
        level: distribution.level,
        commissionAmount: String(roundTo(distribution.commissionAmount)),
        status: "pending",
        createdAt: new Date(),
      });

      const balance = await tx.select().from(marketerBalances).where(eq(marketerBalances.marketerId, distribution.marketerId)).limit(1).then(res => res[0]);
      const newPending = addPrecise(balance?.pendingBalance ?? '0', distribution.commissionAmount);

      if(balance){
        await tx
            .update(marketerBalances)
            .set({
                pendingBalance: String(Math.max(0, newPending)),
                lastUpdated: new Date(),
            })
            .where(eq(marketerBalances.marketerId, distribution.marketerId));
      } else {
        await tx.insert(marketerBalances).values({
            id: nanoid(),
            marketerId: distribution.marketerId,
            pendingBalance: String(Math.max(0, newPending)),
            availableBalance: '0',
            totalWithdrawn: '0',
        });
      }

      totalNewCommissions = addPrecise(totalNewCommissions, distribution.commissionAmount);
    }

    await tx
      .update(rechargeRequests)
      .set({ commissionCalculated: true })
      .where(eq(rechargeRequests.id, rechargeRequestId));

    console.log(
      `[Commission Processing] Recharge ${rechargeRequestId}: Processed ${distributions.length} commission distributions, total: $${totalNewCommissions}`
    );
  } catch (error) {
    console.error(
      `[Commission Processing] Error processing commissions for recharge ${rechargeRequestId}:`,
      error
    );
    throw error;
  }
}
