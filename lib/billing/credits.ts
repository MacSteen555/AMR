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
 * This function inserts a transaction which triggers automatic balance update.
 * Includes idempotency: won't grant credits twice for the same billing period.
 */
// In-memory mutex to serialize requests for the same team
const activeProcessing = new Map<string, Promise<void>>()

export async function grantMonthlyCredits(teamId: string, isUpgrade: boolean = false, actorUserId: string | null = null): Promise<void> {
  // Wait for any active processing for this team to finish
  // This prevents race conditions where two events (e.g. proration + renewal)
  // trigger grants simultaneously, both reading the same initial balance.
  while (activeProcessing.has(teamId)) {
    try {
      await activeProcessing.get(teamId)
    } catch (e) {
      // Ignore errors from previous runs
    }
  }

  // Create a new promise signal
  let resolveProcessing: () => void
  const processingPromise = new Promise<void>((resolve) => {
    resolveProcessing = resolve
  })
  
  activeProcessing.set(teamId, processingPromise)

  try {
    const serviceClient = createSupabaseServiceRoleClient()

    console.log(`[Credits] Granting monthly credits for team: ${teamId}`)

    // Get the subscription to find monthly_credits
    const { data: subscription, error: subError } = await serviceClient
      .schema('app').from('team_subscriptions')
      .select('monthly_credits, current_period_start, current_period_end')
      .eq('team_id', teamId)
      .single()

    if (subError) {
      console.error(`[Credits] Error fetching subscription:`, subError)
      return
    }

    if (!subscription || !subscription.monthly_credits || subscription.monthly_credits <= 0) {
      console.log(`[Credits] No monthly credits to grant - subscription:`, subscription)
      return
    }

    const targetCredits = subscription.monthly_credits
    const periodStart = subscription.current_period_start
    const periodEnd = subscription.current_period_end

    let creditsToGrant = targetCredits

    // IDEMPOTENCY CHECK: Calculate how many credits already granted for this period
    // Skip this check for upgrades - when upgrading, grant the full new plan amount
    if (!isUpgrade && periodStart && periodEnd) {
      const { data: existingGrants } = await serviceClient
        .schema('app')
        .from('team_credit_transactions')
        .select('amount')
        .eq('team_id', teamId)
        .eq('event_type', 'monthly_grant')
        .gte('created_at', periodStart)
        .lte('created_at', periodEnd)

      if (existingGrants && existingGrants.length > 0) {
        const grantedTotal = existingGrants.reduce((sum, tx) => sum + tx.amount, 0)
        console.log(`[Credits] Found existing grants for this period: ${grantedTotal} credits`)

        if (grantedTotal >= targetCredits) {
          console.log(`[Credits] Already granted ${grantedTotal} (>= target ${targetCredits}) for this billing period (${periodStart} to ${periodEnd}), skipping`)
          return
        }

        // Grant the difference (e.g. renewal triggered twice, already granted 100, target 100, so grant 0)
        creditsToGrant = targetCredits - grantedTotal
        console.log(`[Credits] Partial credits detected. Target: ${targetCredits}, Granted: ${grantedTotal}. Granting difference: ${creditsToGrant}`)
      }
    } else if (isUpgrade) {
      console.log(`[Credits] Upgrade detected - granting full ${targetCredits} credits (ignoring existing grants for this period)`)
    }

    console.log(`[Credits] Granting ${creditsToGrant} credits for period ${periodStart} to ${periodEnd}`)

    // Insert credit transaction
    // NOTE: The database trigger 'trg_credit_tx_apply_balance' automatically updates
    // team_credit_balances when this transaction is inserted, so we don't manually update it
    const { error: txError } = await serviceClient.schema('app').from('team_credit_transactions').insert({
      team_id: teamId,
      event_type: 'monthly_grant',
      amount: creditsToGrant,
      reason: 'Monthly subscription credit grant',
      actor_user_id: actorUserId,
    })

    if (txError) {
      console.error(`[Credits] Error inserting credit transaction:`, txError)
      throw txError
    }

    console.log(`[Credits] Successfully granted ${creditsToGrant} credits via transaction (balance updated by trigger)`)

  } finally {
    // Release lock
    if (activeProcessing.get(teamId) === processingPromise) {
      activeProcessing.delete(teamId)
    }
    resolveProcessing!()
  }
}

