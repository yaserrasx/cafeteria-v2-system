import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  numeric,
  boolean,
  index,
  json,
} from "drizzle-orm/pg-core";

/**
 * CAFETERIA V2 - Complete Database Schema (PostgreSQL)
 * 18 tables for multi-role cafeteria points management system with recharge-based commissions
 */

// ============================================================================
// ENUMS
// ============================================================================
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const statusEnum = pgEnum("status", ["pending", "approved", "rejected"]);
export const distributionStatusEnum = pgEnum("distribution_status", ["pending", "available", "withdrawn"]);
export const periodTypeEnum = pgEnum("period_type", ["global_first_time", "special_grant"]);
export const staffRoleEnum = pgEnum("staff_role", ["manager", "waiter", "chef", "cashier"]);
export const tableStatusEnum = pgEnum("table_status", ["available", "occupied", "reserved", "maintenance"]);
export const orderStatusEnum = pgEnum("order_status", ["open", "closed", "cancelled"]);
export const orderItemStatusEnum = pgEnum("order_item_status", ["pending", "sent_to_kitchen", "ready", "served", "cancelled"]);
export const shiftStatusEnum = pgEnum("shift_status", ["active", "completed", "cancelled"]);
export const reportTypeEnum = pgEnum("report_type", ["daily", "weekly", "monthly"]);

// ============================================================================
// 1. USERS TABLE - Authentication & Authorization
// ============================================================================
export const users = pgTable(
  "users",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: roleEnum("role").default("user").notNull(),
    preferredLanguage: varchar("preferred_language", { length: 10 }).default("en"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  (table) => ({
    idxOpenId: index("idx_openId").on(table.openId),
    idxRole: index("idx_role").on(table.role),
    idxCreatedAt: index("idx_createdAt").on(table.createdAt),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// 2. MARKETERS TABLE - Hierarchical Marketer Management
// ============================================================================
export const marketers = pgTable(
  "marketers",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }),
    parentId: varchar("parentId", { length: 36 }),
    isRoot: boolean("isRoot").default(false),
    referenceCode: varchar("referenceCode", { length: 50 }).unique(),
    country: varchar("country", { length: 2 }),
    currency: varchar("currency", { length: 3 }),
    currencyOverrideBy: varchar("currencyOverrideBy", { length: 36 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxParentId: index("idx_parentId").on(table.parentId),
    idxReferenceCode: index("idx_referenceCode").on(table.referenceCode),
    idxCreatedAt: index("idx_createdAt").on(table.createdAt),
  })
);

export type Marketer = typeof marketers.$inferSelect;
export type InsertMarketer = typeof marketers.$inferInsert;

// ============================================================================
// 3. CAFETERIAS TABLE - Cafeteria Management with Points & Grace Mode
// ============================================================================
export const cafeterias = pgTable(
  "cafeterias",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    marketerId: varchar("marketerId", { length: 36 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    location: varchar("location", { length: 255 }),
    pointsBalance: numeric("pointsBalance", { precision: 10, scale: 2 }).default("0"),
    graceMode: boolean("graceMode").default(false),
    referenceCode: varchar("referenceCode", { length: 50 }).unique(),
    country: varchar("country", { length: 2 }),
    currency: varchar("currency", { length: 3 }),
    currencyOverrideBy: varchar("currencyOverrideBy", { length: 36 }),
    freeOperationEndDate: timestamp("freeOperationEndDate"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxMarketerId: index("idx_marketerId").on(table.marketerId),
    idxReferenceCode: index("idx_referenceCode").on(table.referenceCode),
    idxCreatedAt: index("idx_createdAt").on(table.createdAt),
  })
);

export type Cafeteria = typeof cafeterias.$inferSelect;
export type InsertCafeteria = typeof cafeterias.$inferInsert;

// ============================================================================
// 4. COMMISSION CONFIGS TABLE - Commission Settings
// ============================================================================
export const commissionConfigs = pgTable(
  "commissionConfigs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    marketerId: varchar("marketerId", { length: 36 }).notNull(),
    rate: numeric("rate", { precision: 5, scale: 2 }).default("0"),
    expiryOverrideMonths: integer("expiryOverrideMonths"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxMarketerId: index("idx_marketerId").on(table.marketerId),
  })
);

export type CommissionConfig = typeof commissionConfigs.$inferSelect;
export type InsertCommissionConfig = typeof commissionConfigs.$inferInsert;

// ============================================================================
// 5. RECHARGE REQUESTS TABLE - Recharge Workflow with Image Storage
// ============================================================================
export const rechargeRequests = pgTable(
  "rechargeRequests",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    imageUrl: text("imageUrl"),
    status: statusEnum("status").default("pending"),
    processedAt: timestamp("processedAt"),
    processedBy: varchar("processedBy", { length: 255 }),
    notes: text("notes"),
    commissionCalculated: boolean("commissionCalculated").default(false),
    commissionDistributionId: varchar("commissionDistributionId", { length: 36 }),
    pointsAddedToBalance: numeric("pointsAddedToBalance", { precision: 10, scale: 2 }).default("0"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCafeteriaId: index("idx_cafeteriaId").on(table.cafeteriaId),
    idxStatus: index("idx_status").on(table.status),
    idxCreatedAt: index("idx_createdAt").on(table.createdAt),
  })
);

export type RechargeRequest = typeof rechargeRequests.$inferSelect;
export type InsertRechargeRequest = typeof rechargeRequests.$inferInsert;

// ============================================================================
// 6. MARKETER BALANCES TABLE - Track Pending/Available Commissions
// ============================================================================
export const marketerBalances = pgTable(
  "marketerBalances",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    marketerId: varchar("marketerId", { length: 36 }).notNull().unique(),
    pendingBalance: numeric("pendingBalance", { precision: 15, scale: 2 }).default("0"),
    availableBalance: numeric("availableBalance", { precision: 15, scale: 2 }).default("0"),
    totalWithdrawn: numeric("totalWithdrawn", { precision: 15, scale: 2 }).default("0"),
    lastUpdated: timestamp("lastUpdated").defaultNow().notNull(),
  },
  (table) => ({
    idxMarketerId: index("idx_marketerId").on(table.marketerId),
  })
);

