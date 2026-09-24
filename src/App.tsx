import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Sparkles,
  MapPin,
  Calendar,
  DollarSign,
  PlusCircle,
  FileDown,
  MessageSquare,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Cpu,
  RefreshCw,
  Eye,
  Trash2,
  ShieldCheck,
  Smartphone,
  Laptop,
  CheckCircle2,
} from 'lucide-react';
import { Trip, ItineraryItem, User, TripMember } from './types.js';
import { api } from './services/api.js';
import { Navbar } from './components/Navbar.js';
import { Sidebar, ActiveTab } from './components/Sidebar.js';
import { TripOverview } from './components/TripOverview.js';
import { ItineraryTimeline } from './components/ItineraryTimeline.js';
import { InteractiveMap } from './components/InteractiveMap.js';
import { BudgetDashboard } from './components/BudgetDashboard.js';
import { ExploreDestinations } from './components/ExploreDestinations.js';
import { AgentActivityPanel } from './components/AgentActivityPanel.js';
import { AdminHealthPanel } from './components/AdminHealthPanel.js';
import { PlanTripModal } from './components/PlanTripModal.js';
import { ChatTripDrawer } from './components/ChatTripDrawer.js';
import { PdfExportModal } from './components/PdfExportModal.js';
import { AuthModal } from './components/AuthModal.js';
import { LoginDetailsModal } from './components/LoginDetailsModal.js';
import { SosEmergencyModal } from './components/SosEmergencyModal.js';
import { GroupMembersModal } from './components/GroupMembersModal.js';
import { TripReviewModal } from './components/TripReviewModal.js';
import { useAuth } from './contexts/AuthContext.js';
import { saveTripToFirestore, deleteTripFromFirestore, subscribeToUserTrips } from './lib/firebase.js';
import { fallbackTrip } from './data/fallbackTrip.js';

