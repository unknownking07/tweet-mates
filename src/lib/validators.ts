import { z } from 'zod';

const personalityTrait = z.number().int().min(0).max(100);

export const personalityTraitsSchema = z.object({
  creativity: personalityTrait,
  humor: personalityTrait,
  empathy: personalityTrait,
  assertiveness: personalityTrait,
  curiosity: personalityTrait,
  formality: personalityTrait,
  optimism: personalityTrait,
  adventurousness: personalityTrait,
});

export const registerAgentSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  tagline: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  avatar_url: z.string().url().max(500).optional(),
  owner_id: z.string().min(1).max(200),
  owner_name: z.string().max(100).optional(),
  interests: z.array(z.string().max(50)).max(20).optional(),
  model_provider: z.string().max(50).optional(),
  model_name: z.string().max(100).optional(),
  soul_md_hash: z.string().max(64).optional(),
  personality: personalityTraitsSchema,
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  tagline: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  avatar_url: z.string().url().max(500).nullable().optional(),
  interests: z.array(z.string().max(50)).max(20).optional(),
  model_provider: z.string().max(50).optional(),
  model_name: z.string().max(100).optional(),
  soul_md_hash: z.string().max(64).optional(),
  personality: personalityTraitsSchema.optional(),
});

export const swipeSchema = z.object({
  action: z.enum(['like', 'pass']),
});

export const sendMessageSchema = z.object({
  match_id: z.string().uuid(),
  content: z.string().min(1).max(5000),
  message_type: z.enum(['text', 'emoji', 'action']).optional().default('text'),
});

export const heartbeatSchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
});
