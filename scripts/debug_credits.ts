
import dotenv from 'dotenv'
import path from 'path'

// Load env vars before anything else
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

async function main() {
  // Dynamic import to ensure env vars are set first
  const { createSupabaseServiceRoleClient } = await import('../lib/supabase/server')

  const supabase = createSupabaseServiceRoleClient()

  console.log('--- Subscription Plans ---')
  const { data: plans, error: plansError } = await supabase
    .schema('app')
    .from('subscription_plans')
    .select('*')
  
  if (plansError) {
    console.error('Error fetching plans:', plansError)
  } else {
    // console.table(plans) // console.table might not be visible in some outputs, using JSON
    console.log(JSON.stringify(plans, null, 2))
  }

  console.log('\n--- Recent Credit Transactions for team 2604ead8... ---')
  const { data: txs, error: txsError } = await supabase
    .schema('app')
    .from('team_credit_transactions')
    .select('*')
    .eq('team_id', '2604ead8-a1d8-48cb-a214-d53c02a3cf62')
    .order('created_at', { ascending: false })
    .limit(20)

  if (txsError) {
    console.error('Error fetching transactions:', txsError)
  } else {
    console.log(JSON.stringify(txs.map(t => ({ 
      id: t.id, 
      team_id: t.team_id, 
      event_type: t.event_type, 
      amount: t.amount, 
      created_at: t.created_at,
      reason: t.reason
    })), null, 2))
  }
}

main().catch(console.error)