export type MarketerBalance = typeof marketerBalances.$inferSelect;
export type InsertMarketerBalance = typeof marketerBalances.$inferInsert;

// ============================================================================
// 7. COMMISSION DISTRIBUTIONS TABLE - Track Commission Distribution per Recharge
// ============================================================================
export const commissionDistributions = pgTable(
  "commissionDistributions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    rechargeRequestId: varchar("rechargeRequestId", { length: 36 }).notNull(),
    marketerId: varchar("marketerId", { length: 36 }).notNull(),
    level: integer("level").notNull(),
    commissionAmount: numeric("commissionAmount", { precision: 15, scale: 2 }).notNull(),
    status: distributionStatusEnum("status").default("pending"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxRechargeRequestId: index("idx_rechargeRequestId").on(table.rechargeRequestId),
    idxMarketerId: index("idx_marketerId").on(table.marketerId),
    idxStatus: index("idx_status").on(table.status),
  })
);

export type CommissionDistribution = typeof commissionDistributions.$inferSelect;
export type InsertCommissionDistribution = typeof commissionDistributions.$inferInsert;

// ============================================================================
// 8. CAFETERIA MARKETER RELATIONSHIPS TABLE - Track Commission Lifetime
// ============================================================================
export const cafeteriaMarketerRelationships = pgTable(
  "cafeteriaMarketerRelationships",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    marketerId: varchar("marketerId", { length: 36 }).notNull(),
    commissionStartDate: timestamp("commissionStartDate").defaultNow().notNull(),
    commissionExpiryDate: timestamp("commissionExpiryDate").notNull(),
    isExpired: boolean("isExpired").default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCafeteriaId: index("idx_cafeteriaId").on(table.cafeteriaId),
    idxMarketerId: index("idx_marketerId").on(table.marketerId),
    idxExpiryDate: index("idx_expiryDate").on(table.commissionExpiryDate),
    uniqueCafeteriaMarketer: index("unique_cafeteria_marketer").on(
      table.cafeteriaId,
      table.marketerId
    ),
  })
);

export type CafeteriaMarketerRelationship = typeof cafeteriaMarketerRelationships.$inferSelect;
export type InsertCafeteriaMarketerRelationship = typeof cafeteriaMarketerRelationships.$inferInsert;

