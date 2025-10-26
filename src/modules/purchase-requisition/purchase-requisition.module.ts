import { Module } from "@nestjs/common";
import { PurchaseRequisitionController } from "./purchase-requisition.controller";
import { PurchaseRequisitionService } from "./purchase-requisition.service";
import { PrismaModule } from "../../database/prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [PrismaModule, AuditModule, EventsModule],
  controllers: [PurchaseRequisitionController],
  providers: [PurchaseRequisitionService],
  exports: [PurchaseRequisitionService],
})
export class PurchaseRequisitionModule {}