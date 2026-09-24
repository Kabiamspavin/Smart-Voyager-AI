import fs from 'fs';
import path from 'path';
import { Trip, User, ExpenseItem, DisruptionAlert, AgentExecutionLog, ApiHealthStatus, DestinationGuide, TripReview } from '../src/types.js';

interface DatabaseSchema {
  users: User[];
  trips: Trip[];
  expenses: ExpenseItem[];
  notifications: DisruptionAlert[];
  agentLogs: AgentExecutionLog[];
  reviews: TripReview[];
  apiHealth: Record<string, ApiHealthStatus>;
  cache: Record<string, { data: any; expiresAt: number }>;
}

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'smart_voyager.json');

const defaultUser: User = {
  id: 'usr_demo_01',
  name: 'Kaviamspavin',
  email: 'kabiamspavin75@gmail.com',
  role: 'admin',
  preferences: {
    home_city: 'Chennai',
    preferred_currency: 'INR',
    travel_style: 'balanced',
    interests: ['Heritage', 'Food', 'Nature', 'Shopping'],
    food_preference: 'all',
    accommodation_preference: 'boutique',
    transport_preference: 'flight',
  },
  created_at: new Date().toISOString(),
};

const sampleTrips: Trip[] = [
  {
    id: 'trip_delhi_5d',
    user_id: 'usr_demo_01',
    title: 'Chennai to Delhi Cultural & Culinary Odyssey',
    origin: 'Chennai',
    destination: 'Delhi',
    destinations: ['Delhi'],
    start_date: '2026-10-10',
    end_date: '2026-10-14',
    travellers_count: 4,
    members: [
      { id: 'm1', name: 'Kavi (Lead)', interests: ['Heritage', 'Food'] },
      { id: 'm2', name: 'Pavin', interests: ['Photography', 'Shopping'] },
      { id: 'm3', name: 'Aarav (Kid)', age: 10, interests: ['Nature', 'Science'] },
      { id: 'm4', name: 'Meera', interests: ['Spiritual', 'Food'] },
    ],
    budget: 80000,
    currency: 'INR',
    interests: ['Heritage', 'Food', 'Shopping', 'Nature'],
    travel_style: 'family',
    food_preference: 'all',
    transport_preference: 'flight',
    accommodation_preference: 'boutique',
    status: 'PLANNING',
    version: 1,
    versions: [
      {
        version: 1,
        created_at: '2026-09-17T08:00:00.000Z',
        change_summary: 'Initial multi-agent itinerary synthesized from user request.',
        days: [],
        budget: {
          total_budget: 80000,
          currency: 'INR',
          estimated_cost: {
            transport: 28000,
            accommodation: 22000,
            food: 14000,
            activities: 8500,
            local_transport: 4500,
            miscellaneous: 2000,
            total: 79000,
          },
          spent_actual: 32000,
          remaining_budget: 1000,
          usage_percentage: 98.7,
          status: 'caution',
          recommendation_note: 'Budget tightly packed at 98.7%. Consider metro transit on Day 3 to save ₹1,500.',
        },
      },
    ],
    transport_options: [
      {
        id: 'fl_6e204',
        mode: 'flight',
        carrier: 'IndiGo 6E-204',
        number: '6E-204',
        origin: 'MAA (Chennai)',
        destination: 'DEL (Delhi T3)',
        departure_time: '06:15 AM',
        arrival_time: '09:00 AM',
        duration: '2h 45m',
        is_direct: true,
        price: 28000,
        currency: 'INR',
        baggage_included: '15kg check-in + 7kg cabin per person',
        carbon_footprint_kg: 142,
        source: {
          source_name: 'Amadeus Flight Availability / Direct GDS',
          source_type: 'live_api',
          retrieved_at: new Date().toISOString(),
          data_status: 'LIVE',
        },
      },
    ],
    hotel_options: [
      {
        id: 'htl_the_claridges',
        name: 'The Claridges New Delhi',
        location: '12 Dr APJ Abdul Kalam Road, New Delhi',
        coordinates: { lat: 28.5997, lng: 77.2185 },
        rating: 4.6,
        price_per_night: 5500,
        total_price: 22000,
        currency: 'INR',
        amenities: ['Breakfast Included', 'Family Suites', 'Swimming Pool', 'Heritage Architecture'],
        distance_to_center_km: 2.1,
        source: {
          source_name: 'Google Places & Hotel Distribution Feed',
          source_type: 'live_api',
          retrieved_at: new Date().toISOString(),
          data_status: 'LIVE',
        },
      },
    ],
    days: [
      {
        day_number: 1,
        date: '2026-10-10',
        title: 'Arrival in the Capital & Lutyens Splendor',
        theme: 'Historical Heritage & Grand Vistas',
        city: 'Delhi',
        weather_summary: {
          temp_c: 28,
          condition: 'Pleasant & Sunny',
          icon: 'Sun',
          rain_prob_pct: 5,
          wind_kmh: 12,
          humidity_pct: 45,
          source: {
            source_name: 'Open-Meteo Real-Time Weather Engine',
            source_type: 'live_api',
            retrieved_at: new Date().toISOString(),
            data_status: 'LIVE',
          },
        },
        items: [
          {
            id: 'item_1_1',
            time: '06:15 - 09:00',
            title: 'Flight: Chennai (MAA) to Delhi (DEL)',
            category: 'flight',
            description: 'Direct flight IndiGo 6E-204 into Delhi IGI Terminal 3. Refreshments on board.',
            location: 'Chennai Airport (MAA) to IGI T3 (DEL)',
            duration_minutes: 165,
            cost_estimate: 14000,
            cost_type: 'CONFIRMED',
            activity_type: 'INDOOR',
            why_recommended: 'Early departure secures maximum daylight on arrival day (4 passengers).',
            source: {
              source_name: 'IndiGo Schedules API',
              source_type: 'live_api',
              retrieved_at: new Date().toISOString(),
              data_status: 'LIVE',
            },
          },
          {
            id: 'item_1_2',
            time: '10:00 - 11:30',
            title: 'Airport Transfer to The Claridges Hotel',
            category: 'transport',
            description: 'Pre-arranged EV SUV cab via Airport Express corridor.',
            location: 'Aerocity to Dr APJ Abdul Kalam Road',
            duration_minutes: 45,
            distance_km: 15.4,
            cost_estimate: 1200,
            cost_type: 'ESTIMATED',
            activity_type: 'FLEXIBLE',
            why_recommended: 'Smooth zero-emission transit directly to heritage zone.',
            source: {
              source_name: 'Google Routes / City Mobility Live',
              source_type: 'live_api',
              retrieved_at: new Date().toISOString(),
              data_status: 'LIVE',
            },
          },
          {
            id: 'item_1_3',
            time: '14:00 - 16:30',
            title: 'India Gate & Kartavya Path Stroll',
            category: 'attraction',
            description: 'Walk through the grand ceremonial boulevard and pay homage at the National War Memorial.',
            location: 'Kartavya Path, India Gate, New Delhi',
            coordinates: { lat: 28.6129, lng: 77.2295 },
            duration_minutes: 120,
            cost_estimate: 0,
            cost_type: 'FREE',
            opening_status: 'Open 24 hours (Memorial illumination starts 6 PM)',
            activity_type: 'OUTDOOR',
            why_recommended: 'Iconic architectural symbol of India with wide paved pedestrian plazas perfect for kids.',
            source: {
              source_name: 'Google Places API',
              source_type: 'live_api',
              retrieved_at: new Date().toISOString(),
              data_status: 'LIVE',
            },
          },
          {
            id: 'item_1_4',
            time: '17:30 - 19:30',
            title: 'Lodhi Garden Sunset Heritage Walk',
            category: 'attraction',
            description: 'Explore 15th-century Sayyid & Lodi tombs nestled amidst 90 acres of landscaped botanical lawns.',
            location: 'Lodhi Road, New Delhi',
            coordinates: { lat: 28.5933, lng: 77.2197 },
            duration_minutes: 120,
            cost_estimate: 0,
            cost_type: 'FREE',
            opening_status: 'Open until 8:00 PM',
            activity_type: 'OUTDOOR',
            why_recommended: 'Calm green oasis close to hotel; combines Mughal-era architecture with bird watching.',
            source: {
              source_name: 'Archaeological Survey of India / Live Places',
              source_type: 'live_api',
              retrieved_at: new Date().toISOString(),
              data_status: 'LIVE',
            },
          },
          {
            id: 'item_1_5',
            time: '20:00 - 21:45',
            title: 'Welcome Dinner at Gulati Restaurant, Pandara Road',
            category: 'restaurant',
            description: 'Legendary North Indian Mughlai curries, fragrant biryanis, and succulent tandoor delicacies.',
            location: '6, Pandara Road Market, New Delhi',
            coordinates: { lat: 28.6074, lng: 77.2341 },
            duration_minutes: 100,
            cost_estimate: 3400,
            cost_type: 'ESTIMATED',
            opening_status: 'Open until 12:00 AM',
            activity_type: 'INDOOR',
            why_recommended: 'Delhi culinary landmark with vegetarian and non-vegetarian options satisfying diverse family tastes.',
            source: {
              source_name: 'Zomato / Google Places Verified',
              source_type: 'live_api',
              retrieved_at: new Date().toISOString(),
              data_status: 'LIVE',
            },
          },
        ],
        day_cost_estimate: 18600,
      },
      {
        day_number: 2,
        date: '2026-10-11',
        title: 'Old Delhi Heritage & Chandni Chowk Food Trail',
        theme: 'Shahjahanabad History & Street Food Culture',
        city: 'Delhi',
        weather_summary: {
          temp_c: 29,
          condition: 'Clear Sky',
          icon: 'Sun',
          rain_prob_pct: 0,
          wind_kmh: 10,
          humidity_pct: 42,
          source: {
            source_name: 'Open-Meteo Real-Time Weather Engine',
            source_type: 'live_api',
            retrieved_at: new Date().toISOString(),
            data_status: 'LIVE',
          },
        },
        items: [
          {
            id: 'item_2_1',
            time: '09:00 - 11:30',
            title: 'The Majestic Red Fort (Lal Qila)',
            category: 'attraction',
            description: '17th-century Mughal palace fort with red sandstone ramparts, Diwan-i-Aam, and museum halls.',
            location: 'Netaji Subhash Marg, Chandni Chowk, Delhi',
            coordinates: { lat: 28.6562, lng: 77.2410 },
            duration_minutes: 150,
            cost_estimate: 200,
            cost_type: 'CONFIRMED',
            opening_status: 'Open 9:30 AM - 4:30 PM (Closed Mondays)',
            activity_type: 'OUTDOOR',
            why_recommended: 'UNESCO World Heritage monument showcasing the pinnacle of Mughal architectural symmetry.',
            source: {
              source_name: 'ASI Ticketing & Google Places',
              source_type: 'live_api',
              retrieved_at: new Date().toISOString(),
              data_status: 'LIVE',
            },
          },
          {
            id: 'item_2_2',
            time: '12:00 - 14:00',
            title: 'Jama Masjid & Karim\'s Old Delhi Lunch',
            category: 'restaurant',
            description: 'Visit India\'s largest historic congregational mosque followed by historic dining at Karim\'s (est. 1913).',
            location: 'Gali Kababian, Jama Masjid, Delhi',
            coordinates: { lat: 28.6507, lng: 77.2334 },
            duration_minutes: 120,
            cost_estimate: 2800,
            cost_type: 'ESTIMATED',
            activity_type: 'INDOOR',
            why_recommended: 'Unrivaled cultural immersion and genuine culinary roots of historic Shahjahanabad.',
            source: {
              source_name: 'Google Places API',
              source_type: 'live_api',
              retrieved_at: new Date().toISOString(),
              data_status: 'LIVE',
            },
          },
          {
            id: 'item_2_3',
            time: '15:00 - 18:00',
            title: 'Chandni Chowk & Khari Baoli Spice Market Rickshaw Tour',
            category: 'shopping',
            description: 'Cycle rickshaw ride through Asia\'s largest wholesale spice market and bustling wedding apparel bazaars.',
            location: 'Khari Baoli, Chandni Chowk, Old Delhi',
            coordinates: { lat: 28.6575, lng: 77.2245 },
            duration_minutes: 180,
            cost_estimate: 2500,
            cost_type: 'ESTIMATED',
            activity_type: 'FLEXIBLE',
            why_recommended: 'High-sensory cultural experience with authentic saffron, dry fruits, teas, and local shopping.',
            source: {
              source_name: 'RAG Knowledge & Delhi Tourism Guide',
              source_type: 'rag_knowledge',
              retrieved_at: new Date().toISOString(),
              data_status: 'LIVE',
            },
          },
        ],
        day_cost_estimate: 5500,
      },
      {
        day_number: 3,
        date: '2026-10-12',
        title: 'Spiritual Wonders: Qutub Minar & Lotus Temple',
        theme: 'Architectural Antiquity & Inter-Faith Harmony',
        city: 'Delhi',
        weather_summary: {
          temp_c: 27,
          condition: 'Scattered Clouds',
          icon: 'CloudSun',
          rain_prob_pct: 15,
          wind_kmh: 14,
          humidity_pct: 50,
          source: {
            source_name: 'Open-Meteo Real-Time Weather Engine',
            source_type: 'live_api',
            retrieved_at: new Date().toISOString(),
            data_status: 'LIVE',
          },
        },
        items: [
          {
            id: 'item_3_1',
            time: '09:30 - 12:00',
            title: 'Qutub Minar Complex & Iron Pillar of Delhi',
            category: 'attraction',
            description: '73-meter brick minaret built in 1192 and the rust-resistant 4th-century Gupta iron pillar.',
            location: 'Mehrauli, South West Delhi',
            coordinates: { lat: 28.5245, lng: 77.1855 },
            duration_minutes: 150,
            cost_estimate: 200,
            cost_type: 'CONFIRMED',
            opening_status: 'Open 7:00 AM - 5:00 PM',
            activity_type: 'OUTDOOR',
            why_recommended: 'Ancient metallurgical marvel and UNESCO World Heritage sanctuary with spacious lawns.',
            source: {
              source_name: 'Google Places API',
              source_type: 'live_api',
              retrieved_at: new Date().toISOString(),
              data_status: 'LIVE',
            },
          },
          {
            id: 'item_3_2',
            time: '13:00 - 14:30',
            title: 'Lunch at Olive Bar & Kitchen (Mehrauli)',
            category: 'restaurant',
            description: 'Sun-dappled courtyard Italian & Mediterranean dining under a banyan tree overlooking the Qutub Minar.',
            location: 'One Style Mile, Haveli 6, Kalka Das Marg, Mehrauli',
            coordinates: { lat: 28.5262, lng: 77.1868 },
            duration_minutes: 90,
            cost_estimate: 3600,
            cost_type: 'ESTIMATED',
            activity_type: 'INDOOR',
            why_recommended: 'Relaxing ambient break minutes from Qutub Minar, perfect for group refreshment.',
            source: {
              source_name: 'Zomato Live Ratings',
              source_type: 'live_api',
              retrieved_at: new Date().toISOString(),
              data_status: 'LIVE',
            },
          },
          {
            id: 'item_3_3',
            time: '15:30 - 17:30',
            title: 'Lotus Temple (Bahá\'í House of Worship)',
            category: 'attraction',
            description: 'Pristine 27-petal white marble lotus sanctuary open to people of all faiths for silent meditation.',
            location: 'Lotus Temple Rd, Bahapur, Kalkaji, New Delhi',
            coordinates: { lat: 28.5535, lng: 77.2588 },
            duration_minutes: 120,
            cost_estimate: 0,
            cost_type: 'FREE',
            opening_status: 'Open 9:00 AM - 5:30 PM (Closed Mondays)',
            activity_type: 'INDOOR',
            why_recommended: 'Acclaimed modern structural design offering peace and tranquility in South Delhi.',
            source: {
              source_name: 'Bahá\'í Trust & Google Places',
              source_type: 'live_api',
              retrieved_at: new Date().toISOString(),
              data_status: 'LIVE',
            },
          },
        ],
        day_cost_estimate: 4200,
      },
      {
        day_number: 4,
        date: '2026-10-13',
        title: 'Artisan Crafts & Handicrafts at Dilli Haat',
        theme: 'Pan-Indian Crafts, Folk Art & Regional Delicacies',
        city: 'Delhi',
        weather_summary: {
          temp_c: 28,
          condition: 'Sunny',
          icon: 'Sun',
          rain_prob_pct: 10,
          wind_kmh: 11,
          humidity_pct: 46,
          source: {
            source_name: 'Open-Meteo Real-Time Weather Engine',
            source_type: 'live_api',
            retrieved_at: new Date().toISOString(),
            data_status: 'LIVE',
          },
        },
        items: [
          {
            id: 'item_4_1',
            time: '10:00 - 12:30',
            title: 'National Museum of India',
            category: 'attraction',
            description: 'Explore 5,000 years of civilization: Harappan Bronze Dancing Girl, Buddhist art, and ancient weaponry.',
            location: 'Janpath, Connaught Place, New Delhi',
            coordinates: { lat: 28.6118, lng: 77.2193 },
            duration_minutes: 150,
            cost_estimate: 80,
            cost_type: 'CONFIRMED',
            opening_status: 'Open 10:00 AM - 6:00 PM (Closed Mondays)',
            activity_type: 'INDOOR',
            why_recommended: 'Exceptional educational experience for Aarav and the family with air-conditioned comfort.',
            source: {
              source_name: 'Ministry of Culture / ASI',
              source_type: 'live_api',
              retrieved_at: new Date().toISOString(),
              data_status: 'LIVE',
            },
          },
          {
            id: 'item_4_2',
            time: '13:30 - 18:00',
            title: 'Dilli Haat INA (Crafts & Food Bazaar)',
            category: 'shopping',
            description: 'Open-air village market with rotating artisans from across all 28 states of India and authentic regional food stalls.',
            location: 'INA Market, Dilli Haat, Kidwai Nagar West, New Delhi',
            coordinates: { lat: 28.5732, lng: 77.2075 },
            duration_minutes: 270,
            cost_estimate: 4000,
            cost_type: 'ESTIMATED',
            opening_status: 'Open 10:30 AM - 10:00 PM Daily',
            activity_type: 'FLEXIBLE',
            why_recommended: 'Direct artisan purchasing without middlemen; taste Momos, Rajasthani Pyaaz Kachoris, and Kashmiri Kahwa.',
            source: {
              source_name: 'Delhi Tourism Live Portal',
              source_type: 'live_api',
              retrieved_at: new Date().toISOString(),
              data_status: 'LIVE',
            },
          },
        ],
        day_cost_estimate: 4400,
      },
      {
        day_number: 5,
        date: '2026-10-14',
        title: 'Humayun’s Tomb & Return Flight to Chennai',
        theme: 'Charbagh Garden Tombs & Homeward Transit',
        city: 'Delhi',
        weather_summary: {
          temp_c: 29,
          condition: 'Clear',
          icon: 'Sun',
          rain_prob_pct: 0,
          wind_kmh: 9,
          humidity_pct: 44,
          source: {
            source_name: 'Open-Meteo Real-Time Weather Engine',
            source_type: 'live_api',
            retrieved_at: new Date().toISOString(),
            data_status: 'LIVE',
          },
        },
        items: [
          {
            id: 'item_5_1',
            time: '08:30 - 11:00',
            title: 'Humayun’s Tomb & Sunder Nursery Complex',
            category: 'attraction',
            description: 'The architectural precursor to the Taj Mahal with red sandstone double domes and restored 16th-century Persian water gardens.',
            location: 'Mathura Road, Nizamuddin East, New Delhi',
            coordinates: { lat: 28.5933, lng: 77.2507 },
            duration_minutes: 150,
            cost_estimate: 200,
            cost_type: 'CONFIRMED',
            opening_status: 'Open sunrise to sunset',
            activity_type: 'OUTDOOR',
            why_recommended: 'Aga Khan Trust restored masterpiece with shaded walking paths and stunning morning lighting.',
            source: {
              source_name: 'Google Places API',
              source_type: 'live_api',
              retrieved_at: new Date().toISOString(),
              data_status: 'LIVE',
            },
          },
          {
            id: 'item_5_2',
            time: '12:00 - 13:30',
            title: 'Hotel Check-out & Farewell Lunch at Claridges',
            category: 'hotel',
            description: 'Pack bags, complete express check-out, and enjoy light lunch before airport transit.',
            location: 'The Claridges New Delhi',
            duration_minutes: 90,
            cost_estimate: 2000,
            cost_type: 'ESTIMATED',
            activity_type: 'INDOOR',
            why_recommended: 'Relaxed transition without rushing with kids.',
            source: {
              source_name: 'Hotel Concierge',
              source_type: 'live_api',
              retrieved_at: new Date().toISOString(),
              data_status: 'LIVE',
            },
          },
          {
            id: 'item_5_3',
            time: '16:45 - 19:35',
            title: 'Flight: Delhi (DEL T3) to Chennai (MAA)',
            category: 'flight',
            description: 'IndiGo 6E-205 non-stop flight landing back safely in Chennai.',
            location: 'Delhi Airport (DEL) to Chennai Airport (MAA)',
            duration_minutes: 170,
            cost_estimate: 14000,
            cost_type: 'CONFIRMED',
            activity_type: 'INDOOR',
            why_recommended: 'Confirmed return flight ticket landing back in Chennai (4 passengers).',
            source: {
              source_name: 'IndiGo Schedules API',
              source_type: 'live_api',
              retrieved_at: new Date().toISOString(),
              data_status: 'LIVE',
            },
          },
        ],
        day_cost_estimate: 16200,
      },
    ],
    budget_summary: {
      total_budget: 80000,
      currency: 'INR',
      estimated_cost: {
        transport: 28000,
        accommodation: 22000,
        food: 14000,
        activities: 8500,
        local_transport: 4500,
        miscellaneous: 2000,
        total: 79000,
      },
      spent_actual: 32000,
      remaining_budget: 1000,
      usage_percentage: 98.7,
      status: 'caution',
      recommendation_note: 'Budget tightly packed at 98.7%. Consider Delhi Metro for Day 3 to save ₹1,500 on cabs.',
    },
    alerts: [
      {
        id: 'alt_trans_01',
        trip_id: 'trip_delhi_5d',
        category: 'transport_timing',
        severity: 'medium',
        title: '⚡ Live Tracking Active: IndiGo 6E-204 (6E-8KJ92Z)',
        description: 'Autonomous Transportation Agent is continuously monitoring departures, live Gate 4B, and commute buffers for your trip.',
        suggested_action: 'View Boarding Pass & Timings',
        status: 'active',
        created_at: new Date().toISOString(),
        metadata: {
          carrier: 'IndiGo 6E-204',
          booking_reference: '6E-8KJ92Z',
          gate_or_platform: 'Gate 4B (Terminal 1)',
          estimated_departure: '06:15 AM',
          delay_minutes: 0,
          recommended_leave_time: '04:00 AM',
        },
      },
      {
        id: 'alt_trans_02',
        trip_id: 'trip_delhi_5d',
        category: 'transport_timing',
        severity: 'medium',
        title: '🚗 Commute Advisory: Depart home by 04:00 AM',
        description: 'Allow 45 min road transit to MAA Airport + 90 min security & check-in buffer for scheduled 06:15 AM departure.',
        suggested_action: 'View Traffic Route',
        status: 'active',
        created_at: new Date().toISOString(),
        metadata: {
          carrier: 'IndiGo 6E-204',
          booking_reference: '6E-8KJ92Z',
          recommended_leave_time: '04:00 AM',
        },
      },
      {
        id: 'alt_trans_03',
        trip_id: 'trip_delhi_5d',
        category: 'transport_timing',
        severity: 'low',
        title: '📍 Gate 4B Allocated (Terminal 1)',
        description: 'IndiGo 6E-204 boarding via Gate 4B Aerobridge. Scheduled departure on-time at 06:15 AM.',
        suggested_action: 'View Boarding Pass',
        status: 'active',
        created_at: new Date().toISOString(),
        metadata: {
          carrier: 'IndiGo 6E-204',
          gate_or_platform: 'Gate 4B (Terminal 1)',
          estimated_departure: '06:15 AM',
        },
      },
      {
        id: 'alt_01',
        trip_id: 'trip_delhi_5d',
        day_number: 3,
        category: 'weather',
        severity: 'low',
        title: 'Mild Precipitation Watch on Day 3',
        description: 'Open-Meteo detected 15% rain probability around South Delhi during afternoon. Lotus Temple is indoor and unaffected.',
        suggested_action: 'Carry light folding umbrellas during Qutub Minar morning walk.',
        status: 'active',
        created_at: new Date().toISOString(),
      },
    ],
    agent_logs: [
      {
        id: 'log_trans_01',
        agent_name: 'Transportation',
        status: 'completed',
        started_at: '2026-09-17T08:00:00.000Z',
        completed_at: '2026-09-17T08:00:00.650Z',
        duration_ms: 650,
        tools_used: ['trackLiveTransit', 'calculateCommuteBuffer', 'verifyPlatformAllocation'],
        result_summary: 'Autonomous Transportation Timing Agent: Active monitoring for IndiGo 6E-204 (PNR: 6E-8KJ92Z). Scheduled Dep 06:15 AM, Gate 4B, On-Time. Leave home by 04:00 AM.',
      },
      {
        id: 'log_01',
        agent_name: 'Coordinator',
        status: 'completed',
        started_at: '2026-09-17T08:00:00.000Z',
        completed_at: '2026-09-17T08:00:01.200Z',
        duration_ms: 1200,
        tools_used: ['extractConstraints', 'dispatchAgents', 'resolveConflicts'],
        result_summary: 'Synthesized constraints for 4 travellers from Chennai to Delhi for 5 days with ₹80,000 budget.',
      },
      {
        id: 'log_02',
        agent_name: 'Transportation',
        status: 'completed',
        started_at: '2026-09-17T08:00:01.200Z',
        completed_at: '2026-09-17T08:00:02.800Z',
        duration_ms: 1600,
        tools_used: ['searchFlights', 'calculateTransportCost'],
        result_summary: 'Queried direct flights: IndiGo 6E-204 (₹28,000 round trip for 4) selected as most punctual and cost-effective.',
      },
      {
        id: 'log_03',
        agent_name: 'Accommodation',
        status: 'completed',
        started_at: '2026-09-17T08:00:02.800Z',
        completed_at: '2026-09-17T08:00:04.100Z',
        duration_ms: 1300,
        tools_used: ['searchHotels', 'calculateDistance', 'calculateHotelCost'],
        result_summary: 'Selected The Claridges New Delhi (₹5,500/night) for proximity to Lutyens attractions and family amenities.',
      },
      {
        id: 'log_04',
        agent_name: 'Attractions',
        status: 'completed',
        started_at: '2026-09-17T08:00:04.100Z',
        completed_at: '2026-09-17T08:00:05.900Z',
        duration_ms: 1800,
        tools_used: ['searchPlaces', 'getOpeningHours', 'clusterByDistance'],
        result_summary: 'Grouped 14 heritage, culinary, and shopping spots logically across 5 geographic clusters to eliminate zigzag transit.',
      },
      {
        id: 'log_05',
        agent_name: 'Weather',
        status: 'completed',
        started_at: '2026-09-17T08:00:05.900Z',
        completed_at: '2026-09-17T08:00:06.500Z',
        duration_ms: 600,
        tools_used: ['getRealtimeForecast', 'checkDisruptions'],
        result_summary: 'Live weather retrieved from Open-Meteo. Pleasant temperatures (27-29°C), low rain risks.',
      },
      {
        id: 'log_06',
        agent_name: 'Budget',
        status: 'completed',
        started_at: '2026-09-17T08:00:06.500Z',
        completed_at: '2026-09-17T08:00:07.100Z',
        duration_ms: 600,
        tools_used: ['calculateTotalTripCost', 'validateThresholds'],
        result_summary: 'Total projected cost ₹79,000 matches user ₹80,000 limit with ₹1,000 buffer (98.7% utilization).',
      },
    ],
    data_sources: [
      {
        source_name: 'Amadeus / IndiGo Schedules GDS',
        source_type: 'live_api',
        retrieved_at: new Date().toISOString(),
        data_status: 'LIVE',
        notes: 'Live flight pricing and schedules',
      },
      {
        source_name: 'Open-Meteo Live Forecast Engine',
        source_type: 'live_api',
        retrieved_at: new Date().toISOString(),
        data_status: 'LIVE',
        notes: 'Real-time weather, temperature, humidity and rainfall probabilities',
      },
      {
        source_name: 'Google Places & OpenStreetMap Overpass',
        source_type: 'live_api',
        retrieved_at: new Date().toISOString(),
        data_status: 'LIVE',
        notes: 'Attraction coordinates, ratings, and operating hours',
      },
      {
        source_name: 'Open Exchange Rates (open.er-api.com)',
        source_type: 'live_api',
        retrieved_at: new Date().toISOString(),
        data_status: 'LIVE',
        notes: 'Real-time live currency exchange rates updated hourly',
      },
    ],
    transport_tracking: {
      booking_reference: '6E-8KJ92Z',
      carrier: 'IndiGo 6E-204',
      number: '6E-204',
      mode: 'flight',
      origin: 'MAA (Chennai)',
      destination: 'DEL (Delhi T3)',
      travel_date: '2026-10-10',
      scheduled_departure: '06:15 AM',
      estimated_departure: '06:15 AM',
      scheduled_arrival: '09:00 AM',
      estimated_arrival: '09:00 AM',
      delay_minutes: 0,
      status: 'ON_TIME',
      status_description: 'Autonomous Transportation Agent telemetry confirms flight is running strictly on published schedule.',
      terminal: 'Terminal 1 (Domestic)',
      gate_or_platform: 'Gate 4B (Direct Aerobridge)',
      boarding_time: '05:35 AM',
      web_checkin_url: 'https://www.goindigo.in/web-check-in.html',
      checkin_status: 'Web Check-in Active (Boarding Passes Ready)',
      commute_lead_time_minutes: 135,
      recommended_leave_time: '04:00 AM',
      traffic_congestion: 'moderate',
      traffic_note: 'Normal arterial road flow on GST Road toward Chennai Airport (MAA).',
      last_checked_at: new Date().toISOString(),
      timing_alerts: [
        {
          id: 'tt_01',
          type: 'checkin',
          severity: 'medium',
          title: '⚡ Live Tracking Active: IndiGo 6E-204 (6E-8KJ92Z)',
          message: 'Autonomous Transportation Agent is continuously monitoring departures, live Gate 4B, and commute buffers for your trip.',
          timestamp: new Date().toISOString(),
          action_label: 'View Boarding Pass',
        },
        {
          id: 'tt_02',
          type: 'traffic_lead',
          severity: 'medium',
          title: '🚗 Commute Advisory: Depart home by 04:00 AM',
          message: 'Allow 45 min road transit to MAA Airport + 90 min security & check-in buffer for scheduled 06:15 AM departure.',
          timestamp: new Date().toISOString(),
          action_label: 'View Route',
        },
        {
          id: 'tt_03',
          type: 'gate_platform',
          severity: 'low',
          title: '📍 Gate 4B Allocated (Terminal 1)',
          message: 'IndiGo 6E-204 boarding via Gate 4B Aerobridge. Scheduled departure on-time at 06:15 AM.',
          timestamp: new Date().toISOString(),
          action_label: 'View Terminal Guide',
        },
      ],
      schedule_sync_status: 'synchronized',
      day1_adaptation_note: 'Day 1 itinerary items scheduled starting 10:30 AM seamlessly accommodate estimated arrival at 09:00 AM.',
    },
    booking_records: [
      {
        id: 'rec_trans_demo_01',
        trip_id: 'trip_delhi_5d',
        category: 'transport',
        type: 'flight',
        reference_number: '6E-8KJ92Z',
        title: 'IndiGo 6E-204 Confirmed Boarding Pass',
        provider_name: 'IndiGo 6E-204',
        booking_status: 'CONFIRMED',
        booked_date: '2026-09-17T08:00:00Z',
        travel_date: '2026-10-10',
        end_date: '2026-10-14',
        origin: 'MAA (Chennai)',
        destination: 'DEL (Delhi T3)',
        departure_time: '06:15 AM',
        arrival_time: '09:00 AM',
        passengers: [
          { name: 'Kavi (Guide)', seat_or_berth: '12A (Window)', status: 'CONFIRMED' },
          { name: 'Pavin', seat_or_berth: '12B (Middle)', status: 'CONFIRMED' },
          { name: 'Aarav (Kid)', seat_or_berth: '12C (Aisle)', status: 'CONFIRMED' },
          { name: 'Meera', seat_or_berth: '12D (Aisle)', status: 'CONFIRMED' },
        ],
        seat_or_room: 'Seats 12A, 12B, 12C, 12D',
        class_tier: 'Economy (Express Flex)',
        gate_or_platform: 'Gate 4B (Terminal 1)',
        baggage_or_inclusions: '15kg check-in + 7kg cabin baggage per passenger',
        price_paid: 28000,
        currency: 'INR',
        official_site_url: 'https://www.goindigo.in',
        pnr_verification_url: 'https://www.goindigo.in/web-check-in.html',
        notes: 'Direct flight verified. Web check-in active. Electronic boarding passes generated.',
        source: {
          source_name: 'IndiGo Live API',
          source_type: 'live_api',
          retrieved_at: new Date().toISOString(),
          data_status: 'LIVE',
        },
      },
    ],
    created_at: '2026-09-17T08:00:00.000Z',
    updated_at: new Date().toISOString(),
  },
];

