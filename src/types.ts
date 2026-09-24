/**
 * Smart Voyager AI - Shared Types
 */

export type DataStatus = 'LIVE' | 'CACHED' | 'DEMO DATA' | 'ESTIMATED';

export interface DataSourceMeta {
  source_name: string;
  source_type: 'live_api' | 'rag_knowledge' | 'ai_inference' | 'cached' | 'demo_data';
  retrieved_at: string;
  data_status: DataStatus;
  source_url?: string;
  notes?: string;
}

export interface UserPreferences {
  home_city: string;
  preferred_currency: string;
  travel_style: 'budget' | 'balanced' | 'luxury' | 'adventure' | 'family';
  interests: string[];
  food_preference: 'all' | 'vegetarian' | 'vegan' | 'halal' | 'kosher';
  accommodation_preference: 'hostel' | 'budget_hotel' | 'boutique' | 'luxury_resort' | 'apartment';
  transport_preference: 'flight' | 'train' | 'bus' | 'rental_car' | 'fastest' | 'cheapest';
}

export interface User {
  id: string;
  name: string;
  email: string;
  photo_url?: string;
  role: 'user' | 'admin' | string;
  provider?: 'google' | 'password' | 'anonymous' | string;
  preferences: UserPreferences;
  created_at: string;
  last_login_at?: string;
}

export interface TripMember {
  id: string;
  name: string;
  age?: number;
  interests: string[];
  dietary_preference?: string;
  role?: 'Guide' | 'Tour Member' | 'Leader' | 'Family';
  status?: 'active' | 'at_hotel' | 'exploring' | 'rendezvous' | 'en_route' | 'offline';
  last_location_name?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  battery_level?: number;
  last_ping?: string;
  avatar_color?: string;
  phone?: string;
  // Live Mobile GPS & Precision Tracking Fields
  accuracy_meters?: number;
  carrier?: string;
  signal_strength_dbm?: number;
  gps_fix_type?: 'Dual-Band GNSS (±3m)' | 'Differential GPS (±4m)' | 'Cellular Triangulation (±15m)' | 'A-GPS / Wi-Fi';
  speed_kmh?: number;
  heading_degrees?: number;
  altitude_m?: number;
  satellites_locked?: number;
  is_mobile_tracked?: boolean;
  last_mobile_ping_timestamp?: string;
}

export interface MapsGroundingInsight {
  title: string;
  summary: string;
  grounding_sources: Array<{
    title: string;
    uri: string;
  }>;
  review_snippets?: string[];
}

export type ActivityType = 'OUTDOOR' | 'INDOOR' | 'FLEXIBLE';

export interface ItineraryItem {
  id: string;
  time: string;
  title: string;
  category: 'flight' | 'transport' | 'hotel' | 'attraction' | 'restaurant' | 'activity' | 'shopping' | 'leisure';
  description: string;
  location: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  duration_minutes: number;
  travel_time_minutes?: number;
  distance_km?: number;
  transit_info?: string;
  traffic_delay_minutes?: number;
  cost_estimate: number;
  cost_type: 'ESTIMATED' | 'CONFIRMED' | 'FREE';
  opening_status?: string;
  activity_type: ActivityType;
  why_recommended?: string;
  is_weather_vulnerable?: boolean;
  source: DataSourceMeta;
}

export interface ItineraryDay {
  day_number: number;
  date: string;
  title: string;
  theme: string;
  city: string;
  weather_summary?: {
    temp_c: number;
    condition: string;
    icon: string;
    rain_prob_pct: number;
    wind_kmh: number;
    humidity_pct: number;
    is_disrupted?: boolean;
    disruption_reason?: string;
    traffic_advisory?: string;
    traffic_congestion?: 'low' | 'moderate' | 'heavy' | 'severe';
    recommended_transit_mode?: string;
    source: DataSourceMeta;
  };
  items: ItineraryItem[];
  day_cost_estimate: number;
}

export interface TransportOption {
  id: string;
  mode: 'flight' | 'train' | 'bus' | 'car';
  type?: 'flight' | 'train' | 'bus' | 'car' | string;
  carrier: string;
  number: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  duration: string;
  is_direct: boolean;
  price: number;
  currency: string;
  baggage_included?: string;
  carbon_footprint_kg?: number;
  source: DataSourceMeta;
}

export interface HotelOption {
  id: string;
  name: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  rating: number;
  price_per_night: number;
  total_price: number;
  currency: string;
  amenities: string[];
  distance_to_center_km: number;
  image_url?: string;
  source: DataSourceMeta;
}

