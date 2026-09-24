import React, { useState } from 'react';
import {
  MapPin,
  Calendar,
  Users,
  DollarSign,
  Sparkles,
  History,
  AlertTriangle,
  FileDown,
  MessageSquare,
  Plane,
  Train,
  Bus,
  Check,
  Building2,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  ChevronDown,
  ArrowRightLeft,
  ShieldCheck,
  Car,
  Radio,
  TrendingDown,
  TrendingUp,
  Ticket,
  QrCode,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Star,
  Zap,
} from 'lucide-react';
import { Trip, DisruptionAlert, TransportOption, HotelOption } from '../types.js';
import { api } from '../services/api.js';
import { HotelSwitcherModal } from './HotelSwitcherModal.js';
import { BookedTicketsModal } from './BookedTicketsModal.js';
import { AgentBookingAssistantModal } from './AgentBookingAssistantModal.js';
import { TransportTimingTrackerCard } from './TransportTimingTrackerCard.js';
import { getTransportBookingInfo, getHotelBookingInfo } from '../utils/bookingUrls.js';
import { adaptItineraryToTransport, getTransportTimingProfile, minutesToTimeString } from '../utils/scheduleAdapter.js';
import { computeTransitTracking, applyTransitTrackingToTrip } from '../utils/transportationTracker.js';

interface TripOverviewProps {
  trip: Trip;
  currentCurrency: string;
  onOpenChat: () => void;
  onOpenPdf: () => void;
  onReplanDay: (dayNum: number, reason: string) => void;
  onTripUpdated: (updatedTrip: Trip) => void;
  onOpenAddExpense: () => void;
  onOpenGroupMembers?: () => void;
  onOpenSosModal?: () => void;
  onOpenReview?: () => void;
  isReplanning?: boolean;
}

