import { Router } from 'express';
import { db } from './db.js';
import { coordinator } from './gemini.js';
import { weatherService } from './services/weatherService.js';
import { currencyService } from './services/currencyService.js';
import { placesService } from './services/placesService.js';
import { flightService } from './services/flightService.js';
import { ragService } from './services/ragService.js';
import { monitoringService } from './services/monitoringService.js';
import { transportTrackingService } from './services/transportTrackingService.js';

export const apiRouter = Router();

// ==========================================
// Authentication & User Profile
// ==========================================
apiRouter.post('/auth/login', (req, res) => {
  const { email } = req.body;
  const user = db.getUserByEmail(email) || db.getUser('usr_demo_01');
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user, token: 'demo_jwt_token_auth_ok' });
});

apiRouter.post('/auth/register', (req, res) => {
  const { name, email, preferences } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  let existing = db.getUserByEmail(email);
  if (existing) {
    return res.json({ user: existing, token: 'demo_jwt_token_auth_ok' });
  }
  const newUser = db.createUser({
    id: `usr_${Date.now()}`,
    name,
    email,
    role: 'user',
    preferences: preferences || {
      home_city: 'Chennai',
      preferred_currency: 'INR',
      travel_style: 'balanced',
      interests: ['Heritage', 'Food'],
      food_preference: 'all',
      accommodation_preference: 'boutique',
      transport_preference: 'flight',
    },
    created_at: new Date().toISOString(),
  });
  res.status(201).json({ user: newUser, token: 'demo_jwt_token_auth_ok' });
});

apiRouter.get('/auth/me', (req, res) => {
  const user = db.getUser('usr_demo_01');
  res.json({ user });
});

apiRouter.put('/auth/profile', (req, res) => {
  const { preferences, name } = req.body;
  const updated = db.updateUser('usr_demo_01', { preferences, name });
  res.json({ user: updated });
});

// ==========================================
// AI Trip Planning & Multi-Agent Coordinator
// ==========================================
apiRouter.post('/trips/extract', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    const constraints = await coordinator.extractConstraints(prompt);
    res.json({ constraints });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to extract constraints' });
  }
});

apiRouter.post('/trips/plan', async (req, res) => {
  try {
    const { constraints, userId, userReviews } = req.body;
    if (!constraints || !constraints.destination || !constraints.origin) {
      return res.status(400).json({ error: 'Origin and destination are required' });
    }
    const trip = await coordinator.planTrip(constraints, userId || 'usr_demo_01', userReviews);
    res.status(201).json({ trip });
  } catch (err: any) {
    console.error('Plan trip error:', err);
    res.status(500).json({ error: err.message || 'Failed to plan trip' });
  }
});

// ==========================================
// Trip Management CRUD
// ==========================================
apiRouter.get('/trips', (req, res) => {
  const trips = db.getTrips();
  res.json({ trips });
});

apiRouter.get('/trips/:id', (req, res) => {
  const trip = db.getTrip(req.params.id);
  if (!trip) {
    return res.status(404).json({ error: 'Trip not found' });
  }
  res.json({ trip });
});

apiRouter.put('/trips/:id', (req, res) => {
  const existing = db.getTrip(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Trip not found' });
  }
  const updated = db.saveTrip({ ...existing, ...req.body });
  res.json({ trip: updated });
});

apiRouter.delete('/trips/:id', (req, res) => {
  const success = db.deleteTrip(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Trip not found' });
  }
  res.json({ success: true });
});

// ==========================================
// Trip Reviews & AI Preference Refinements
// ==========================================
apiRouter.get('/reviews', (req, res) => {
  const userId = req.query.userId as string | undefined;
  const reviews = db.getReviews(userId);
  res.json({ reviews });
});

