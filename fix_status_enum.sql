-- Run this in your Supabase SQL Editor

ALTER TYPE app.subscription_status ADD VALUE IF NOT EXISTS 'canceling';
