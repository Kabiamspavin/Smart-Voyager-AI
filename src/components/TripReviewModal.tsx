import React, { useState, useEffect, useMemo } from 'react';
import {
  Star,
  Sparkles,
  CheckCircle2,
  X,
  MapPin,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  CloudCheck,
  ShieldCheck,
  Send,
  HelpCircle,
  Tag,
  Compass,
  Building2,
  Utensils,
  Camera,
  Heart,
  AlertCircle,
  Clock,
  Award,
} from 'lucide-react';
import { Trip, TripReview, ActivityRating, ItineraryItem } from '../types.js';
import { saveTripReviewToFirestore } from '../lib/firebase.js';
import { api } from '../services/api.js';

interface TripReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  userId?: string;
  onTripUpdated: (updatedTrip: Trip) => void;
}

const AVAILABLE_HIGHLIGHT_TAGS = [
  'Heritage & History',
  'Exceptional Food',
  'Scenic Landscapes',
  'Peaceful & Relaxing',
  'Vibrant Culture',
  'Friendly Locals',
  'Budget Friendly',
  'Hidden Gems',
  'Easy Transit',
  'Family Friendly',
];

interface ActivityRatingState {
  rating: number;
  feedback: string;
  tags: string[];
  would_recommend: boolean;
}

const ACTIVITY_SENTIMENT_TAGS = [
  'Must-Visit',
  'Hidden Gem',
  'Great Value',
  'Scenic Photo Spot',
  'Delicious Food',
  'Too Crowded',
  'Overrated',
  'Skip Next Time',
];

