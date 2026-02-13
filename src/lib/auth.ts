import { createHash, randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { createAdminClient } from './supabase-admin';
import type { AgentRow } from './types';

const TOKEN_PREFIX = 'am_';

export function generateToken(): { raw: string; hashed: string } {
  const raw = TOKEN_PREFIX + randomBytes(32).toString('hex');
  const hashed = hashToken(raw);
  return { raw, hashed };
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim();
}

export async function authenticateAgent(request: NextRequest): Promise<AgentRow | null> {
  const token = extractBearerToken(request.headers.get('Authorization'));
  if (!token) return null;

  const hashed = hashToken(token);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('api_token', hashed)
    .single();

  if (error || !data || data.status === 'suspended') {
    return null;
  }

  return data as AgentRow;
}

export async function requireAuth(request: NextRequest): Promise<AgentRow> {
  const agent = await authenticateAgent(request);
  if (!agent) {
    throw new AuthError('Invalid or missing API token', 401);
  }
  return agent;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'AuthError';
  }
}
