import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  index,
  json,
} from "drizzle-orm/mysql-core";

/**
 * CAFETERIA V2 - Complete Database Schema
 * 18 tables for multi-role cafeteria points management system with recharge-based commissions
 */

// ============================================================================
// 1. USERS TABLE - Authentication & Authorization
// ============================================================================
export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
    preferredLanguage: varchar("preferred_language", { length: 10 }).default("en"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
export const marketers = mysqlTable(
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
export const cafeterias = mysqlTable(
  "cafeterias",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    marketerId: varchar("marketerId", { length: 36 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    location: varchar("location", { length: 255 }),
    pointsBalance: decimal("pointsBalance", { precision: 10, scale: 2 }).default("0"),
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
export const commissionConfigs = mysqlTable(
  "commissionConfigs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    marketerId: varchar("marketerId", { length: 36 }).notNull(),
    rate: decimal("rate", { precision: 5, scale: 2 }).default("0"),
    expiryOverrideMonths: int("expiryOverrideMonths"),
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
export const rechargeRequests = mysqlTable(
  "rechargeRequests",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    imageUrl: text("imageUrl"),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending"),
    processedAt: timestamp("processedAt"),
    processedBy: varchar("processedBy", { length: 255 }),
    notes: text("notes"),
    commissionCalculated: boolean("commissionCalculated").default(false),
    commissionDistributionId: varchar("commissionDistributionId", { length: 36 }),
    pointsAddedToBalance: decimal("pointsAddedToBalance", { precision: 10, scale: 2 }).default("0"),
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
export const marketerBalances = mysqlTable(
  "marketerBalances",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    marketerId: varchar("marketerId", { length: 36 }).notNull().unique(),
    pendingBalance: decimal("pendingBalance", { precision: 15, scale: 2 }).default("0"),
    availableBalance: decimal("availableBalance", { precision: 15, scale: 2 }).default("0"),
    totalWithdrawn: decimal("totalWithdrawn", { precision: 15, scale: 2 }).default("0"),
    lastUpdated: timestamp("lastUpdated").defaultNow().onUpdateNow().notNull(),
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
export const commissionDistributions = mysqlTable(
  "commissionDistributions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    rechargeRequestId: varchar("rechargeRequestId", { length: 36 }).notNull(),
    marketerId: varchar("marketerId", { length: 36 }).notNull(),
    level: int("level").notNull(),
    commissionAmount: decimal("commissionAmount", { precision: 15, scale: 2 }).notNull(),
    status: mysqlEnum("status", ["pending", "available", "withdrawn"]).default("pending"),
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
export const cafeteriaMarketerRelationships = mysqlTable(
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
export const freeOperationPeriods = mysqlTable(
  "freeOperationPeriods",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    periodType: mysqlEnum("periodType", ["global_first_time", "special_grant"]).notNull(),
    startDate: timestamp("startDate").notNull(),
    endDate: timestamp("endDate").notNull(),
    reason: text("reason"),
    createdBy: varchar("createdBy", { length: 36 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCafeteriaId: index("idx_cafeteriaId").on(table.cafeteriaId),
    idxEndDate: index("idx_endDate").on(table.endDate),
  })
);

export type FreeOperationPeriod = typeof freeOperationPeriods.$inferSelect;
export type InsertFreeOperationPeriod = typeof freeOperationPeriods.$inferInsert;

// ============================================================================
// 10. LEDGER ENTRIES TABLE - Financial Transaction Audit Trail
// ============================================================================
export const ledgerEntries = mysqlTable(
  "ledgerEntries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    type: varchar("type", { length: 50 }).notNull(),
    ledgerType: mysqlEnum("ledgerType", [
      "points_deduction",
      "points_credit",
      "commission_pending",
      "commission_available",
      "commission_withdrawn",
      "recharge_approval",
    ]),
    description: text("description"),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }),
    marketerId: varchar("marketerId", { length: 36 }),
    amount: decimal("amount", { precision: 10, scale: 2 }),
    refId: varchar("refId", { length: 36 }),
    relatedMarketerIds: json("relatedMarketerIds"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxType: index("idx_type").on(table.type),
    idxCafeteriaId: index("idx_cafeteriaId").on(table.cafeteriaId),
    idxMarketerId: index("idx_marketerId").on(table.marketerId),
    idxCreatedAt: index("idx_createdAt").on(table.createdAt),
  })
);

export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type InsertLedgerEntry = typeof ledgerEntries.$inferInsert;

// ============================================================================
// 11. SYSTEM CONFIGS TABLE - System-wide Configuration
// ============================================================================
export const systemConfigs = mysqlTable(
  "systemConfigs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    key: varchar("key", { length: 255 }).notNull().unique(),
    value: text("value"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxKey: index("idx_key").on(table.key),
  })
);

export type SystemConfig = typeof systemConfigs.$inferSelect;
export type InsertSystemConfig = typeof systemConfigs.$inferInsert;

// ============================================================================
// 12. SECTIONS TABLE - Table Groupings within Cafeteria
// ============================================================================
export const sections = mysqlTable(
  "sections",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    displayOrder: int("displayOrder").default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCafeteriaId: index("idx_cafeteriaId").on(table.cafeteriaId),
  })
);

export type Section = typeof sections.$inferSelect;
export type InsertSection = typeof sections.$inferInsert;

// ============================================================================
// 13. CAFETERIA TABLES TABLE - Table Management
// ============================================================================
export const cafeteriaTables = mysqlTable(
  "cafeteriaTables",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    sectionId: varchar("sectionId", { length: 36 }),
    tableNumber: int("tableNumber").notNull(),
    capacity: int("capacity"),
    status: varchar("status", { length: 50 }).default("available"),
    tableToken: varchar("tableToken", { length: 64 }).unique(),
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
// 14. STAFF SECTION ASSIGNMENTS TABLE - Waiter to Section Assignments
// ============================================================================
export const staffSectionAssignments = mysqlTable(
  "staffSectionAssignments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    staffId: varchar("staffId", { length: 36 }).notNull(),
    sectionId: varchar("sectionId", { length: 36 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxStaffId: index("idx_staffId").on(table.staffId),
    idxSectionId: index("idx_sectionId").on(table.sectionId),
    uniqueStaffSection: index("unique_staff_section").on(table.staffId, table.sectionId),
  })
);

export type StaffSectionAssignment = typeof staffSectionAssignments.$inferSelect;
export type InsertStaffSectionAssignment = typeof staffSectionAssignments.$inferInsert;

// ============================================================================
// 15. CAFETERIA STAFF TABLE - Staff Management with Login Permissions
// ============================================================================
export const cafeteriaStaff = mysqlTable(
  "cafeteriaStaff",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    role: varchar("role", { length: 50 }),
    status: varchar("status", { length: 50 }).default("active"),
    canLogin: boolean("canLogin").default(false),
    permissions: json("permissions"),
    loginPermissionGrantedAt: timestamp("loginPermissionGrantedAt"),
    loginPermissionGrantedBy: varchar("loginPermissionGrantedBy", { length: 36 }),
    lastLoginAt: timestamp("lastLoginAt"),
    country: varchar("country", { length: 2 }),
    currency: varchar("currency", { length: 3 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCafeteriaId: index("idx_cafeteriaId").on(table.cafeteriaId),
    idxCanLogin: index("idx_canLogin").on(table.canLogin),
  })
);

export type CafeteriaStaff = typeof cafeteriaStaff.$inferSelect;
export type InsertCafeteriaStaff = typeof cafeteriaStaff.$inferInsert;

// ============================================================================
// 16. MENU CATEGORIES TABLE - Menu Organization
// ============================================================================
export const menuCategories = mysqlTable(
  "menuCategories",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    displayOrder: int("displayOrder").default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCafeteriaId: index("idx_cafeteriaId").on(table.cafeteriaId),
  })
);

export type MenuCategory = typeof menuCategories.$inferSelect;
export type InsertMenuCategory = typeof menuCategories.$inferInsert;

// ============================================================================
// 17. STAFF CATEGORY ASSIGNMENTS TABLE - Chef to Prep Category Assignments
// ============================================================================
export const staffCategoryAssignments = mysqlTable(
  "staffCategoryAssignments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    staffId: varchar("staffId", { length: 36 }).notNull(),
    categoryId: varchar("categoryId", { length: 36 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxStaffId: index("idx_staffId").on(table.staffId),
    idxCategoryId: index("idx_categoryId").on(table.categoryId),
    uniqueStaffCategory: index("unique_staff_category").on(table.staffId, table.categoryId),
  })
);

export type StaffCategoryAssignment = typeof staffCategoryAssignments.$inferSelect;
export type InsertStaffCategoryAssignment = typeof staffCategoryAssignments.$inferInsert;

// ============================================================================
// 18. MENU ITEMS TABLE - Individual Menu Items
// ============================================================================
export const menuItems = mysqlTable(
  "menuItems",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    categoryId: varchar("categoryId", { length: 36 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    price: decimal("price", { precision: 10, scale: 2 }),
    available: boolean("available").default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCategoryId: index("idx_categoryId").on(table.categoryId),
  })
);

export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = typeof menuItems.$inferInsert;

// ============================================================================
// 19. ORDERS TABLE - Order Tracking with Points Consumption
// ============================================================================
export const orders = mysqlTable(
  "orders",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    tableId: varchar("tableId", { length: 36 }),
    waiterId: varchar("waiterId", { length: 36 }),
    totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }),
    status: varchar("status", { length: 50 }).default("open"),
    pointsConsumed: decimal("pointsConsumed", { precision: 10, scale: 2 }).default("0"),
    source: varchar("source", { length: 50 }).default("staff"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    closedAt: timestamp("closedAt"),
  },
  (table) => ({
    idxCafeteriaId: index("idx_cafeteriaId").on(table.cafeteriaId),
    idxStatus: index("idx_status").on(table.status),
    idxSource: index("idx_source").on(table.source),
    idxCreatedAt: index("idx_createdAt").on(table.createdAt),
    idxClosedAt: index("idx_closedAt").on(table.closedAt),
  })
);

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ============================================================================
// 20. ORDER ITEMS TABLE - Individual Items in Orders
// ============================================================================
export const orderItems = mysqlTable(
  "orderItems",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("orderId", { length: 36 }).notNull(),
    menuItemId: varchar("menuItemId", { length: 36 }).notNull(),
    quantity: int("quantity").notNull().default(1),
    unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
    totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
    status: mysqlEnum("status", ["pending", "sent_to_kitchen", "in_preparation", "ready", "served", "cancelled"]).default("pending"),
    sentToKitchenAt: timestamp("sentToKitchenAt"),
    readyAt: timestamp("readyAt"),
    servedAt: timestamp("servedAt"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxOrderId: index("idx_orderId").on(table.orderId),
    idxMenuItemId: index("idx_menuItemId").on(table.menuItemId),
    idxStatus: index("idx_status").on(table.status),
  })
);

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// ============================================================================
// 21. SHIFTS TABLE - Staff Shift Tracking
// ============================================================================
export const shifts = mysqlTable(
  "shifts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    staffId: varchar("staffId", { length: 36 }).notNull(),
    startTime: timestamp("startTime").notNull(),
    endTime: timestamp("endTime"),
    status: mysqlEnum("status", ["active", "completed", "cancelled"]).default("active"),
    totalSales: decimal("totalSales", { precision: 15, scale: 2 }).default("0"),
    totalOrders: int("totalOrders").default(0),
    totalItemsSold: int("totalItemsSold").default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCafeteriaId: index("idx_cafeteriaId").on(table.cafeteriaId),
    idxStaffId: index("idx_staffId").on(table.staffId),
    idxStatus: index("idx_status").on(table.status),
    idxStartTime: index("idx_startTime").on(table.startTime),
  })
);

