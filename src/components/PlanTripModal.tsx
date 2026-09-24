import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Send,
  Calendar,
  Users,
  DollarSign,
  MapPin,
  Compass,
  CheckCircle2,
  ArrowRight,
  Plane,
  Hotel,
  CloudSun,
  Train,
  Bus,
  AlertTriangle,
  ArrowRightLeft,
  ChevronRight,
} from 'lucide-react';
import { ExtractedConstraints, Trip, TransportOption } from '../types.js';
import { api } from '../services/api.js';

interface PlanTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTripPlanned: (trip: Trip) => void;
}

const SAMPLE_PROMPTS = [
  'I want to travel from Chennai to Delhi for 5 days with my family of 4. My budget is ₹80,000. We like historical places, food, shopping and nature.',
  'Plan a 4-day trip from Chennai to Jaipur for 2 people under ₹45,000. We love palaces, royal cuisine, and local handicrafts.',
  'Plan a 5-day scenic trip from Bengaluru to Kerala for 3 people under ₹60,000 with backwaters and tea plantations.',
  'Explore Ooty and Nilgiri hills for 3 days with friends under ₹30,000 focusing on viewpoints and trekking.',
];

const AGENT_STEPS = [
  { id: 'coord', name: 'Coordinator Agent', role: 'Deconstructing constraints & planning workflow' },
  { id: 'trans', name: 'Transportation Agent', role: 'Searching flight & train routes with carbon estimates' },
  { id: 'hotel', name: 'Accommodation Agent', role: 'Comparing hotels for proximity, ratings & family amenities' },
  { id: 'attr', name: 'Attractions Agent', role: 'Synthesizing day-by-day itinerary & applying past trip review refinements' },
  { id: 'weath', name: 'Weather & Disruption Agent', role: 'Checking real-time meteorological forecasts & rain risks' },
  { id: 'budg', name: 'Budget Optimization Agent', role: 'Allocating expenses & testing safety thresholds' },
];

