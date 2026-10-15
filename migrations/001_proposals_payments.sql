-- Additive upgrade for existing Billora databases. Safe to apply more than once.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS public_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS invoices_public_token_unique ON invoices(public_token);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_plan jsonb NOT NULL DEFAULT '[{"label":"Full payment","percent":100}]'::jsonb;
CREATE TABLE IF NOT EXISTS payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
 session_id text UNIQUE, amount_cents integer NOT NULL CHECK (amount_cents > 0), label text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','failed')),
 created_at timestamp NOT NULL DEFAULT now(), paid_at timestamp
);
CREATE INDEX IF NOT EXISTS payments_invoice_idx ON payments(invoice_id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_pending ON payments(invoice_id) WHERE status = 'pending';
CREATE TABLE IF NOT EXISTS proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), public_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 user_id uuid NOT NULL REFERENCES users(id), client_id uuid NOT NULL REFERENCES clients(id), title text NOT NULL,
 status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Sent','Changes requested','Accepted')),
 version integer NOT NULL DEFAULT 1, content jsonb NOT NULL, invoice_id uuid UNIQUE REFERENCES invoices(id),
 created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS proposals_user_idx ON proposals(user_id);
CREATE TABLE IF NOT EXISTS proposal_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
 version integer NOT NULL, actor text NOT NULL, kind text NOT NULL, message text NOT NULL, snapshot jsonb,
 created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS proposal_events_proposal_idx ON proposal_events(proposal_id);
