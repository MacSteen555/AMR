import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Helper to access tables in the 'app' schema.
 * Usage: appTable(supabase, 'users') instead of supabase.schema('app').from('users')
 */
export function appTable(client: SupabaseClient, tableName: string) {
  return client.schema('app').from(tableName)
}