// ============================================================================
// 9. FREE OPERATION PERIODS TABLE - Track Free Operation Periods
// ============================================================================
export const freeOperationPeriods = pgTable(
  "freeOperationPeriods",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    periodType: periodTypeEnum("periodType").notNull(),
    startDate: timestamp("startDate").notNull(),
    endDate: timestamp("endDate").notNull(),
    reason: text("reason"),
    createdBy: varchar("createdBy", { length: 36 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCafeteriaId: index("idx_cafeteriaId").on(table.cafeteriaId),
  })
);

export type FreeOperationPeriod = typeof freeOperationPeriods.$inferSelect;
export type InsertFreeOperationPeriod = typeof freeOperationPeriods.$inferInsert;

// ============================================================================
// 10. SYSTEM CONFIGS TABLE - Global System Settings
// ============================================================================
export const systemConfigs = pgTable(
  "systemConfigs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    key: varchar("key", { length: 50 }).notNull().unique(),
    value: text("value").notNull(),
    description: text("description"),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  }
);

export type SystemConfig = typeof systemConfigs.$inferSelect;
export type InsertSystemConfig = typeof systemConfigs.$inferInsert;

// ============================================================================
// 11. LEDGER ENTRIES TABLE - Audit Trail for All Points Movements
// ============================================================================
export const ledgerEntries = pgTable(
  "ledgerEntries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(), // 'recharge', 'order_deduction', 'manual_adjustment'
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    balanceBefore: numeric("balanceBefore", { precision: 15, scale: 2 }).notNull(),
    balanceAfter: numeric("balanceAfter", { precision: 15, scale: 2 }).notNull(),
    referenceId: varchar("referenceId", { length: 36 }),
    description: text("description"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCafeteriaId: index("idx_cafeteriaId").on(table.cafeteriaId),
    idxCreatedAt: index("idx_createdAt").on(table.createdAt),
  })
);

export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type InsertLedgerEntry = typeof ledgerEntries.$inferInsert;

// ============================================================================
// 12. SECTIONS TABLE - Cafeteria Sections
// ============================================================================
export const sections = pgTable(
  "sections",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCafeteriaId: index("idx_cafeteriaId").on(table.cafeteriaId),
  })
);

export type Section = typeof sections.$inferSelect;
export type InsertSection = typeof sections.$inferInsert;

// ============================================================================
// 13. CAFETERIA TABLES TABLE - Physical Tables with QR Tokens
// ============================================================================
export const cafeteriaTables = pgTable(
  "cafeteriaTables",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    sectionId: varchar("sectionId", { length: 36 }).notNull(),
    tableNumber: varchar("tableNumber", { length: 20 }).notNull(),
    capacity: integer("capacity").default(4),
    status: tableStatusEnum("status").default("available"),
    tableToken: varchar("tableToken", { length: 50 }).unique(),
    qrCodeUrl: text("qrCodeUrl"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCafeteriaId: index("idx_cafeteriaId").on(table.cafeteriaId),
    idxSectionId: index("idx_sectionId").on(table.sectionId),
    idxTableToken: index("idx_tableToken").on(table.tableToken),
  })
);

export type CafeteriaTable = typeof cafeteriaTables.$inferSelect;
export type InsertCafeteriaTable = typeof cafeteriaTables.$inferInsert;

// ============================================================================
// 14. CAFETERIA STAFF TABLE - Staff Management
// ============================================================================
export const cafeteriaStaff = pgTable(
  "cafeteriaStaff",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    openId: varchar("openId", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    role: staffRoleEnum("role").notNull(),
    isActive: boolean("isActive").default(true),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCafeteriaId: index("idx_cafeteriaId").on(table.cafeteriaId),
    idxOpenId: index("idx_staff_openId").on(table.openId),
  })
);

export type Staff = typeof cafeteriaStaff.$inferSelect;
export type InsertStaff = typeof cafeteriaStaff.$inferInsert;

// ============================================================================
// 15. STAFF SECTION ASSIGNMENTS TABLE - Waiter-to-Section Mapping
// ============================================================================
export const staffSectionAssignments = pgTable(
  "staffSectionAssignments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    staffId: varchar("staffId", { length: 36 }).notNull(),
    sectionId: varchar("sectionId", { length: 36 }).notNull(),
    assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  },
  (table) => ({
    idxStaffId: index("idx_staff_section_staffId").on(table.staffId),
    idxSectionId: index("idx_staff_section_sectionId").on(table.sectionId),
  })
);