const sampleExpenses: ExpenseItem[] = [
  {
    id: 'exp_01',
    trip_id: 'trip_delhi_5d',
    category: 'Transport',
    description: 'Round-trip Flight Tickets (Chennai <-> Delhi 4 pax)',
    amount: 28000,
    currency: 'INR',
    date: '2026-10-10',
    paid_by: 'Kavi',
    participants: ['Kavi', 'Pavin', 'Aarav', 'Meera'],
  },
  {
    id: 'exp_02',
    trip_id: 'trip_delhi_5d',
    category: 'Hotel',
    description: 'Hotel Deposit (The Claridges Advance Booking)',
    amount: 4000,
    currency: 'INR',
    date: '2026-10-10',
    paid_by: 'Kavi',
    participants: ['Kavi', 'Pavin', 'Aarav', 'Meera'],
  },
];

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        parsed.reviews = parsed.reviews || [];
        return parsed;
      }
    } catch (e) {
      console.warn('Could not read existing database file, seeding defaults:', e);
    }

    const initial: DatabaseSchema = {
      users: [defaultUser],
      trips: sampleTrips,
      expenses: sampleExpenses,
      reviews: [],
      notifications: [
        {
          id: 'notif_01',
          trip_id: 'trip_delhi_5d',
          severity: 'low',
          title: 'Trip Confirmed & Monitored',
          description: 'Smart Voyager continuous monitoring service is tracking flight 6E-204 and Delhi weather forecasts.',
          suggested_action: 'Check weather status 24 hours before departure.',
          status: 'active',
          created_at: new Date().toISOString(),
        },
      ],
      agentLogs: sampleTrips[0].agent_logs,
      apiHealth: {
        gemini: {
          service: 'gemini',
          name: 'Google Gemini 3.8 Flash',
          status: 'operational',
          last_check: new Date().toISOString(),
          response_time_ms: 240,
          error_count: 0,
          notes: 'Server-side @google/genai SDK initialized',
        },
        weather: {
          service: 'weather',
          name: 'Open-Meteo & OpenWeatherMap',
          status: 'operational',
          last_check: new Date().toISOString(),
          response_time_ms: 110,
          error_count: 0,
          notes: 'Real-time live weather active with zero latency penalty',
        },
        currency: {
          service: 'currency',
          name: 'Open Exchange Rates (open.er-api.com)',
          status: 'operational',
          last_check: new Date().toISOString(),
          response_time_ms: 95,
          error_count: 0,
          notes: 'Live global FX rates cached hourly with sub-100ms response',
        },
        places: {
          service: 'places',
          name: 'Google Places / Overpass Geocoder',
          status: 'operational',
          last_check: new Date().toISOString(),
          response_time_ms: 180,
          error_count: 0,
          notes: 'Attraction lookup and opening hours active',
        },
        flights: {
          service: 'flights',
          name: 'Amadeus GDS & Flight Hub',
          status: 'operational',
          last_check: new Date().toISOString(),
          response_time_ms: 320,
          error_count: 0,
          notes: 'Direct and connecting route calculations operational',
        },
      },
      cache: {},
    };

    this.save(initial);
    return initial;
  }

  private save(data = this.data) {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  // Users
  getUser(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  getUserByEmail(email: string): User | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  createUser(user: User): User {
    this.data.users.push(user);
    this.save();
    return user;
  }

  updateUser(id: string, updates: Partial<User>): User | undefined {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    this.data.users[idx] = { ...this.data.users[idx], ...updates };
    this.save();
    return this.data.users[idx];
  }

  // Trips
  getTrips(userId?: string): Trip[] {
    if (!userId) return this.data.trips;
    return this.data.trips.filter((t) => t.user_id === userId);
  }

  getTrip(id: string): Trip | undefined {
    return this.data.trips.find((t) => t.id === id);
  }

  saveTrip(trip: Trip): Trip {
    const idx = this.data.trips.findIndex((t) => t.id === trip.id);
    if (idx >= 0) {
      this.data.trips[idx] = { ...trip, updated_at: new Date().toISOString() };
    } else {
      this.data.trips.unshift(trip);
    }
    this.save();
    return trip;
  }

  deleteTrip(id: string): boolean {
    const initLen = this.data.trips.length;
    this.data.trips = this.data.trips.filter((t) => t.id !== id);
    this.data.expenses = this.data.expenses.filter((e) => e.trip_id !== id);
    this.data.notifications = this.data.notifications.filter((n) => n.trip_id !== id);
    this.save();
    return this.data.trips.length < initLen;
  }

  // Expenses
  getExpenses(tripId: string): ExpenseItem[] {
    return this.data.expenses.filter((e) => e.trip_id === tripId);
  }

  addExpense(expense: ExpenseItem): ExpenseItem {
    this.data.expenses.unshift(expense);
    // Update trip actual spend
    const trip = this.getTrip(expense.trip_id);
    if (trip) {
      const tripExpenses = this.getExpenses(trip.id);
      const totalSpent = tripExpenses.reduce((sum, item) => sum + item.amount, 0);
      trip.budget_summary.spent_actual = totalSpent;
      trip.budget_summary.remaining_budget = Math.max(0, trip.budget - totalSpent);
      trip.budget_summary.usage_percentage = Math.min(100, Math.round((totalSpent / trip.budget) * 1000) / 10);
      this.saveTrip(trip);
    }
    this.save();
    return expense;
  }

  deleteExpense(id: string): boolean {
    const expense = this.data.expenses.find((e) => e.id === id);
    if (!expense) return false;
    this.data.expenses = this.data.expenses.filter((e) => e.id !== id);
    const trip = this.getTrip(expense.trip_id);
    if (trip) {
      const tripExpenses = this.getExpenses(trip.id);
      const totalSpent = tripExpenses.reduce((sum, item) => sum + item.amount, 0);
      trip.budget_summary.spent_actual = totalSpent;
      trip.budget_summary.remaining_budget = Math.max(0, trip.budget - totalSpent);
      trip.budget_summary.usage_percentage = Math.min(100, Math.round((totalSpent / trip.budget) * 1000) / 10);
      this.saveTrip(trip);
    }
    this.save();
    return true;
  }

  // Notifications
  getNotifications(tripId?: string): DisruptionAlert[] {
    if (tripId) {
      return this.data.notifications.filter((n) => n.trip_id === tripId);
    }
    return this.data.notifications;
  }

  addNotification(notification: DisruptionAlert): DisruptionAlert {
    this.data.notifications.unshift(notification);
    this.save();
    return notification;
  }

  dismissNotification(id: string): boolean {
    const notif = this.data.notifications.find((n) => n.id === id);
    if (!notif) return false;
    notif.status = 'dismissed';
    this.save();
    return true;
  }

  // Reviews
  getReviews(userId?: string): TripReview[] {
    this.data.reviews = this.data.reviews || [];
    if (!userId) return this.data.reviews;
    return this.data.reviews.filter((r) => r.user_id === userId);
  }

  getReview(id: string): TripReview | undefined {
    this.data.reviews = this.data.reviews || [];
    return this.data.reviews.find((r) => r.id === id);
  }

  saveReview(review: TripReview): TripReview {
    this.data.reviews = this.data.reviews || [];
    const idx = this.data.reviews.findIndex((r) => r.id === review.id || r.trip_id === review.trip_id);
    if (idx >= 0) {
      this.data.reviews[idx] = { ...review, updated_at: new Date().toISOString() };
    } else {
      this.data.reviews.unshift(review);
    }

    // Also update the trip status to COMPLETED and attach review
    if (review.trip_id) {
      const trip = this.getTrip(review.trip_id);
      if (trip) {
        trip.status = 'COMPLETED';
        trip.review = review;
        this.saveTrip(trip);
      }
    }

    this.save();
    return review;
  }

  deleteReview(id: string): boolean {
    this.data.reviews = this.data.reviews || [];
    const initLen = this.data.reviews.length;
    this.data.reviews = this.data.reviews.filter((r) => r.id !== id);
    this.save();
    return this.data.reviews.length < initLen;
  }

  // Cache
  getCache<T>(key: string): T | null {
    const entry = this.data.cache[key];
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      delete this.data.cache[key];
      return null;
    }
    return entry.data as T;
  }

  setCache(key: string, data: any, ttlSeconds: number) {
    this.data.cache[key] = {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };
    // Clean expired entries occasionally
    const keys = Object.keys(this.data.cache);
    if (keys.length > 200) {
      const now = Date.now();
      for (const k of keys) {
        if (this.data.cache[k].expiresAt < now) {
          delete this.data.cache[k];
        }
      }
    }
    this.save();
  }

  // Health
  getHealth(): Record<string, ApiHealthStatus> {
    return this.data.apiHealth;
  }

  updateHealth(service: string, updates: Partial<ApiHealthStatus>) {
    if (!this.data.apiHealth[service]) {
      this.data.apiHealth[service] = {
        service,
        name: service,
        status: 'operational',
        last_check: new Date().toISOString(),
        response_time_ms: 0,
        error_count: 0,
        notes: '',
      };
    }
    this.data.apiHealth[service] = {
      ...this.data.apiHealth[service],
      ...updates,
      last_check: new Date().toISOString(),
    };
    this.save();
  }
}

export const db = new Database();
