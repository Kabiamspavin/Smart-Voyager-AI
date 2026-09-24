import React, { useState } from 'react';
import {
  X,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  Smartphone,
  Laptop,
  Check,
  Copy,
  Clock,
  Mail,
  Key,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';


interface LoginDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoggedOut?: () => void;
}

export const LoginDetailsModal: React.FC<LoginDetailsModalProps> = ({ isOpen, onClose, onLoggedOut }) => {
  const { currentUser, sessionDetails, signOut } = useAuth();
  const [copiedUid, setCopiedUid] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  if (!isOpen || !currentUser) return null;

  const handleCopyUid = () => {
    if (currentUser?.id) {
      navigator.clipboard.writeText(currentUser.id);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      if (onLoggedOut) onLoggedOut();
      onClose();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  const isGoogle = currentUser.provider === 'google' || sessionDetails?.providerId === 'google.com';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            {currentUser.photo_url ? (
              <img
                src={currentUser.photo_url}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-full border-2 border-indigo-400/80 shadow-md object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-indigo-600 border-2 border-indigo-300/60 text-white font-bold text-xl flex items-center justify-center shadow-md">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{currentUser.name}</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">{currentUser.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-[11px] font-medium text-slate-200">
                  Role: {currentUser.role}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/30 text-[11px] font-medium text-indigo-200 flex items-center gap-1">
                  {isGoogle ? 'Google Account' : 'Email/Password'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body: Login & Device Details */}
        <div className="p-6 space-y-5">
          {/* Section: Account & Auth Details */}
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-2">
              Authentication Credentials
            </div>
            <div className="space-y-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> Firebase UID:
                </span>
                <div className="flex items-center gap-1.5">
                  <code className="bg-slate-200/70 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded text-[11px] font-mono max-w-[200px] truncate">
                    {currentUser.id}
                  </code>
                  <button
                    onClick={handleCopyUid}
                    className="p-1 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded hover:bg-slate-200/60 dark:hover:bg-slate-750 transition-colors cursor-pointer"
                    title="Copy UID"
                  >
                    {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> Primary Email:
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{currentUser.email}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> Auth Provider:
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  {isGoogle ? (
                    <>
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
                      Google Authentication
                    </>
                  ) : (
                    'Firebase Password'
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> Last Sign-in:
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {sessionDetails?.lastSignInTime
                    ? new Date(sessionDetails.lastSignInTime).toLocaleString()
                    : 'Just now'}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Multi-Device Sync */}
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-2">
              Multi-Device Real-Time Sync
            </div>
            <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-3.5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Laptop className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Current Device</span>
                    <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full">
                      This Device
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {sessionDetails?.device || 'Modern Browser Session'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>All itinerary changes, bookings, and budget logs sync automatically across any device.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              id="logout-btn"
              type="button"
              disabled={loggingOut}
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              {loggingOut ? (
                <div className="w-3.5 h-3.5 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
              ) : (
                <LogOut className="w-3.5 h-3.5" />
              )}
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
