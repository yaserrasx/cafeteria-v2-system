
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import {
  withdrawalRequests,
  marketerBalances,
  ledgerEntries,
} from "../../drizzle/schema";
import { addPrecise, subtractPrecise } from "../utils/precision";

export const withdrawalsRouter = router({
  /**
   * Approve a withdrawal request
   */
  approveRequest: protectedProcedure
    .input(
      z.object({
        withdrawalRequestId: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      return await db.transaction(async (tx) => {
        const requests = await tx
          .select()
          .from(withdrawalRequests)
          .where(eq(withdrawalRequests.id, input.withdrawalRequestId))
          .for("update");

        if (requests.length === 0) {
          throw new Error("Withdrawal request not found");
        }

        const request = requests[0];

        if (request.status !== "pending") {
          throw new Error(`Withdrawal request has already been processed (status: ${request.status})`);
        }

        const amount = Number(request.amount) || 0;

        const balance = await tx.select().from(marketerBalances).where(eq(marketerBalances.marketerId, request.marketerId)).for("update").then(res => res[0]);

        if (!balance || Number(balance.availableBalance) < amount) {
          await tx.update(withdrawalRequests).set({ status: "rejected", notes: "Insufficient balance at time of approval" }).where(eq(withdrawalRequests.id, input.withdrawalRequestId));
          throw new Error("Insufficient available balance");
        }

        const now = new Date();
        await tx
          .update(withdrawalRequests)
          .set({
            status: "approved",
            processedAt: now,
            processedBy: ctx.user?.name || "admin",
            notes: input.notes,
          })
          .where(eq(withdrawalRequests.id, input.withdrawalRequestId));

        const newAvailable = subtractPrecise(balance.availableBalance, amount);
        const newTotalWithdrawn = addPrecise(balance.totalWithdrawn, amount);

        await tx
          .update(marketerBalances)
          .set({
            availableBalance: String(Math.max(0, newAvailable)),
            totalWithdrawn: String(newTotalWithdrawn),
            lastUpdated: now,
          })
          .where(eq(marketerBalances.marketerId, request.marketerId));

        await tx.insert(ledgerEntries).values({
          id: nanoid(),
          type: "withdrawal_approved",
          ledgerType: "commission_withdrawn",
          description: `Withdrawal approved: ${amount}`,
          marketerId: request.marketerId,
          amount: String(amount),
          refId: input.withdrawalRequestId,
          createdAt: now,
        });

        return {
          success: true,
          withdrawalRequestId: input.withdrawalRequestId,
        };
      });
    }),

  /**
   * Reject a withdrawal request
   */
  rejectRequest: protectedProcedure
    .input(
      z.object({
        withdrawalRequestId: z.string(),
        reason: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(withdrawalRequests)
        .set({
          status: "rejected",
          processedAt: new Date(),
          processedBy: ctx.user?.name || "admin",
          notes: input.reason,
        })
        .where(eq(withdrawalRequests.id, input.withdrawalRequestId));

      return {
        success: true,
        withdrawalRequestId: input.withdrawalRequestId,
      };
    }),
});
