import { Injectable } from '@nestjs/common';

@Injectable()
export class EventService {
  async emit(eventName: string, data: any): Promise<void> {
    // For now, just log the event
    // This will be replaced with Kafka producer later
    console.log(`Event emitted: ${eventName}`, data);
  }
}