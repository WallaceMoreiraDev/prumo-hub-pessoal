import type { Context } from 'hono';
import type { AppEnv } from '../../types/hono.types';
import { jsonSuccess } from '../../utils/response';
import { authService } from './auth.service';

export class AuthController {
  public getMe(c: Context<AppEnv>): Response {
    const user = c.get('user');
    const currentUser = authService.getCurrentUser(user);
    return jsonSuccess(c, currentUser);
  }
}

export const authController = new AuthController();
