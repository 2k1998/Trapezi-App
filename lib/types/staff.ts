export type StaffMember = {
  id: string
  restaurant_id: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'cashier'
  active: boolean
  pin_hash: string | null
  failed_pin_attempts: number
  locked_until: string | null
  deleted_at: string | null
  created_at: string
}

export type StaffCredentials = {
  staff_id: string
  name: string
  email: string
  role: string
  generated_password: string
  generated_pin: string
}

export type Section = {
  id: string
  restaurant_id: string
  name: string
  display_order: number
  created_at: string
}

export type TableRow = {
  id: string
  restaurant_id: string
  number: number
  name: string | null
  capacity: number | null
  section_id: string | null
  status: string
  deleted_at: string | null
}

export type BrandingSettings = {
  logo_url: string | null
  accent_color: string | null
  secondary_color: string | null
  font: string | null
  confirmation_message_el: string | null
  confirmation_message_en: string | null
  receipt_header: string | null
  receipt_footer: string | null
}

export type PrinterSettings = {
  kitchen: string | null
  bar: string | null
  cashier: string | null
}

export type SecuritySettings = {
  inactivity_timeout_minutes: number
}
