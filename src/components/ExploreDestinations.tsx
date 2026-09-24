import React, { useState, useEffect } from 'react';
import { Compass, Sparkles, MapPin, Calendar, DollarSign, ShieldAlert, CloudSun, ArrowRight } from 'lucide-react';
import { DestinationGuide } from '../types.js';
import { api } from '../services/api.js';

interface ExploreDestinationsProps {
  onPlanTripForDestination: (destName: string) => void;
}

export const ExploreDestinations: React.FC<ExploreDestinationsProps> = ({
  onPlanTripForDestination,
}) => {
  const [guides, setGuides] = useState<DestinationGuide[]>([]);
  const [selectedGuide, setSelectedGuide] = useState<DestinationGuide | null>(null);
  const [liveWeather, setLiveWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGuides();
  }, []);

  const loadGuides = async () => {
    try {
      const res = await api.getDestinationGuides();
      if (res.guides && res.guides.length > 0) {
        setGuides(res.guides);
        setSelectedGuide(res.guides[0]);
        fetchWeather(res.guides[0].name);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeather = async (cityName: string) => {
    try {
      const res = await api.getLiveWeather(cityName);
      setLiveWeather(res.weather);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectGuide = (guide: DestinationGuide) => {
    setSelectedGuide(guide);
    fetchWeather(guide.name);
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-xs">Loading verified destination knowledge base...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Explore Destinations</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Discover verified cultural guides, neighborhood insights, and real-time live weather feeds.
        </p>
      </div>

      {/* Destination Cards Carousel */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {guides.map((g) => {
          const isSelected = selectedGuide?.id === g.id;
          return (
            <div
              key={g.id}
              onClick={() => handleSelectGuide(g)}
              className={`relative rounded-xl overflow-hidden border p-3 cursor-pointer transition-all ${
                isSelected
                  ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-sm ring-1 ring-indigo-500'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="h-24 rounded-lg overflow-hidden mb-2 bg-slate-100 dark:bg-slate-800">
                <img
                  src={g.image_url}
                  alt={g.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">{g.name}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{g.country} &bull; {g.tagline}</div>
            </div>
          );
        })}
      </div>

      {/* Selected Destination Deep-Dive Detail View */}
      {selectedGuide && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          {/* Hero Banner */}
          <div className="relative h-48 sm:h-64 overflow-hidden">
            <img
              src={selectedGuide.image_url}
              alt={selectedGuide.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent flex flex-col justify-end p-6 text-white">
              <span className="text-xs uppercase font-bold tracking-wider text-indigo-300">
                Verified Destination Guide &bull; {selectedGuide.country}
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold">{selectedGuide.name}</h3>
              <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-2xl">{selectedGuide.tagline}</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Best Season</div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedGuide.best_time_to_visit}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Languages</div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedGuide.language}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Est. Daily Budget</div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">₹{selectedGuide.estimated_daily_budget_inr.toLocaleString('en-IN')} / person</div>
              </div>

              {/* Live Weather Widget */}
              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
                  <span>Live Weather</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
                {liveWeather ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <CloudSun className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{liveWeather.temp_c}&deg;C</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300">{liveWeather.condition}</span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Fetching live feed...</div>
                )}
              </div>
            </div>

            {/* Overview */}
            <div>
              <h4 className="text-xs uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1.5">Overview</h4>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selectedGuide.overview}</p>
            </div>

            {/* Neighborhoods Guide */}
            <div>
              <h4 className="text-xs uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-2.5">Top Neighborhoods & Zones</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedGuide.top_neighborhoods.map((n, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                    <div className="font-bold text-xs text-slate-900 dark:text-white">{n.name}</div>
                    <div className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium">Vibe: {n.vibe}</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">Best for: {n.best_for}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cultural Etiquette Tips */}
            <div>
              <h4 className="text-xs uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-2">Local Etiquette & Travel Secrets</h4>
              <ul className="space-y-1.5">
                {selectedGuide.cultural_tips.map((tip, idx) => (
                  <li key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Safety Advisory Banner */}
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Safety & Health Advisory: </span>
                {selectedGuide.safety_advisory}
              </div>
            </div>

            {/* Plan Trip CTA */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => onPlanTripForDestination(selectedGuide.name)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-100 dark:shadow-none transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Plan Trip to {selectedGuide.name} with AI</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
