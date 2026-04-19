export type Role = 'owner' | 'dispatcher' | 'driver'

export type DispatchStatus = 'pending' | 'active' | 'completed' | 'cancelled'
export type AssignmentStatus = 'assigned' | 'acknowledged' | 'en_route' | 'completed'
export type LocationType = 'yard' | 'quarry' | 'job_site' | 'other'
export type TicketStatus = 'submitted' | 'confirmed' | 'invoiced' | 'disputed'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'disputed'

export type FieldType = 'text' | 'number' | 'dropdown' | 'photo' | 'signature' | 'checkbox' | 'date'

export interface TemplateField {
  id: string
  label: string
  type: FieldType
  required: boolean
  options?: string[]
  placeholder?: string
}

export interface Company {
  id: string
  name: string
  address: string | null
  phone: string | null
  logo_url: string | null
  created_at: string
}

export interface User {
  id: string
  company_id: string
  full_name: string
  phone: string | null
  role: Role
  truck_number: string | null
  is_active: boolean
  pay_type: 'per_load' | 'hourly' | null
  pay_rate: number | null
  created_at: string
}

export interface Client {
  id: string
  company_id: string
  name: string
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  address: string | null
  created_at: string
}

export interface JobSite {
  id: string
  company_id: string
  client_id: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  geofence_radius_meters: number
  is_active: boolean
  created_at: string
}

export interface TicketTemplate {
  id: string
  company_id: string
  name: string
  description: string | null
  fields: TemplateField[]
  is_active: boolean
  created_at: string
}

export interface Dispatch {
  id: string
  company_id: string
  dispatcher_id: string
  client_id: string
  job_site_id: string
  ticket_template_id: string
  title: string
  notes: string | null
  scheduled_date: string
  scheduled_time: string | null
  status: DispatchStatus
  created_at: string
}

export interface DispatchAssignment {
  id: string
  dispatch_id: string
  driver_id: string
  acknowledged_at: string | null
  status: AssignmentStatus
  created_at: string
}

export interface CheckIn {
  id: string
  company_id: string
  driver_id: string
  dispatch_id: string | null
  location_type: LocationType
  location_label: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  checked_in_at: string
}

export interface LoadTicket {
  id: string
  company_id: string
  driver_id: string
  dispatch_id: string | null
  client_id: string
  job_site_id: string
  ticket_template_id: string
  form_data: Record<string, unknown>
  photo_urls: string[]
  latitude: number | null
  longitude: number | null
  status: TicketStatus
  submitted_at: string
  confirmed_at: string | null
  confirmed_by: string | null
  notes: string | null
}

export interface DailyLog {
  id: string
  company_id: string
  driver_id: string
  log_date: string
  total_loads: number
  total_hours: number
  first_check_in: string | null
  last_check_in: string | null
  created_at: string
}

export interface Invoice {
  id: string
  company_id: string
  client_id: string
  invoice_number: string
  date_from: string | null
  date_to: string | null
  total_loads: number | null
  total_amount: number | null
  status: InvoiceStatus
  pdf_url: string | null
  notes: string | null
  created_at: string
}

export interface InspectionItem {
  id: string
  label: string
  passed: boolean | null
  note: string
  photo_url: string | null
}

export interface PreTripInspection {
  id: string
  company_id: string
  driver_id: string
  truck_number: string | null
  items: InspectionItem[]
  overall_status: 'passed' | 'failed'
  inspected_at: string
}

export interface FuelLog {
  id: string
  company_id: string
  driver_id: string
  gallons: number
  price_per_gallon: number
  total_cost: number
  receipt_url: string | null
  latitude: number | null
  longitude: number | null
  logged_at: string
}

export interface InvoiceLineItem {
  id: string
  invoice_id: string
  load_ticket_id: string
  description: string | null
  quantity: number | null
  unit_price: number | null
  total: number | null
}
