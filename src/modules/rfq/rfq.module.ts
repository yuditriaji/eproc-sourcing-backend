import { Module } from '@nestjs/common';
import { RFQController } from './rfq.controller';
import { RFQService } from './rfq.service';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';

@Module({
    imports: [PrismaModule, AuditModule, EventsModule],
    controllers: [RFQController],
    providers: [RFQService],
    exports: [RFQService],
})
export class RFQModule { }