export type Shift = typeof shifts.$inferSelect;
export type InsertShift = typeof shifts.$inferInsert;

// ============================================================================
// 22. SHIFT SALES TABLE - Sales Tracking per Shift
// ============================================================================
export const shiftSales = mysqlTable(
  "shiftSales",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    shiftId: varchar("shiftId", { length: 36 }).notNull(),
    orderId: varchar("orderId", { length: 36 }).notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    pointsDeducted: decimal("pointsDeducted", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    idxShiftId: index("idx_shiftId").on(table.shiftId),
    idxOrderId: index("idx_orderId").on(table.orderId),
  })
);

export type ShiftSale = typeof shiftSales.$inferSelect;
export type InsertShiftSale = typeof shiftSales.$inferInsert;

// ============================================================================
// 23. CAFETERIA REPORTS TABLE - Daily/Period Reports
// ============================================================================
export const cafeteriaReports = mysqlTable(
  "cafeteriaReports",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    reportType: mysqlEnum("reportType", ["daily", "weekly", "monthly"]).notNull(),
    reportDate: timestamp("reportDate").notNull(),
    totalSales: decimal("totalSales", { precision: 15, scale: 2 }).default("0"),
    totalOrders: int("totalOrders").default(0),
    totalItemsSold: int("totalItemsSold").default(0),
    totalPointsDeducted: decimal("totalPointsDeducted", { precision: 15, scale: 2 }).default("0"),
    averageOrderValue: decimal("averageOrderValue", { precision: 10, scale: 2 }).default("0"),
    generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  },
  (table) => ({
    idxCafeteriaId: index("idx_cafeteriaId").on(table.cafeteriaId),
    idxReportType: index("idx_reportType").on(table.reportType),
    idxReportDate: index("idx_reportDate").on(table.reportDate),
  })
);

