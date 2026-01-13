import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export type CreditEventType =
  | 'monthly_grant'
  | 'topup'
  | 'adjustment'
  | 'reply_generate'
  | 'reply_regenerate'
  | 'insight_run'
  | 'competitive_run'
  | 'refund'

export type SubscriptionTier = 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE'

export interface TeamTier {
  tier: SubscriptionTier
  insightsEnabled: boolean
  competitiveEnabled: boolean
}

/**
 * Gets the team's subscription tier and feature flags.
 */
export async function getTeamTier(teamId: string): Promise<TeamTier> {
  const supabase = createSupabaseServerClient()

  const { data: subscription, error } = await supabase
    .schema('app').from('team_subscriptions')
    .select('tier, insights_enabled, competitive_enabled')
    .eq('team_id', teamId)
    .single()

  if (error || !subscription) {
    // Default to FREE if no subscription exists
    return {
      tier: 'FREE',
      insightsEnabled: false,
      competitiveEnabled: false,
    }
  }

  return {
    tier: subscription.tier as SubscriptionTier,
    insightsEnabled: subscription.insights_enabled || false,
    competitiveEnabled: subscription.competitive_enabled || false,
  }
}

/**
 * Gets the current credit balance for a team.
 */
export async function getBalance(teamId: string): Promise<number> {
  const supabase = createSupabaseServerClient()

  const { data: balance, error } = await supabase
    .schema('app').from('team_credit_balances')
    .select('balance')
    .eq('team_id', teamId)
    .single()

  if (error || !balance) {
    // If no balance record exists, calculate from transactions
    const { data: transactions } = await supabase
      .schema('app').from('team_credit_transactions')
      .select('amount')
      .eq('team_id', teamId)

    return transactions?.reduce((sum, t) => sum + t.amount, 0) || 0
  }

  return balance.balance || 0
}

/**
 * Spends credits atomically with idempotency support.
 * Returns true if successful, throws if insufficient credits or tier mismatch.
 */
export async function spendCredits(
  teamId: string,
  userId: string,
  eventType: CreditEventType,
  amount: number,
  referenceType: string | null,
  referenceId: string | null,
  idempotencyKey: string | null,
  tierCheck?: { requiredTier?: SubscriptionTier; feature?: 'insights' | 'competitive' }
): Promise<boolean> {
  if (amount <= 0) {
    throw new Error('Amount must be positive')
  }

  const serviceClient = createSupabaseServiceRoleClient()

  // Check idempotency if key provided
  if (idempotencyKey) {
    const { data: existing } = await serviceClient
      .schema('app').from('idempotency_keys')
      .select('*')
      .eq('user_id', userId)
      .eq('key', idempotencyKey)
      .single()

    if (existing) {
      if (existing.status === 'completed') {
        // Return stored response
        if (existing.response) {
          return true
        }
      } else if (existing.status === 'started') {
        throw new Error('Request already in progress')
      } else if (existing.status === 'failed') {
        // Check if request hash matches (allow retry if same request)
        const requestHash = crypto
          .createHash('sha256')
          .update(JSON.stringify({ teamId, eventType, amount, referenceType, referenceId }))
          .digest('hex')

        if (existing.request_hash === requestHash) {
          // Same request - allow retry
        } else {
          throw new Error('Idempotency key already used for different request')
        }
      }
    }
  }

  // Use a transaction to atomically:
  // 1. Check tier eligibility
  // 2. Check balance
  // 3. Insert credit transaction
  // 4. Update idempotency key

  const { data: tier, error: tierError } = await serviceClient
    .schema('app').from('team_subscriptions')
    .select('tier, insights_enabled, competitive_enabled')
    .eq('team_id', teamId)
    .single()

  if (tierError || !tier) {
    throw new Error('Team subscription not found')
  }

  // Check tier requirements
  if (tierCheck?.requiredTier) {
    const tierOrder: SubscriptionTier[] = ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE']
    const currentTierIndex = tierOrder.indexOf(tier.tier as SubscriptionTier)
    const requiredTierIndex = tierOrder.indexOf(tierCheck.requiredTier)

    if (currentTierIndex < requiredTierIndex) {
      throw new Error(`Requires ${tierCheck.requiredTier} tier`)
    }
  }

  if (tierCheck?.feature === 'insights' && !tier.insights_enabled) {
    throw new Error('Insights feature not enabled for this tier')
  }

  if (tierCheck?.feature === 'competitive' && !tier.competitive_enabled) {
    throw new Error('Competitive feature not enabled for this tier')
  }

  // Get current balance
  const balance = await getBalance(teamId)

  if (balance < amount) {
    throw new Error('Insufficient credits')
  }

  // Create idempotency record if key provided
  if (idempotencyKey) {
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ teamId, eventType, amount, referenceType, referenceId }))
      .digest('hex')

    await serviceClient.schema('app').from('idempotency_keys').upsert({
      user_id: userId,
      team_id: teamId,
      key: idempotencyKey,
      route: eventType,
      request_hash: requestHash,
      status: 'started',
    })
  }

  // Insert credit transaction (negative amount = spend)
  const { error: transactionError } = await serviceClient
    .schema('app').from('team_credit_transactions')
    .insert({
      team_id: teamId,
      event_type: eventType,
      amount: -amount,
      reason: `Spent ${amount} credits for ${eventType}`,
      reference_type: referenceType,
      reference_id: referenceId,
      actor_user_id: userId,
    })

  if (transactionError) {
    // Update idempotency to failed
    if (idempotencyKey) {
      await serviceClient
        .schema('app').from('idempotency_keys')
        .update({ status: 'failed', error: { message: transactionError.message } })
        .eq('user_id', userId)
        .eq('key', idempotencyKey)
    }
    throw new Error(`Failed to spend credits: ${transactionError.message}`)
  }

  // Update idempotency to completed
  if (idempotencyKey) {
    await serviceClient
      .schema('app').from('idempotency_keys')
      .update({ status: 'completed', response: { success: true } })
      .eq('user_id', userId)
      .eq('key', idempotencyKey)
  }

  return true
}

/**
 * Grants monthly credits to a team (called by cron/webhook).
 */
export async function grantMonthlyCredits(teamId: string): Promise<void> {
  const serviceClient = createSupabaseServiceRoleClient()

  const { data: subscription, error } = await serviceClient
    .schema('app').from('team_subscriptions')
    .select('monthly_credits')
    .eq('team_id', teamId)
    .single()

  if (error || !subscription || !subscription.monthly_credits || subscription.monthly_credits <= 0) {
    return // No monthly credits to grant
  }

  await serviceClient.schema('app').from('team_credit_transactions').insert({
    team_id: teamId,
    event_type: 'monthly_grant',
    amount: subscription.monthly_credits,
    reason: 'Monthly subscription credit grant',
    actor_user_id: null,
  })
}