export const PlanTripModal: React.FC<PlanTripModalProps> = ({
  isOpen,
  onClose,
  onTripPlanned,
}) => {
  const [activeMode, setActiveMode] = useState<'nlp' | 'wizard'>('nlp');
  const [nlpPrompt, setNlpPrompt] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [currentAgentIndex, setCurrentAgentIndex] = useState(0);
  const [extractedConstraints, setExtractedConstraints] = useState<ExtractedConstraints | null>(null);

  // Wizard state
  const [origin, setOrigin] = useState('Chennai');
  const [destination, setDestination] = useState('Delhi');
  const [durationDays, setDurationDays] = useState(5);
  const [travellersCount, setTravellersCount] = useState(4);
  const [budget, setBudget] = useState(80000);
  const [currency, setCurrency] = useState('INR');
  const [travelStyle, setTravelStyle] = useState('family');
  const [interests, setInterests] = useState<string[]>(['Heritage', 'Food', 'Shopping', 'Nature']);

  // Budget transport constraint state
  const [isCheckingTransport, setIsCheckingTransport] = useState(false);
  const [showTransportChoice, setShowTransportChoice] = useState(false);
  const [liveTransportOptions, setLiveTransportOptions] = useState<TransportOption[]>([]);
  const [selectedTransportChoice, setSelectedTransportChoice] = useState<TransportOption | null>(null);
  const [pendingConstraints, setPendingConstraints] = useState<ExtractedConstraints | null>(null);

  if (!isOpen) return null;

  const handleExtractFromNlp = async () => {
    if (!nlpPrompt.trim()) return;
    setIsExtracting(true);
    try {
      const { constraints } = await api.extractConstraints(nlpPrompt);
      setExtractedConstraints(constraints);
      setOrigin(constraints.origin);
      setDestination(constraints.destination);
      setDurationDays(constraints.duration_days);
      setTravellersCount(constraints.travellers_count);
      setBudget(constraints.budget);
      setCurrency(constraints.currency || 'INR');
      setInterests(constraints.interests);
      setTravelStyle(constraints.travel_style);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCheckBudgetAndPlan = async (constraintsToUse?: ExtractedConstraints) => {
    const finalConstraints: ExtractedConstraints = constraintsToUse || {
      origin,
      destination,
      duration_days: durationDays,
      start_date: '2026-10-10',
      end_date: '2026-10-14',
      travellers_count: travellersCount,
      budget,
      currency,
      interests,
      travel_style: travelStyle,
      food_preference: 'all',
      transport_preference: 'flight',
      accommodation_preference: 'boutique',
    };

    setIsCheckingTransport(true);
    try {
      // Query live transport options to check if flight fits within 45% budget allocation
      const { options } = await api.getLiveTransport(
        finalConstraints.origin,
        finalConstraints.destination,
        finalConstraints.travellers_count
      );

      const flights = options.filter((t) => t.mode === 'flight');
      const cheapestFlight = flights[0];
      const flightPrice = cheapestFlight ? cheapestFlight.price : finalConstraints.travellers_count * 6500;
      const budgetCap = finalConstraints.budget;
      const flightOverBudget = flightPrice > budgetCap * 0.45;

      // If flight tickets exceed the budget allocation, ask user to choose live transport according to budget!
      if (flightOverBudget && options.length > 1 && finalConstraints.transport_preference === 'flight') {
        setLiveTransportOptions(options);
        setPendingConstraints(finalConstraints);

        // Pre-select the recommended train or bus option
        const recommendedOption =
          options.find((t) => t.mode === 'train' && t.price <= budgetCap * 0.45) ||
          options.find((t) => t.mode === 'bus') ||
          options[1];

        setSelectedTransportChoice(recommendedOption || options[0]);
        setShowTransportChoice(true);
        setIsCheckingTransport(false);
        return;
      }

      // If within budget or already confirmed, proceed immediately to planner
      await handleExecutePlanning(finalConstraints);
    } catch (e) {
      console.warn('Transport pre-check warning, proceeding to planner directly:', e);
      await handleExecutePlanning(finalConstraints);
    } finally {
      setIsCheckingTransport(false);
    }
  };

  const handleConfirmTransportChoiceAndPlan = (choice: TransportOption) => {
    if (!pendingConstraints) return;

    const updatedConstraints: ExtractedConstraints = {
      ...pendingConstraints,
      transport_preference: choice.mode,
      selected_transport_id: choice.id,
    };

    setShowTransportChoice(false);
    handleExecutePlanning(updatedConstraints);
  };

  const handleExecutePlanning = async (constraintsToUse?: ExtractedConstraints) => {
    const finalConstraints: ExtractedConstraints = constraintsToUse || {
      origin,
      destination,
      duration_days: durationDays,
      start_date: '2026-10-10',
      end_date: '2026-10-14',
      travellers_count: travellersCount,
      budget,
      currency,
      interests,
      travel_style: travelStyle,
      food_preference: 'all',
      transport_preference: 'flight',
      accommodation_preference: 'boutique',
    };

    setIsPlanning(true);
    setCurrentAgentIndex(0);

    // Animate multi-agent sequence visually
    const interval = setInterval(() => {
      setCurrentAgentIndex((prev) => {
        if (prev < AGENT_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 550);

    try {
      // Ingest reviews to refine AI recommendations
      let userReviews;
      try {
        const reviewsRes = await api.getReviews();
        userReviews = reviewsRes.reviews;
      } catch (err) {
        console.warn('Could not fetch reviews prior to planning:', err);
      }

      const { trip } = await api.planTrip(finalConstraints, userReviews);
      clearInterval(interval);
      setCurrentAgentIndex(AGENT_STEPS.length);
      setTimeout(() => {
        setIsPlanning(false);
        onTripPlanned(trip);
        onClose();
      }, 700);
    } catch (e) {
      clearInterval(interval);
      setIsPlanning(false);
      console.error('Trip planning error:', e);
      alert('Planning request failed. Please check network connection.');
    }
  };

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter((i) => i !== interest));
    } else {
      setInterests([...interests, interest]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto transition-all">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-white">Plan My Trip with Smart Voyager AI</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Autonomous multi-agent synthesis using live data feeds</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPlanning}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto max-h-[75vh]">
          {isPlanning ? (
            /* Multi-Agent Orchestration Visualizer */
            <div className="py-8 px-4 text-center">
              <div className="relative w-16 h-16 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-950"></div>
                <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                Synthesizing Itinerary for {destination}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
                Coordinator is querying live flights, accommodations, opening hours, and real-time weather.
              </p>

              {/* Steps Progress */}
              <div className="max-w-md mx-auto space-y-2.5 text-left">
                {AGENT_STEPS.map((step, idx) => {
                  const isDone = currentAgentIndex > idx;
                  const isCurrent = currentAgentIndex === idx;
                  return (
                    <div
                      key={step.id}
                      className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                        isDone
                          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                          : isCurrent
                          ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 shadow-xs'
                          : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      <div className="mt-0.5">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : isCurrent ? (
                          <span className="relative flex h-3.5 w-3.5 mt-0.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-indigo-600"></span>
                          </span>
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-700" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold">{step.name}</div>
                        <div className="text-[11px] opacity-80 leading-tight">{step.role}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : showTransportChoice ? (
            /* Budget-Constrained Live Transport Selection Screen */
            <div className="space-y-4">
              {/* Alert Header */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-amber-950 dark:text-amber-200">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5 text-amber-800 dark:text-amber-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-amber-950 dark:text-amber-200">
                        Flight Tickets Exceed Recommended Budget Allocation
                      </h3>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 rounded-full">
                        Budget Guard
                      </span>
                    </div>
                    <p className="text-xs text-amber-900/90 dark:text-amber-300/90 mt-1 leading-relaxed">
                      Round-trip flight tickets for{' '}
                      <strong>{pendingConstraints?.travellers_count || travellersCount} travellers</strong> start at{' '}
                      <strong>
                        ₹
                        {(
                          liveTransportOptions.find((t) => t.mode === 'flight')?.price ||
                          (pendingConstraints?.travellers_count || travellersCount) * 6500
                        ).toLocaleString('en-IN')}
                      </strong>
                      , which takes{' '}
                      <strong>
                        {Math.round(
                          ((liveTransportOptions.find((t) => t.mode === 'flight')?.price ||
                            (pendingConstraints?.travellers_count || travellersCount) * 6500) /
                            (pendingConstraints?.budget || budget)) *
                            100
                        )}
                        %
                      </strong>{' '}
                      of your ₹{(pendingConstraints?.budget || budget).toLocaleString('en-IN')} budget cap. This leaves
                      insufficient funds for quality hotel rooms, daily meals, and local sightseeing.
                    </p>
                    <p className="text-xs font-semibold text-amber-950 dark:text-amber-200 mt-2">
                      Please choose a live transport option according to your budget:
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Transport Options Grid */}
              <div className="space-y-2.5">
                {liveTransportOptions.map((opt) => {
                  const isSelected = selectedTransportChoice?.id === opt.id;
                  const currentBudget = pendingConstraints?.budget || budget;
                  const pct = Math.round((opt.price / currentBudget) * 100);
                  const remainingCushion = Math.max(0, currentBudget - opt.price);

                  return (
                    <div
                      key={opt.id}
                      onClick={() => setSelectedTransportChoice(opt)}
                      className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                        isSelected
                          ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-slate-50/70 dark:hover:bg-slate-800 bg-white dark:bg-slate-850'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          opt.mode === 'train'
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                            : opt.mode === 'bus'
                            ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                            : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                        }`}
                      >
                        {opt.mode === 'train' ? (
                          <Train className="w-5 h-5" />
                        ) : opt.mode === 'bus' ? (
                          <Bus className="w-5 h-5" />
                        ) : (
                          <Plane className="w-5 h-5" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{opt.carrier}</span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                opt.mode === 'train'
                                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                                  : opt.mode === 'bus'
                                  ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                                  : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200'
                              }`}
                            >
                              {opt.mode}
                            </span>
                            {opt.mode === 'train' && opt.price <= currentBudget * 0.45 && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                                Recommended Budget Match
                              </span>
                            )}
                            {opt.mode === 'bus' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                                Maximum Savings
                              </span>
                            )}
                            {opt.mode === 'flight' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">
                                Exceeds 45% Limit
                              </span>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                              ₹{opt.price.toLocaleString('en-IN')}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">({pct}% of budget)</span>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                          <span>
                            ⏱️ {opt.duration} &bull; Departure {opt.departure_time}
                          </span>
                          <span>&bull;</span>
                          <span>🧳 {opt.baggage_included}</span>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                          <span className="text-slate-600 dark:text-slate-300 font-medium">
                            Remaining for Hotel & Food:{' '}
                            <strong className="text-emerald-700 dark:text-emerald-400">₹{remainingCushion.toLocaleString('en-IN')}</strong>
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{opt.source?.source_name}</span>
                        </div>
                      </div>

                      <div className="mt-1">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Option to increase budget if user really wants flights */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between gap-3">
                <span className="text-slate-600 dark:text-slate-300">
                  Prefer flying? You can increase your total budget to comfortably cover IndiGo flights without compromise.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const flightOption = liveTransportOptions.find((t) => t.mode === 'flight');
                    const requiredBudget = Math.round((flightOption?.price || 28000) / 0.4);
                    setBudget(requiredBudget);
                    if (pendingConstraints) {
                      setPendingConstraints({ ...pendingConstraints, budget: requiredBudget });
                    }
                    setShowTransportChoice(false);
                  }}
                  className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer shadow-2xs"
                >
                  Adjust Budget Instead
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Mode Toggle */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => setActiveMode('nlp')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeMode === 'nlp' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Natural Language Prompt
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMode('wizard')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeMode === 'wizard' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Step-by-Step Parameters
                </button>
              </div>

              {activeMode === 'nlp' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    Describe your dream trip in simple plain text:
                  </label>
                  <div className="relative mb-3">
                    <textarea
                      id="nlp-travel-input"
                      rows={4}
                      value={nlpPrompt}
                      onChange={(e) => setNlpPrompt(e.target.value)}
                      placeholder="e.g., I want to travel from Chennai to Delhi for 5 days with my family of 4. My budget is ₹80,000. We like historical places, food, shopping and nature."
                      className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950 outline-hidden text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none transition-all"
                    />
                    <button
                      id="extract-constraints-btn"
                      disabled={!nlpPrompt.trim() || isExtracting}
                      onClick={handleExtractFromNlp}
                      className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isExtracting ? 'Analyzing...' : 'Analyze with AI'}</span>
                    </button>
                  </div>

                  {/* Sample Prompts */}
                  <div className="mb-6">
                    <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-2">Or try a sample request:</div>
                    <div className="space-y-1.5">
                      {SAMPLE_PROMPTS.map((sample, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setNlpPrompt(sample);
                          }}
                          className="w-full text-left p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 border border-slate-200/60 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:text-indigo-900 dark:hover:text-indigo-200 transition-colors cursor-pointer"
                        >
                          "{sample}"
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Extracted Constraints Confirmation Card */}
                  {extractedConstraints && (
                    <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30 mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          Gemini Extracted Trip Parameters
                        </span>
                        <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">Verified</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-white dark:bg-slate-850 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Route</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{origin} → {destination}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-850 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Duration & Pax</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{durationDays} Days / {travellersCount} Pax</span>
                        </div>
                        <div className="bg-white dark:bg-slate-850 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Budget</span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">₹{budget.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-850 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Interests</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">{interests.join(', ')}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Step-by-Step Parameter Wizard */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Departure Origin</label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={origin}
                          onChange={(e) => setOrigin(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 text-xs font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Destination City</label>
                      <div className="relative">
                        <Compass className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={destination}
                          onChange={(e) => setDestination(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 text-xs font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Duration (Days)</label>
                      <input
                        type="number"
                        min={1}
                        max={14}
                        value={durationDays}
                        onChange={(e) => setDurationDays(Number(e.target.value))}
                        className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 text-xs font-medium focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Number of Travellers</label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={travellersCount}
                        onChange={(e) => setTravellersCount(Number(e.target.value))}
                        className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 text-xs font-medium focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Total Budget (₹)</label>
                      <input
                        type="number"
                        step={5000}
                        value={budget}
                        onChange={(e) => setBudget(Number(e.target.value))}
                        className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 text-xs font-medium focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Interests Chips */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Key Travel Interests</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['Heritage', 'Food', 'Shopping', 'Nature', 'Photography', 'Adventure', 'Spiritual', 'Beaches', 'Luxury'].map((interest) => {
                        const isSelected = interests.includes(interest);
                        return (
                          <button
                            key={interest}
                            type="button"
                            onClick={() => toggleInterest(interest)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {interest}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!isPlanning && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            {showTransportChoice ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowTransportChoice(false)}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white px-3 py-1.5 cursor-pointer"
                >
                  &larr; Back to Parameters
                </button>

                <button
                  id="confirm-transport-choice-btn"
                  type="button"
                  disabled={!selectedTransportChoice}
                  onClick={() => selectedTransportChoice && handleConfirmTransportChoiceAndPlan(selectedTransportChoice)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    Confirm & Plan Trip with{' '}
                    {selectedTransportChoice
                      ? selectedTransportChoice.carrier.split('(')[0].trim()
                      : 'Selected Transport'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white px-3 py-1.5 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  id="plan-trip-submit-btn"
                  type="button"
                  disabled={isCheckingTransport}
                  onClick={() => handleCheckBudgetAndPlan(extractedConstraints || undefined)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${isCheckingTransport ? 'animate-spin' : ''}`} />
                  <span>{isCheckingTransport ? 'Checking Live Inventory...' : 'Launch Multi-Agent Planner'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

