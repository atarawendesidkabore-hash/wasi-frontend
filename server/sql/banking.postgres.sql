-- WASI Banking schema (PostgreSQL)
-- Monetary amounts stored as BIGINT in XOF centimes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS banking_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holder TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('CHECKING', 'SAVINGS', 'BUSINESS')),
  currency CHAR(3) NOT NULL CHECK (currency = 'XOF'),
  balance_centimes BIGINT NOT NULL CHECK (balance_centimes >= 0),
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS banking_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES banking_accounts(id),
  kind VARCHAR(20) NOT NULL CHECK (
    kind IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT')
  ),
  amount_centimes BIGINT NOT NULL CHECK (
    amount_centimes > 0 AND amount_centimes <= 9007199254740991
  ),
  description TEXT NOT NULL,
  transfer_group_id UUID NULL,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banking_transactions_account_time
ON banking_transactions(account_id, created_at_utc DESC);

CREATE INDEX IF NOT EXISTS idx_banking_transactions_time
ON banking_transactions(created_at_utc DESC);
