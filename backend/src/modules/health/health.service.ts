import type { HealthCheckDto } from '@shared/types/auth.types';

export class HealthService {
  public getStatus(): HealthCheckDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      runtime: 'cloudflare-workers',
    };
  }
}

export const healthService = new HealthService();
