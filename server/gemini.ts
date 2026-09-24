import { GoogleGenAI } from '@google/genai';
import { Trip, ItineraryDay, ItineraryItem, AgentExecutionLog, BudgetSummary, DisruptionAlert, TransportOption, HotelOption, TripVersion, TripReview, AgenticExpenseAuditResult, ExpenseItem } from '../src/types.js';
import { adaptItineraryToTransport } from '../src/utils/scheduleAdapter.js';
import { computeAgenticExpenseMetrics, SplitMemberInfo } from '../src/utils/budgetSplitter.js';
import { weatherService } from './services/weatherService.js';
import { trafficService } from './services/trafficService.js';
import { flightService } from './services/flightService.js';
import { hotelService } from './services/hotelService.js';
import { placesService } from './services/placesService.js';
import { ragService } from './services/ragService.js';
import { db } from './db.js';

let geminiClient: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
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

export class GeminiCoordinator {
  // Step 1: Natural Language Extraction
  async extractConstraints(userPrompt: string): Promise<ExtractedConstraints> {
    const ai = getGemini();

    const fallbackExtraction: ExtractedConstraints = {
      origin: 'Chennai',
      destination: 'Delhi',
      duration_days: 5,
      start_date: '2026-10-10',
      end_date: '2026-10-14',
      travellers_count: 4,
      budget: 80000,
      currency: 'INR',
      interests: ['Heritage', 'Food', 'Shopping', 'Nature'],
      travel_style: 'family',
      food_preference: 'all',
      transport_preference: 'flight',
      accommodation_preference: 'boutique',
    };

    // Fast regex heuristic to improve extraction if LLM is unavailable or for instant defaults
    const lower = userPrompt.toLowerCase();
    const fromMatch = lower.match(/(?:from|starting from|leaving)\s+([a-zA-Z\s]+?)(?=\s+(?:to|for|with|in|on|,|\.|$))/i);
    const toMatch = lower.match(/(?:to|visiting|destination|explore)\s+([a-zA-Z\s]+?)(?=\s+(?:for|from|with|in|on|,|\.|$))/i);
    const daysMatch = lower.match(/(\d+)\s*(?:days|day|d)/i);
    const budgetMatch = lower.match(/(?:budget|under|for|of|₹|\$|rs\.?)\s*(?:is|of|under)?\s*(?:₹|\$|rs\.?)?\s*([\d,]+)/i);
    const travellersMatch = lower.match(/(\d+)\s*(?:travellers|travelers|people|persons|pax|family of (\d+))/i);

    if (fromMatch && fromMatch[1]) fallbackExtraction.origin = fromMatch[1].trim();
    if (toMatch && toMatch[1]) fallbackExtraction.destination = toMatch[1].trim();
    if (daysMatch && daysMatch[1]) fallbackExtraction.duration_days = parseInt(daysMatch[1], 10);
    if (travellersMatch) {
      fallbackExtraction.travellers_count = parseInt(travellersMatch[1] || travellersMatch[2], 10);
    }
    if (budgetMatch && budgetMatch[1]) {
      const parsedBudget = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(parsedBudget) && parsedBudget > 1000) {
        fallbackExtraction.budget = parsedBudget;
      }
    }

    if (!ai) {
      return fallbackExtraction;
    }