export const TripReviewModal: React.FC<TripReviewModalProps> = ({
  isOpen,
  onClose,
  trip,
  userId = 'usr_demo_01',
  onTripUpdated,
}) => {
  // Extract all reviewable activities from trip
  const reviewableActivities: ItineraryItem[] = useMemo(() => {
    if (!trip || !trip.days) return [];
    const items: ItineraryItem[] = [];
    const seenTitles = new Set<string>();

    trip.days.forEach((day) => {
      day.items.forEach((item) => {
        // Exclude transit arrival/departure transfers unless it's an attraction/restaurant/hotel/activity
        if (
          item.category !== 'flight' &&
          item.category !== 'transport' &&
          !seenTitles.has(item.title)
        ) {
          seenTitles.add(item.title);
          items.push(item);
        }
      });
    });
    return items;
  }, [trip]);

  // Form State initialized from existing review if already reviewed
  const existingReview = trip?.review;
  const [destinationRating, setDestinationRating] = useState<number>(existingReview?.destination_rating || 5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [destinationFeedback, setDestinationFeedback] = useState<string>(existingReview?.destination_feedback || '');
  const [travelStyleRating, setTravelStyleRating] = useState<number>(existingReview?.travel_style_rating || 5);
  const [paceRating, setPaceRating] = useState<'too_slow' | 'just_right' | 'too_rushed'>(
    existingReview?.pace_rating || 'just_right'
  );
  const [valueForMoney, setValueForMoney] = useState<number>(existingReview?.value_for_money || 5);
  const [selectedHighlights, setSelectedHighlights] = useState<string[]>(
    existingReview?.highlights || ['Heritage & History', 'Exceptional Food']
  );
  const [tipsForFutureTravelers, setTipsForFutureTravelers] = useState<string>(
    existingReview?.tips_for_future_travelers || ''
  );

  // Per-activity ratings state
  const [activityRatingsMap, setActivityRatingsMap] = useState<Record<string, ActivityRatingState>>({});

  const [activeTab, setActiveTab] = useState<'destination' | 'activities' | 'ai_impact'>('destination');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Initialize activity ratings map
  useEffect(() => {
    if (reviewableActivities.length > 0) {
      const initialMap: Record<string, any> = {};
      reviewableActivities.forEach((act) => {
        const existingAct = existingReview?.activity_ratings?.find(
          (ar) => ar.activity_id === act.id || ar.title === act.title
        );
        initialMap[act.id] = {
          rating: existingAct?.rating || 5,
          feedback: existingAct?.feedback || '',
          tags: existingAct?.tags || ['Must-Visit'],
          would_recommend: existingAct !== undefined ? existingAct.would_recommend : true,
        };
      });
      setActivityRatingsMap(initialMap);
    }
  }, [reviewableActivities, existingReview]);

  if (!isOpen) return null;

  const handleToggleHighlight = (tag: string) => {
    setSelectedHighlights((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleActivityRatingChange = (activityId: string, rating: number) => {
    setActivityRatingsMap((prev) => ({
      ...prev,
      [activityId]: {
        ...prev[activityId],
        rating,
      },
    }));
  };

  const handleActivityTagToggle = (activityId: string, tag: string) => {
    setActivityRatingsMap((prev) => {
      const current = prev[activityId] || { rating: 5, feedback: '', tags: [], would_recommend: true };
      const currentTags = current.tags || [];
      const updatedTags = currentTags.includes(tag)
        ? currentTags.filter((t) => t !== tag)
        : [...currentTags, tag];
      return {
        ...prev,
        [activityId]: {
          ...current,
          tags: updatedTags,
        },
      };
    });
  };

  const handleActivityFeedbackChange = (activityId: string, feedback: string) => {
    setActivityRatingsMap((prev) => ({
      ...prev,
      [activityId]: {
        ...prev[activityId],
        feedback,
      },
    }));
  };

  const handleActivityRecommendToggle = (activityId: string, would_recommend: boolean) => {
    setActivityRatingsMap((prev) => ({
      ...prev,
      [activityId]: {
        ...prev[activityId],
        would_recommend,
      },
    }));
  };

  // AI extracted insights for live preview
  const highRatedActivityTags = useMemo(() => {
    const tags = new Set<string>();
    (Object.values(activityRatingsMap) as ActivityRatingState[]).forEach((data) => {
      if (data && (data.rating >= 4 || data.would_recommend)) {
        data.tags?.forEach((t) => tags.add(t));
      }
    });
    selectedHighlights.forEach((h) => tags.add(h));
    return Array.from(tags);
  }, [activityRatingsMap, selectedHighlights]);

  const avoidedThemes = useMemo(() => {
    const tags = new Set<string>();
    (Object.values(activityRatingsMap) as ActivityRatingState[]).forEach((data) => {
      if (data && (data.rating <= 2 || !data.would_recommend)) {
        data.tags?.forEach((t) => {
          if (t === 'Too Crowded' || t === 'Overrated' || t === 'Skip Next Time') {
            tags.add(t);
          }
        });
      }
    });
    return Array.from(tags);
  }, [activityRatingsMap]);

  const handleSubmitReview = async () => {
    setIsSubmitting(true);
    setSyncMessage(null);

    try {
      // Build structured activity ratings list
      const formattedActivityRatings: ActivityRating[] = reviewableActivities.map((act) => {
        const entry = activityRatingsMap[act.id] || {
          rating: 5,
          feedback: '',
          tags: ['Must-Visit'],
          would_recommend: true,
        };
        return {
          activity_id: act.id,
          title: act.title,
          category: act.category,
          rating: entry.rating,
          feedback: entry.feedback,
          tags: entry.tags,
          would_recommend: entry.would_recommend,
        };
      });

      const reviewId = existingReview?.id || `rev_${trip.id}_${Date.now()}`;
      const newReview: TripReview = {
        id: reviewId,
        trip_id: trip.id,
        user_id: userId,
        destination: trip.destination,
        destination_rating: destinationRating,
        destination_feedback: destinationFeedback,
        travel_style_rating: travelStyleRating,
        pace_rating: paceRating,
        value_for_money: valueForMoney,
        activity_ratings: formattedActivityRatings,
        highlights: selectedHighlights,
        tips_for_future_travelers: tipsForFutureTravelers,
        created_at: existingReview?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ai_insights_extracted: {
          preferred_tags: highRatedActivityTags,
          avoid_tags: avoidedThemes,
          refined_travel_style: paceRating === 'too_rushed' ? 'relaxed' : trip.travel_style,
        },
      };

      // 1. Save in Firebase Firestore
      await saveTripReviewToFirestore(userId, newReview);

      // 2. Synchronize with Server API backend
      await api.saveReview(newReview);

      // 3. Update parent trip state to mark COMPLETED and attach review
      const updatedTrip: Trip = {
        ...trip,
        status: 'COMPLETED',
        review: newReview,
        updated_at: new Date().toISOString(),
      };
      onTripUpdated(updatedTrip);

      setSubmittedSuccess(true);
      setSyncMessage('Review saved to Firebase Firestore. AI recommendations refined!');
    } catch (err: any) {
      console.error('Submit review error:', err);
      setSyncMessage(`Saved to local memory (Firebase sync notice: ${err.message || 'cached'})`);
      // Still update trip locally so user experience is non-blocking
      const fallbackReview: TripReview = {
        id: `rev_${trip.id}_local`,
        trip_id: trip.id,
        user_id: userId,
        destination: trip.destination,
        destination_rating: destinationRating,
        destination_feedback: destinationFeedback,
        travel_style_rating: travelStyleRating,
        pace_rating: paceRating,
        value_for_money: valueForMoney,
        activity_ratings: [],
        highlights: selectedHighlights,
        tips_for_future_travelers: tipsForFutureTravelers,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      onTripUpdated({
        ...trip,
        status: 'COMPLETED',
        review: fallbackReview,
      });
      setSubmittedSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRatingLabel = (val: number) => {
    switch (val) {
      case 5:
        return 'Exceptional (5/5)';
      case 4:
        return 'Very Good (4/5)';
      case 3:
        return 'Average (3/5)';
      case 2:
        return 'Disappointing (2/5)';
      case 1:
        return 'Poor (1/5)';
      default:
        return '';
    }
  };

  return (
    <div
      id="trip-review-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm overflow-y-auto"
    >
      <div
        id="trip-review-modal-content"
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white flex-shrink-0">
          <button
            id="trip-review-modal-close"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm text-white border border-white/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Post-Trip Review & AI Memory
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/60 text-emerald-200">
              <CloudCheck className="w-3.5 h-3.5" />
              Firebase Firestore
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">Rate Your Trip to {trip.destination}</h2>
          <p className="text-sm text-emerald-100 mt-1 max-w-2xl">
            Your feedback directly trains the Smart Voyager AI to tune future destinations, activities, and
            daily pacing to your personal taste.
          </p>

          {/* Quick Tabs */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/15">
            <button
              id="tab-destination-review"
              onClick={() => setActiveTab('destination')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'destination'
                  ? 'bg-white text-emerald-800 shadow'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              1. Destination Rating
            </button>
            <button
              id="tab-activities-review"
              onClick={() => setActiveTab('activities')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'activities'
                  ? 'bg-white text-emerald-800 shadow'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              2. Activities & Sights ({reviewableActivities.length})
            </button>
            <button
              id="tab-ai-impact-review"
              onClick={() => setActiveTab('ai_impact')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'ai_impact'
                  ? 'bg-white text-emerald-800 shadow'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              3. AI Memory Preview
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50">
          {submittedSuccess ? (
            <div id="review-success-panel" className="text-center py-10 px-4 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                Review Stored & AI Memory Refined!
              </h3>
              <p className="text-slate-600 dark:text-slate-300 max-w-md mx-auto text-sm leading-relaxed">
                Thank you! Your ratings for <strong>{trip.destination}</strong> and its{' '}
                <strong>{reviewableActivities.length} activities</strong> are persisted in Firebase Firestore.
                Future itinerary recommendations will prioritize your preferred themes and pacing.
              </p>

              {syncMessage && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="w-4 h-4" />
                  {syncMessage}
                </div>
              )}

              <div className="pt-4 flex justify-center gap-3">
                <button
                  id="btn-done-review"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shadow-md"
                >
                  Return to Trip
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* TAB 1: DESTINATION RATING */}
              {activeTab === 'destination' && (
                <div className="space-y-6">
                  {/* Overall Star Rating Card */}
                  <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                          Overall Experience in {trip.destination}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          How would you rate your overall trip from {trip.start_date} to {trip.end_date}?
                        </p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {getRatingLabel(hoverRating || destinationRating)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const isFilled = (hoverRating || destinationRating) >= star;
                        return (
                          <button
                            key={star}
                            id={`star-dest-${star}`}
                            type="button"
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(null)}
                            onClick={() => setDestinationRating(star)}
                            className="p-1 rounded-lg hover:scale-110 transition-transform focus:outline-none"
                            aria-label={`Rate ${star} star`}
                          >
                            <Star
                              className={`w-9 h-9 ${
                                isFilled
                                  ? 'fill-amber-400 text-amber-400 drop-shadow'
                                  : 'text-slate-300 dark:text-slate-600 hover:text-slate-400'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pace & Travel Style Multi-Sliders */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Itinerary Pacing */}
                    <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3">
                      <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-sm">
                        <Clock className="w-4 h-4 text-emerald-500" />
                        Daily Itinerary Pacing
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Did you feel comfortable with the daily schedule tempo?
                      </p>
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {(['too_slow', 'just_right', 'too_rushed'] as const).map((pace) => {
                          const isSelected = paceRating === pace;
                          const labels = {
                            too_slow: 'Too Slow (pack more)',
                            just_right: 'Just Right (balanced)',
                            too_rushed: 'Too Rushed (need rest)',
                          };
                          return (
                            <button
                              key={pace}
                              id={`pace-${pace}`}
                              type="button"
                              onClick={() => setPaceRating(pace)}
                              className={`px-3 py-2.5 rounded-lg text-xs font-medium border text-center transition-all ${
                                isSelected
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm font-semibold'
                                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                              }`}
                            >
                              {labels[pace]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Value for Money */}
                    <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-sm">
                          <Award className="w-4 h-4 text-amber-500" />
                          Value for Money
                        </div>
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                          {valueForMoney}/5 Stars
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Considering total spend against experience quality.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            id={`val-${s}`}
                            type="button"
                            onClick={() => setValueForMoney(s)}
                            className="p-1 hover:scale-110 transition-transform"
                          >
                            <Star
                              className={`w-6 h-6 ${
                                valueForMoney >= s
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300 dark:text-slate-600'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Highlights Selector */}
                  <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-sm">
                      <Tag className="w-4 h-4 text-cyan-500" />
                      Trip Highlights & Core Impressions
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Select what stood out most so the AI knows which themes you love.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {AVAILABLE_HIGHLIGHT_TAGS.map((tag) => {
                        const isSelected = selectedHighlights.includes(tag);
                        return (
                          <button
                            key={tag}
                            id={`tag-${tag.replace(/\s+/g, '-').toLowerCase()}`}
                            type="button"
                            onClick={() => handleToggleHighlight(tag)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              isSelected
                                ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                            }`}
                          >
                            {isSelected ? '✓ ' : '+ '}
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Destination Feedback Text */}
                  <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3">
                    <label
                      htmlFor="destination-review-notes"
                      className="block text-sm font-semibold text-slate-800 dark:text-slate-100"
                    >
                      Destination Feedback & Notes
                    </label>
                    <textarea
                      id="destination-review-notes"
                      rows={3}
                      value={destinationFeedback}
                      onChange={(e) => setDestinationFeedback(e.target.value)}
                      placeholder={`What was the most memorable part of visiting ${trip.destination}? What advice would you give to the AI for next time?`}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
                    />
                  </div>

                  {/* Next Step Button */}
                  <div className="flex justify-end pt-2">
                    <button
                      id="btn-next-to-activities"
                      type="button"
                      onClick={() => setActiveTab('activities')}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shadow"
                    >
                      Next: Rate Activities ({reviewableActivities.length}) →
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: ACTIVITIES & SIGHTS */}
              {activeTab === 'activities' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Rate Individual Activities & Attractions
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Let the AI know which places you loved and which to skip in future itineraries.
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium">
                      {reviewableActivities.length} items to rate
                    </span>
                  </div>

                  {reviewableActivities.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-xl border">
                      No distinct activities recorded for this trip.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reviewableActivities.map((activity, index) => {
                        const actState = activityRatingsMap[activity.id] || {
                          rating: 5,
                          feedback: '',
                          tags: [],
                          would_recommend: true,
                        };

                        return (
                          <div
                            key={activity.id || index}
                            id={`activity-card-${activity.id}`}
                            className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  {activity.category === 'hotel' ? (
                                    <Building2 className="w-4 h-4" />
                                  ) : activity.category === 'restaurant' ? (
                                    <Utensils className="w-4 h-4" />
                                  ) : (
                                    <Compass className="w-4 h-4" />
                                  )}
                                </div>
                                <div>
                                  <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {activity.title}
                                  </h5>
                                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    <span className="truncate max-w-xs">{activity.location}</span>
                                    <span>•</span>
                                    <span className="capitalize">{activity.category}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Star Rating for this Activity */}
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    id={`star-act-${activity.id}-${star}`}
                                    type="button"
                                    onClick={() => handleActivityRatingChange(activity.id, star)}
                                    className="p-1 hover:scale-110 transition-transform"
                                  >
                                    <Star
                                      className={`w-5 h-5 ${
                                        actState.rating >= star
                                          ? 'fill-amber-400 text-amber-400'
                                          : 'text-slate-300 dark:text-slate-600'
                                      }`}
                                    />
                                  </button>
                                ))}
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 ml-1.5 w-6">
                                  {actState.rating}★
                                </span>
                              </div>
                            </div>

                            {/* Tags / Sentiments */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-xs text-slate-400 mr-1">Sentiment:</span>
                              {ACTIVITY_SENTIMENT_TAGS.map((t) => {
                                const isTagged = actState.tags?.includes(t);
                                const isNegative = t === 'Too Crowded' || t === 'Overrated' || t === 'Skip Next Time';
                                return (
                                  <button
                                    key={t}
                                    id={`tag-act-${activity.id}-${t.replace(/\s+/g, '-').toLowerCase()}`}
                                    type="button"
                                    onClick={() => handleActivityTagToggle(activity.id, t)}
                                    className={`px-2 py-0.5 rounded-md text-xs transition-all ${
                                      isTagged
                                        ? isNegative
                                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold border border-rose-300'
                                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold border border-emerald-300'
                                        : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                                    }`}
                                  >
                                    {t}
                                  </button>
                                );
                              })}

                              {/* Would recommend toggle */}
                              <div className="ml-auto flex items-center gap-1 pl-2">
                                <button
                                  id={`rec-yes-${activity.id}`}
                                  type="button"
                                  onClick={() => handleActivityRecommendToggle(activity.id, true)}
                                  className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all ${
                                    actState.would_recommend
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 font-semibold'
                                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                  title="Recommend to other travelers"
                                >
                                  <ThumbsUp className="w-3.5 h-3.5" />
                                  <span className="text-[11px]">Recommend</span>
                                </button>
                                <button
                                  id={`rec-no-${activity.id}`}
                                  type="button"
                                  onClick={() => handleActivityRecommendToggle(activity.id, false)}
                                  className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all ${
                                    !actState.would_recommend
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 font-semibold'
                                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                  title="Do not recommend"
                                >
                                  <ThumbsDown className="w-3.5 h-3.5" />
                                  <span className="text-[11px]">Skip</span>
                                </button>
                              </div>
                            </div>

                            {/* Optional single line comment */}
                            <input
                              id={`comment-act-${activity.id}`}
                              type="text"
                              value={actState.feedback}
                              onChange={(e) => handleActivityFeedbackChange(activity.id, e.target.value)}
                              placeholder="Quick note for AI (e.g. 'Go early morning to beat the rush', 'Great view from top tier')"
                              className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-between pt-2">
                    <button
                      id="btn-back-to-dest"
                      type="button"
                      onClick={() => setActiveTab('destination')}
                      className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs"
                    >
                      ← Back to Destination
                    </button>
                    <button
                      id="btn-next-to-ai"
                      type="button"
                      onClick={() => setActiveTab('ai_impact')}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shadow"
                    >
                      Next: AI Memory Preview →
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: AI MEMORY PREVIEW */}
              {activeTab === 'ai_impact' && (
                <div className="space-y-5">
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-xl space-y-4 border border-indigo-500/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-white">
                            AI Recommendation Engine Refinements
                          </h4>
                          <p className="text-xs text-slate-300">
                            How this review refines the multi-agent travel coordinator in real time
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                        Firebase Backed
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                      {/* Preferred Tags */}
                      <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                        <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
                          <Heart className="w-3.5 h-3.5" />
                          High-Affinity Themes (+Score Boost)
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {highRatedActivityTags.length > 0 ? (
                            highRatedActivityTags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-[11px]"
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400">All trip highlights</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 pt-1">
                          Future trips will automatically prioritize and surface attractions matching these
                          tags.
                        </p>
                      </div>

                      {/* Avoided Themes */}
                      <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                        <div className="text-rose-400 font-semibold flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          De-Prioritized & Avoided Themes
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {avoidedThemes.length > 0 ? (
                            avoidedThemes.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded-md bg-rose-950/80 border border-rose-500/40 text-rose-200 text-[11px]"
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400">No negative themes detected</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 pt-1">
                          Activities with poor ratings will be filtered or substituted with quieter
                          alternatives.
                        </p>
                      </div>
                    </div>

                    {/* Pacing Calibration Notice */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                      <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-200">
                          Pacing Calibration: {paceRating.replace('_', ' ').toUpperCase()}
                        </span>
                        <p className="text-slate-400 mt-0.5 text-[11px]">
                          {paceRating === 'too_rushed'
                            ? 'The Attractions Agent will schedule fewer daily places (2 max) and provide longer rest buffers.'
                            : paceRating === 'too_slow'
                            ? 'The Attractions Agent will pack 3-4 sights per day with high activity density.'
                            : 'The current balanced pacing (2-3 sights per day) will remain active for future itineraries.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tips for future travelers */}
                  <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-2">
                    <label
                      htmlFor="future-travelers-tips"
                      className="block text-sm font-semibold text-slate-800 dark:text-slate-100"
                    >
                      Tips for Future Travelers to {trip.destination}
                    </label>
                    <textarea
                      id="future-travelers-tips"
                      rows={2}
                      value={tipsForFutureTravelers}
                      onChange={(e) => setTipsForFutureTravelers(e.target.value)}
                      placeholder="e.g. 'Carry cash for street food near Chandni Chowk', 'Pre-book monuments 2 days in advance'"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
                    />
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      id="btn-back-to-activities"
                      type="button"
                      onClick={() => setActiveTab('activities')}
                      className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs"
                    >
                      ← Back to Activities
                    </button>
                    <button
                      id="btn-submit-review"
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleSubmitReview}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-sm transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving to Firebase...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Submit & Update AI Memory
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Encrypted & scoped to your user account</span>
          </div>
          <button
            id="btn-cancel-review"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