export default function App() {
  const { currentUser, firebaseUser } = useAuth();

  const [guestUser] = useState<User>({
    id: 'usr_demo_01',
    name: 'Siddharth Rao',
    email: 'siddharth@example.com',
    role: 'Organizer',
    preferences: {
      home_city: 'Chennai',
      preferred_currency: 'INR',
      travel_style: 'family',
      interests: ['Heritage', 'Food', 'Shopping', 'Nature'],
      food_preference: 'all',
      accommodation_preference: 'boutique',
      transport_preference: 'flight',
    },
    created_at: '2026-09-01T00:00:00Z',
  });

  const activeUser = currentUser || guestUser;

  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(1);
  const [selectedItem, setSelectedItem] = useState<ItineraryItem | null>(null);
  const [currentCurrency, setCurrentCurrency] = useState<string>('INR');

  // Modals & Drawers
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoginDetailsModalOpen, setIsLoginDetailsModalOpen] = useState(false);
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const [isGroupMembersModalOpen, setIsGroupMembersModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedMemberToLocate, setSelectedMemberToLocate] = useState<TripMember | null>(null);
  const [isReplanning, setIsReplanning] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(true);

  // Load initial trips from local server
  useEffect(() => {
    loadTrips();
  }, []);

  const hasSeededToFirestore = useRef(false);

  // Multi-device real-time sync with Firestore when user is authenticated
  useEffect(() => {
    if (!currentUser?.id) {
      hasSeededToFirestore.current = false;
      return;
    }

    const unsubscribe = subscribeToUserTrips(currentUser.id, (remoteTrips) => {
      if (remoteTrips && remoteTrips.length > 0) {
        setTrips(remoteTrips);
        setActiveTrip((prev) => {
          if (!prev) return remoteTrips[0];
          const matched = remoteTrips.find((t) => t.id === prev.id);
          return matched || remoteTrips[0];
        });
      } else if (!hasSeededToFirestore.current) {
        hasSeededToFirestore.current = true;
        // If user logged in and has 0 remote trips, persist local trips once so they are available on any other device
        if (trips.length > 0) {
          trips.forEach((t) => {
            saveTripToFirestore(currentUser.id, t);
          });
        }
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser?.id]);

  const loadTrips = async () => {
    try {
      setLoadingTrips(true);
      const res = await api.getTrips();
      if (res.trips && res.trips.length > 0) {
        setTrips(res.trips);
        setActiveTrip(res.trips[0]);
      } else {
        setTrips([fallbackTrip]);
        setActiveTrip(fallbackTrip);
      }
    } catch (e) {
      console.warn('Network trip loading recovered with fallback trip:', e);
      setTrips([fallbackTrip]);
      setActiveTrip(fallbackTrip);
    } finally {
      setLoadingTrips(false);
    }
  };


  const handleTripPlanned = (newTrip: Trip) => {
    setTrips((prev) => [newTrip, ...prev]);
    setActiveTrip(newTrip);
    setSelectedDayNumber(1);
    setActiveTab('itinerary');

    // Cloud sync to Firestore for multi-device access
    if (currentUser?.id) {
      saveTripToFirestore(currentUser.id, newTrip);
    }
  };

  const handleReplanDay = async (dayNum: number, reason: string) => {
    if (!activeTrip) return;
    setIsReplanning(true);
    try {
      const res = await api.replanDay(activeTrip.id, dayNum, reason);
      if (res.trip) {
        setActiveTrip(res.trip);
        setTrips((prev) => prev.map((t) => (t.id === res.trip.id ? res.trip : t)));
        if (currentUser?.id) {
          saveTripToFirestore(currentUser.id, res.trip);
        }
      }
    } catch (e) {
      console.error('Re-plan failed:', e);
      alert('Failed to re-plan day: ' + e);
    } finally {
      setIsReplanning(false);
    }
  };

  const handleDeleteTrip = async (e: React.MouseEvent, tripId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this trip?')) return;
    try {
      await api.deleteTrip(tripId);
      if (currentUser?.id) {
        await deleteTripFromFirestore(currentUser.id, tripId);
      }
      const remaining = trips.filter((t) => t.id !== tripId);
      setTrips(remaining);
      if (activeTrip?.id === tripId) {
        setActiveTrip(remaining[0] || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTripUpdated = (updatedTrip: Trip) => {
    setActiveTrip(updatedTrip);
    setTrips((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
    api.updateTrip(updatedTrip.id, updatedTrip).catch((err) => {
      console.warn('Backend update failed:', err);
    });
    if (currentUser?.id) {
      saveTripToFirestore(currentUser.id, updatedTrip);
    }
  };

  const handleUpdateMembers = (newMembers: TripMember[]) => {
    if (!activeTrip) return;
    const updatedTrip = { ...activeTrip, members: newMembers };
    handleTripUpdated(updatedTrip);
  };

  // Collect all active alerts across all trips
  const allAlerts = trips.flatMap((t) => t.alerts || []);

  const currentDayItems = activeTrip?.days.find((d) => d.day_number === selectedDayNumber)?.items || [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-slate-900 dark:text-slate-100 pb-16 md:pb-0 antialiased transition-colors">
      {/* Top Navigation */}
      <Navbar
        user={activeUser}
        currentCurrency={currentCurrency}
        onCurrencyChange={setCurrentCurrency}
        alerts={allAlerts}
        onOpenPlanModal={() => setIsPlanModalOpen(true)}
        onOpenSosModal={() => setIsSosModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenLoginDetails={() => setIsLoginDetailsModalOpen(true)}
        onSelectTripAlert={(tripId) => {
          const matched = trips.find((t) => t.id === tripId);
          if (matched) {
            setActiveTrip(matched);
            setActiveTab('itinerary');
          }
        }}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Main Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            if (tab === 'pdf' && activeTrip) {
              setIsPdfModalOpen(true);
            } else {
              setActiveTab(tab);
            }
          }}
          onOpenPlanModal={() => setIsPlanModalOpen(true)}
          hasActiveTrip={!!activeTrip}
          onOpenSosModal={() => setIsSosModalOpen(true)}
          onOpenGroupMembers={() => setIsGroupMembersModalOpen(true)}
          destination={activeTrip?.destination || 'Delhi'}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Multi-Device Authentication Banner */}
              {firebaseUser ? (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                        Signed in as {activeUser.name} &bull; <span className="font-normal text-emerald-700 dark:text-emerald-300">{activeUser.email}</span>
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <Laptop className="w-3 h-3" />
                        <span>Cloud Synced across all your devices via Firebase</span>
                      </p>
                    </div>
                  </div>

                  <button
                    id="dashboard-view-login-details-btn"
                    onClick={() => setIsLoginDetailsModalOpen(true)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100/50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    View Login Details
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-indigo-700 dark:text-indigo-300">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200">Multi-Device Access Available</p>
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-400">
                        Sign in with Google to sync all itineraries, expenses, and live alerts across your phone, tablet, and laptop.
                      </p>
                    </div>
                  </div>

                  <button
                    id="dashboard-signin-prompt-btn"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>Sign In with Google</span>
                  </button>
                </div>
              )}

              {/* Dashboard Welcome Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                    Welcome back, {activeUser.name.split(' ')[0]}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Your real-time autonomous travel hub with live flight, weather, and currency grounding.
                  </p>
                </div>

                <button
                  onClick={() => setIsPlanModalOpen(true)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-100 dark:shadow-indigo-950 transition-all cursor-pointer self-start sm:self-auto"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Plan New Trip with AI</span>
                </button>
              </div>

              {/* Active Trip Hero Preview */}
              {activeTrip && (
                <div className="space-y-4">
                  <TripOverview
                    trip={activeTrip}
                    currentCurrency={currentCurrency}
                    onOpenChat={() => setIsChatDrawerOpen(true)}
                    onOpenPdf={() => setIsPdfModalOpen(true)}
                    onReplanDay={handleReplanDay}
                    onTripUpdated={handleTripUpdated}
                    onOpenAddExpense={() => setActiveTab('budget')}
                    onOpenGroupMembers={() => setIsGroupMembersModalOpen(true)}
                    onOpenSosModal={() => setIsSosModalOpen(true)}
                    onOpenReview={() => setIsReviewModalOpen(true)}
                    isReplanning={isReplanning}
                  />

                  {/* Split Preview: Itinerary Timeline & Live Interactive Map */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>Day {selectedDayNumber} Schedule & Live Weather</span>
                        </h2>
                        <button
                          onClick={() => setActiveTab('itinerary')}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          Full Itinerary View <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      <ItineraryTimeline
                        trip={activeTrip}
                        selectedDayNumber={selectedDayNumber}
                        onSelectDay={setSelectedDayNumber}
                        selectedItem={selectedItem}
                        onSelectItem={setSelectedItem}
                        onReplanDay={handleReplanDay}
                        isReplanning={isReplanning}
                      />
                    </div>

                    <div className="lg:col-span-5 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>Interactive Route Map</span>
                        </h2>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">Click marker to focus</span>
                      </div>

                      <div className="flex-1 min-h-[360px]">
                        <InteractiveMap
                          items={currentDayItems}
                          hotel={activeTrip.selected_hotel}
                          destinationCity={activeTrip.destination}
                          selectedItem={selectedItem}
                          onSelectItem={setSelectedItem}
                          members={activeTrip.members}
                          onUpdateMembers={handleUpdateMembers}
                          selectedMemberProp={selectedMemberToLocate}
                          onSelectMember={setSelectedMemberToLocate}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* All Saved Trips Grid */}
              <div className="space-y-3 pt-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Your Planned Journeys ({trips.length})</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trips.map((trip) => {
                    const isCurrent = activeTrip?.id === trip.id;
                    return (
                      <div
                        key={trip.id}
                        onClick={() => {
                          setActiveTrip(trip);
                          setSelectedDayNumber(1);
                        }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer bg-white dark:bg-slate-900 ${
                          isCurrent
                            ? 'border-indigo-600 dark:border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-950/60 shadow-md'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            v{trip.version} &bull; {trip.travel_style}
                          </span>
                          <button
                            onClick={(e) => handleDeleteTrip(e, trip.id)}
                            className="text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1"
                            title="Delete trip"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">{trip.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                          {trip.origin} &rarr; {trip.destination} &bull; {trip.days?.length || 0} Days &bull; {trip.travellers_count || 1} Travellers
                        </p>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200">₹{trip.budget.toLocaleString('en-IN')}</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                            <span>Open</span>
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}


          {activeTab === 'itinerary' && activeTrip && (
            <div className="space-y-6">
              <TripOverview
                trip={activeTrip}
                currentCurrency={currentCurrency}
                onOpenChat={() => setIsChatDrawerOpen(true)}
                onOpenPdf={() => setIsPdfModalOpen(true)}
                onReplanDay={handleReplanDay}
                onTripUpdated={handleTripUpdated}
                onOpenAddExpense={() => setActiveTab('budget')}
                onOpenGroupMembers={() => setIsGroupMembersModalOpen(true)}
                onOpenSosModal={() => setIsSosModalOpen(true)}
                isReplanning={isReplanning}
              />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7">
                  <ItineraryTimeline
                    trip={activeTrip}
                    selectedDayNumber={selectedDayNumber}
                    onSelectDay={setSelectedDayNumber}
                    selectedItem={selectedItem}
                    onSelectItem={setSelectedItem}
                    onReplanDay={handleReplanDay}
                    isReplanning={isReplanning}
                  />
                </div>

                <div className="lg:col-span-5 h-[500px] lg:h-auto lg:sticky lg:top-20">
                  <InteractiveMap
                    items={currentDayItems}
                    hotel={activeTrip.selected_hotel}
                    destinationCity={activeTrip.destination}
                    selectedItem={selectedItem}
                    onSelectItem={setSelectedItem}
                    members={activeTrip.members}
                    onUpdateMembers={handleUpdateMembers}
                    selectedMemberProp={selectedMemberToLocate}
                    onSelectMember={setSelectedMemberToLocate}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'budget' && activeTrip && (
            <BudgetDashboard
              trip={activeTrip}
              currentCurrency={currentCurrency}
              onTripUpdated={handleTripUpdated}
            />
          )}

          {activeTab === 'explore' && (
            <ExploreDestinations
              onPlanTripForDestination={(dest) => {
                setIsPlanModalOpen(true);
              }}
            />
          )}

          {activeTab === 'activity' && (
            <AgentActivityPanel
              logs={activeTrip?.agent_logs || []}
              dataSources={activeTrip?.data_sources || []}
            />
          )}

          {activeTab === 'admin' && <AdminHealthPanel />}
        </main>
      </div>

      {/* Plan Trip Modal */}
      <PlanTripModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        onTripPlanned={handleTripPlanned}
      />

      {/* Chat Co-Pilot Drawer */}
      {activeTrip && (
        <ChatTripDrawer
          isOpen={isChatDrawerOpen}
          onClose={() => setIsChatDrawerOpen(false)}
          trip={activeTrip}
          onTripUpdated={handleTripUpdated}
        />
      )}

      {/* PDF Export Modal */}
      {activeTrip && (
        <PdfExportModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          trip={activeTrip}
        />
      )}

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => setIsAuthModalOpen(false)}
      />

      {/* Login Details & Multi-Device Modal */}
      <LoginDetailsModal
        isOpen={isLoginDetailsModalOpen}
        onClose={() => setIsLoginDetailsModalOpen(false)}
      />

      {/* Local Emergency SOS Quick Action Modal */}
      <SosEmergencyModal
        isOpen={isSosModalOpen}
        onClose={() => setIsSosModalOpen(false)}
        destination={activeTrip?.destination || 'Delhi'}
        currentTrip={activeTrip}
        onLogEmergencyAlert={(newAlert) => {
          if (activeTrip) {
            const updated = {
              ...activeTrip,
              alerts: [newAlert, ...(activeTrip.alerts || [])],
            };
            handleTripUpdated(updated);
          }
        }}
      />

      {/* Live Group Members Tracking & Safety Modal */}
      {activeTrip && isGroupMembersModalOpen && (
        <GroupMembersModal
          isOpen={isGroupMembersModalOpen}
          onClose={() => setIsGroupMembersModalOpen(false)}
          trip={activeTrip}
          members={activeTrip.members}
          destinationCity={activeTrip.destination}
          hotel={activeTrip.selected_hotel}
          onUpdateMembers={handleUpdateMembers}
          onLocateMember={(member) => {
            setSelectedMemberToLocate(member);
            setActiveTab('itinerary');
          }}
        />
      )}

      {/* Post-Trip Review Modal (Rates destinations and activities to refine AI) */}
      {activeTrip && isReviewModalOpen && (
        <TripReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          trip={activeTrip}
          userId={currentUser?.id || activeUser.id}
          onTripUpdated={handleTripUpdated}
        />
      )}
    </div>
  );
}