// ============================================================================
// 16. STAFF CATEGORY ASSIGNMENTS TABLE - Chef-to-Category Mapping
// ============================================================================
export const staffCategoryAssignments = pgTable(
  "staffCategoryAssignments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    staffId: varchar("staffId", { length: 36 }).notNull(),
    categoryId: varchar("categoryId", { length: 36 }).notNull(),
    assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  },
  (table) => ({
    idxStaffId: index("idx_staff_category_staffId").on(table.staffId),
    idxCategoryId: index("idx_staff_category_categoryId").on(table.categoryId),
  })
);

// ============================================================================
// 17. MENU CATEGORIES TABLE - Food Categories
// ============================================================================
export const menuCategories = pgTable(
  "menuCategories",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    displayOrder: integer("displayOrder").default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCafeteriaId: index("idx_menu_category_cafeteriaId").on(table.cafeteriaId),
  })
);

export type MenuCategory = typeof menuCategories.$inferSelect;
export type InsertMenuCategory = typeof menuCategories.$inferInsert;

// ============================================================================
// 18. MENU ITEMS TABLE - Food & Drink Items
// ============================================================================
export const menuItems = pgTable(
  "menuItems",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    categoryId: varchar("categoryId", { length: 36 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    pointsCost: numeric("pointsCost", { precision: 10, scale: 2 }).notNull(),
    imageUrl: text("imageUrl"),
    isAvailable: boolean("isAvailable").default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCafeteriaId: index("idx_menu_item_cafeteriaId").on(table.cafeteriaId),
    idxCategoryId: index("idx_menu_item_categoryId").on(table.categoryId),
  })
);

export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = typeof menuItems.$inferInsert;

// ============================================================================
// 19. ORDERS TABLE - Customer Orders
// ============================================================================
export const orders = pgTable(
  "orders",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    tableId: varchar("tableId", { length: 36 }).notNull(),
    waiterId: varchar("waiterId", { length: 36 }),
    status: orderStatusEnum("status").default("open"),
    totalAmount: numeric("totalAmount", { precision: 10, scale: 2 }).default("0"),
    totalPoints: numeric("totalPoints", { precision: 10, scale: 2 }).default("0"),
    source: varchar("source", { length: 20 }).default("waiter"), // 'waiter' or 'customer'
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    closedAt: timestamp("closedAt"),
  },
  (table) => ({
    idxCafeteriaId: index("idx_order_cafeteriaId").on(table.cafeteriaId),
    idxTableId: index("idx_order_tableId").on(table.tableId),
    idxStatus: index("idx_order_status").on(table.status),
  })
);

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ============================================================================
// 20. ORDER ITEMS TABLE - Items within an Order
// ============================================================================
export const orderItems = pgTable(
  "orderItems",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("orderId", { length: 36 }).notNull(),
    menuItemId: varchar("menuItemId", { length: 36 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unitPrice", { precision: 10, scale: 2 }).notNull(),
    unitPoints: numeric("unitPoints", { precision: 10, scale: 2 }).notNull(),
    status: orderItemStatusEnum("status").default("pending"),
    sentToKitchenAt: timestamp("sentToKitchenAt"),
    readyAt: timestamp("readyAt"),
    servedAt: timestamp("servedAt"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxOrderId: index("idx_orderItem_orderId").on(table.orderId),
    idxMenuItemId: index("idx_orderItem_menuItemId").on(table.menuItemId),
    idxStatus: index("idx_orderItem_status").on(table.status),
  })
);

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// ============================================================================
// 21. SHIFTS TABLE - Staff Shift Tracking
// ============================================================================
export const shifts = pgTable(
  "shifts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    staffId: varchar("staffId", { length: 36 }).notNull(),
    startTime: timestamp("startTime").notNull(),
    endTime: timestamp("endTime"),
    status: shiftStatusEnum("status").default("active"),
    totalSales: numeric("totalSales", { precision: 15, scale: 2 }).default("0"),
    totalOrders: integer("totalOrders").default(0),
    totalItemsSold: integer("totalItemsSold").default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCafeteriaId: index("idx_shift_cafeteriaId").on(table.cafeteriaId),
    idxStaffId: index("idx_shift_staffId").on(table.staffId),
    idxStatus: index("idx_shift_status").on(table.status),
    idxStartTime: index("idx_shift_startTime").on(table.startTime),
  })
);