export interface BookingRecord {
  id: string;
  trip_id: string;
  category: 'transport' | 'hotel';
  type: 'flight' | 'train' | 'bus' | 'cab' | 'hotel';
  reference_number: string; // PNR / E-Ticket Number / Hotel Confirmation ID
  title: string;
  provider_name: string;
  booking_status: 'CONFIRMED' | 'IN_PROCESS' | 'CHECKED_IN';
  booked_date: string;
  travel_date: string;
  end_date?: string;
  origin?: string;
  destination?: string;
  departure_time?: string;
  arrival_time?: string;
  passengers?: Array<{
    name: string;
    seat_or_berth?: string;
    status?: string;
  }>;
  seat_or_room: string;
  class_tier?: string;
  gate_or_platform?: string;
  baggage_or_inclusions?: string;
  price_paid: number;
  currency: string;
  official_site_url: string;
  pnr_verification_url?: string;
  notes?: string;
  transport_tracking?: TransitTrackingInfo;
  source?: DataSourceMeta;
}

export interface BudgetSummary {
  total_budget: number;
  currency: string;
  estimated_cost: {
    transport: number;
    accommodation: number;
    food: number;
    activities: number;
    local_transport: number;
    miscellaneous: number;
    total: number;
  };
  spent_actual: number;
  remaining_budget: number;
  usage_percentage: number;
  status: 'normal' | 'caution' | 'warning' | 'over_budget';
  recommendation_note?: string;
}

export interface ExpenseItem {
  id: string;
  trip_id: string;
  category: 'Transport' | 'Hotel' | 'Food' | 'Activity' | 'Shopping' | 'Local Travel' | 'Other';
  description: string;
  amount: number;
  currency: string;
  date: string;
  paid_by: string;
  participants: string[];
  split_type?: 'equal' | 'custom' | 'exact';
  split_members?: string[];
  per_member_share?: number;
  is_settled?: boolean;
  notes?: string;
  agentic_audit_status?: 'verified' | 'flagged' | 'optimized';
  agentic_note?: string;
}

export interface MemberBalance {
  member_name: string;
  total_paid: number;
  fair_share_owed: number;
  net_balance: number; // positive = to receive, negative = to pay
  avatar_color?: string;
  phone?: string;
}

export interface DebtSettlement {
  id: string;
  from_member: string;
  to_member: string;
  amount: number;
  currency: string;
  is_settled: boolean;
  settled_at?: string;
  description?: string;
}

export interface AgenticExpenseAuditResult {
  pacing_status: 'healthy' | 'caution' | 'critical';
  burn_rate_daily: number;
  burn_rate_target_daily: number;
  projected_total_spend: number;
  projected_savings_or_deficit: number;
  fairness_score_percent: number;
  dominant_payer?: string;
  anomalies_detected: string[];
  settlement_instructions: {
    from: string;
    to: string;
    amount: number;
    reason: string;
  }[];
  agentic_recommendations: string[];
  category_health: {
    category: string;
    allocated: number;
    spent: number;
    pacing_pct: number;
    status: 'good' | 'elevated' | 'exceeded';
  }[];
  audit_timestamp: string;
}

export type TransitLiveStatus =
  | 'ON_TIME'
  | 'DELAYED'
  | 'BOARDING_SOON'
  | 'GATE_ASSIGNED'
  | 'PLATFORM_ASSIGNED'
  | 'WEB_CHECKIN_OPEN'
  | 'CHART_PREPARED'
  | 'DEPARTED'
  | 'IN_TRANSIT'
  | 'ARRIVED';

export interface TransitTimingAlert {
  id: string;
  type: 'delay' | 'gate_platform' | 'checkin' | 'traffic_lead' | 'boarding' | 'itinerary_sync';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  action_label?: string;
  is_dismissed?: boolean;
}

export interface TransitTrackingInfo {
  booking_reference: string;
  carrier: string;
  number: string;
  mode: 'flight' | 'train' | 'bus' | 'cab';
  origin: string;
  destination: string;
  travel_date: string;
  scheduled_departure: string;
  estimated_departure: string;
  scheduled_arrival: string;
  estimated_arrival: string;
  delay_minutes: number;
  status: TransitLiveStatus;
  status_description: string;
  terminal?: string;
  gate_or_platform: string;
  boarding_time?: string;
  web_checkin_url?: string;
  checkin_status: string;
  commute_lead_time_minutes: number;
  recommended_leave_time: string;
  traffic_congestion: 'low' | 'moderate' | 'heavy' | 'severe';
  traffic_note: string;
  last_checked_at: string;
  timing_alerts: TransitTimingAlert[];
  schedule_sync_status: 'synchronized' | 'needs_adjustment' | 'adjusted';
  day1_adaptation_note?: string;
}