export type CafeteriaReport = typeof cafeteriaReports.$inferSelect;
export type InsertCafeteriaReport = typeof cafeteriaReports.$inferInsert;

// ============================================================================
// 24. STAFF PERFORMANCE TABLE - Staff Performance Metrics
// ============================================================================
export const staffPerformance = mysqlTable(
  "staffPerformance",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    staffId: varchar("staffId", { length: 36 }).notNull(),
    cafeteriaId: varchar("cafeteriaId", { length: 36 }).notNull(),
    reportDate: timestamp("reportDate").notNull(),
    totalShifts: int("totalShifts").default(0),
    totalSales: decimal("totalSales", { precision: 15, scale: 2 }).default("0"),
    totalOrders: int("totalOrders").default(0),
    averageOrderValue: decimal("averageOrderValue", { precision: 10, scale: 2 }).default("0"),
    totalItemsSold: int("totalItemsSold").default(0),
    totalHoursWorked: decimal("totalHoursWorked", { precision: 8, scale: 2 }).default("0"),
    generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  },
  (table) => ({
    idxStaffId: index("idx_staffId").on(table.staffId),
    idxCafeteriaId: index("idx_cafeteriaId").on(table.cafeteriaId),
    idxReportDate: index("idx_reportDate").on(table.reportDate),
  })
);

export type StaffPerformance = typeof staffPerformance.$inferSelect;
export type InsertStaffPerformance = typeof staffPerformance.$inferInsert;


// ============================================================================
// 25. WITHDRAWAL REQUESTS TABLE - Marketer Withdrawal Workflow
// ============================================================================
expor
t const withdrawalRequests = mysqlTable(
  "withdrawalRequests",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    marketerId: varchar("marketerId", { length: 36 }).notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending"),
    requestedAt: timestamp("requestedAt").defaultNow().notNull(),
    processedAt: timestamp("processedAt"),
    processedBy: varchar("processedBy", { length: 255 }),
    notes: text("notes"),
  },
  (table) => ({
    idxMarketerId: index("idx_marketerId").on(table.marketerId),
    idxStatus: index("idx_status").on(table.status),
  })
);

export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = typeof withdrawalRequests.$inferInsert;