export type Shift = typeof shifts.$inferSelect;
export type InsertShift = typeof shifts.$inferInsert;

// ============================================================================
// 22. SHIFT SALES TABLE - Sales Tracking per Shift
// ============================================================================
export const shiftSales = pgTable(
  "shiftSales",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    shiftId: varchar("shiftId", { length: 36 }).notNull(),
    orderId: varchar("orderId", { length: 36 }).notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    pointsDeducted: numeric("pointsDeducted", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxShiftId: index("idx_shiftSale_shiftId").on(table.shiftId),
    idxOrderId: index("idx_shiftSale_orderId").on(table.orderId),
  })
);

export type ShiftSale = typeof shiftSales.$inferSelect;
export type InsertShiftSale = typeof shiftSales.$inferInsert;

// ============================================================================
// 23. CAFETERIA REPORTS TABLE - Daily/Period Reports
// ============================================================================
export const cafeteriaReports = pgTable(
  "cafeteriaReports",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    reportType: reportTypeEnum("reportType").notNull(),
    reportDate: timestamp("reportDate").notNull(),
    totalSales: numeric("totalSales", { precision: 15, scale: 2 }).default("0"),
    totalOrders: integer("totalOrders").default(0),
    totalItemsSold: integer("totalItemsSold").default(0),
    totalPointsDeducted: numeric("totalPointsDeducted", { precision: 15, scale: 2 }).default("0"),
    averageOrderValue: numeric("averageOrderValue", { precision: 10, scale: 2 }).default("0"),
    generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCafeteriaId: index("idx_report_cafeteriaId").on(table.cafeteriaId),
    idxReportType: index("idx_report_reportType").on(table.reportType),
    idxReportDate: index("idx_report_reportDate").on(table.reportDate),
  })
);

export type CafeteriaReport = typeof cafeteriaReports.$inferSelect;
export type InsertCafeteriaReport = typeof cafeteriaReports.$inferInsert;

// ============================================================================
// 24. STAFF PERFORMANCE TABLE - Staff Performance Metrics
// ============================================================================
export const staffPerformance = pgTable(
  "staffPerformance",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    staffId: varchar("staffId", { length: 36 }).notNull(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    reportDate: timestamp("reportDate").notNull(),
    totalShifts: integer("totalShifts").default(0),
    totalSales: numeric("totalSales", { precision: 15, scale: 2 }).default("0"),
    totalOrders: integer("totalOrders").default(0),
    averageOrderValue: numeric("averageOrderValue", { precision: 10, scale: 2 }).default("0"),
    totalItemsSold: integer("totalItemsSold").default(0),
    totalHoursWorked: numeric("totalHoursWorked", { precision: 8, scale: 2 }).default("0"),
    generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  },
  (table) => ({
    idxStaffId: index("idx_staffPerf_staffId").on(table.staffId),
    idxCafeteriaId: index("idx_staffPerf_cafeteriaId").on(table.cafeteriaId),
    idxReportDate: index("idx_staffPerf_reportDate").on(table.reportDate),
  })
);

export type StaffPerformance = typeof staffPerformance.$inferSelect;
export type InsertStaffPerformance = typeof staffPerformance.$inferInsert;


// ============================================================================
// 25. WITHDRAWAL REQUESTS TABLE - Marketer Withdrawal Workflow
// ============================================================================
export const withdrawalRequests = pgTable(
  "withdrawalRequests",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    marketerId: varchar("marketerId", { length: 36 }).notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    status: statusEnum("status").default("pending"),
    requestedAt: timestamp("requestedAt").defaultNow().notNull(),
    processedAt: timestamp("processedAt"),
    processedBy: varchar("processedBy", { length: 255 }),
    notes: text("notes"),
  },
  (table) => ({
    idxMarketerId: index("idx_withdrawal_marketerId").on(table.marketerId),
    idxStatus: index("idx_withdrawal_status").on(table.status),
  })
);

export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = typeof withdrawalRequests.$inferInsert;
