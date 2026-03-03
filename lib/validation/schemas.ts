import { z } from 'zod'

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
})

export const createTeamInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
})

export const updateTeamMemberSchema = z.object({
  role: z.enum(['admin', 'member']),
})

export const importLocationsSchema = z.object({
  google_location_ids: z.array(z.string()).min(1),
  account_id: z.string().optional(),
})

export const updateLocationSettingsSchema = z.object({
  brand_voice: z.string().nullable().optional(),
  positive_sentiment: z.string().nullable().optional(),
  negative_sentiment: z.string().nullable().optional(),
  signature: z.string().nullable().optional(),
  reply_language: z.string().nullable().optional(),
})

export const createLocationAccessSchema = z.object({
  user_id: z.string().uuid(),
  can_manage: z.boolean().default(true),
})

export const syncReviewsSchema = z.object({
  page_size: z.number().int().min(1).max(100).default(50),
  page_token: z.string().optional(),
})

export const updateDraftSchema = z.object({
  draft_text: z.string().min(1),
})

export const postReplySchema = z.object({
  comment: z.string().optional(),
})

export const placesSearchSchema = z.object({
  query: z.string().min(1),
})

export const createCompetitorSchema = z.object({
  name: z.string().min(1),
  place_id: z.string().min(1),
  website: z.string().url().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  rating: z.number().optional().nullable(),
  review_count: z.number().optional().nullable(),
  opening_hours: z.any().optional().nullable(),
})

export const runInsightsSchema = z.object({
  period_start: z.string().date(),
  period_end: z.string().date(),
  period_window: z.enum(['30d', '90d', '6m', '1y', 'all', 'custom']).optional(),
})

export const createCompetitiveRunSchema = z.object({
  name: z.string().optional(),
  owned_location_ids: z.array(z.string().uuid()).min(1).max(3),
  competitor_ids: z.array(z.string().uuid()).min(1).max(3),
})

export const createCheckoutSchema = z.object({
  tier: z.enum(['PRO', 'BUSINESS', 'ENTERPRISE']),
})

export const createTopupSchema = z.object({
  stripe_price_id: z.string().min(1),
})

