-- Update ENTERPRISE tier to grant 1,000 monthly credits
-- Run this script to update the subscription_plans table

UPDATE app.subscription_plans
SET monthly_credits = 1000
WHERE tier = 'ENTERPRISE';

-- Verify the update
SELECT tier, monthly_credits, insights_enabled, competitive_enabled
FROM app.subscription_plans
ORDER BY monthly_credits;
