-- Migration 009: Phase 5c — Staff, Settings & Onboarding

-- ─── STAFF COLUMNS ───────────────────────────────────────────────────────────
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS failed_pin_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ─── SECTIONS TABLE ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

-- ─── TABLES COLUMNS ──────────────────────────────────────────────────────────
ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS capacity int,
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ─── RLS: sections ───────────────────────────────────────────────────────────
-- Use SECURITY DEFINER function to avoid infinite recursion when referencing
-- the staff table from within a new table's policy (same pattern as migration 003).

CREATE POLICY "staff can read sections" ON sections
  FOR SELECT TO authenticated
  USING (
    public.current_user_is_owner_or_manager_of_restaurant(restaurant_id)
    OR restaurant_id IN (
      SELECT restaurant_id FROM staff WHERE id = auth.uid()
    )
  );

CREATE POLICY "owner or manager can manage sections" ON sections
  FOR ALL TO authenticated
  USING (
    public.current_user_is_owner_or_manager_of_restaurant(restaurant_id)
  );

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sections_restaurant
  ON sections(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_section
  ON tables(section_id);
CREATE INDEX IF NOT EXISTS idx_staff_deleted
  ON staff(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tables_deleted
  ON tables(deleted_at) WHERE deleted_at IS NULL;
