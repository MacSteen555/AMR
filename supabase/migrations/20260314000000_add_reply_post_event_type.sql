-- Add 'reply_post' to the credit_event_type enum
ALTER TYPE "app"."credit_event_type" ADD VALUE IF NOT EXISTS 'reply_post' AFTER 'reply_regenerate';
