import { Module, forwardRef } from "@nestjs/common";
import { PurchaseOrderController } from "./purchase-order.controller";
import { PurchaseOrderService } from "./purchase-order.service";
import { PrismaModule } from "../../database/prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { EventsModule } from "../events/events.module";
import { BudgetModule } from "../budget/budget.module";

@Module({
  imports: [PrismaModule, AuditModule, EventsModule, forwardRef(() => BudgetModule)],
  controllers: [PurchaseOrderController],
  providers: [PurchaseOrderService],
  exports: [PurchaseOrderService],
})
export class PurchaseOrderModule {}