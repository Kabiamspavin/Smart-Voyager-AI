import React from 'react';
import {
  LayoutDashboard,
  Sparkles,
  MapPin,
  ReceiptText,
  Compass,
  FileDown,
  Cpu,
  Activity,
  ShieldAlert,
  PhoneCall,
  Radio,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.js';

export type ActiveTab = 'dashboard' | 'itinerary' | 'budget' | 'explore' | 'pdf' | 'activity' | 'admin';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenPlanModal: () => void;
  hasActiveTrip: boolean;
  onOpenSosModal?: () => void;
  onOpenGroupMembers?: () => void;
  destination?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onOpenPlanModal,
  hasActiveTrip,
  onOpenSosModal,
  onOpenGroupMembers,
  destination,
}) => {
  const { isDark, toggleTheme, theme } = useTheme();

  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'itinerary' as ActiveTab, label: 'Itinerary & Map', icon: MapPin, disabled: !hasActiveTrip },
    { id: 'budget' as ActiveTab, label: 'Budget & Expenses', icon: ReceiptText, disabled: !hasActiveTrip },
    { id: 'explore' as ActiveTab, label: 'Explore Destinations', icon: Compass },
    { id: 'pdf' as ActiveTab, label: 'PDF Itinerary', icon: FileDown, disabled: !hasActiveTrip },
    { id: 'activity' as ActiveTab, label: 'AI Agent Activity', icon: Cpu },
    { id: 'admin' as ActiveTab, label: 'System Health', icon: Activity },
  ];

  return (
    <>
      {/* Desktop & Tablet Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 min-h-[calc(100vh-61px)] p-4 shrink-0 transition-colors">
        {/* Plan Trip Primary Action */}
        <button
          id="sidebar-plan-trip-btn"
          onClick={onOpenPlanModal}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white py-2.5 px-4 rounded-xl text-sm font-semibold shadow-md shadow-indigo-100 dark:shadow-indigo-950 transition-all cursor-pointer mb-4"
        >
          <Sparkles className="w-4 h-4" />
          <span>Plan Trip with AI</span>
        </button>

        {/* Floating 'SOS' Quick-Action Button in the Sidebar */}
        <div className="mb-4">
          <button
            id="sidebar-sos-quick-action-btn"
            onClick={onOpenSosModal}
            className="group relative flex items-center justify-between gap-2.5 w-full bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 active:scale-[0.98] text-white p-3 rounded-2xl shadow-lg shadow-red-500/25 border border-red-400/40 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30">
                <ShieldAlert className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div className="text-left truncate">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black tracking-wider uppercase text-white">SOS Help</span>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                </div>
                <p className="text-[10px] text-red-100 font-medium truncate">
                  {destination ? `${destination} Contacts & GPS` : 'Emergency Numbers & GPS'}
                </p>
              </div>
            </div>
            <div className="px-2 py-0.5 bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 border border-white/25">
              112
            </div>
          </button>
        </div>

        {/* Live Group Members Live Tracking Button in Sidebar */}
        {hasActiveTrip && onOpenGroupMembers && (
          <div className="mb-4">
            <button
              id="sidebar-group-members-btn"
              onClick={onOpenGroupMembers}
              className="group relative flex items-center justify-between gap-2.5 w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.98] text-white p-3 rounded-2xl shadow-md shadow-emerald-600/15 border border-emerald-400/30 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30">
                  <Radio className="w-4 h-4 text-white animate-pulse" />
                </div>
                <div className="text-left truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs tracking-wide">Live Group GPS</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping shrink-0" />
                  </div>
                  <p className="text-[10px] text-emerald-100 truncate font-medium">Track members & ping</p>
                </div>
              </div>
              <div className="px-2 py-0.5 bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 border border-white/25">
                LIVE
              </div>
            </button>
          </div>
        )}

        {/* Navigation List */}
        <nav className="space-y-1 flex-1">
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Main Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                disabled={item.disabled}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold shadow-xs'
                    : item.disabled
                    ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : item.disabled
                      ? 'text-slate-300 dark:text-slate-600'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Theme Quick Switcher Row */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between px-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Appearance</span>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span>Dark Mode</span>
              </>
            )}
          </button>
        </div>

        {/* Live Multi-Agent Monitoring Indicator Card */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Autonomous Monitoring</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Weather and flight disruption checks active every 15 minutes with auto re-planning.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex justify-around items-center transition-colors">
        <button
          onClick={() => onTabChange('dashboard')}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Home</span>
        </button>

        <button
          onClick={onOpenPlanModal}
          className="flex flex-col items-center py-1 px-2 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center -mt-3 shadow-md shadow-indigo-200 dark:shadow-indigo-950">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="mt-0.5">Plan</span>
        </button>

        <button
          id="mobile-sos-quick-action-btn"
          onClick={onOpenSosModal}
          className="flex flex-col items-center py-1 px-2 text-[10px] font-extrabold text-red-600 dark:text-red-400 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center -mt-3 shadow-md shadow-red-200 dark:shadow-red-950 animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
          <span className="mt-0.5 text-red-600 dark:text-red-400 font-black">SOS</span>
        </button>

        <button
          disabled={!hasActiveTrip}
          onClick={() => onTabChange('itinerary')}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium cursor-pointer ${
            activeTab === 'itinerary'
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
              : !hasActiveTrip
              ? 'text-slate-300 dark:text-slate-600'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Itinerary</span>
        </button>

        <button
          disabled={!hasActiveTrip}
          onClick={() => onTabChange('budget')}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium cursor-pointer ${
            activeTab === 'budget'
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
              : !hasActiveTrip
              ? 'text-slate-300 dark:text-slate-600'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <ReceiptText className="w-4 h-4" />
          <span>Budget</span>
        </button>

        <button
          onClick={() => onTabChange('explore')}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium cursor-pointer ${
            activeTab === 'explore'
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Explore</span>
        </button>
      </nav>
    </>
  );
};

