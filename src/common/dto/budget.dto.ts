import { z } from 'zod';
import { BudgetType, TransferType } from '@prisma/client';

// ===========================
// Budget Structure Config (for TenantConfig.budgetStructure Json)
// ===========================
export const BudgetStructureSchema = z.object({
  fiscalYear: z.string(),
  initialAlloc: z.record(z.string(), z.number().positive()),
  transferRules: z.object({
    sameLevel: z.object({
      maxPercent: z.number().min(0).max(100),
      traceToItems: z.boolean(),
    }),
    crossLevel: z.object({
      maxPercent: z.number().min(0).max(100),
      approvalStep: z.string().optional(),
      traceOrigin: z.string().optional(),
    }),
  }),
});

export type BudgetStructure = z.infer<typeof BudgetStructureSchema>;

// ===========================
// Budget Check Config (for ProcessConfig.steps.budgetCheck Json)
// ===========================
export const BudgetCheckSchema = z.object({
  required: z.boolean(),
  thresholdKeyFigure: z.string(), // e.g., "availableBalance > poTotal"
  deductOn: z.enum(['COMMIT_PO', 'APPROVE_INVOICE', 'CREATE_PR']),
  traceLevel: z.enum(['ITEM', 'HEADER']),
});

export type BudgetCheck = z.infer<typeof BudgetCheckSchema>;

// ===========================
// Budget Creation DTO
// ===========================
export const CreateBudgetDtoSchema = z.object({
  fiscalYear: z.string(),
  totalAmount: z.number().positive(),
  orgUnitId: z.string(),
  type: z.nativeEnum(BudgetType),
  configId: z.string().optional(),
});

export type CreateBudgetDto = z.infer<typeof CreateBudgetDtoSchema>;

// ===========================
// Budget Allocation DTO
// ===========================
export const AllocateBudgetDtoSchema = z.object({
  fromBudgetId: z.string(),
  toOrgUnits: z.array(
    z.object({
      orgUnitId: z.string(),
      amount: z.number().positive(),
      percent: z.number().min(0).max(100).optional(),
    }),
  ),
  reason: z.string().optional(),
  traceId: z.string().optional(),
});

export type AllocateBudgetDto = z.infer<typeof AllocateBudgetDtoSchema>;

// ===========================
// Budget Transfer DTO
// ===========================
export const TransferBudgetDtoSchema = z.object({
  fromBudgetId: z.string(),
  targetBudgetId: z.string(),
  amount: z.number().positive(),
  type: z.nativeEnum(TransferType),
  traceFlag: z.boolean().default(true),
  approvalChain: z.array(z.string()).optional(),
});

export type TransferBudgetDto = z.infer<typeof TransferBudgetDtoSchema>;

// ===========================
// Budget Deduction DTO
// ===========================
export const DeductBudgetDtoSchema = z.object({
  budgetId: z.string(),
  amount: z.number().positive(),
  transferTraceId: z.string().optional(),
  targetType: z.enum(['PO', 'INVOICE', 'PR']),
  targetId: z.string(),
  items: z
    .array(
      z.object({
        itemNumber: z.number().int().positive(),
        consumedAmount: z.number().positive(),
        budgetAllocationId: z.string().optional(),
        transferTraceId: z.string().optional(),
      }),
    )
    .optional(),
});

export type DeductBudgetDto = z.infer<typeof DeductBudgetDtoSchema>;

// ===========================
// Budget Usage Report Query DTO
// ===========================
export const BudgetUsageQueryDtoSchema = z.object({
  budgetId: z.string().optional(),
  orgUnitId: z.string().optional(),
  fiscalYear: z.string().optional(),
  level: z.enum(['DIVISION', 'DEPARTMENT', 'STAFF', 'PROJECT']).optional(),
  traceId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type BudgetUsageQueryDto = z.infer<typeof BudgetUsageQueryDtoSchema>;

// ===========================
// Budget Transfer Validation
// ===========================
export const TransferRulesSchema = z.object({
  conditions: z.array(
    z.object({
      type: z.enum(['CROSS', 'SAME']),
      max: z.number().min(0).max(1), // 0.5 = 50%
      traceLevel: z.enum(['ITEM', 'HEADER']),
    }),
  ),
});

export type TransferRules = z.infer<typeof TransferRulesSchema>;

// ===========================
// Budget Usage Response
// ===========================
export interface BudgetUsageReport {
  budgetId: string;
  fiscalYear: string;
  totalAmount: number;
  availableAmount: number;
  consumedAmount: number;
  consumedPercent: number;
  orgUnit: {
    id: string;
    name: string;
    type: string;
  };
  allocations: Array<{
    toOrgUnit: string;
    amount: number;
    allocatedAt: Date;
  }>;
  transfers: Array<{
    type: 'IN' | 'OUT';
    amount: number;
    counterpartyBudget: string;
    transferredAt: Date;
    traceId?: string;
  }>;
  usage: {
    purchaseOrders: Array<{
      poNumber: string;
      amount: number;
      transferTraceId?: string;
      items?: Array<{
        itemNumber: number;
        consumedAmount: number;
        transferTraceId?: string;
      }>;
    }>;
    invoices: Array<{
      invoiceNumber: string;
      amount: number;
      transferTraceId?: string;
      items?: Array<{
        itemNumber: number;
        consumedAmount: number;
        transferTraceId?: string;
      }>;
    }>;
  };
}
