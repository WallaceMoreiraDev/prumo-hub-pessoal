import type { Context } from 'hono';
import type { AppEnv } from '../../types/hono.types';
import { jsonSuccess } from '../../utils/response';
import { healthService } from './health.service';

export class HealthController {
  public getHealth(c: Context<AppEnv>): Response {
    const status = healthService.getStatus();
    return jsonSuccess(c, status);
  }
}

export const healthController = new HealthController();
