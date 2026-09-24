import React, { useState } from 'react';
import {
  Compass,
  Bell,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Sparkles,
  LogOut,
  ShieldCheck,
  Laptop,
  User as UserIcon,
  LogIn,
  Sun,
  Moon,
  Monitor,
  ShieldAlert,
} from 'lucide-react';
import { DisruptionAlert, User as UserType } from '../types.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useTheme } from '../contexts/ThemeContext.js';
import { AuthModal } from './AuthModal.js';
import { LoginDetailsModal } from './LoginDetailsModal.js';

interface NavbarProps {
  user: UserType;
  currentCurrency: string;
  onCurrencyChange: (currency: string) => void;
  alerts: DisruptionAlert[];
  onOpenPlanModal: () => void;
  onOpenSosModal?: () => void;
  onSelectTripAlert?: (tripId: string) => void;
  onOpenAuthModal?: () => void;
  onOpenLoginDetails?: () => void;
}

const SUPPORTED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'];

export const Navbar: React.FC<NavbarProps> = ({
  user,
  currentCurrency,
  onCurrencyChange,
  alerts,
  onOpenPlanModal,
  onOpenSosModal,
  onSelectTripAlert,
}) => {
  const { currentUser, firebaseUser, signOut } = useAuth();
  const { theme, isDark, toggleTheme, setTheme } = useTheme();
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLoginDetailsModal, setShowLoginDetailsModal] = useState(false);

  const activeAlerts = alerts.filter((a) => a.status === 'active');

  const displayUser = currentUser || user;
  const isLoggedIn = !!firebaseUser;

  const handleLogout = async () => {
    setShowUserDropdown(false);
    try {
      await signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 lg:px-8 py-3 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Logo & Tagline */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-100 dark:shadow-indigo-950">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">Smart Voyager AI</span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/60">
                  <Sparkles className="w-3 h-3" /> Multi-Agent Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden md:block">Real-Time Autonomous Travel Planner</p>
            </div>
          </div>

          {/* Live Data Badge & Fast Action */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Live Data Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden sm:inline">Live Feeds:</span>
              <span className="font-semibold">Weather & FX Active</span>
            </div>

            {/* Quick Emergency SOS Action */}
            {onOpenSosModal && (
              <button
                id="navbar-sos-quick-btn"
                onClick={onOpenSosModal}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 active:scale-95 text-white text-xs font-black tracking-wide shadow-sm shadow-red-500/30 transition-all cursor-pointer border border-red-400/50"
                title="Emergency Contacts, SOS Siren, & GPS Distress"
              >
                <ShieldAlert className="w-3.5 h-3.5 animate-pulse text-white" />
                <span>SOS</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
              </button>
            )}

            {/* Primary CTA */}
            <button
              id="nav-plan-trip-cta"
              onClick={onOpenPlanModal}
              className="hidden sm:inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Plan Trip with AI
            </button>

            {/* Global Theme Toggle Button */}
            <div className="relative">
              <button
                id="theme-toggle-btn"
                onClick={() => toggleTheme()}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setShowThemeDropdown(!showThemeDropdown);
                }}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer flex items-center justify-center"
                title={`Current: ${theme} theme. Click to toggle light/dark, right-click for menu.`}
                aria-label="Toggle color theme"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-600 transition-transform hover:-rotate-12" />
                )}
              </button>

              {showThemeDropdown && (
                <div className="absolute right-0 mt-1.5 w-36 bg-white dark:bg-slate-850 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 animate-in fade-in duration-100">
                  <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                    Theme Mode
                  </div>
                  <button
                    onClick={() => {
                      setTheme('light');
                      setShowThemeDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      theme === 'light' ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                      <span>Light</span>
                    </span>
                    {theme === 'light' && <CheckCircle className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                  </button>
                  <button
                    onClick={() => {
                      setTheme('dark');
                      setShowThemeDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      theme === 'dark' ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Moon className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Dark</span>
                    </span>
                    {theme === 'dark' && <CheckCircle className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                  </button>
                  <button
                    onClick={() => {
                      setTheme('system');
                      setShowThemeDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      theme === 'system' ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Monitor className="w-3.5 h-3.5 text-slate-400" />
                      <span>System</span>
                    </span>
                    {theme === 'system' && <CheckCircle className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                  </button>
                </div>
              )}
            </div>

            {/* Currency Selector */}
            <div className="relative">
              <button
                id="currency-selector-btn"
                onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                className="flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                <span>{currentCurrency}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showCurrencyDropdown && (
                <div className="absolute right-0 mt-1.5 w-32 bg-white dark:bg-slate-850 rounded-lg shadow-xl border border-slate-100 dark:border-slate-700 py-1 z-50">
                  <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">Currency</div>
                  {SUPPORTED_CURRENCIES.map((cur) => (
                    <button
                      key={cur}
                      onClick={() => {
                        onCurrencyChange(cur);
                        setShowCurrencyDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 ${
                        currentCurrency === cur ? 'font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/50' : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <span>{cur}</span>
                      {currentCurrency === cur && <CheckCircle className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Disruption Notifications Bell */}
            <div className="relative">
              <button
                id="notifications-bell-btn"
                onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
                className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Alerts"
              >
                <Bell className="w-4 h-4" />
                {activeAlerts.length > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-xs">
                    {activeAlerts.length}
                  </span>
                )}
              </button>

              {showAlertsDropdown && (
                <div className="absolute right-0 mt-1.5 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 z-50">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="font-semibold text-sm text-slate-900 dark:text-white">Live Disruption Alerts</span>
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">{activeAlerts.length} active</span>
                  </div>

                  {activeAlerts.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                      All itineraries are operating normally. Continuous monitoring active.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {activeAlerts.map((alt) => (
                        <div
                          key={alt.id}
                          onClick={() => {
                            if (onSelectTripAlert) onSelectTripAlert(alt.trip_id);
                            setShowAlertsDropdown(false);
                          }}
                          className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100/70 dark:hover:bg-amber-900/50 transition-colors cursor-pointer text-left"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-900 dark:text-amber-200">{alt.title}</span>
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-100">
                              {alt.severity}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{alt.description}</p>
                          <p className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium mt-1">Action: {alt.suggested_action}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Authentication & User Login Details */}
            <div className="relative pl-2 border-l border-slate-200 dark:border-slate-800">
              {isLoggedIn ? (
                <div>
                  <button
                    id="user-profile-menu-btn"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group text-left"
                  >
                    <div className="relative">
                      {displayUser.photo_url ? (
                        <img
                          src={displayUser.photo_url}
                          alt={displayUser.name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full border border-indigo-400 object-cover shadow-xs"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                          {displayUser.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                    </div>

                    <div className="hidden lg:block">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight flex items-center gap-1">
                        <span className="max-w-[120px] truncate">{displayUser.name}</span>
                        <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors" />
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium leading-tight flex items-center gap-1">
                        <span>Cloud Synced</span>
                      </div>
                    </div>
                  </button>

                  {showUserDropdown && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in duration-100">
                      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{displayUser.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{displayUser.email}</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/60">
                            {displayUser.provider === 'google' ? 'Google Auth' : 'Firebase User'}
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Synced
                          </span>
                        </div>
                      </div>

                      <div className="p-1">
                        <button
                          id="nav-login-details-btn"
                          onClick={() => {
                            setShowUserDropdown(false);
                            setShowLoginDetailsModal(true);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                        >
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>Login & Device Details</span>
                        </button>

                        <button
                          id="nav-logout-btn"
                          onClick={handleLogout}
                          className="w-full text-left px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5 text-red-500" />
                          <span>Log Out from Device</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    id="nav-google-login-btn"
                    onClick={() => setShowAuthModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer"
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
                    <span>Sign In</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Auth Modal for Google & Email Sign-in */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
      />

      {/* Login Details & Multi-Device Modal */}
      <LoginDetailsModal
        isOpen={showLoginDetailsModal}
        onClose={() => setShowLoginDetailsModal(false)}
      />
    </>
  );
};