export interface DisruptionAlert {
  id: string;
  trip_id: string;
  day_number?: number;
  category?: 'weather' | 'transport_timing' | 'budget' | 'traffic' | 'general';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  suggested_action: string;
  status: 'active' | 'resolved' | 'dismissed';
  created_at: string;
  metadata?: {
    carrier?: string;
    booking_reference?: string;
    gate_or_platform?: string;
    estimated_departure?: string;
    delay_minutes?: number;
    recommended_leave_time?: string;
  };
}

export interface AgentExecutionLog {
  id: string;
  agent_name: 'Coordinator' | 'Transportation' | 'Accommodation' | 'Attractions' | 'Weather' | 'Budget' | 'RAG';
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  tools_used: string[];
  result_summary: string;
  error?: string;
}

export interface TripVersion {
  version: number;
  created_at: string;
  change_summary: string;
  days: ItineraryDay[];
  budget: BudgetSummary;
}

export type TripStatus = 'DRAFT' | 'PLANNING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ActivityRating {
  activity_id: string;
  title: string;
  category?: string;
  rating: number; // 1 to 5
  feedback?: string;
  tags?: string[];
  would_recommend: boolean;
}

export interface TripReview {
  id: string;
  trip_id: string;
  user_id: string;
  destination: string;
  destination_rating: number; // 1 to 5
  destination_feedback: string;
  travel_style_rating?: number; // 1 to 5
  pace_rating?: 'too_slow' | 'just_right' | 'too_rushed';
  value_for_money?: number; // 1 to 5
  activity_ratings: ActivityRating[];
  highlights?: string[];
  tips_for_future_travelers?: string;
  favorite_activity_title?: string;
  avoid_activity_title?: string;
  created_at: string;
  updated_at: string;
  ai_insights_extracted?: {
    preferred_tags: string[];
    avoid_tags: string[];
    refined_travel_style?: string;
  };
}

export interface Trip {
  id: string;
  user_id: string;
  title: string;
  origin: string;
  destination: string;
  destinations?: string[]; // For multi-city trips
  start_date: string;
  end_date: string;
  travellers_count: number;
  members: TripMember[];
  tour_members?: TripMember[];
  budget: number;
  currency: string;
  interests: string[];
  travel_style: string;
  food_preference: string;
  transport_preference: string;
  accommodation_preference: string;
  status: TripStatus;
  version: number;
  versions: TripVersion[];
  transport_options: TransportOption[];
  selected_transport?: TransportOption;
  hotel_options: HotelOption[];
  selected_hotel?: HotelOption;
  booking_records?: BookingRecord[];
  transport_tracking?: TransitTrackingInfo;
  days: ItineraryDay[];
  budget_summary: BudgetSummary;
  alerts: DisruptionAlert[];
  agent_logs: AgentExecutionLog[];
  data_sources: DataSourceMeta[];
  review?: TripReview;
  created_at: string;
  updated_at: string;
}

export interface DestinationGuide {
  id: string;
  name: string;
  country: string;
  tagline: string;
  overview: string;
  best_time_to_visit: string;
  currency: string;
  language: string;
  cultural_tips: string[];
  top_neighborhoods: Array<{ name: string; vibe: string; best_for: string }>;
  safety_advisory: string;
  image_url: string;
  estimated_daily_budget_inr: number;
  popular_attractions: Array<{ name: string; category: string; rating: number; fee_inr: number }>;
}

export interface ApiHealthStatus {
  service?: string;
  name?: string;
  status: 'operational' | 'degraded' | 'unavailable' | 'demo_mode' | 'healthy';
  last_check?: string;
  last_checked?: string;
  response_time_ms?: number;
  latency_ms?: number;
  error_count?: number;
  notes?: string;
}

export interface ExtractedConstraints {
  origin: string;
  destination: string;
  destinations?: string[];
  duration_days: number;
  start_date: string;
  end_date: string;
  travellers_count: number;
  budget: number;
  currency: string;
  interests: string[];
  travel_style: string;
  food_preference: string;
  transport_preference: string;
  selected_transport_id?: string;
  accommodation_preference: string;
}