export const TripOverview: React.FC<TripOverviewProps> = ({
  trip,
  currentCurrency,
  onOpenChat,
  onOpenPdf,
  onReplanDay,
  onTripUpdated,
  onOpenAddExpense,
  onOpenGroupMembers,
  onOpenSosModal,
  onOpenReview,
  isReplanning,
}) => {
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const [showTransportModal, setShowTransportModal] = useState(false);
  const [isSwitchingTransport, setIsSwitchingTransport] = useState(false);
  const [showHotelModal, setShowHotelModal] = useState(false);
  const [isSwitchingHotel, setIsSwitchingHotel] = useState(false);
  const [showBookedTicketsModal, setShowBookedTicketsModal] = useState(false);
  const [bookedTicketsCategory, setBookedTicketsCategory] = useState<'all' | 'transport' | 'hotel'>('all');
  const [showAgentBookingModal, setShowAgentBookingModal] = useState(false);
  const [agentBookingCategory, setAgentBookingCategory] = useState<'transport' | 'hotel'>('transport');
  const [targetTransportOption, setTargetTransportOption] = useState<TransportOption | undefined>();
  const [targetHotelOption, setTargetHotelOption] = useState<HotelOption | undefined>();
  const [transportFilter, setTransportFilter] = useState<'all' | 'flight' | 'train' | 'bus'>('all');
  const [scheduleAdaptNotice, setScheduleAdaptNotice] = useState<{
    carrier: string;
    mode: string;
    note: string;
    arrival: string;
  } | null>(null);
  const activeAlerts = trip.alerts.filter((a) => a.status === 'active');
  const resolvedAlerts = trip.alerts.filter((a) => a.status === 'resolved');
  const dayWithRainRisk = trip.days.find((d) => (d.weather_summary?.rain_prob_pct || 0) > 40 && !d.weather_summary?.is_disrupted);

  const isFlightOverBudget =
    trip.selected_transport?.mode === 'flight' &&
    (trip.selected_transport.price > trip.budget * 0.45 ||
      trip.budget_summary?.status === 'caution' ||
      trip.budget_summary?.status === 'warning');
  const alternateTransports = (trip.transport_options || []).filter((t) => t.mode !== 'flight');

  const hasConfirmedTransport = (trip.booking_records || []).some(
    (r) => r.category === 'transport' && r.booking_status === 'CONFIRMED'
  );

  const activeTracking =
    trip.transport_tracking ||
    (hasConfirmedTransport || trip.selected_transport ? computeTransitTracking(trip) : null);

  const handleRefreshTracking = async () => {
    try {
      const res = await api.trackTransport(trip.id, trip);
      if (res?.trip && onTripUpdated) {
        onTripUpdated(res.trip);
      }
    } catch (e) {
      console.warn('Refresh tracking error:', e);
      if (onTripUpdated) {
        onTripUpdated(applyTransitTrackingToTrip(trip));
      }
    }
  };

  const handleSimulateDelay = async (delayMinutes: number) => {
    try {
      const res = await api.simulateTransitDelay(trip.id, trip, delayMinutes);
      if (res?.trip && onTripUpdated) {
        onTripUpdated(res.trip);
      }
    } catch (e) {
      console.warn('Simulate delay error:', e);
      if (onTripUpdated) {
        onTripUpdated(
          applyTransitTrackingToTrip(trip, {
            forceDelay: delayMinutes,
            simulatedStatus: delayMinutes > 0 ? 'DELAYED' : 'ON_TIME',
          })
        );
      }
    }
  };

  const handleRestoreVersion = async (vNumber: number) => {
    try {
      const res = await api.restoreVersion(trip.id, vNumber);
      if (res.trip) {
        onTripUpdated(res.trip);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSwitchTransport = async (transportId: string) => {
    setIsSwitchingTransport(true);
    const target = (trip.transport_options || []).find((t) => t.id === transportId);
    try {
      const res = await api.switchTransport(trip.id, { transportId, trip });
      if (res.trip) {
        const adapted = target ? adaptItineraryToTransport(res.trip, target, res.trip.selected_hotel) : null;
        const finalTrip = adapted && adapted.updatedDays.length > 0
          ? { ...res.trip, days: adapted.updatedDays }
          : res.trip;

        onTripUpdated(finalTrip);
        if (target) {
          const profile = getTransportTimingProfile(target, finalTrip.selected_hotel, finalTrip.destination);
          setScheduleAdaptNotice({
            carrier: target.carrier,
            mode: target.mode.toUpperCase(),
            note: adapted?.changeNotes[0] || `Schedule timings synchronized with ${target.carrier} (${target.departure_time || ''} - ${target.arrival_time || ''}).`,
            arrival: minutesToTimeString(profile.arrivalMinutes, true),
          });
        }
        setShowTransportModal(false);
        setIsSwitchingTransport(false);
        return;
      }
    } catch (e) {
      console.warn('API switch transport error, applying local fallback:', e);
    }

    // Local fallback for offline/instant response
    if (target) {
      const updatedTrip = { ...trip };
      updatedTrip.selected_transport = target;
      const hotelCost = updatedTrip.selected_hotel?.total_price || 0;
      const budgetCap = updatedTrip.budget;
      const remainingForDaily = Math.max(0, budgetCap - (target.price + hotelCost));
      const daysCount = updatedTrip.days?.length || 1;
      const foodCost = (updatedTrip.travellers_count || 1) * daysCount * 600;
      const localTransportCost = Math.max(
        daysCount * 300,
        Math.min(daysCount * 800, Math.round(remainingForDaily * 0.2))
      );
      const miscCost = Math.max(500, Math.round(budgetCap * 0.03));
      const totalEst = Math.min(
        budgetCap,
        target.price + hotelCost + foodCost + (updatedTrip.budget_summary?.estimated_cost?.activities || 4000) + localTransportCost + miscCost
      );
      const remainingBudget = Math.max(0, budgetCap - totalEst);
      const usagePct = Math.min(100, Math.round((totalEst / budgetCap) * 1000) / 10);

      // Intelligently adapt all itinerary days according to the new transport mode timings
      const { updatedDays, changeNotes } = adaptItineraryToTransport(updatedTrip, target, updatedTrip.selected_hotel);
      updatedTrip.days = updatedDays;

      updatedTrip.budget_summary = {
        total_budget: budgetCap,
        currency: updatedTrip.currency || 'INR',
        estimated_cost: {
          transport: target.price,
          accommodation: hotelCost,
          food: foodCost,
          activities: updatedTrip.budget_summary?.estimated_cost?.activities || 4000,
          local_transport: localTransportCost,
          miscellaneous: miscCost,
          total: totalEst,
        },
        spent_actual: target.price + hotelCost,
        remaining_budget: remainingBudget,
        usage_percentage: usagePct,
        status: usagePct > 95 ? 'warning' : usagePct > 85 ? 'caution' : 'normal',
        recommendation_note: `Transport updated to ${target.mode.toUpperCase()} (${target.carrier}). Schedule synchronized: ${changeNotes.join(' ')}`,
      };

      const profile = getTransportTimingProfile(target, updatedTrip.selected_hotel, updatedTrip.destination);
      setScheduleAdaptNotice({
        carrier: target.carrier,
        mode: target.mode.toUpperCase(),
        note: changeNotes[0] || `Schedule timings synchronized with ${target.carrier}.`,
        arrival: minutesToTimeString(profile.arrivalMinutes, true),
      });

      onTripUpdated(updatedTrip);
      setShowTransportModal(false);
    }
    setIsSwitchingTransport(false);
  };

  const handleSwitchHotel = async (hotelId: string) => {
    setIsSwitchingHotel(true);
    try {
      const res = await api.switchHotel(trip.id, { hotelId });
      if (res.trip) {
        onTripUpdated(res.trip);
        setShowHotelModal(false);
        return;
      }
    } catch (e) {
      console.warn('API switch hotel error, applying local fallback:', e);
    }

    // Local fallback for offline/instant response
    const target = (trip.hotel_options || []).find((h) => h.id === hotelId);
    if (target) {
      const updatedTrip = { ...trip };
      updatedTrip.selected_hotel = target;
      const transportCost = updatedTrip.selected_transport?.price || 0;
      const hotelCost = target.total_price;
      const budgetCap = updatedTrip.budget;
      const remainingForDaily = Math.max(0, budgetCap - (transportCost + hotelCost));
      const daysCount = updatedTrip.days?.length || 1;
      const foodCost = (updatedTrip.travellers_count || 1) * daysCount * 600;
      const localTransportCost = Math.max(
        daysCount * 300,
        Math.min(daysCount * 800, Math.round(remainingForDaily * 0.2))
      );
      const miscCost = Math.max(500, Math.round(budgetCap * 0.03));
      const totalEst = Math.min(
        budgetCap,
        transportCost + hotelCost + foodCost + (updatedTrip.budget_summary?.estimated_cost?.activities || 4000) + localTransportCost + miscCost
      );
      const remainingBudget = Math.max(0, budgetCap - totalEst);
      const usagePct = Math.min(100, Math.round((totalEst / budgetCap) * 1000) / 10);

      updatedTrip.budget_summary = {
        total_budget: budgetCap,
        currency: updatedTrip.currency || 'INR',
        estimated_cost: {
          transport: transportCost,
          accommodation: hotelCost,
          food: foodCost,
          activities: updatedTrip.budget_summary?.estimated_cost?.activities || 4000,
          local_transport: localTransportCost,
          miscellaneous: miscCost,
          total: totalEst,
        },
        spent_actual: transportCost + hotelCost,
        remaining_budget: remainingBudget,
        usage_percentage: usagePct,
        status: usagePct > 95 ? 'warning' : usagePct > 85 ? 'caution' : 'normal',
        recommendation_note: `Hotel updated to ${target.name}. Total accommodation: ₹${hotelCost.toLocaleString('en-IN')}. Remaining cushion: ₹${remainingBudget.toLocaleString('en-IN')}.`,
      };

      if (updatedTrip.days && updatedTrip.days[0]) {
        const checkinItem = updatedTrip.days[0].items.find((it) => it.category === 'hotel' || it.id.includes('hotel'));
        if (checkinItem) {
          checkinItem.title = `Hotel Check-in: ${target.name}`;
          checkinItem.location = target.location;
          checkinItem.cost_estimate = target.total_price;
          checkinItem.coordinates = target.coordinates;
        }
      }

      onTripUpdated(updatedTrip);
      setShowHotelModal(false);
    }
    setIsSwitchingHotel(false);
  };

  return (
    <div className="space-y-4">
      {/* Live Transport Budget Guard Advisory Banner */}
      {isFlightOverBudget && (
        <div className="p-4 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-200 dark:bg-indigo-900/70 text-indigo-900 dark:text-indigo-200 flex items-center justify-center shrink-0 mt-0.5">
              <Plane className="w-5 h-5 text-indigo-700 dark:text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-indigo-950 dark:text-indigo-200">
                  Flight Tickets Exceed Recommended Budget Allocation
                </span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-indigo-200 dark:bg-indigo-900/80 text-indigo-900 dark:text-indigo-200 rounded-full">
                  Live Transport Options Available
                </span>
              </div>
              <p className="text-xs text-indigo-900/90 dark:text-indigo-300 mt-1 leading-relaxed">
                Current flight tickets (₹{trip.selected_transport?.price?.toLocaleString('en-IN')}) take{' '}
                {Math.round(((trip.selected_transport?.price || 0) / trip.budget) * 100)}% of your ₹
                {trip.budget.toLocaleString('en-IN')} budget. Choose a live rail or bus option according to your budget
                to free up funds for hotel rooms and activities:
              </p>
              {/* Quick option buttons */}
              <div className="flex flex-wrap gap-2 mt-2.5">
                {alternateTransports.map((alt) => {
                  const savings = (trip.selected_transport?.price || 0) - alt.price;
                  return (
                    <button
                      key={alt.id}
                      onClick={() => handleSwitchTransport(alt.id)}
                      disabled={isSwitchingTransport}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white dark:hover:text-white border border-indigo-200 dark:border-indigo-800/80 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all shadow-2xs cursor-pointer group disabled:opacity-50"
                    >
                      {alt.mode === 'train' ? (
                        <Train className="w-3.5 h-3.5 text-emerald-600 group-hover:text-white" />
                      ) : (
                        <Bus className="w-3.5 h-3.5 text-amber-600 group-hover:text-white" />
                      )}
                      <span>{alt.carrier.split('(')[0].trim()}</span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-400 group-hover:text-white">
                        ₹{alt.price.toLocaleString('en-IN')}
                      </span>
                      {savings > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 group-hover:bg-emerald-500 group-hover:text-white">
                          Save ₹{savings.toLocaleString('en-IN')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowTransportModal(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 self-start lg:self-auto"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Choose Live Transport</span>
          </button>
        </div>
      )}

      {/* Active Disruption Alert Banner */}
      {activeAlerts.length > 0 && (
        <div className={`p-4 rounded-2xl border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          activeAlerts[0].category === 'transport_timing'
            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/60'
            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              activeAlerts[0].category === 'transport_timing'
                ? 'bg-indigo-200 dark:bg-indigo-900/70 text-indigo-900 dark:text-indigo-200'
                : 'bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200'
            }`}>
              {activeAlerts[0].category === 'transport_timing' ? (
                <Radio className="w-4 h-4 text-indigo-700 dark:text-indigo-300 animate-pulse" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-300" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-bold text-xs ${
                  activeAlerts[0].category === 'transport_timing'
                    ? 'text-indigo-950 dark:text-indigo-200'
                    : 'text-amber-950 dark:text-amber-200'
                }`}>
                  {activeAlerts[0].title}
                </span>
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                  activeAlerts[0].category === 'transport_timing'
                    ? 'bg-indigo-200 dark:bg-indigo-900/80 text-indigo-900 dark:text-indigo-200'
                    : 'bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200'
                }`}>
                  {activeAlerts[0].severity}
                </span>
              </div>
              <p className={`text-xs mt-0.5 leading-relaxed ${
                activeAlerts[0].category === 'transport_timing'
                  ? 'text-indigo-900 dark:text-indigo-300'
                  : 'text-amber-900 dark:text-amber-300'
              }`}>
                {activeAlerts[0].description}
              </p>
            </div>
          </div>

          {activeAlerts[0].category === 'transport_timing' ? (
            <button
              onClick={() => {
                setBookedTicketsCategory('transport');
                setShowBookedTicketsModal(true);
              }}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>{activeAlerts[0].suggested_action || 'View Boarding Pass & Timings'}</span>
            </button>
          ) : (
            <button
              disabled={isReplanning}
              onClick={() => onReplanDay(activeAlerts[0].day_number || 1, activeAlerts[0].suggested_action)}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReplanning ? 'animate-spin' : ''}`} />
              <span>Targeted Re-plan (Auto-Adapt)</span>
            </button>
          )}
        </div>
      )}

      {/* Proactive Weather & Traffic Disruption Banner if unreplanned rain risk exists */}
      {activeAlerts.length === 0 && dayWithRainRisk && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200 dark:border-amber-900/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-amber-950 dark:text-amber-200">
                  Live Weather Alert: Day {dayWithRainRisk.day_number} ({dayWithRainRisk.weather_summary?.rain_prob_pct}% Rain Risk)
                </span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 rounded">
                  Advisory
                </span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                Real-time forecast indicates {dayWithRainRisk.weather_summary?.condition} in {dayWithRainRisk.city}. Outdoor activities may be disrupted by rain and traffic congestion.
              </p>
            </div>
          </div>

          <button
            disabled={isReplanning}
            onClick={() => onReplanDay(dayWithRainRisk.day_number, `Weather disruption: ${dayWithRainRisk.weather_summary?.condition} (${dayWithRainRisk.weather_summary?.rain_prob_pct}% rain)`)}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReplanning ? 'animate-spin' : ''}`} />
            <span>Targeted Re-plan to Indoor</span>
          </button>
        </div>
      )}

      {/* Resolved Adaptation Notice */}
      {resolvedAlerts.length > 0 && activeAlerts.length === 0 && !dayWithRainRisk && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-emerald-950 dark:text-emerald-100">{resolvedAlerts[0].title}: </span>
              <span>{resolvedAlerts[0].description}</span>
            </div>
          </div>
          <button
            disabled={isReplanning}
            onClick={() => onReplanDay(resolvedAlerts[0].day_number || 1, 'Sync with latest live conditions')}
            className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 underline cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3 h-3 ${isReplanning ? 'animate-spin' : ''}`} />
            <span>Re-verify Live Telemetry</span>
          </button>
        </div>
      )}

      {/* Dynamic Schedule Timing Adaptation Banner */}
      {scheduleAdaptNotice && (
        <div className="p-4 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white">
                  Schedule Adapted to {scheduleAdaptNotice.carrier} ({scheduleAdaptNotice.mode})
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-indigo-200 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-200 rounded">
                  Arrival: {scheduleAdaptNotice.arrival}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                {scheduleAdaptNotice.note} Day 1 transfers, hotel check-in buffer, and activities have been recalibrated to your transportation timings.
              </p>
            </div>
          </div>
          <button
            onClick={() => setScheduleAdaptNotice(null)}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-semibold px-2.5 py-1 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800 transition-colors cursor-pointer self-end sm:self-auto"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Header Hero Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 text-[11px] font-semibold border border-indigo-100 dark:border-indigo-900/60">
                {(trip.travel_style || 'custom').toUpperCase()} EXPEDITION
              </span>

              {/* Version History Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowVersionMenu(!showVersionMenu)}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  <History className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                  <span>Version {trip.version}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                </button>

                {showVersionMenu && (
                  <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-30">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Itinerary History
                    </div>
                    {trip.versions.map((ver) => (
                      <button
                        key={ver.version}
                        onClick={() => {
                          handleRestoreVersion(ver.version);
                          setShowVersionMenu(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 flex flex-col ${
                          trip.version === ver.version
                            ? 'bg-indigo-50 dark:bg-indigo-950/80 font-semibold text-indigo-700 dark:text-indigo-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>Version {ver.version}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {new Date(ver.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal truncate">{ver.change_summary}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{trip.title}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Autonomous multi-agent synthesis &bull; Coordinated across Transportation, Accommodation & Weather agents
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenChat}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat with Trip AI</span>
            </button>

            <button
              onClick={onOpenPdf}
              className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>

            <button
              onClick={onOpenAddExpense}
              className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden sm:inline">Add Expense</span>
            </button>

            {(() => {
              const confirmedCount = trip.booking_records?.filter((r) => r.booking_status === 'CONFIRMED').length || 0;
              return (
                <button
                  onClick={() => {
                    setBookedTicketsCategory('all');
                    setShowBookedTicketsModal(true);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                    confirmedCount > 0
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white'
                      : 'bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white'
                  }`}
                  title={confirmedCount > 0 ? 'View Confirmed Tickets & Stays' : 'View Bookings & Reservations Status'}
                >
                  {confirmedCount > 0 ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                  ) : (
                    <QrCode className="w-3.5 h-3.5 text-slate-300" />
                  )}
                  <span>{confirmedCount > 0 ? 'Confirmed Passes' : 'Bookings & Passes'}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      confirmedCount > 0 ? 'bg-white/20 text-white' : 'bg-amber-400 text-amber-950'
                    }`}
                  >
                    {confirmedCount > 0 ? confirmedCount : 'Pending'}
                  </span>
                </button>
              );
            })()}

            {/* Trip Review Button (Refines AI) */}
            {onOpenReview && (
              <button
                id="btn-open-trip-review"
                onClick={onOpenReview}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  trip.review
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-100'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/20'
                }`}
                title="Rate destinations and activities after trip concludes to refine future AI recommendations"
              >
                <Star className={`w-3.5 h-3.5 ${trip.review ? 'fill-amber-400 text-amber-400' : 'fill-white text-white'}`} />
                <span>{trip.review ? `Trip Rated (${trip.review.destination_rating}★)` : 'Rate & Review Trip'}</span>
              </button>
            )}

            {/* Quick SOS Button */}
            {onOpenSosModal && (
              <button
                id="trip-overview-sos-btn"
                onClick={onOpenSosModal}
                className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs shadow-red-500/20 border border-red-500/40 transition-all cursor-pointer"
                title="Emergency SOS & Local Helplines"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-white animate-pulse" />
                <span>SOS</span>
              </button>
            )}
          </div>
        </div>

        {/* Trip Review & AI Learning Memory Banner if already reviewed */}
        {trip.review && (
          <div
            id="trip-review-summary-card"
            className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-cyan-950/20 border border-emerald-200 dark:border-emerald-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-xs text-emerald-950 dark:text-emerald-100">
                    Post-Trip Review Completed &bull; {trip.review.destination_rating}/5 Stars
                  </span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 bg-emerald-200 dark:bg-emerald-900/80 text-emerald-900 dark:text-emerald-200 rounded">
                    Firebase AI Memory Active
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 rounded">
                    Pace: {trip.review.pace_rating?.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  {trip.review.destination_feedback
                    ? `"${trip.review.destination_feedback}"`
                    : `Destination rated ${trip.review.destination_rating}★ with ${trip.review.activity_ratings?.length || 0} activities reviewed.`}
                  {trip.review.highlights && trip.review.highlights.length > 0 && (
                    <span className="font-medium text-emerald-900 dark:text-emerald-200 ml-1">
                      Top Highlights: {trip.review.highlights.join(', ')}.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {onOpenReview && (
              <button
                id="btn-edit-trip-review"
                onClick={onOpenReview}
                className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-emerald-50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-2xs shrink-0 self-start sm:self-auto cursor-pointer"
              >
                <span>Edit Review</span>
              </button>
            )}
          </div>
        )}

        {/* Metadata Chips Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Route</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{trip.origin} &rarr; {trip.destination}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Duration</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{trip.days?.length || 0} Days ({trip.start_date.slice(5)} to {trip.end_date.slice(5)})</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <Users className="w-4 h-4 text-indigo-500 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Travellers</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{trip.travellers_count} Family Pax</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <DollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Budget Cap</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">₹{trip.budget.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {onOpenGroupMembers && (
            <button
              onClick={onOpenGroupMembers}
              className="flex items-center gap-2 p-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/80 transition-colors text-left cursor-pointer group col-span-2 sm:col-span-4"
            >
              <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Radio className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
              </div>
              <div className="truncate">
                <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-semibold block">Live Tracking</span>
                <span className="font-bold text-xs text-indigo-950 dark:text-indigo-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                  {trip.members?.length || 4} Group Members
                </span>
              </div>
            </button>
          )}
        </div>

        {/* Autonomous Transportation Timing & Live Telemetry Card */}
        {activeTracking && (
          <div className="pt-2">
            <TransportTimingTrackerCard
              trip={trip}
              tracking={activeTracking}
              onRefreshTracking={handleRefreshTracking}
              onSimulateDelay={handleSimulateDelay}
              onViewBoardingPass={() => {
                setBookedTicketsCategory('transport');
                setShowBookedTicketsModal(true);
              }}
              onAdaptItinerary={() => onReplanDay(1, 'Transit schedule timing shift adaptation')}
            />
          </div>
        )}

        {/* Selected Transport & Hotel Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {trip.selected_transport && (() => {
            const booking = getTransportBookingInfo(trip.selected_transport, trip);
            return (
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-xs flex flex-col justify-between gap-3 relative group">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      trip.selected_transport.mode === 'train'
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                        : trip.selected_transport.mode === 'bus'
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                        : 'bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300'
                    }`}
                  >
                    {trip.selected_transport.mode === 'train' ? (
                      <Train className="w-4.5 h-4.5" />
                    ) : trip.selected_transport.mode === 'bus' ? (
                      <Bus className="w-4.5 h-4.5" />
                    ) : (
                      <Plane className="w-4.5 h-4.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-slate-900 dark:text-white truncate">{trip.selected_transport.carrier}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            trip.selected_transport.mode === 'train'
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                              : trip.selected_transport.mode === 'bus'
                              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                              : 'bg-violet-100 dark:bg-violet-950/80 text-violet-800 dark:text-violet-300'
                          }`}
                        >
                          {trip.selected_transport.mode || 'Flight'}
                        </span>
                        {(() => {
                          const isConfirmed = trip.booking_records?.some(
                            (r) => r.category === 'transport' && r.booking_status === 'CONFIRMED'
                          );
                          const confRecord = trip.booking_records?.find(
                            (r) => r.category === 'transport' && r.booking_status === 'CONFIRMED'
                          );
                          if (isConfirmed && confRecord) {
                            return (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Booked ({confRecord.reference_number})
                              </span>
                            );
                          }
                          return (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                              Booking Pending
                            </span>
                          );
                        })()}
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">₹{trip.selected_transport.price?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 truncate">
                      {trip.selected_transport.origin} to {trip.selected_transport.destination} ({trip.selected_transport.duration})
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1.5">
                      <span>CO₂: {trip.selected_transport.carbon_footprint_kg}kg</span>
                      <span>&bull;</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{trip.selected_transport.source?.source_name}</span>
                    </div>
                  </div>
                </div>

                {/* Transport Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/60">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => {
                        setAgentBookingCategory('transport');
                        setTargetTransportOption(trip.selected_transport);
                        setShowAgentBookingModal(true);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 px-2.5 py-1 rounded-lg transition-all shadow-2xs cursor-pointer group"
                      title="Minimal human intervention: Pre-filled real-time ticket redirection & 1-click clipboard passenger autofill"
                    >
                      <Zap className="w-3 h-3 text-amber-300 fill-amber-300 animate-pulse" />
                      <span>Instant Live Tickets</span>
                    </button>

                    <a
                      href={booking.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                      title={`Book tickets directly on ${booking.officialSiteName}`}
                    >
                      <span>Direct on {booking.realtimePlatform.split('&')[0].trim()}</span>
                      <ExternalLink className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                    </a>

                    {(() => {
                      const isConfirmed = trip.booking_records?.some(
                        (r) => r.category === 'transport' && r.booking_status === 'CONFIRMED'
                      );
                      if (isConfirmed) {
                        return (
                          <button
                            onClick={() => {
                              setBookedTicketsCategory('transport');
                              setShowBookedTicketsModal(true);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                            title="View Confirmed Boarding Pass & E-Ticket"
                          >
                            <QrCode className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>View Confirmed Ticket</span>
                          </button>
                        );
                      }
                      return (
                        <button
                          onClick={() => {
                            setBookedTicketsCategory('transport');
                            setShowBookedTicketsModal(true);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          title="Complete Booking & Enter PNR to Unlock Ticket"
                        >
                          <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          <span>Complete Booking (Enter PNR)</span>
                        </button>
                      );
                    })()}
                  </div>

                  <button
                    onClick={() => setShowTransportModal(true)}
                    className="text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>Change</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {trip.selected_hotel && (() => {
            const booking = getHotelBookingInfo(trip.selected_hotel, trip);
            return (
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-xs flex flex-col justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
                    <Building2 className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-slate-900 dark:text-white truncate">{trip.selected_hotel.name}</span>
                        {(() => {
                          const isConfirmed = trip.booking_records?.some(
                            (r) => r.category === 'hotel' && r.booking_status === 'CONFIRMED'
                          );
                          const confRecord = trip.booking_records?.find(
                            (r) => r.category === 'hotel' && r.booking_status === 'CONFIRMED'
                          );
                          if (isConfirmed && confRecord) {
                            return (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Booked ({confRecord.reference_number})
                              </span>
                            );
                          }
                          return (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                              Reservation Pending
                            </span>
                          );
                        })()}
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">₹{trip.selected_hotel.total_price?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 truncate">
                      {trip.selected_hotel.location} &bull; {trip.selected_hotel.rating}★ ({trip.selected_hotel.distance_to_center_km}km from center)
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1.5 truncate">
                      <span>{trip.selected_hotel.amenities?.slice(0, 2).join(', ') || 'Hotel Stay'}</span>
                      <span>&bull;</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{trip.selected_hotel.source?.source_name}</span>
                    </div>
                  </div>
                </div>

                {/* Hotel Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/60">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => {
                        setAgentBookingCategory('hotel');
                        setTargetHotelOption(trip.selected_hotel);
                        setShowAgentBookingModal(true);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-2.5 py-1 rounded-lg transition-all shadow-2xs cursor-pointer group"
                      title="Minimal human intervention: Pre-filled real-time room availability, dates, guests & 1-click booking"
                    >
                      <Zap className="w-3 h-3 text-amber-300 fill-amber-300 animate-pulse" />
                      <span>Instant Live Rooms</span>
                    </button>

                    <a
                      href={booking.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                      title={`Book room directly on ${booking.officialSiteName}`}
                    >
                      <Building2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      <span>Direct on {booking.realtimePlatform.split('&')[0].trim()}</span>
                      <ExternalLink className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                    </a>

                    {(() => {
                      const isConfirmed = trip.booking_records?.some(
                        (r) => r.category === 'hotel' && r.booking_status === 'CONFIRMED'
                      );
                      if (isConfirmed) {
                        return (
                          <button
                            onClick={() => {
                              setBookedTicketsCategory('hotel');
                              setShowBookedTicketsModal(true);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                            title="View Confirmed Hotel Booking Voucher"
                          >
                            <QrCode className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>View Confirmed Voucher</span>
                          </button>
                        );
                      }
                      return (
                        <button
                          onClick={() => {
                            setBookedTicketsCategory('hotel');
                            setShowBookedTicketsModal(true);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          title="Complete Booking & Enter Confirmation Ref to Unlock Voucher"
                        >
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Complete Booking (Enter Ref)</span>
                        </button>
                      );
                    })()}
                  </div>

                  <button
                    onClick={() => setShowHotelModal(true)}
                    className="text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>Change</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Multi-Modal Transport Switcher Modal */}
        {showTransportModal && trip.transport_options && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Select Transport Mode (Budget Optimized)</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Budget Agent ensures flights, trains, and buses automatically balance under your ₹{trip.budget.toLocaleString('en-IN')} cap.
                  </p>
                </div>
                <button
                  onClick={() => setShowTransportModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs font-bold cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Mode Filter Tabs */}
              <div className="flex items-center gap-1.5 pb-1">
                <button
                  onClick={() => setTransportFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    transportFilter === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  All ({trip.transport_options?.length || 0})
                </button>
                <button
                  onClick={() => setTransportFilter('flight')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    transportFilter === 'flight'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Flights
                </button>
                <button
                  onClick={() => setTransportFilter('train')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    transportFilter === 'train'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Trains
                </button>
                <button
                  onClick={() => setTransportFilter('bus')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    transportFilter === 'bus'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Buses
                </button>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {trip.transport_options
                  .filter((opt) => transportFilter === 'all' || opt.mode === transportFilter)
                  .map((opt) => {
                    const isSelected = trip.selected_transport?.id === opt.id;
                    const isUnderBudget = opt.price <= trip.budget * 0.45;
                    const currentPrice = trip.selected_transport?.price || 0;
                    const priceSavings = currentPrice - opt.price;
                    const optBooking = getTransportBookingInfo(opt, trip);
                    const timingProfile = getTransportTimingProfile(opt, trip.selected_hotel, trip.destination);

                    return (
                      <div
                        key={opt.id}
                        onClick={() => !isSwitchingTransport && handleSwitchTransport(opt.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/50 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 bg-white dark:bg-slate-900/80'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              opt.mode === 'train'
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                                : opt.mode === 'bus'
                                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                                : 'bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300'
                            }`}
                          >
                            {opt.mode === 'train' ? (
                              <Train className="w-4 h-4" />
                            ) : opt.mode === 'bus' ? (
                              <Bus className="w-4 h-4" />
                            ) : (
                              <Plane className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-xs text-slate-900 dark:text-white">{opt.carrier}</span>
                              <span
                                className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                                  opt.mode === 'train'
                                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                                    : opt.mode === 'bus'
                                    ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                                    : 'bg-violet-100 dark:bg-violet-950/80 text-violet-800 dark:text-violet-300'
                                }`}
                              >
                                {opt.mode}
                              </span>
                              {priceSavings > 0 && !isSelected && (
                                <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                  <TrendingDown className="w-2.5 h-2.5" />
                                  <span>Saves ₹{priceSavings.toLocaleString('en-IN')}</span>
                                </span>
                              )}
                              {isUnderBudget && priceSavings <= 0 && (
                                <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.2 rounded">
                                  Budget Match
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {opt.origin} &rarr; {opt.destination} &bull; {opt.duration} &bull; {opt.departure_time} - {opt.arrival_time}
                            </div>

                            {/* Schedule Adaptation Impact Pill */}
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-indigo-500" />
                                <span>Day 1 Starts: ~{minutesToTimeString(timingProfile.readyForActivitiesMinutes, true)}</span>
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 px-1.5 py-0.5 rounded-md">
                                {timingProfile.terminalName.split('(')[0].trim()}
                              </span>
                            </div>

                            {/* Official Booking Site Direct Links */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAgentBookingCategory('transport');
                                  setTargetTransportOption(opt);
                                  setShowAgentBookingModal(true);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                                title="Autonomous instant booking redirection with pre-filled inputs"
                              >
                                <Zap className="w-2.5 h-2.5 text-amber-300 fill-amber-300" />
                                <span>Live Tickets</span>
                              </button>

                              <a
                                href={optBooking.officialUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-md transition-colors"
                                title={`Open real-time ticketing on ${optBooking.officialSiteName}`}
                              >
                                <span>Direct {optBooking.realtimePlatform.split('(')[0].trim()}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>

                              {isSelected && (
                                <button
                                  onClick={() => {
                                    setShowTransportModal(false);
                                    setBookedTicketsCategory('transport');
                                    setShowBookedTicketsModal(true);
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                                >
                                  <QrCode className="w-2.5 h-2.5" />
                                  <span>View Ticket</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-left sm:text-right shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 flex sm:flex-col items-center sm:items-end justify-between">
                          <div>
                            <div className="font-bold text-xs text-slate-900 dark:text-white">₹{opt.price.toLocaleString('en-IN')}</div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{opt.carbon_footprint_kg}kg CO₂</div>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 justify-end mt-1">
                              <Check className="w-3 h-3" />
                              <span>Active</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setShowTransportModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hotel Switcher Modal */}
        <HotelSwitcherModal
          isOpen={showHotelModal}
          onClose={() => setShowHotelModal(false)}
          trip={trip}
          onSelectHotel={handleSwitchHotel}
          isLoading={isSwitchingHotel}
          onViewVoucher={() => {
            setShowHotelModal(false);
            setBookedTicketsCategory('hotel');
            setShowBookedTicketsModal(true);
          }}
        />

        {/* Booked Tickets, Rail Slips & Hotel Vouchers Modal */}
        <BookedTicketsModal
          isOpen={showBookedTicketsModal}
          onClose={() => setShowBookedTicketsModal(false)}
          trip={trip}
          onUpdateTrip={onTripUpdated}
          initialCategory={bookedTicketsCategory}
        />

        {/* Autonomous Real-Time Ticket Booking Concierge Modal */}
        <AgentBookingAssistantModal
          isOpen={showAgentBookingModal}
          onClose={() => setShowAgentBookingModal(false)}
          trip={trip}
          mode={agentBookingCategory}
          transportOption={targetTransportOption}
          hotelOption={targetHotelOption}
          onUpdateTrip={onTripUpdated}
          onViewTickets={() => {
            setBookedTicketsCategory(agentBookingCategory);
            setShowBookedTicketsModal(true);
          }}
        />
      </div>
    </div>
  );
};
