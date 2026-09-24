import React, { useState, useEffect } from 'react';
import {
  Plane,
  Train,
  Bus,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  Radio,
  Car,
  Bell,
  ArrowRight,
  ChevronRight,
  Ticket,
  Sparkles,
} from 'lucide-react';
import { Trip, TransitTrackingInfo, TransitTimingAlert } from '../types.js';
import { parseTimeToMinutes } from '../utils/transportationTracker.js';

interface TransportTimingTrackerCardProps {
  trip: Trip;
  tracking: TransitTrackingInfo;
  onRefreshTracking?: () => Promise<void> | void;
  onSimulateDelay?: (delayMinutes: number) => Promise<void> | void;
  onViewBoardingPass?: () => void;
  onAdaptItinerary?: () => void;
}

export const TransportTimingTrackerCard: React.FC<TransportTimingTrackerCardProps> = ({
  trip,
  tracking,
  onRefreshTracking,
  onSimulateDelay,
  onViewBoardingPass,
  onAdaptItinerary,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [countdown, setCountdown] = useState<string>('');
  const [showSimulateDropdown, setShowSimulateDropdown] = useState(false);

  // Compute live departure countdown
  useEffect(() => {
    const updateCountdown = () => {
      try {
        const depMinutes = parseTimeToMinutes(tracking.estimated_departure);
        const depHours = Math.floor(depMinutes / 60);
        const depMins = depMinutes % 60;

        // Trip start date
        const travelDate = new Date(`${tracking.travel_date}T${depHours.toString().padStart(2, '0')}:${depMins.toString().padStart(2, '0')}:00`);
        const now = new Date();

        const diffMs = travelDate.getTime() - now.getTime();
        if (diffMs <= 0) {
          setCountdown('Departed / In-Transit');
          return;
        }

        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
        const diffMinutes = Math.floor((diffMs / (1000 * 60)) % 60);

        if (diffDays > 0) {
          setCountdown(`${diffDays}d ${diffHours}h ${diffMinutes}m to departure`);
        } else {
          setCountdown(`${diffHours}h ${diffMinutes}m to departure`);
        }
      } catch {
        setCountdown('Schedule Live Monitored');
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 30000);
    return () => clearInterval(interval);
  }, [tracking.estimated_departure, tracking.travel_date]);

  const handleManualRefresh = async () => {
    if (isRefreshing || !onRefreshTracking) return;
    setIsRefreshing(true);
    try {
      await onRefreshTracking();
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const isFlight = tracking.mode === 'flight';
  const isTrain = tracking.mode === 'train';
  const isBus = tracking.mode === 'bus';

  const isDelayed = tracking.status === 'DELAYED' || tracking.delay_minutes > 0;
  const isOnTime = tracking.status === 'ON_TIME' && tracking.delay_minutes === 0;

  return (
    <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 rounded-3xl border border-indigo-500/30 text-white shadow-xl overflow-hidden transition-all relative">
      {/* Background ambient radar glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

      {/* Top Telemetry Header Bar */}
      <div className="px-5 py-3.5 border-b border-indigo-500/20 bg-indigo-900/40 flex flex-wrap items-center justify-between gap-3 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-200 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            Autonomous Transportation Timing Agent
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-800/80 border border-indigo-600/50 text-indigo-200 font-mono font-bold">
            PNR: {tracking.booking_reference}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {/* Live Status Badge */}
          {isOnTime && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              ON TIME (Punctual)
            </span>
          )}
          {isDelayed && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold text-[11px]">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              DELAYED (+{tracking.delay_minutes}m)
            </span>
          )}

          {/* Refresh telemetry button */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg bg-indigo-800/50 hover:bg-indigo-700/60 border border-indigo-500/30 text-indigo-200 transition-colors cursor-pointer disabled:opacity-50"
            title="Ping Live Telemetry Radar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Tracking Content */}
      <div className="p-5 sm:p-6 space-y-5">
        {/* Transit Header & Route */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
              {isFlight ? (
                <Plane className="w-6 h-6 text-indigo-300" />
              ) : isTrain ? (
                <Train className="w-6 h-6 text-indigo-300" />
              ) : (
                <Bus className="w-6 h-6 text-indigo-300" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white">
                  {tracking.carrier}
                </h3>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-800/60 text-indigo-300">
                  {tracking.mode}
                </span>
              </div>
              <div className="text-xs text-indigo-200/80 mt-0.5 flex flex-wrap items-center gap-2">
                <span>{tracking.origin} &rarr; {tracking.destination}</span>
                <span className="text-slate-400">&bull;</span>
                <span className="text-amber-300 font-semibold">{countdown}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {onViewBoardingPass && (
              <button
                onClick={onViewBoardingPass}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>Digital Pass</span>
              </button>
            )}

            {/* Simulation Menu for Testing Delay Handling */}
            <div className="relative">
              <button
                onClick={() => setShowSimulateDropdown(!showSimulateDropdown)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                title="Simulate live transit disruptions or timing updates"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Simulate Event</span>
              </button>

              {showSimulateDropdown && (
                <div className="absolute right-0 mt-1.5 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 text-xs">
                  <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Test Agent Response:
                  </div>
                  <button
                    onClick={() => {
                      setShowSimulateDropdown(false);
                      onSimulateDelay?.(0);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-emerald-300 font-semibold flex items-center justify-between"
                  >
                    <span>Restore On-Time</span>
                    <span className="text-[10px] text-slate-400">0 min</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowSimulateDropdown(false);
                      onSimulateDelay?.(25);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-amber-300 font-semibold flex items-center justify-between"
                  >
                    <span>Simulate Delay (+25m)</span>
                    <span className="text-[10px] text-slate-400">+25 min</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowSimulateDropdown(false);
                      onSimulateDelay?.(50);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-rose-300 font-semibold flex items-center justify-between"
                  >
                    <span>Major Delay (+50m)</span>
                    <span className="text-[10px] text-slate-400">+50 min</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4-Column Timings & Allocation Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/70 p-4 rounded-2xl border border-indigo-500/20">
          {/* Departure */}
          <div>
            <div className="text-[11px] text-indigo-300/80 font-medium flex items-center gap-1 mb-1">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Departure Time</span>
            </div>
            <div className="text-base sm:text-lg font-extrabold text-white">
              {tracking.estimated_departure}
            </div>
            <div className="text-[10px] text-slate-400">
              {isDelayed ? (
                <span className="text-amber-400 font-semibold">
                  Sched: {tracking.scheduled_departure} (+{tracking.delay_minutes}m)
                </span>
              ) : (
                <span className="text-emerald-400 font-semibold">Published: {tracking.scheduled_departure}</span>
              )}
            </div>
          </div>

          {/* Arrival */}
          <div>
            <div className="text-[11px] text-indigo-300/80 font-medium flex items-center gap-1 mb-1">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Arrival Time</span>
            </div>
            <div className="text-base sm:text-lg font-extrabold text-white">
              {tracking.estimated_arrival}
            </div>
            <div className="text-[10px] text-emerald-400 font-semibold truncate">
              {tracking.schedule_sync_status === 'synchronized' ? '✓ Day 1 Synchronized' : '⚠️ Adjust Day 1'}
            </div>
          </div>

          {/* Gate / Platform */}
          <div>
            <div className="text-[11px] text-indigo-300/80 font-medium flex items-center gap-1 mb-1">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isFlight ? 'Gate & Terminal' : 'Platform & Track'}</span>
            </div>
            <div className="text-sm sm:text-base font-extrabold text-indigo-200">
              {tracking.gate_or_platform}
            </div>
            <div className="text-[10px] text-slate-400">
              {tracking.terminal || 'Main Terminal Concourse'}
            </div>
          </div>

          {/* Leave Home By (Commute Advisory) */}
          <div className="bg-indigo-950/60 p-2.5 rounded-xl border border-indigo-500/30">
            <div className="text-[11px] text-amber-300 font-bold flex items-center gap-1 mb-1">
              <Car className="w-3.5 h-3.5 text-amber-400" />
              <span>Leave Home By</span>
            </div>
            <div className="text-base sm:text-lg font-extrabold text-amber-300">
              {tracking.recommended_leave_time}
            </div>
            <div className="text-[10px] text-slate-300">
              {tracking.commute_lead_time_minutes}m buffer ({tracking.traffic_congestion} traffic)
            </div>
          </div>
        </div>

        {/* Visual Transit Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] text-indigo-200/90 font-medium">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Web Check-In / Charting: {tracking.checkin_status}</span>
            </span>
            <span className="text-[10px] text-slate-400">
              Boarding starts {tracking.boarding_time}
            </span>
          </div>

          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
            <div className="h-full bg-emerald-500 rounded-full w-2/5"></div>
            <div className={`h-full ${isDelayed ? 'bg-amber-500 animate-pulse' : 'bg-indigo-500'} rounded-full w-1/5 ml-1`}></div>
            <div className="h-full bg-slate-700 rounded-full w-2/5 ml-1"></div>
          </div>

          <div className="flex justify-between text-[9px] text-slate-400 uppercase tracking-wider pt-0.5">
            <span className="text-emerald-400 font-bold">1. Confirmed</span>
            <span className="text-indigo-300 font-bold">2. Commute & Gate</span>
            <span>3. Boarding</span>
            <span>4. Arrived</span>
          </div>
        </div>

        {/* Live Active Alerts Feed */}
        {tracking.timing_alerts && tracking.timing_alerts.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-indigo-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                <span>Real-Time Transportation Timing Alerts ({tracking.timing_alerts.length})</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Telemetry Synced: {new Date(tracking.last_checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {tracking.timing_alerts.map((alt) => (
                <div
                  key={alt.id}
                  className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                    alt.severity === 'high' || alt.severity === 'critical'
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      : alt.severity === 'medium'
                      ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                      : 'bg-indigo-950/40 border-indigo-500/30 text-indigo-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>{alt.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                      {alt.message}
                    </p>
                  </div>

                  {alt.type === 'delay' && onAdaptItinerary && (
                    <button
                      onClick={onAdaptItinerary}
                      className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-[10px] shrink-0 self-center cursor-pointer shadow-xs"
                    >
                      Adapt Day 1
                    </button>
                  )}
                  {alt.type === 'checkin' && tracking.web_checkin_url && (
                    <a
                      href={tracking.web_checkin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shrink-0 self-center inline-flex items-center gap-1"
                    >
                      <span>Check-In</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