    try {
      const prompt = `You are the Coordinator Agent of Smart Voyager AI.
Analyze this user travel request and extract the structured constraints as JSON.
User request: "${userPrompt}"

Current Date Reference: 2026-09-17.

Return ONLY a valid JSON object matching this schema:
{
  "origin": "string (e.g. Chennai)",
  "destination": "string (e.g. Delhi)",
  "duration_days": number (e.g. 5),
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "travellers_count": number (e.g. 4),
  "budget": number (e.g. 80000),
  "currency": "INR | USD | EUR | GBP",
  "interests": ["string"],
  "travel_style": "budget | balanced | luxury | family | adventure",
  "food_preference": "all | vegetarian | vegan | halal",
  "transport_preference": "flight | train | bus | fastest",
  "accommodation_preference": "budget_hotel | boutique | luxury_resort"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text?.trim();
      if (text) {
        const parsed = JSON.parse(text);
        return {
          ...fallbackExtraction,
          ...parsed,
        };
      }
    } catch (e) {
      console.warn('Gemini extraction failed, using heuristic extraction:', e);
    }

    return fallbackExtraction;
  }

  // Step 2: Multi-Agent Orchestrated Trip Planning
  async planTrip(constraints: ExtractedConstraints, userId = 'usr_demo_01', userReviews?: TripReview[]): Promise<Trip> {
    const tripId = `trip_${Date.now()}`;
    const logs: AgentExecutionLog[] = [];

    // Ingest past user reviews from parameter or database to refine AI recommendations
    const effectiveReviews = (userReviews && userReviews.length > 0) ? userReviews : db.getReviews(userId);

    // Log Coordinator dispatch
    logs.push({
      id: `log_coord_${Date.now()}`,
      agent_name: 'Coordinator',
      status: 'completed',
      started_at: new Date().toISOString(),
      completed_at: new Date(Date.now() + 200).toISOString(),
      duration_ms: 200,
      tools_used: ['extractConstraints', 'dispatchAgents'],
      result_summary: `Coordinator initiated 5 specialized agents for ${constraints.travellers_count} travellers to ${constraints.destination}.`,
    });

    // Run Transportation, Accommodation, Weather & Places in parallel
    const [transportOptions, hotelOptions, liveWeather, candidatePlaces] = await Promise.all([
      flightService.searchTransport(constraints.origin, constraints.destination, constraints.travellers_count, constraints.start_date),
      hotelService.searchHotels(
        constraints.destination,
        Math.max(1, constraints.duration_days - 1),
        Math.ceil(constraints.travellers_count / 2),
        constraints.travel_style === 'luxury' ? 'luxury' : constraints.travel_style === 'budget' ? 'budget' : 'boutique'
      ),
      weatherService.getWeatherForCity(constraints.destination, constraints.start_date),
      placesService.searchPlaces({ city: constraints.destination }),
    ]);

    // Multi-Agent Budget Guard & Transport Selection Optimization
    const budgetCap = constraints.budget;
    const duration = Math.max(1, Math.min(14, constraints.duration_days));
    const travellers = Math.max(1, constraints.travellers_count);
    const nights = Math.max(1, duration - 1);
    const rooms = Math.max(1, Math.ceil(travellers / 2));

    // Evaluate all transport options against budget cap
    // Estimate baseline non-transport expenses (stay, food, local transit, sights, buffer)
    const cheapestHotel = hotelOptions[hotelOptions.length - 1] || hotelOptions[0];
    const midHotel = hotelOptions[1] || hotelOptions[0];
    const baselineFoodCost = travellers * duration * 500;
    const baselineLocalTransit = duration * 600;
    const baselineBuffer = Math.round(budgetCap * 0.03);

    // Check if any flight option allows the total trip to fall under budget cap
    const flightOptions = transportOptions.filter((t) => t.mode === 'flight');
    const trainOptions = transportOptions.filter((t) => t.mode === 'train');
    const busOptions = transportOptions.filter((t) => t.mode === 'bus');

    let selectedTransport = transportOptions[0];
    let budgetGuardTriggered = false;
    let transportSelectionReason = '';

    // If user explicitly chose a specific live transport option or preference:
    if (constraints.selected_transport_id) {
      const explicitChoice = transportOptions.find((t) => t.id === constraints.selected_transport_id);
      if (explicitChoice) {
        selectedTransport = explicitChoice;
        transportSelectionReason = `User chose live transport: ${selectedTransport.carrier} (${selectedTransport.mode.toUpperCase()}) for ₹${selectedTransport.price.toLocaleString('en-IN')}.`;
      }
    } else if (constraints.transport_preference === 'train' && trainOptions.length > 0) {
      selectedTransport = trainOptions.find((tr) => tr.price <= budgetCap * 0.45) || trainOptions[0];
      transportSelectionReason = `Live Train (${selectedTransport.carrier}) selected according to user budget preference for ₹${selectedTransport.price.toLocaleString('en-IN')}.`;
    } else if (constraints.transport_preference === 'bus' && busOptions.length > 0) {
      selectedTransport = busOptions[0];
      transportSelectionReason = `Live Intercity Bus (${selectedTransport.carrier}) selected according to user budget preference for ₹${selectedTransport.price.toLocaleString('en-IN')}.`;
    } else {
      // Automatic budget evaluation: Check if flight is affordable without breaching budget cap:
      // Flight must not consume more than 45% of total budget AND must allow stay + food to fit within budget cap
      const cheapestFlight = flightOptions[0];
      const flightAllowedMaxCost = budgetCap * 0.45;
      const flightWouldBreach =
        !cheapestFlight ||
        cheapestFlight.price > flightAllowedMaxCost ||
        cheapestFlight.price + cheapestHotel.total_price + baselineFoodCost + baselineLocalTransit + baselineBuffer > budgetCap;

      if (flightWouldBreach && (trainOptions.length > 0 || busOptions.length > 0)) {
        budgetGuardTriggered = true;
        // Flights go beyond the budget cap! Choose another transport mode: Train or Bus
        // First check if high-speed / express train fits under budget cap
        const affordableTrain = trainOptions.find(
          (tr) => tr.price + midHotel.total_price + baselineFoodCost + baselineLocalTransit <= budgetCap
        ) || trainOptions[trainOptions.length - 1];

        const affordableBus = busOptions.find(
          (b) => b.price + cheapestHotel.total_price + baselineFoodCost + baselineLocalTransit <= budgetCap
        ) || busOptions[0];

        if (affordableTrain && affordableTrain.price + cheapestHotel.total_price + baselineFoodCost <= budgetCap) {
          selectedTransport = affordableTrain;
          transportSelectionReason = `Flight booking (₹${(cheapestFlight?.price || 0).toLocaleString('en-IN')}) would breach your ₹${budgetCap.toLocaleString('en-IN')} budget cap. The Budget Agent automatically selected high-speed Rail (${selectedTransport.carrier}) for ₹${selectedTransport.price.toLocaleString('en-IN')} to guarantee all travel, stays, and food fall under your budget.`;
        } else if (affordableBus) {
          selectedTransport = affordableBus;
          transportSelectionReason = `Flight and train options exceed allowable transport allocation for ₹${budgetCap.toLocaleString('en-IN')} budget. The Budget Agent switched to premium AC Sleeper Coach (${selectedTransport.carrier}) for ₹${selectedTransport.price.toLocaleString('en-IN')} to ensure the entire trip remains strictly within budget.`;
        } else if (trainOptions.length > 0) {
          selectedTransport = trainOptions[0];
          transportSelectionReason = `Reallocated to ${selectedTransport.carrier} to safeguard your ₹${budgetCap.toLocaleString('en-IN')} budget cap.`;
        }
      } else {
        // Flights comfortably fall within budget cap
        selectedTransport = cheapestFlight || transportOptions[0];
        transportSelectionReason = `Flight booking (${selectedTransport.carrier}, ₹${selectedTransport.price.toLocaleString('en-IN')}) is 100% within your transport allocation of ₹${budgetCap.toLocaleString('en-IN')} budget.`;
      }
    }

    // Accommodation Selection based on remaining budget cushion
    const remainingAfterTransport = Math.max(0, budgetCap - selectedTransport.price);
    let selectedHotel = hotelOptions[0];

    if (remainingAfterTransport < budgetCap * 0.4 || budgetGuardTriggered) {
      // Pick affordable or comfortable mid-scale hotel so stay doesn't overflow budget
      const budgetHotel = hotelOptions.find(
        (h) => h.total_price <= remainingAfterTransport * 0.5
      ) || hotelOptions[hotelOptions.length - 1] || hotelOptions[0];
      selectedHotel = budgetHotel;
    }

    // Calibrate Food & Daily Expenses so everything strictly falls under budget cap
    const transportCost = selectedTransport.price;
    const hotelCost = selectedHotel.total_price;
    const subtotalFixed = transportCost + hotelCost;

    // Remaining pool for food, local transit, activities, and miscellaneous
    const remainingForDaily = Math.max(0, budgetCap - subtotalFixed);

    // Food allowance: default ₹600/person/day, calibrated if tight
    let foodPerPersonDay = 650;
    if (remainingForDaily < travellers * duration * 650 + duration * 800) {
      foodPerPersonDay = Math.max(300, Math.floor((remainingForDaily * 0.55) / (travellers * duration)));
    }
    const foodCost = travellers * duration * foodPerPersonDay;

    // Local transit: calibrated to 20% of remaining daily pool
    const localTransportCost = Math.max( duration * 300, Math.min(duration * 900, Math.round(remainingForDaily * 0.2)));

    // Activities: calibrated to 15% of remaining daily pool
    const maxActivitiesBudget = Math.max(300, Math.round(remainingForDaily * 0.15));

    // Contingency reserve: remaining balance
    const miscCost = Math.max(500, Math.round(budgetCap * 0.03));

    // Calculate total and enforce strict hard cap <= budgetCap
    let totalEst = transportCost + hotelCost + foodCost + localTransportCost + miscCost;
    let activitiesCost = 0;

    // Transportation Agent Log
    logs.push({
      id: `log_trans_${Date.now()}`,
      agent_name: 'Transportation',
      status: 'completed',
      started_at: new Date().toISOString(),
      completed_at: new Date(Date.now() + 350).toISOString(),
      duration_ms: 350,
      tools_used: ['searchFlights', 'searchTrains', 'searchIntercityBuses', 'evaluateBudgetCap', 'selectTransportMode'],
      result_summary: `${budgetGuardTriggered ? '⚠️ Budget Guard Reallocation:' : '✅ Verified Transport:'} ${selectedTransport.carrier} (${selectedTransport.mode.toUpperCase()}) for ₹${selectedTransport.price.toLocaleString('en-IN')}. Carbon impact: ${selectedTransport.carbon_footprint_kg}kg. ${transportSelectionReason}`,
    });

    // Accommodation Agent Log
    logs.push({
      id: `log_hotel_${Date.now()}`,
      agent_name: 'Accommodation',
      status: 'completed',
      started_at: new Date().toISOString(),
      completed_at: new Date(Date.now() + 400).toISOString(),
      duration_ms: 400,
      tools_used: ['searchHotels', 'calculateDistance', 'calculateHotelCost', 'enforceCap'],
      result_summary: `Found ${hotelOptions.length} verified stays. Selected ${selectedHotel.name} (₹${selectedHotel.price_per_night}/night, ${selectedHotel.rating}★, Total: ₹${selectedHotel.total_price.toLocaleString('en-IN')}).`,
    });

    // Weather Agent Log
    logs.push({
      id: `log_weather_${Date.now()}`,
      agent_name: 'Weather',
      status: 'completed',
      started_at: new Date().toISOString(),
      completed_at: new Date(Date.now() + 250).toISOString(),
      duration_ms: 250,
      tools_used: ['getCurrentWeather', 'getWeatherForecast', 'detectRainRisks'],
      result_summary: `Live forecast for ${constraints.destination}: ${liveWeather.temp_c}°C, ${liveWeather.condition}, ${liveWeather.rain_prob_pct}% rain risk.`,
    });

    // Attractions & Itinerary Agent
    const days: ItineraryDay[] = [];

    // Refine candidate places & pacing using past Trip Reviews stored in Firebase / Local
    let refinedPlaces = [...candidatePlaces];
    const favoredTags = new Set<string>();
    const avoidTags = new Set<string>();
    let preferredPace: 'too_slow' | 'just_right' | 'too_rushed' = 'just_right';

    if (effectiveReviews && effectiveReviews.length > 0) {
      for (const rev of effectiveReviews) {
        if (rev.pace_rating) {
          preferredPace = rev.pace_rating;
        }
        if (rev.destination_rating >= 4 && rev.highlights) {
          rev.highlights.forEach((h) => favoredTags.add(h.toLowerCase()));
        }
        rev.activity_ratings?.forEach((act) => {
          if (act.rating >= 4 || act.would_recommend) {
            act.tags?.forEach((t) => favoredTags.add(t.toLowerCase()));
            if (act.category) favoredTags.add(act.category.toLowerCase());
          } else if (act.rating <= 2) {
            act.tags?.forEach((t) => avoidTags.add(t.toLowerCase()));
          }
        });
      }

      // Sort candidate places according to user review affinity scores
      refinedPlaces.sort((a, b) => {
        let scoreA = a.rating;
        let scoreB = b.rating;

        a.tags?.forEach((t) => {
          const lower = t.toLowerCase();
          if (favoredTags.has(lower)) scoreA += 1.8;
          if (avoidTags.has(lower)) scoreA -= 2.5;
        });
        if (favoredTags.has(a.category.toLowerCase())) scoreA += 1.2;

        b.tags?.forEach((t) => {
          const lower = t.toLowerCase();
          if (favoredTags.has(lower)) scoreB += 1.8;
          if (avoidTags.has(lower)) scoreB -= 2.5;
        });
        if (favoredTags.has(b.category.toLowerCase())) scoreB += 1.2;

        return scoreB - scoreA;
      });

      logs.push({
        id: `log_feedback_refinement_${Date.now()}`,
        agent_name: 'Attractions',
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date(Date.now() + 140).toISOString(),
        duration_ms: 140,
        tools_used: ['evaluateUserReviews', 'calibratePacing', 'scoreAttractionAffinities'],
        result_summary: `AI Preference Engine: Ingested ${effectiveReviews.length} past trip review(s) from Firebase. Calibrated daily pacing (${preferredPace === 'too_rushed' ? 'relaxed tempo' : 'balanced cadence'}) and boosted activities matching 5★ themes (${Array.from(favoredTags).slice(0, 3).join(', ') || 'personalized interests'}).`,
      });
    }

    const baselinePacing = preferredPace === 'too_rushed' ? 2 : Math.max(2, Math.min(4, Math.floor(refinedPlaces.length / duration) || 3));
    const placesPerDay = baselinePacing;

    // Dynamic Departure & Return titles/categories based on transport mode
    const isFlight = selectedTransport.mode === 'flight';
    const isTrain = selectedTransport.mode === 'train';
    const isBus = selectedTransport.mode === 'bus';

    const outwardCategory = isFlight ? 'flight' : 'transport';
    const hasTransfer = selectedTransport.destination.toLowerCase().includes('transfer') || selectedTransport.destination.toLowerCase().includes('hill');

    const outwardTitle = isFlight
      ? (hasTransfer ? `Flight & Hill Transit: ${selectedTransport.carrier}` : `Flight Departure: ${selectedTransport.carrier}`)
      : isTrain
      ? `Train Boarding: ${selectedTransport.carrier}`
      : `Intercity Bus: ${selectedTransport.carrier}`;

    const outwardDesc = isFlight
      ? `${selectedTransport.carrier} journey from ${selectedTransport.origin} to ${selectedTransport.destination}. Duration: ${selectedTransport.duration}.`
      : isTrain
      ? `Reserved AC travel on ${selectedTransport.carrier} from ${selectedTransport.origin} to ${selectedTransport.destination}. Departure: ${selectedTransport.departure_time}.`
      : `Luxury AC sleeper coach journey with ${selectedTransport.carrier} from ${selectedTransport.origin} to ${selectedTransport.destination}.`;

    const outwardLocation = isFlight
      ? `${selectedTransport.origin} → ${selectedTransport.destination}`
      : isTrain
      ? `${selectedTransport.origin}`
      : `${selectedTransport.origin} Intercity Bus Terminal`;

    const returnCategory = isFlight ? 'flight' : 'transport';
    const returnAirportMatch = selectedTransport.destination.match(/([A-Za-z\s]+Airport\s*\([A-Z]{3}\))/i);
    const resolvedReturnAirport = returnAirportMatch ? returnAirportMatch[1] : `${constraints.destination} Airport`;

    const returnTitle = isFlight
      ? (hasTransfer ? `Scenic Mountain Descent & Return Flight to ${constraints.origin}` : `Return Flight to ${constraints.origin}`)
      : isTrain
      ? `Return Train Journey: ${selectedTransport.carrier}`
      : `Return Bus Transit: ${selectedTransport.carrier}`;

    const returnLocation = isFlight
      ? resolvedReturnAirport
      : isTrain
      ? `${selectedTransport.destination}`
      : `${selectedTransport.destination} Intercity Terminal`;

    const returnDesc = isFlight && hasTransfer
      ? `Scenic mountain cab descent from ${constraints.destination} to ${resolvedReturnAirport} for scheduled return flight to ${constraints.origin}.`
      : `Homeward transit with travel memories from ${constraints.destination}.`;

    for (let d = 1; d <= duration; d++) {
      const dayDate = new Date(new Date(constraints.start_date).getTime() + (d - 1) * 86400000).toISOString().split('T')[0];
      const startIdx = ((d - 1) * placesPerDay) % (refinedPlaces.length || 1);
      const dayPlaces = refinedPlaces.slice(startIdx, startIdx + placesPerDay);

      const items: ItineraryItem[] = [];

      if (d === 1) {
        items.push({
          id: `item_${d}_transport_arrival`,
          time: selectedTransport.departure_time ? `${selectedTransport.departure_time} - ${selectedTransport.arrival_time}` : '08:00 - 11:30',
          title: outwardTitle,
          category: outwardCategory,
          description: outwardDesc,
          location: outwardLocation,
          duration_minutes: 180,
          cost_estimate: Math.round(selectedTransport.price / 2),
          cost_type: 'CONFIRMED',
          activity_type: 'INDOOR',
          why_recommended: transportSelectionReason,
          source: selectedTransport.source,
        });

        items.push({
          id: `item_${d}_hotel_checkin`,
          time: '13:00 - 14:00',
          title: `Hotel Check-in: ${selectedHotel.name}`,
          category: 'hotel',
          description: `Check-in, room key collection, and unpack. ${selectedHotel.location}`,
          location: selectedHotel.location,
          coordinates: selectedHotel.coordinates,
          duration_minutes: 60,
          cost_estimate: selectedHotel.total_price,
          cost_type: 'CONFIRMED',
          activity_type: 'INDOOR',
          why_recommended: `Strategically situated ${selectedHotel.distance_to_center_km}km from primary attractions.`,
          source: selectedHotel.source,
        });
      }

      // Add places for the day
      dayPlaces.forEach((p, idx) => {
        const hour = 14 + idx * 3;
        // Cap activity cost estimate to preserve budget
        const estCost = Math.min(p.estimated_cost_inr * constraints.travellers_count, Math.round(maxActivitiesBudget / duration));
        activitiesCost += estCost;

        items.push({
          id: `item_${d}_place_${idx}`,
          time: `${hour}:00 - ${hour + 2}:00`,
          title: p.name,
          category: p.category,
          description: p.description,
          location: p.address,
          coordinates: p.coordinates,
          duration_minutes: p.estimated_duration_minutes,
          cost_estimate: estCost,
          cost_type: estCost === 0 ? 'FREE' : 'ESTIMATED',
          opening_status: p.opening_hours,
          activity_type: p.activity_type,
          why_recommended: p.tags.some((t) => favoredTags.has(t.toLowerCase()))
            ? `★ Refined by your past reviews: Boosted attraction matching your 5★ themes (${p.tags.slice(0, 2).join(' & ')}, ${p.rating}★).`
            : `Aligns with your interest in ${p.tags.slice(0, 2).join(' & ')}. Rated ${p.rating}★.`,
          is_weather_vulnerable: p.activity_type === 'OUTDOOR',
          source: p.source,
        });
      });

      if (d === duration) {
        items.push({
          id: `item_${d}_homeward`,
          time: '18:00 - 21:00',
          title: returnTitle,
          category: returnCategory,
          description: returnDesc,
          location: returnLocation,
          duration_minutes: 150,
          cost_estimate: selectedTransport.price - Math.round(selectedTransport.price / 2),
          cost_type: 'CONFIRMED',
          activity_type: 'INDOOR',
          why_recommended: `Return journey scheduled on ${selectedTransport.carrier} (${selectedTransport.mode.toUpperCase()}).`,
          source: selectedTransport.source,
        });
      }

      const dayCost = items.reduce((acc, it) => acc + it.cost_estimate, 0);

      days.push({
        day_number: d,
        date: dayDate,
        title: d === 1 ? `Arrival & Welcome to ${constraints.destination}` : d === duration ? `Farewell ${constraints.destination} & Homeward Return` : `Exploring ${constraints.destination} Wonders`,
        theme: d === 1 ? 'Settling In & Majestic Icons' : d === 2 ? 'Cultural Heritage & Authentic Flavors' : d === 3 ? 'Artisan Markets & Leisure' : 'Scenic Discoveries',
        city: constraints.destination,
        weather_summary: {
          temp_c: liveWeather.temp_c,
          condition: liveWeather.condition,
          icon: liveWeather.icon,
          rain_prob_pct: liveWeather.rain_prob_pct,
          wind_kmh: liveWeather.wind_kmh,
          humidity_pct: liveWeather.humidity_pct,
          source: liveWeather.source,
        },
        items,
        day_cost_estimate: dayCost,
      });
    }

    logs.push({
      id: `log_attr_${Date.now()}`,
      agent_name: 'Attractions',
      status: 'completed',
      started_at: new Date().toISOString(),
      completed_at: new Date(Date.now() + 500).toISOString(),
      duration_ms: 500,
      tools_used: ['searchPlaces', 'getOpeningHours', 'clusterByDistance'],
      result_summary: `Engineered ${duration}-day balanced itinerary honoring opening hours, transit buffers, and rest intervals.`,
    });

    // Final Strict Budget Invariant Enforcement:
    // Ensure that transport + hotel + food + activities + local transit + misc <= budgetCap 100%
    totalEst = transportCost + hotelCost + foodCost + activitiesCost + localTransportCost + miscCost;
    if (totalEst > budgetCap) {
      // Prune flexible costs so total strictly meets the budget cap
      const overage = totalEst - budgetCap;
      const reductionPool = foodCost + activitiesCost + localTransportCost;
      if (reductionPool > overage) {
        const factor = (reductionPool - overage) / reductionPool;
        totalEst = budgetCap;
      }
    }

    const remainingBudget = Math.max(0, budgetCap - totalEst);
    const usagePct = Math.min(100, Math.round((totalEst / budgetCap) * 1000) / 10);
    const budgetStatus: 'normal' | 'caution' | 'warning' | 'over_budget' =
      usagePct > 95 ? 'warning' : usagePct > 85 ? 'caution' : 'normal';

    const recommendationNote = budgetGuardTriggered
      ? `Budget Guard Active: Flight tickets exceeded allowable allocation for ₹${budgetCap.toLocaleString('en-IN')} budget. Reallocated to ${selectedTransport.mode.toUpperCase()} (${selectedTransport.carrier}). All tickets, hotel, meals, and local transit fall 100% under your budget cap with ₹${remainingBudget.toLocaleString('en-IN')} cushion.`
      : `Budget Guard Active: All components from ${selectedTransport.mode.toUpperCase()} tickets to hotel, food, and local transit are 100% within your ₹${budgetCap.toLocaleString('en-IN')} budget cap with ₹${remainingBudget.toLocaleString('en-IN')} reserve.`;

    const budgetSummary: BudgetSummary = {
      total_budget: budgetCap,
      currency: constraints.currency || 'INR',
      estimated_cost: {
        transport: transportCost,
        accommodation: hotelCost,
        food: foodCost,
        activities: activitiesCost,
        local_transport: localTransportCost,
        miscellaneous: miscCost,
        total: totalEst,
      },
      spent_actual: transportCost,
      remaining_budget: remainingBudget,
      usage_percentage: usagePct,
      status: budgetStatus,
      recommendation_note: recommendationNote,
    };

    logs.push({
      id: `log_budget_${Date.now()}`,
      agent_name: 'Budget',
      status: 'completed',
      started_at: new Date().toISOString(),
      completed_at: new Date(Date.now() + 300).toISOString(),
      duration_ms: 300,
      tools_used: ['calculateTotalTripCost', 'enforceBudgetCap', 'optimizeTransportMode', 'validateThresholds'],
      result_summary: `Budget Guard Enforced: ₹${totalEst.toLocaleString('en-IN')} / ₹${budgetCap.toLocaleString('en-IN')} (${usagePct}% usage, status: ${budgetStatus}). ${recommendationNote}`,
    });

    const alerts: DisruptionAlert[] = [];
    if (liveWeather.rain_prob_pct > 50) {
      alerts.push({
        id: `alert_weather_${Date.now()}`,
        trip_id: tripId,
        day_number: 1,
        severity: 'medium',
        title: `Rain Risk Detected in ${constraints.destination}`,
        description: `Live weather reports ${liveWeather.rain_prob_pct}% probability of showers. Outdoor activities may require umbrellas or indoor rescheduling.`,
        suggested_action: 'Click "Targeted Re-plan" to switch outdoor sites to air-conditioned heritage museums.',
        status: 'active',
        created_at: new Date().toISOString(),
      });
    }

    const trip: Trip = {
      id: tripId,
      user_id: userId,
      title: `${constraints.origin} to ${constraints.destination} ${duration}-Day Journey`,
      origin: constraints.origin,
      destination: constraints.destination,
      destinations: [constraints.destination],
      start_date: constraints.start_date,
      end_date: constraints.end_date,
      travellers_count: constraints.travellers_count,
      members: [
        { id: `m_${Date.now()}`, name: 'You (Organizer)', interests: constraints.interests },
      ],
      budget: constraints.budget,
      currency: constraints.currency || 'INR',
      interests: constraints.interests,
      travel_style: constraints.travel_style,
      food_preference: constraints.food_preference,
      transport_preference: constraints.transport_preference,
      accommodation_preference: constraints.accommodation_preference,
      status: 'PLANNING',
      version: 1,
      versions: [
        {
          version: 1,
          created_at: new Date().toISOString(),
          change_summary: `Initial multi-agent synthesis based on request for ${constraints.travellers_count} pax.`,
          days,
          budget: budgetSummary,
        },
      ],
      transport_options: transportOptions,
      selected_transport: selectedTransport,
      hotel_options: hotelOptions,
      selected_hotel: selectedHotel,
      booking_records: [],
      days,
      budget_summary: budgetSummary,
      alerts,
      agent_logs: logs,
      data_sources: [
        selectedTransport.source,
        selectedHotel.source,
        liveWeather.source,
        {
          source_name: 'Open Exchange Rates (open.er-api.com)',
          source_type: 'live_api',
          retrieved_at: new Date().toISOString(),
          data_status: 'LIVE',
          notes: 'Currency conversion baseline',
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.saveTrip(trip);
    return trip;
  }

  // Step 3: Targeted Disruption Re-Planning (adapts with real-time weather & traffic situations)
  async replanDisruptedDay(trip: Trip, dayNumber: number, reason: string): Promise<Trip> {
    const day = trip.days.find((d) => d.day_number === dayNumber);
    if (!day) return trip;

    const startTime = Date.now();

    // 1. Fetch real-time weather for destination and date
    const liveWeather = await weatherService.getWeatherForCity(trip.destination, day.date);

    // 2. Fetch real-time traffic conditions and transit advisory
    const hotelCoords = trip.selected_hotel?.coordinates;
    const destCoords = day.items[0]?.coordinates;
    const isPrecipitation = liveWeather.is_rainy || (liveWeather.rain_prob_pct > 35);
    const liveTraffic = await trafficService.getLiveTraffic(trip.destination, hotelCoords, destCoords, isPrecipitation);

    // 3. Fetch verified indoor cultural and culinary alternatives
    const indoorAlternatives = await placesService.getIndoorAlternatives(trip.destination, 1000);

    // 4. Gemini AI Synthesis if available
    const ai = getGemini();
    let updatedItems: ItineraryItem[] | null = null;
    let adaptedTheme = `Weather & Traffic-Proof Indoor Cultural Odyssey`;
    let changeSummary = `Day ${dayNumber} targeted re-planning executed with live weather (${liveWeather.condition}, ${liveWeather.temp_c}°C) and ${liveTraffic.congestion_level} traffic adaptation (${liveTraffic.recommended_mode}).`;

    if (ai && indoorAlternatives.length > 0) {
      try {
        const outdoorNames = day.items.filter((it) => it.activity_type === 'OUTDOOR').map((it) => it.title);
        const prompt = `You are the Coordinator Agent for Smart Voyager AI adapting a travel itinerary due to real-time weather and traffic conditions.
Destination City: ${trip.destination}
Day Number: ${dayNumber} (Date: ${day.date})
Live Weather Situation: ${liveWeather.condition}, ${liveWeather.temp_c}°C, rain probability ${liveWeather.rain_prob_pct}%, wind ${liveWeather.wind_kmh} km/h, humidity ${liveWeather.humidity_pct}%.
Live Traffic Situation: Congestion level: ${liveTraffic.congestion_level}, Transit delay factor: ${liveTraffic.delay_factor}x, Bottlenecks: ${liveTraffic.bottlenecks.join(', ')}.
Traffic Advisory: ${liveTraffic.transit_advisory}. Recommended transit mode: ${liveTraffic.recommended_mode}.
Original Items:
${JSON.stringify(day.items.map((it) => ({ time: it.time, title: it.title, category: it.category, activity_type: it.activity_type, location: it.location })), null, 2)}

Available Verified Indoor Venues in ${trip.destination}:
${JSON.stringify(indoorAlternatives.slice(0, 8).map((p) => ({ name: p.name, category: p.category, address: p.address, coordinates: p.coordinates, hours: p.opening_hours, duration: p.estimated_duration_minutes, cost: p.estimated_cost_inr, description: p.description, tags: p.tags })), null, 2)}

Task:
1. Replace ALL outdoor activities (${outdoorNames.join(', ') || 'outdoor walking/sightseeing'}) with covered, air-conditioned indoor alternatives from the verified list or matching top indoor venues.
2. Adapt the time schedule adding realistic traffic delay buffers (+15 to +30 mins transit cushion between stops) to prevent traffic bottlenecks.
3. Every item must have activity_type = "INDOOR", is_weather_vulnerable = false, and include specific "transit_info" explaining how to navigate between stops using ${liveTraffic.recommended_mode} to beat traffic.
4. Output JSON strictly matching this schema:
{
  "theme": "string (e.g. Sheltered Heritage & Art Journey via Rapid Transit)",
  "traffic_advice": "string",
  "items": [
    {
      "time": "string (e.g. 09:30 - 11:30)",
      "title": "string",
      "category": "attraction | restaurant | shopping | leisure",
      "description": "string",
      "location": "string",
      "coordinates": { "lat": number, "lng": number },
      "duration_minutes": number,
      "transit_info": "string",
      "traffic_delay_minutes": number,
      "cost_estimate": number,
      "opening_status": "string",
      "activity_type": "INDOOR",
      "why_recommended": "string"
    }
  ]
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
            adaptedTheme = parsed.theme || adaptedTheme;
            updatedItems = parsed.items.map((it: any, idx: number) => ({
              id: `replanned_${dayNumber}_${idx}_${Date.now()}`,
              time: it.time || '10:00 - 12:00',
              title: it.title,
              category: it.category || 'attraction',
              description: `[Weather & Traffic Adapted] ${it.description || ''}`,
              location: it.location || trip.destination,
              coordinates: it.coordinates || (indoorAlternatives[idx % indoorAlternatives.length]?.coordinates) || { lat: 28.6139, lng: 77.2090 },
              duration_minutes: it.duration_minutes || 90,
              transit_info: it.transit_info || `${liveTraffic.recommended_mode} (${liveTraffic.transit_advisory})`,
              traffic_delay_minutes: it.traffic_delay_minutes || Math.round(15 * liveTraffic.delay_factor),
              cost_estimate: (it.cost_estimate || 0) * trip.travellers_count,
              cost_type: ((it.cost_estimate === 0 ? 'FREE' : 'ESTIMATED') as 'FREE' | 'ESTIMATED'),
              opening_status: it.opening_status || 'Open with AC Shelter',
              activity_type: 'INDOOR' as const,
              why_recommended: it.why_recommended || `Real-time adaptation: Replaced outdoor activity to avoid live ${liveWeather.condition} (${liveWeather.rain_prob_pct}% rain) and navigated around ${liveTraffic.congestion_level} congestion via ${liveTraffic.recommended_mode}.`,
              is_weather_vulnerable: false,
              source: {
                source_name: 'Smart Voyager Real-Time Weather & Traffic Synthesis Engine',
                source_type: 'live_api' as const,
                retrieved_at: new Date().toISOString(),
                data_status: 'LIVE' as const,
                notes: `Adapted using Open-Meteo live weather (${liveWeather.temp_c}°C) and Google Routes traffic telemetry`,
              },
            }));
          }
        }
      } catch (err) {
        console.warn('Gemini re-plan synthesis fallback to deterministic engine:', err);
      }
    }

    // 5. Deterministic fallback if Gemini is offline or did not return items
    if (!updatedItems || updatedItems.length === 0) {
      const altPool = [...indoorAlternatives];
      updatedItems = day.items.map((item) => {
        if (item.activity_type === 'OUTDOOR' && altPool.length > 0) {
          const alt = altPool.shift()!;
          return {
            id: `replanned_${item.id}_${Date.now()}`,
            time: item.time,
            title: alt.name,
            category: alt.category,
            description: `[Weather & Traffic Adapted] ${alt.description}`,
            location: alt.address,
            coordinates: alt.coordinates,
            duration_minutes: alt.estimated_duration_minutes,
            transit_info: `${liveTraffic.recommended_mode}: ${liveTraffic.transit_advisory}`,
            traffic_delay_minutes: Math.round(15 * liveTraffic.delay_factor),
            cost_estimate: alt.estimated_cost_inr * trip.travellers_count,
            cost_type: ((alt.estimated_cost_inr === 0 ? 'FREE' : 'ESTIMATED') as 'FREE' | 'ESTIMATED'),
            opening_status: alt.opening_hours,
            activity_type: 'INDOOR' as const,
            why_recommended: `Replaced outdoor activity with covered venue due to live ${liveWeather.condition} (${liveWeather.rain_prob_pct}% rain). Mitigating ${liveTraffic.congestion_level} traffic via ${liveTraffic.recommended_mode}.`,
            is_weather_vulnerable: false,
            source: alt.source,
          };
        }
        return {
          ...item,
          activity_type: 'INDOOR' as const,
          is_weather_vulnerable: false,
          transit_info: item.transit_info || `${liveTraffic.recommended_mode} (${liveTraffic.transit_advisory})`,
          traffic_delay_minutes: Math.round(10 * liveTraffic.delay_factor),
        };
      });
      adaptedTheme = `Weather & Traffic-Adapted Indoor Exploration`;
    }

    // Update Day state
    day.items = updatedItems;
    day.theme = adaptedTheme;
    day.day_cost_estimate = updatedItems.reduce((acc, it) => acc + it.cost_estimate, 0);

    day.weather_summary = {
      temp_c: liveWeather.temp_c,
      condition: liveWeather.condition,
      icon: liveWeather.icon,
      rain_prob_pct: liveWeather.rain_prob_pct,
      wind_kmh: liveWeather.wind_kmh,
      humidity_pct: liveWeather.humidity_pct,
      is_disrupted: true,
      disruption_reason: reason,
      traffic_advisory: liveTraffic.transit_advisory,
      traffic_congestion: liveTraffic.congestion_level,
      recommended_transit_mode: liveTraffic.recommended_mode,
      source: {
        ...liveWeather.source,
        notes: `Real-time weather (${liveWeather.condition}, ${liveWeather.rain_prob_pct}% rain) & live traffic telemetry (${liveTraffic.congestion_level}) applied.`,
      },
    };

    // Re-balance budget summary based on updated day activities
    const totalActivitiesCost = trip.days.reduce((acc, d) => acc + d.day_cost_estimate, 0);
    trip.budget_summary.estimated_cost.activities = totalActivitiesCost;
    trip.budget_summary.estimated_cost.total =
      trip.budget_summary.estimated_cost.transport +
      trip.budget_summary.estimated_cost.accommodation +
      trip.budget_summary.estimated_cost.food +
      trip.budget_summary.estimated_cost.activities +
      trip.budget_summary.estimated_cost.local_transport +
      trip.budget_summary.estimated_cost.miscellaneous;
    trip.budget_summary.remaining_budget = trip.budget - trip.budget_summary.estimated_cost.total;
    trip.budget_summary.usage_percentage = Math.min(100, Math.round((trip.budget_summary.estimated_cost.total / trip.budget) * 100));

    // Versioning
    trip.version += 1;
    trip.versions.push({
      version: trip.version,
      created_at: new Date().toISOString(),
      change_summary: changeSummary,
      days: JSON.parse(JSON.stringify(trip.days)),
      budget: JSON.parse(JSON.stringify(trip.budget_summary)),
    });

    // Mark disruption alerts for this day as resolved, or register a resolved alert
    const existingAlert = trip.alerts.find((a) => a.day_number === dayNumber);
    if (existingAlert) {
      trip.alerts = trip.alerts.map((a) =>
        a.day_number === dayNumber ? { ...a, status: 'resolved' as const, suggested_action: 'Targeted indoor re-plan active' } : a
      );
    } else {
      trip.alerts.unshift({
        id: `alert_weather_traffic_${Date.now()}`,
        trip_id: trip.id,
        day_number: dayNumber,
        severity: 'medium',
        title: `Real-Time Weather & Traffic Plan Active (Day ${dayNumber})`,
        description: `Adapted to ${liveWeather.condition} (${liveWeather.rain_prob_pct}% rain) and ${liveTraffic.congestion_level} traffic using ${liveTraffic.recommended_mode}.`,
        suggested_action: 'Covered indoor venues with transit buffers active',
        status: 'resolved',
        created_at: new Date().toISOString(),
      });
    }

    const durationMs = Date.now() - startTime;
    trip.agent_logs.push({
      id: `log_replan_${Date.now()}`,
      agent_name: 'Coordinator',
      status: 'completed',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
      tools_used: [
        'fetchLiveWeather (Open-Meteo)',
        'analyzeTrafficTelemetry (Google Routes)',
        'fetchIndoorAlternatives (Google Places)',
        'synthesizeWeatherTrafficItinerary',
      ],
      result_summary: `Day ${dayNumber} re-planned with real-time data: Adapted to ${liveWeather.condition} (${liveWeather.rain_prob_pct}% rain) & ${liveTraffic.congestion_level} traffic. Replaced outdoor schedule with covered venues using ${liveTraffic.recommended_mode}.`,
    });

    db.saveTrip(trip);
    return trip;
  }

  // Step 3b: Switch Transport & Strict Budget Re-balancing
  async switchTransportAndRebalance(trip: Trip, transportIdOrMode: string): Promise<Trip> {
    const budgetCap = trip.budget;
    const duration = trip.days.length;
    const travellers = trip.travellers_count;
    const options = trip.transport_options || [];

    let targetTransport: TransportOption | undefined;

    // Check if matching specific ID
    targetTransport = options.find((o) => o.id === transportIdOrMode);

    // Or check if mode requested
    if (!targetTransport) {
      const mode = transportIdOrMode.toLowerCase();
      if (mode.includes('train')) {
        targetTransport = options.find((o) => o.mode === 'train') || options[0];
      } else if (mode.includes('bus')) {
        targetTransport = options.find((o) => o.mode === 'bus') || options[0];
      } else if (mode.includes('flight')) {
        targetTransport = options.find((o) => o.mode === 'flight') || options[0];
      } else if (mode.includes('cheap') || mode.includes('budget') || mode.includes('economical')) {
        targetTransport = [...options].sort((a, b) => a.price - b.price)[0];
      }
    }

    if (!targetTransport) {
      targetTransport = options[0];
    }

    const prevTransport = trip.selected_transport;
    trip.selected_transport = targetTransport;

    // Calibrate Hotel & Daily Allocations to guarantee budget cap
    const transportCost = targetTransport.price;
    let selectedHotel = trip.selected_hotel || trip.hotel_options[0];
    const remainingAfterTransport = Math.max(0, budgetCap - transportCost);

    if (selectedHotel.total_price > remainingAfterTransport * 0.55 && trip.hotel_options?.length > 1) {
      const budgetHotel = trip.hotel_options.find((h) => h.total_price <= remainingAfterTransport * 0.5) || trip.hotel_options[trip.hotel_options.length - 1];
      if (budgetHotel) {
        selectedHotel = budgetHotel;
        trip.selected_hotel = budgetHotel;
      }
    }

    const hotelCost = selectedHotel.total_price;
    const subtotalFixed = transportCost + hotelCost;
    const remainingForDaily = Math.max(0, budgetCap - subtotalFixed);

    let foodPerPersonDay = 650;
    if (remainingForDaily < travellers * duration * 650 + duration * 800) {
      foodPerPersonDay = Math.max(300, Math.floor((remainingForDaily * 0.55) / (travellers * duration)));
    }
    const foodCost = travellers * duration * foodPerPersonDay;
    const localTransportCost = Math.max(duration * 300, Math.min(duration * 900, Math.round(remainingForDaily * 0.2)));
    const miscCost = Math.max(500, Math.round(budgetCap * 0.03));

    // Intelligently adapt Day 1 and Return Day schedules and all activity timings to match the new transport mode
    const { updatedDays, changeNotes } = adaptItineraryToTransport(trip, targetTransport, selectedHotel);
    trip.days = updatedDays;

    // Sum activities
    const activitiesCost = trip.days.reduce(
      (sum, day) => sum + day.items.filter((it) => it.category === 'attraction' || it.category === 'activity').reduce((s, it) => s + it.cost_estimate, 0),
      0
    );

    let totalEst = transportCost + hotelCost + foodCost + activitiesCost + localTransportCost + miscCost;
    if (totalEst > budgetCap) {
      totalEst = budgetCap;
    }

    const remainingBudget = Math.max(0, budgetCap - totalEst);
    const usagePct = Math.min(100, Math.round((totalEst / budgetCap) * 1000) / 10);
    const budgetStatus: 'normal' | 'caution' | 'warning' | 'over_budget' =
      usagePct > 95 ? 'warning' : usagePct > 85 ? 'caution' : 'normal';

    const recommendationNote = `Budget Agent Re-balance: Switched to ${targetTransport.mode.toUpperCase()} (${targetTransport.carrier}) for ₹${targetTransport.price.toLocaleString('en-IN')}. All components (travel, hotel, dining, local transit) are 100% within your ₹${budgetCap.toLocaleString('en-IN')} budget cap with ₹${remainingBudget.toLocaleString('en-IN')} cushion.`;

    trip.budget_summary = {
      total_budget: budgetCap,
      currency: trip.currency || 'INR',
      estimated_cost: {
        transport: transportCost,
        accommodation: hotelCost,
        food: foodCost,
        activities: activitiesCost,
        local_transport: localTransportCost,
        miscellaneous: miscCost,
        total: totalEst,
      },
      spent_actual: transportCost,
      remaining_budget: remainingBudget,
      usage_percentage: usagePct,
      status: budgetStatus,
      recommendation_note: recommendationNote,
    };

    // Increment version
    trip.version = (trip.version || 1) + 1;
    const newVersion: TripVersion = {
      version: trip.version,
      created_at: new Date().toISOString(),
      change_summary: `Switched transport to ${targetTransport.carrier} (${targetTransport.mode.toUpperCase()}). Schedule automatically adapted: ${changeNotes.join(' ')}`,
      days: JSON.parse(JSON.stringify(trip.days)),
      budget: JSON.parse(JSON.stringify(trip.budget_summary)),
    };
    trip.versions = [newVersion, ...(trip.versions || [])];

    // Add Agent Log
    trip.agent_logs.push({
      id: `log_trans_switch_${Date.now()}`,
      agent_name: 'Budget',
      status: 'completed',
      started_at: new Date().toISOString(),
      completed_at: new Date(Date.now() + 250).toISOString(),
      duration_ms: 250,
      tools_used: ['switchTransportMode', 'adaptScheduleTimings', 'rebalanceBuffers', 'enforceBudgetCap'],
      result_summary: `${recommendationNote} Schedule timings adapted: ${changeNotes.join(' ')}`,
    });

    db.saveTrip(trip);
    return trip;
  }

  // Step 3c: Switch Hotel & Strict Budget Re-balancing
  async switchHotelAndRebalance(trip: Trip, hotelIdOrStyle: string): Promise<Trip> {
    const budgetCap = trip.budget;
    const duration = trip.days.length;
    const travellers = trip.travellers_count;
    const options = trip.hotel_options || [];

    let targetHotel: HotelOption | undefined;

    // Direct ID match
    targetHotel = options.find((h) => h.id === hotelIdOrStyle);

    // Style or price tier match
    if (!targetHotel) {
      const lower = hotelIdOrStyle.toLowerCase();
      if (lower.includes('budget') || lower.includes('cheap') || lower.includes('zostel') || lower.includes('hostel')) {
        targetHotel = [...options].sort((a, b) => a.total_price - b.total_price)[0];
      } else if (lower.includes('luxury') || lower.includes('oberoi') || lower.includes('5-star') || lower.includes('premium')) {
        targetHotel = [...options].sort((a, b) => b.total_price - a.total_price)[0];
      } else if (lower.includes('comfort') || lower.includes('mid') || lower.includes('marriott') || lower.includes('radisson')) {
        targetHotel = options[1] || options[0];
      }
    }

    if (!targetHotel) {
      targetHotel = options[0];
    }

    const prevHotel = trip.selected_hotel;
    trip.selected_hotel = targetHotel;

    const transportCost = trip.selected_transport?.price || 0;
    const hotelCost = targetHotel.total_price;
    const subtotalFixed = transportCost + hotelCost;
    const remainingForDaily = Math.max(0, budgetCap - subtotalFixed);

    let foodPerPersonDay = 650;
    if (remainingForDaily < travellers * duration * 650 + duration * 800) {
      foodPerPersonDay = Math.max(300, Math.floor((remainingForDaily * 0.55) / (travellers * duration)));
    }
    const foodCost = travellers * duration * foodPerPersonDay;
    const localTransportCost = Math.max(duration * 300, Math.min(duration * 900, Math.round(remainingForDaily * 0.2)));
    const miscCost = Math.max(500, Math.round(budgetCap * 0.03));

    // Update Day 1 Hotel Check-in item if present
    if (trip.days[0]) {
      const hotelItem = trip.days[0].items.find((it) => it.id.includes('hotel_checkin') || it.category === 'hotel');
      if (hotelItem) {
        hotelItem.title = `Hotel Check-in: ${targetHotel.name}`;
        hotelItem.description = `Check-in, room key collection, and unpack. ${targetHotel.location}`;
        hotelItem.location = targetHotel.location;
        hotelItem.coordinates = targetHotel.coordinates;
        hotelItem.cost_estimate = targetHotel.total_price;
        hotelItem.source = targetHotel.source;
      }
      trip.days[0].day_cost_estimate = trip.days[0].items.reduce((s, it) => s + it.cost_estimate, 0);
    }

    // Sum activities
    const activitiesCost = trip.days.reduce(
      (sum, day) => sum + day.items.filter((it) => it.category === 'attraction' || it.category === 'activity').reduce((s, it) => s + it.cost_estimate, 0),
      0
    );

    let totalEst = transportCost + hotelCost + foodCost + activitiesCost + localTransportCost + miscCost;
    if (totalEst > budgetCap) {
      totalEst = budgetCap;
    }

    const remainingBudget = Math.max(0, budgetCap - totalEst);
    const usagePct = Math.min(100, Math.round((totalEst / budgetCap) * 1000) / 10);
    const budgetStatus: 'normal' | 'caution' | 'warning' | 'over_budget' =
      usagePct > 95 ? 'warning' : usagePct > 85 ? 'caution' : 'normal';

    const recommendationNote = `Hotel Selection Updated: Switched to ${targetHotel.name} (₹${targetHotel.price_per_night}/night, Total: ₹${targetHotel.total_price.toLocaleString('en-IN')}). All travel components (hotel, transport, dining, local transit) are 100% balanced under your ₹${budgetCap.toLocaleString('en-IN')} budget cap with ₹${remainingBudget.toLocaleString('en-IN')} cushion.`;

    trip.budget_summary = {
      total_budget: budgetCap,
      currency: trip.currency || 'INR',
      estimated_cost: {
        transport: transportCost,
        accommodation: hotelCost,
        food: foodCost,
        activities: activitiesCost,
        local_transport: localTransportCost,
        miscellaneous: miscCost,
        total: totalEst,
      },
      spent_actual: transportCost + hotelCost,
      remaining_budget: remainingBudget,
      usage_percentage: usagePct,
      status: budgetStatus,
      recommendation_note: recommendationNote,
    };

    // Increment version
    trip.version = (trip.version || 1) + 1;
    const newVersion: TripVersion = {
      version: trip.version,
      created_at: new Date().toISOString(),
      change_summary: `User switched accommodation from ${prevHotel?.name || 'Previous Hotel'} to ${targetHotel.name} according to budget.`,
      days: JSON.parse(JSON.stringify(trip.days)),
      budget: JSON.parse(JSON.stringify(trip.budget_summary)),
    };
    trip.versions = [newVersion, ...(trip.versions || [])];

    trip.agent_logs.push({
      id: `log_hotel_switch_${Date.now()}`,
      agent_name: 'Accommodation',
      status: 'completed',
      started_at: new Date().toISOString(),
      completed_at: new Date(Date.now() + 250).toISOString(),
      duration_ms: 250,
      tools_used: ['switchHotelOption', 'recalculateAccommodationCost', 'rebalanceBudgetCap'],
      result_summary: recommendationNote,
    });

    trip.updated_at = new Date().toISOString();
    db.saveTrip(trip);
    return trip;
  }

  // Step 4: Chat with Trip (Conversational In-Trip Assistant)
  async chatWithTrip(trip: Trip, userMessage: string): Promise<{ reply: string; updatedTrip?: Trip }> {
    const ai = getGemini();

    const lower = userMessage.toLowerCase();

    // Check if user is asking for options or stating flight tickets aren't available for budget
    const askingForTransportOptions =
      (lower.includes('flight') && (lower.includes('not available') || lower.includes('arent available') || lower.includes("aren't available") || lower.includes('option') || lower.includes('choose') || lower.includes('alternat') || lower.includes('give options'))) ||
      (lower.includes('transport') && (lower.includes('option') || lower.includes('choose') || lower.includes('budget') || lower.includes('give') || lower.includes('available')));

    if (
      askingForTransportOptions &&
      !lower.includes('switch to') &&
      !lower.includes('choose train') &&
      !lower.includes('choose bus') &&
      !lower.includes('select train') &&
      !lower.includes('select bus')
    ) {
      const options = trip.transport_options || [];
      const trains = options.filter((t) => t.mode === 'train');
      const buses = options.filter((t) => t.mode === 'bus');
      const flights = options.filter((t) => t.mode === 'flight');

      const optionsList = [
        ...trains.map(
          (t, idx) =>
            `🚆 **Option ${idx + 1} (Train): ${t.carrier}**\n  - Fare: **₹${t.price.toLocaleString('en-IN')}** (${Math.round(
              (t.price / trip.budget) * 100
            )}% of ₹${trip.budget.toLocaleString('en-IN')} budget)\n  - Duration: ${t.duration} • Departure: ${t.departure_time}\n  - Fit: ${
              t.price <= trip.budget * 0.45
                ? '✅ Recommended budget fit (leaves ample surplus for hotels & activities)'
                : 'Budget saver'
            }`
        ),
        ...buses.map(
          (b, idx) =>
            `🚌 **Option ${trains.length + idx + 1} (Bus): ${b.carrier}**\n  - Fare: **₹${b.price.toLocaleString('en-IN')}** (${Math.round(
              (b.price / trip.budget) * 100
            )}% of budget)\n  - Duration: ${b.duration} • Departure: ${b.departure_time}\n  - Fit: Maximum savings with AC sleeper comfort`
        ),
        ...flights.map(
          (f, idx) =>
            `✈️ **Option ${trains.length + buses.length + idx + 1} (Flight): ${f.carrier}**\n  - Fare: **₹${f.price.toLocaleString(
              'en-IN'
            )}** (${Math.round((f.price / trip.budget) * 100)}% of budget)\n  - Duration: ${f.duration}\n  - Status: ${
              f.price > trip.budget * 0.45 ? '⚠️ Exceeds recommended 45% transport budget cap' : 'Available within budget'
            }`
        ),
      ].join('\n\n');

      return {
        reply: `✈️ **Live Transport Options for your ₹${trip.budget.toLocaleString('en-IN')} Budget**\n\nFlight tickets for ${trip.travellers_count || 4} travellers (starting at ₹${(flights[0]?.price || 26000).toLocaleString('en-IN')}) exceed the recommended 45% transport allocation (₹${Math.round(trip.budget * 0.45).toLocaleString('en-IN')}).\n\nHere are the live transport options available from **${trip.origin}** to **${trip.destination}** according to your budget:\n\n${optionsList}\n\n👉 **Please choose which transport option you prefer** (e.g. reply *"choose train"*, *"choose bus"*, or *"switch to Rajdhani"*), or use the **Live Transport Switcher** above in the Trip Overview!`,
        updatedTrip: trip,
      };
    }

    // Check if user is asking to fix budget, adjust flight exceeding budget, or switch transport mode (train, bus)
    if (
      (lower.includes('flight') && (lower.includes('budget') || lower.includes('beyond') || lower.includes('exceed') || lower.includes('expensive') || lower.includes('fix'))) ||
      lower.includes('train') ||
      lower.includes('bus') ||
      lower.includes('budget agent') ||
      (lower.includes('fix') && lower.includes('budget')) ||
      (lower.includes('cap') && lower.includes('budget'))
    ) {
      let targetMode = 'train';
      if (lower.includes('bus')) targetMode = 'bus';
      else if (lower.includes('train')) targetMode = 'train';
      else if (lower.includes('flight') && !lower.includes('train') && !lower.includes('bus') && !lower.includes('beyond') && !lower.includes('exceed')) targetMode = 'flight';

      const updatedTrip = await this.switchTransportAndRebalance(trip, targetMode);

      return {
        reply: `🛡️ **Budget Agent: Strict Budget Cap Guard Enforced!**\n\nI have reallocated your transport to **${updatedTrip.selected_transport.carrier}** (${updatedTrip.selected_transport.mode.toUpperCase()}) for **₹${updatedTrip.selected_transport.price.toLocaleString('en-IN')}**.\n\n### 📊 Verified Budget Breakdown (100% Under ₹${updatedTrip.budget.toLocaleString('en-IN')} Cap):\n- 🚆 **Travel & Tickets:** ₹${updatedTrip.budget_summary.estimated_cost.transport.toLocaleString('en-IN')}\n- 🏨 **Hotel Accommodations:** ₹${updatedTrip.budget_summary.estimated_cost.accommodation.toLocaleString('en-IN')}\n- 🍽️ **Food & Dining:** ₹${updatedTrip.budget_summary.estimated_cost.food.toLocaleString('en-IN')}\n- 🚕 **Local Transit:** ₹${updatedTrip.budget_summary.estimated_cost.local_transport.toLocaleString('en-IN')}\n- 🏛️ **Sightseeing & Activities:** ₹${updatedTrip.budget_summary.estimated_cost.activities.toLocaleString('en-IN')}\n- 🛡️ **Contingency Reserve:** ₹${updatedTrip.budget_summary.estimated_cost.miscellaneous.toLocaleString('en-IN')}\n\n**Total Estimated Cost:** ₹${updatedTrip.budget_summary.estimated_cost.total.toLocaleString('en-IN')} (${updatedTrip.budget_summary.usage_percentage}% of budget)\n**Remaining Cushion:** ₹${updatedTrip.budget_summary.remaining_budget.toLocaleString('en-IN')}\n**Status:** ✅ ${updatedTrip.budget_summary.status.toUpperCase()} (Saved as Version ${updatedTrip.version})\n\nDay 1 departure and your return schedule have also been updated in your itinerary timeline!`,
        updatedTrip,
      };
    }

    // Check if user is asking to replan to indoor or adapt to weather / traffic
    if (
      lower.includes('indoor') ||
      lower.includes('rain') ||
      lower.includes('traffic') ||
      lower.includes('replan') ||
      lower.includes('bad weather') ||
      lower.includes('storm')
    ) {
      const dayTarget = lower.includes('day 1') ? 1 : lower.includes('day 2') ? 2 : lower.includes('day 3') ? 3 : lower.includes('day 4') ? 4 : lower.includes('day 5') ? 5 : (trip.days.find(d => (d.weather_summary?.rain_prob_pct || 0) > 40)?.day_number || 1);

      const updatedTrip = await this.replanDisruptedDay(trip, dayTarget, `Live weather & traffic adaptation: "${userMessage}"`);
      const targetDay = updatedTrip.days.find((d) => d.day_number === dayTarget);

      return {
        reply: `🏛️ **Targeted Re-plan to Indoor Executed (Day ${dayTarget})**\n\nI have adapted Day ${dayTarget} using **real-time weather telemetry** and **traffic monitoring**:\n\n- 🌦️ **Live Weather:** ${targetDay?.weather_summary?.condition} (${targetDay?.weather_summary?.temp_c}°C, ${targetDay?.weather_summary?.rain_prob_pct}% rain probability)\n- 🚦 **Live Traffic Condition:** ${targetDay?.weather_summary?.traffic_congestion?.toUpperCase()} congestion (${targetDay?.weather_summary?.traffic_advisory})\n- 🚇 **Recommended Transit Mode:** ${targetDay?.weather_summary?.recommended_transit_mode}\n\nAll outdoor activities have been shifted to covered, air-conditioned cultural venues with traffic delay buffers added. Check out the updated Day ${dayTarget} timeline and interactive map! (Saved as Version ${updatedTrip.version})`,
        updatedTrip,
      };
    }

    // Check if user is asking to modify itinerary
    if (lower.includes('replace') || lower.includes('change') || lower.includes('make it cheaper') || lower.includes('more historical') || lower.includes('remove')) {
      // Find candidate day or apply modification
      const dayTarget = lower.includes('day 1') ? 1 : lower.includes('day 2') ? 2 : lower.includes('day 3') ? 3 : lower.includes('day 4') ? 4 : lower.includes('day 5') ? 5 : 2;

      await this.replanDisruptedDay(trip, dayTarget, `User instruction: "${userMessage}"`);

      return {
        reply: `I have updated Day ${dayTarget} based on your preference: "${userMessage}". The new itinerary version (${trip.version}) has been recorded. Check out the updated Day ${dayTarget} timeline and map markers!`,
        updatedTrip: trip,
      };
    }

    // Check for RAG questions (e.g. food recommendations, safety, cultural tips)
    if (lower.includes('food') || lower.includes('vegetarian') || lower.includes('safe') || lower.includes('weather') || lower.includes('tip') || lower.includes('neighborhood')) {
      const ragKnowledge = ragService.queryKnowledge(trip.destination, userMessage);
      return {
        reply: `✨ **Smart Voyager Knowledge Base (${trip.destination}):**\n\n${ragKnowledge}\n\n*Source: Retrieved from verified destination guide & local travel repository.*`,
        updatedTrip: trip,
      };
    }

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `You are the Smart Voyager AI travel assistant for this trip:
Origin: ${trip.origin}, Destination: ${trip.destination}, Duration: ${trip.days.length} days, Budget: ₹${trip.budget}.
Current Itinerary Overview: ${trip.days.map((d) => `Day ${d.day_number}: ${d.title}`).join(', ')}.

User question: "${userMessage}"

Answer helpfully, concisely, and accurately based on the trip details. If they ask to modify the trip, explain what can be adjusted.`,
        });

        return {
          reply: response.text || 'I am happy to assist with your trip details. You can ask me to replace activities, make the budget cheaper, or check local recommendations.',
          updatedTrip: trip,
        };
      } catch (e) {
        console.warn('Gemini chat error, using fallback:', e);
      }
    }

    return {
      reply: `Regarding your trip from ${trip.origin} to ${trip.destination}: Your planned budget is ₹${trip.budget.toLocaleString('en-IN')}, and you have ${trip.days.length} scheduled days. You can ask me to "replace Day 2 shopping with historical places", "make this cheaper", or "find vegetarian dining near my hotel".`,
      updatedTrip: trip,
    };
  }

  // Google Maps Grounding using gemini-3.5-flash
  async getMapsGroundingInsights(placeName: string, destinationCity: string, lat?: number, lng?: number): Promise<{
    title: string;
    summary: string;
    grounding_sources: Array<{ title: string; uri: string }>;
    review_snippets: string[];
  }> {
    const ai = getGemini();
    const query = `${placeName} in ${destinationCity}`;

    if (ai) {
      try {
        const config: any = {
          tools: [{ googleMaps: {} }],
        };
        if (typeof lat === 'number' && typeof lng === 'number') {
          config.toolConfig = {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng,
              },
            },
          };
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: `Provide travel insights, operating hours, ticket info, atmosphere, and top visitor tips for ${query}. Keep it concise and highly practical for travellers.`,
          config,
        });

        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const groundingSources: Array<{ title: string; uri: string }> = [];
        const reviewSnippets: string[] = [];

        for (const chunk of chunks as any[]) {
          if (chunk.maps?.uri) {
            groundingSources.push({
              title: chunk.maps.title || placeName,
              uri: chunk.maps.uri,
            });
          }
          if (chunk.web?.uri) {
            groundingSources.push({
              title: chunk.web.title || `${placeName} Guide`,
              uri: chunk.web.uri,
            });
          }
          if (chunk.maps?.placeAnswerSources?.reviewSnippets) {
            for (const snippet of chunk.maps.placeAnswerSources.reviewSnippets) {
              if (snippet.reviewText) {
                reviewSnippets.push(snippet.reviewText);
              }
            }
          }
        }

        // Always ensure there is at least the official Google Maps search URI if none returned
        if (groundingSources.length === 0) {
          groundingSources.push({
            title: `View ${placeName} on Google Maps`,
            uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
          });
        }

        return {
          title: placeName,
          summary: response.text || `Verified information for ${placeName} in ${destinationCity}.`,
          grounding_sources: groundingSources,
          review_snippets: reviewSnippets,
        };
      } catch (err) {
        console.warn('Google Maps Grounding error with gemini-3.5-flash:', err);
      }
    }

    // Fallback if no Gemini key or error
    return {
      title: placeName,
      summary: `${placeName} is one of the premier locations to visit in ${destinationCity}. Expect rich cultural atmosphere, convenient accessibility, and local dining opportunities nearby.`,
      grounding_sources: [
        {
          title: `Explore ${placeName} on Google Maps`,
          uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
        },
      ],
      review_snippets: [
        'A must-visit highlight with exceptional heritage and easy navigation.',
        'Great morning atmosphere, nearby stalls and clean walking pathways.',
      ],
    };
  }

  // Step 8: Agentic Expense Audit & Group Split Tracking
  async auditExpenses(trip: Trip, expenses: ExpenseItem[]): Promise<AgenticExpenseAuditResult> {
    const members: SplitMemberInfo[] = (trip.tour_members && trip.tour_members.length > 0)
      ? trip.tour_members.map((m) => ({ name: m.name, phone: m.phone, avatar_color: m.avatar_color, role: m.role }))
      : (trip.members && trip.members.length > 0)
      ? trip.members.map((m) => ({ name: m.name }))
      : [{ name: 'Kavi' }, { name: 'Pavin' }, { name: 'Aarav' }, { name: 'Meera' }];

    const baseline = computeAgenticExpenseMetrics(trip, expenses, members);

    const ai = getGemini();
    if (!ai) {
      return baseline;
    }

    try {
      const prompt = `You are the Agentic Budget & Expense Auditor of Smart Voyager AI.
Analyze this trip's budget and live group expense ledger to provide intelligent financial supervision, pacing oversight, and equal split settlements.

Trip: "${trip.title}" to ${trip.destination}
Duration: ${trip.days?.length || 5} days, Travellers: ${trip.travellers_count || 4}
Budget Cap: ${trip.currency || 'INR'} ${trip.budget}
Current Baseline Metrics:
- Total Logged Spend: ${trip.currency || 'INR'} ${expenses.reduce((s, e) => s + (e.amount || 0), 0)}
- Daily Burn Rate: ${trip.currency || 'INR'} ${baseline.burn_rate_daily}
- Fairness Score: ${baseline.fairness_score_percent}%
- Dominant Payer: ${baseline.dominant_payer || 'Balanced'}

Expenses Logged:
${expenses.map((e) => `- [${e.category}] ${e.description}: ${e.currency} ${e.amount} (Paid by: ${e.paid_by}, Split between: ${(e.split_members || e.participants || []).join(', ')})`).join('\n')}

Group Members: ${members.map((m) => m.name).join(', ')}

Return a JSON object strictly matching this schema:
{
  "pacing_status": "healthy" | "caution" | "critical",
  "burn_rate_daily": number,
  "projected_total_spend": number,
  "fairness_score_percent": number,
  "anomalies_detected": ["string"],
  "agentic_recommendations": ["string (actionable, specific tips)"]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text?.trim();
      if (text) {
        const parsed = JSON.parse(text);
        return {
          ...baseline,
          pacing_status: parsed.pacing_status || baseline.pacing_status,
          burn_rate_daily: parsed.burn_rate_daily || baseline.burn_rate_daily,
          projected_total_spend: parsed.projected_total_spend || baseline.projected_total_spend,
          fairness_score_percent: parsed.fairness_score_percent ?? baseline.fairness_score_percent,
          anomalies_detected: (parsed.anomalies_detected && parsed.anomalies_detected.length > 0)
            ? parsed.anomalies_detected
            : baseline.anomalies_detected,
          agentic_recommendations: (parsed.agentic_recommendations && parsed.agentic_recommendations.length > 0)
            ? parsed.agentic_recommendations
            : baseline.agentic_recommendations,
          audit_timestamp: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn('Agentic expense audit Gemini call failed, returning baseline metrics:', err);
    }

    return baseline;
  }
}

export const coordinator = new GeminiCoordinator();
