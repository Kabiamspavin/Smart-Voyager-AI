import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  Plane,
  Building2,
  Utensils,
  ShoppingBag,
  Ticket,
  CloudSun,
  CloudRain,
  AlertTriangle,
  RefreshCw,
  Info,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Car,
  Train,
  Bus,
  Navigation,
} from 'lucide-react';
import { Trip, ItineraryDay, ItineraryItem, ActivityType } from '../types.js';

interface ItineraryTimelineProps {
  trip: Trip;
  selectedDayNumber: number;
  onSelectDay: (dayNum: number) => void;
  selectedItem?: ItineraryItem | null;
  onSelectItem: (item: ItineraryItem) => void;
  onReplanDay: (dayNum: number, reason: string) => void;
  isReplanning?: boolean;
}

export const ItineraryTimeline: React.FC<ItineraryTimelineProps> = ({
  trip,
  selectedDayNumber,
  onSelectDay,
  selectedItem,
  onSelectItem,
  onReplanDay,
  isReplanning,
}) => {
  const currentDay = trip.days.find((d) => d.day_number === selectedDayNumber) || trip.days[0];

  if (!currentDay) {
    return <div className="p-8 text-center text-slate-500">No itinerary days scheduled.</div>;
  }

  const getCategoryIcon = (category: string, title?: string) => {
    switch (category) {
      case 'flight':
        return <Plane className="w-4 h-4 text-violet-600" />;
      case 'transport': {
        const lower = (title || '').toLowerCase();
        if (lower.includes('train') || lower.includes('express') || lower.includes('rail')) {
          return <Train className="w-4 h-4 text-emerald-600" />;
        }
        if (lower.includes('bus') || lower.includes('isbt') || lower.includes('sleeper')) {
          return <Bus className="w-4 h-4 text-amber-600" />;
        }
        if (lower.includes('flight') || lower.includes('airport') || lower.includes('air')) {
          return <Plane className="w-4 h-4 text-violet-600" />;
        }
        return <Car className="w-4 h-4 text-indigo-600" />;
      }
      case 'hotel':
        return <Building2 className="w-4 h-4 text-indigo-600" />;
      case 'restaurant':
        return <Utensils className="w-4 h-4 text-amber-600" />;
      case 'shopping':
        return <ShoppingBag className="w-4 h-4 text-pink-600" />;
      default:
        return <Ticket className="w-4 h-4 text-emerald-600" />;
    }
  };

  const getActivityTypeBadge = (type: ActivityType) => {
    switch (type) {
      case 'OUTDOOR':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            ☀️ Outdoor
          </span>
        );
      case 'INDOOR':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            🏛️ Covered Indoor
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
            Flexible
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Day Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {trip.days.map((day) => {
          const isSelected = day.day_number === selectedDayNumber;
          const hasRainRisk = (day.weather_summary?.rain_prob_pct || 0) > 40;
          return (
            <button
              key={day.day_number}
              id={`day-tab-${day.day_number}`}
              onClick={() => onSelectDay(day.day_number)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-100 dark:shadow-none'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 border-slate-200 dark:border-slate-700'
              }`}
            >
              <span>Day {day.day_number}</span>
              <span className={`text-[10px] opacity-75 font-normal ${isSelected ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'}`}>
                ({day.date.slice(5)})
              </span>
              {hasRainRisk && <CloudRain className={`w-3 h-3 ${isSelected ? 'text-amber-200' : 'text-amber-500'}`} />}
            </button>
          );
        })}
      </div>

      {/* Selected Day Weather & Theme Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white shadow-xs border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                Day {currentDay.day_number} &bull; {currentDay.city}
              </span>
              <span className="text-[11px] text-slate-400">{currentDay.date}</span>
              {currentDay.day_number === 1 && trip.selected_transport && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 text-[10px] font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Adapted to {trip.selected_transport.carrier} ({trip.selected_transport.departure_time || ''} - {trip.selected_transport.arrival_time || ''})
                </span>
              )}
              {currentDay.day_number === (trip.days?.length || 0) && trip.selected_transport && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 text-[10px] font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Return {trip.selected_transport.mode.toUpperCase()} Departure Timed
                </span>
              )}
              {currentDay.weather_summary?.is_disrupted && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Indoor & Traffic Adapted
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white">{currentDay.title}</h3>
            <p className="text-xs text-slate-300 mt-0.5">{currentDay.theme}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Live Weather Widget */}
            {currentDay.weather_summary && (
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur px-3.5 py-2.5 rounded-xl border border-white/10 self-start sm:self-auto">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/30 flex items-center justify-center text-amber-300">
                  {currentDay.weather_summary.rain_prob_pct > 50 ? (
                    <CloudRain className="w-5 h-5 text-sky-300" />
                  ) : (
                    <CloudSun className="w-5 h-5 text-amber-300" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white">{currentDay.weather_summary.temp_c}&deg;C</span>
                    <span className="text-[11px] text-slate-300 font-medium">{currentDay.weather_summary.condition}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2">
                    <span>Rain: {currentDay.weather_summary.rain_prob_pct}%</span>
                    <span>Wind: {currentDay.weather_summary.wind_kmh} km/h</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Re-plan Button on Day Header */}
            <button
              id={`quick-replan-day-${currentDay.day_number}`}
              disabled={isReplanning}
              onClick={() => onReplanDay(currentDay.day_number, `Weather & Traffic Adaptation: Switch outdoor items to covered indoor venues`)}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
              title="Targeted Re-plan: Adapts schedule with real-time weather and traffic telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReplanning ? 'animate-spin' : ''}`} />
              <span>{currentDay.weather_summary?.is_disrupted ? 'Re-Adapt to Live Weather' : 'Targeted Re-Plan to Indoor'}</span>
            </button>
          </div>
        </div>

        {/* Real-Time Traffic & Transit Advisory Bar */}
        {currentDay.weather_summary?.traffic_advisory && (
          <div className="mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-indigo-200">
              <Car className="w-4 h-4 text-indigo-300 shrink-0" />
              <span>
                <strong className="text-white font-semibold capitalize">Live Traffic ({currentDay.weather_summary.traffic_congestion || 'moderate'}): </strong>
                {currentDay.weather_summary.traffic_advisory}
              </span>
            </div>
            {currentDay.weather_summary.recommended_transit_mode && (
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 whitespace-nowrap font-medium">
                🚇 {currentDay.weather_summary.recommended_transit_mode}
              </span>
            )}
          </div>
        )}

        {/* Rain Disruption Alert Bar */}
        {(currentDay.weather_summary?.rain_prob_pct || 0) > 40 && !currentDay.weather_summary?.is_disrupted && (
          <div className="mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Rain forecast ({currentDay.weather_summary?.rain_prob_pct}% probability). Outdoor spots may be wet and experience surface traffic delays.
              </span>
            </div>
            <button
              disabled={isReplanning}
              onClick={() => onReplanDay(currentDay.day_number, 'Weather disruption: Heavy precipitation forecast')}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReplanning ? 'animate-spin' : ''}`} />
              <span>Targeted Re-plan to Indoor</span>
            </button>
          </div>
        )}
      </div>

      {/* Itinerary Timeline Cards */}
      <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-200 dark:border-slate-800 space-y-4 pt-1">
        {currentDay.items.map((item) => {
          const isSelected = selectedItem?.id === item.id;
          return (
            <div
              key={item.id}
              onClick={() => onSelectItem(item)}
              className={`relative p-4 rounded-xl border transition-all cursor-pointer bg-white dark:bg-slate-900 ${
                isSelected
                  ? 'border-indigo-600 dark:border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-950 shadow-md'
                  : 'border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-xs'
              }`}
            >
              {/* Timeline Pin Node */}
              <div
                className={`absolute -left-[31px] sm:-left-[39px] top-4 w-6 h-6 rounded-full border-2 bg-white dark:bg-slate-900 flex items-center justify-center ${
                  isSelected ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                }`}
              >
                {getCategoryIcon(item.category, item.title)}
              </div>

              {/* Item Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded-md">
                    <Clock className="w-3 h-3" />
                    {item.time}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {item.category}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {getActivityTypeBadge(item.activity_type)}
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {item.category === 'flight'
                      ? item.cost_estimate === 0
                        ? 'Round-Trip Ticket (Included)'
                        : `₹${item.cost_estimate.toLocaleString('en-IN')}`
                      : item.category === 'transport'
                      ? item.cost_estimate === 0
                        ? 'Included in Booking'
                        : `₹${item.cost_estimate.toLocaleString('en-IN')}`
                      : item.cost_estimate === 0 || item.cost_type === 'FREE'
                      ? 'Free Entry'
                      : `₹${item.cost_estimate.toLocaleString('en-IN')}`}
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center justify-between">
                <span>{item.title}</span>
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2.5">{item.description}</p>

              {/* Location & Opening Hours */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-3">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span className="truncate max-w-xs">{item.location}</span>
                </div>
                {item.opening_status && (
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <Info className="w-3 h-3" />
                    <span>{item.opening_status}</span>
                  </div>
                )}
              </div>

              {/* Why Recommended & Evidence */}
              {item.why_recommended && (
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Why Selected: </span>
                    {item.why_recommended}
                  </div>
                </div>
              )}

              {/* Transit & Real-Time Traffic Routing Buffer */}
              {item.transit_info && (
                <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 text-[11px] text-indigo-950 dark:text-indigo-200 flex items-start gap-2 mb-2">
                  <Navigation className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-indigo-950 dark:text-indigo-200">Real-Time Transit & Traffic: </span>
                    <span>{item.transit_info}</span>
                    {item.traffic_delay_minutes ? (
                      <span className="ml-1.5 font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.2 rounded text-[10px]">
                        +{item.traffic_delay_minutes}m buffer
                      </span>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Data Source Transparency Tag */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>{item.source?.source_name || 'Live Places API'}</span>
                </div>
                <span className="font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {item.source?.data_status || 'LIVE'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