apiRouter.post('/reviews', (req, res) => {
  const review = req.body;
  if (!review || !review.destination || !review.trip_id) {
    return res.status(400).json({ error: 'trip_id and destination are required' });
  }

  const reviewRecord = {
    id: review.id || `rev_${Date.now()}`,
    trip_id: review.trip_id,
    user_id: review.user_id || 'usr_demo_01',
    destination: review.destination,
    destination_rating: review.destination_rating || 5,
    destination_feedback: review.destination_feedback || '',
    travel_style_rating: review.travel_style_rating || 5,
    pace_rating: review.pace_rating || 'just_right',
    value_for_money: review.value_for_money || 5,
    activity_ratings: review.activity_ratings || [],
    highlights: review.highlights || [],
    tips_for_future_travelers: review.tips_for_future_travelers || '',
    favorite_activity_title: review.favorite_activity_title,
    avoid_activity_title: review.avoid_activity_title,
    created_at: review.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const saved = db.saveReview(reviewRecord);
  res.status(201).json({ review: saved, message: 'Review saved and AI recommendation memory updated' });
});

apiRouter.delete('/reviews/:id', (req, res) => {
  const success = db.deleteReview(req.params.id);
  res.json({ success });
});

// ==========================================
// Targeted Re-planning & Chat With Trip
// ==========================================
apiRouter.post('/trips/:id/replan-day', async (req, res) => {
  try {
    const trip = db.getTrip(req.params.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    const { dayNumber, reason } = req.body;
    const replanned = await coordinator.replanDisruptedDay(trip, dayNumber || 1, reason || 'Targeted activity refresh');
    res.json({ trip: replanned });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Re-planning failed' });
  }
});

apiRouter.post('/trips/:id/chat', async (req, res) => {
  try {
    const trip = db.getTrip(req.params.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const response = await coordinator.chatWithTrip(trip, message);
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Chat failed' });
  }
});

apiRouter.post('/trips/:id/switch-transport', async (req, res) => {
  try {
    let trip = db.getTrip(req.params.id);
    if (!trip) {
      if (req.body.trip) {
        trip = req.body.trip;
        db.saveTrip(trip);
      } else {
        return res.status(404).json({ error: 'Trip not found' });
      }
    }
    const { transportId, mode } = req.body;
    const target = transportId || mode || 'train';
    const updated = await coordinator.switchTransportAndRebalance(trip, target);
    res.json({ trip: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to switch transport' });
  }
});

apiRouter.post('/trips/:id/switch-hotel', async (req, res) => {
  try {
    const trip = db.getTrip(req.params.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    const { hotelId, style } = req.body;
    const target = hotelId || style || 'budget';
    const updated = await coordinator.switchHotelAndRebalance(trip, target);
    res.json({ trip: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to switch hotel' });
  }
});

apiRouter.post('/trips/:id/optimize-budget', async (req, res) => {
  try {
    const trip = db.getTrip(req.params.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    const updated = await coordinator.switchTransportAndRebalance(trip, 'cheap');
    res.json({ trip: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to optimize budget' });
  }
});

apiRouter.post('/trips/:id/restore-version', (req, res) => {
  const trip = db.getTrip(req.params.id);
  if (!trip) {
    return res.status(404).json({ error: 'Trip not found' });
  }
  const { versionNumber } = req.body;
  const ver = trip.versions.find((v) => v.version === versionNumber);
  if (!ver) {
    return res.status(404).json({ error: 'Version not found' });
  }
  trip.days = JSON.parse(JSON.stringify(ver.days));
  trip.budget_summary = JSON.parse(JSON.stringify(ver.budget));
  trip.version = ver.version;
  db.saveTrip(trip);
  res.json({ trip });
});

// ==========================================
// Expense Management & Agentic Budget Splitter
// ==========================================
apiRouter.get('/trips/:id/expenses', (req, res) => {
  const expenses = db.getExpenses(req.params.id);
  res.json({ expenses });
});

apiRouter.post('/trips/:id/expenses', (req, res) => {
  const { category, description, amount, currency, paid_by, participants, split_type, split_members, per_member_share, is_settled, notes } = req.body;
  if (!category || !amount) {
    return res.status(400).json({ error: 'Category and amount are required' });
  }

  const numAmount = Number(amount);
  const activeMembers: string[] = split_members && split_members.length > 0
    ? split_members
    : participants && participants.length > 0 && !participants.includes('All')
    ? participants
    : ['All'];

  const calculatedShare = per_member_share || (activeMembers.length > 0 && !activeMembers.includes('All')
    ? Math.round((numAmount / activeMembers.length) * 100) / 100
    : numAmount);

  const newExp = db.addExpense({
    id: `exp_${Date.now()}`,
    trip_id: req.params.id,
    category,
    description: description || category,
    amount: numAmount,
    currency: currency || 'INR',
    date: req.body.date || new Date().toISOString().split('T')[0],
    paid_by: paid_by || 'You',
    participants: participants || activeMembers,
    split_type: split_type || 'equal',
    split_members: activeMembers,
    per_member_share: calculatedShare,
    is_settled: !!is_settled,
    notes: notes || '',
    agentic_audit_status: 'verified',
    agentic_note: `Logged and tracked by Agentic Expense Auditor. Equally apportioned across ${activeMembers.length} member(s).`,
  });
  res.status(201).json({ expense: newExp });
});

apiRouter.delete('/trips/:id/expenses/:expId', (req, res) => {
  const success = db.deleteExpense(req.params.expId);
  res.json({ success });
});

// Real-time Agentic Expense Audit
apiRouter.post('/trips/:id/expenses/agentic-audit', async (req, res) => {
  try {
    let trip = db.getTrip(req.params.id);
    if (!trip) {
      if (req.body.trip) {
        trip = req.body.trip;
        db.saveTrip(trip);
      } else {
        return res.status(404).json({ error: 'Trip not found' });
      }
    }
    const expenses = db.getExpenses(req.params.id);
    const auditResult = await coordinator.auditExpenses(trip, expenses);
    res.json({ audit: auditResult });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Agentic audit failed' });
  }
});

// Record Settlement Payment
apiRouter.post('/trips/:id/expenses/settle-debt', (req, res) => {
  const { from_member, to_member, amount, currency } = req.body;
  if (!from_member || !to_member || !amount) {
    return res.status(400).json({ error: 'from_member, to_member, and amount are required' });
  }

  const settlementExpense = db.addExpense({
    id: `settle_exp_${Date.now()}`,
    trip_id: req.params.id,
    category: 'Other',
    description: `Settlement: ${from_member} paid ${to_member}`,
    amount: Number(amount),
    currency: currency || 'INR',
    date: new Date().toISOString().split('T')[0],
    paid_by: from_member,
    participants: [to_member],
    split_type: 'exact',
    split_members: [to_member],
    per_member_share: Number(amount),
    is_settled: true,
    notes: `Equal split group debt clearance between ${from_member} and ${to_member}.`,
    agentic_audit_status: 'verified',
    agentic_note: 'Debt settlement confirmed by Agentic Auditor.',
  });

  res.status(201).json({ settlementExpense });
});

// ==========================================
// Live Real-Time Data Endpoints
// ==========================================
apiRouter.get('/live/weather', async (req, res) => {
  try {
    const city = (req.query.city as string) || 'Delhi';
    const date = req.query.date as string;
    const weather = await weatherService.getWeatherForCity(city, date);
    res.json({ weather });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Weather lookup failed' });
  }
});

apiRouter.get('/live/currency', async (req, res) => {
  try {
    const base = (req.query.base as string) || 'INR';
    const ratesData = await currencyService.getRates(base);
    res.json(ratesData);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Currency lookup failed' });
  }
});

apiRouter.get('/live/places', async (req, res) => {
  try {
    const city = req.query.city as string;
    const category = req.query.category as string;
    const maxCost = req.query.maxCost ? Number(req.query.maxCost) : undefined;
    const places = await placesService.searchPlaces({ city, category, maxCost });
    res.json({ places });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Places lookup failed' });
  }
});

apiRouter.get('/live/flights', async (req, res) => {
  try {
    const origin = (req.query.origin as string) || 'Chennai';
    const destination = (req.query.destination as string) || 'Delhi';
    const pax = req.query.passengers ? Number(req.query.passengers) : 1;
    const flights = await flightService.searchTransport(origin, destination, pax);
    res.json({ flights });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Flight lookup failed' });
  }
});

apiRouter.post('/maps/grounding', async (req, res) => {
  try {
    const { placeName, destinationCity, lat, lng } = req.body;
    if (!placeName) {
      return res.status(400).json({ error: 'placeName is required' });
    }
    const result = await coordinator.getMapsGroundingInsights(
      placeName,
      destinationCity || 'Delhi',
      lat !== undefined ? Number(lat) : undefined,
      lng !== undefined ? Number(lng) : undefined
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Maps grounding lookup failed' });
  }
});

apiRouter.get('/explore/guides', (req, res) => {
  const guides = ragService.getAllGuides();
  res.json({ guides });
});

// ==========================================
// Autonomous Transportation Timing Tracking & Alerts
// ==========================================
apiRouter.get('/trips/:id/transport-tracking', (req, res) => {
  const trip = db.getTrip(req.params.id);
  if (!trip) {
    return res.status(404).json({ error: 'Trip not found' });
  }
  res.json({ tracking: trip.transport_tracking || null });
});

apiRouter.post('/trips/:id/track-transport', async (req, res) => {
  try {
    let trip = db.getTrip(req.params.id);
    if (!trip) {
      if (req.body.trip) {
        trip = req.body.trip;
        db.saveTrip(trip);
      } else {
        return res.status(404).json({ error: 'Trip not found' });
      }
    }
    const { delayMinutes, simulatedStatus } = req.body;
    const result = await transportTrackingService.trackTripTransport(trip.id, {
      forceDelay: delayMinutes !== undefined ? Number(delayMinutes) : undefined,
      simulatedStatus,
    });
    res.json(result);
  } catch (err: any) {
    console.error('Track transport error:', err);
    res.status(500).json({ error: err.message || 'Failed to track transport' });
  }
});

apiRouter.post('/trips/:id/simulate-transit-delay', async (req, res) => {
  try {
    let trip = db.getTrip(req.params.id);
    if (!trip) {
      if (req.body.trip) {
        trip = req.body.trip;
        db.saveTrip(trip);
      } else {
        return res.status(404).json({ error: 'Trip not found' });
      }
    }
    const delayMinutes = req.body.delayMinutes !== undefined ? Number(req.body.delayMinutes) : 25;
    const result = await transportTrackingService.trackTripTransport(trip.id, {
      forceDelay: delayMinutes,
      simulatedStatus: 'DELAYED',
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to simulate transit delay' });
  }
});

// ==========================================
// Admin & API Health Dashboard
// ==========================================
apiRouter.get('/admin/stats', (req, res) => {
  const trips = db.getTrips();
  const health = db.getHealth();
  const allLogs: any[] = [];
  trips.forEach((t) => allLogs.push(...t.agent_logs));

  res.json({
    active_trips_count: trips.length,
    registered_users_count: 1,
    monitoring_interval_minutes: monitoringService.intervalMinutes,
    agent_executions_count: allLogs.length,
    api_health: health,
    recent_agent_logs: allLogs.slice(0, 10),
  });
});

apiRouter.get('/admin/health', (req, res) => {
  res.json({ health: db.getHealth() });
});

apiRouter.post('/admin/trigger-monitoring', async (req, res) => {
  const result = await monitoringService.runCheckCycle();
  res.json({ result, message: 'Monitoring cycle completed successfully' });
});
