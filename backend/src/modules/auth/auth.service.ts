import type { AuthUserDto } from '@shared/types/auth.types';

export class AuthService {
  public getCurrentUser(user: AuthUserDto): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt,
    };
  }
}

export const authService = new AuthService();
