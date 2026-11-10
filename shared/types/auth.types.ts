export interface AuthUserDto {
  id: string;
  email: string | null;
  role: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
}

export interface HealthCheckDto {
  status: 'ok';
  timestamp: string;
  runtime: 'cloudflare-workers';
}
