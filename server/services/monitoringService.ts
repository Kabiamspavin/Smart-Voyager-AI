import { db } from '../db.js';
import { weatherService } from './weatherService.js';
import { coordinator } from '../gemini.js';
import { transportTrackingService } from './transportTrackingService.js';

export class MonitoringService {
  private timer: NodeJS.Timeout | null = null;
  public intervalMinutes = 15;

  start() {
    if (this.timer) return;
    console.log(`[MonitoringService] Initialized with ${this.intervalMinutes} min cycle`);
    // Run an initial check after 5 seconds, then recurring
    setTimeout(() => this.runCheckCycle(), 5000);
    this.timer = setInterval(() => this.runCheckCycle(), this.intervalMinutes * 60 * 1000);
  }

  async runCheckCycle(): Promise<{ checked_trips: number; alerts_raised: number; transit_checked: number }> {
    const trips = db.getTrips();
    let alertsRaised = 0;

    // 1. Run Autonomous Transportation Timing Tracker for confirmed tickets
    let transitResult = { trips_checked: 0, alerts_raised: 0 };
    try {
      transitResult = await transportTrackingService.trackAllConfirmedTrips();
      alertsRaised += transitResult.alerts_raised;
    } catch (err) {
      console.warn('[MonitoringService] Error running transport tracking:', err);
    }

    // 2. Weather & Budget monitoring across active trips
    for (const trip of trips) {
      if (trip.status !== 'PLANNING' && trip.status !== 'IN_PROGRESS') continue;

      try {
        // Check live weather for destination
        const weather = await weatherService.getWeatherForCity(trip.destination);

        // Check if any day has high rain risk (>60%)
        if (weather.rain_prob_pct > 60) {
          const existingAlert = trip.alerts.find((a) => a.title.includes('Heavy Rain') && a.status === 'active');
          if (!existingAlert) {
            const alert = {
              id: `alert_auto_${Date.now()}`,
              trip_id: trip.id,
              day_number: 1,
              severity: 'high' as const,
              title: `Live Alert: Heavy Rain (${weather.rain_prob_pct}%) Forecast for ${trip.destination}`,
              description: `Real-time meteorological monitoring detected adverse weather. Outdoor activities are vulnerable to rain disruption.`,
              suggested_action: 'Auto-replan outdoor attractions to indoor cultural exhibits.',
              status: 'active' as const,
              created_at: new Date().toISOString(),
            };
            trip.alerts.unshift(alert);
            db.addNotification(alert);
            alertsRaised++;
          }
        }

        // Check budget thresholds
        if (trip.budget_summary.usage_percentage > 95) {
          const existingBudgetAlert = trip.alerts.find((a) => a.title.includes('Budget') && a.status === 'active');
          if (!existingBudgetAlert) {
            const alert = {
              id: `alert_budget_${Date.now()}`,
              trip_id: trip.id,
              severity: 'medium' as const,
              title: `Budget Guard: ${trip.budget_summary.usage_percentage}% Allocated`,
              description: `Total planned expenses leave less than 5% contingency reserve.`,
              suggested_action: 'Review miscellaneous expenses or select economy transit.',
              status: 'active' as const,
              created_at: new Date().toISOString(),
            };
            trip.alerts.unshift(alert);
            db.addNotification(alert);
            alertsRaised++;
          }
        }

        db.saveTrip(trip);
      } catch (e) {
        console.warn(`[MonitoringService] Failed check on trip ${trip.id}:`, e);
      }
    }

    return { checked_trips: trips.length, alerts_raised: alertsRaised, transit_checked: transitResult.trips_checked };
  }
}

export const monitoringService = new MonitoringService();

