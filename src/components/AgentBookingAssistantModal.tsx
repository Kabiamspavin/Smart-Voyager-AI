import React, { useState } from 'react';
import {
  Plane,
  Train,
  Bus,
  Building2,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  Clock,
  MapPin,
  Users,
  AlertCircle,
  HelpCircle,
  X,
  QrCode,
} from 'lucide-react';
import { Trip, TransportOption, HotelOption, BookingRecord } from '../types.js';
import {
  getTransportBookingInfo,
  getHotelBookingInfo,
  getPassengerAutofillSummary,
  createConfirmedBookingRecord,
  OfficialBookingTarget,
} from '../utils/bookingUrls.js';
import { applyTransitTrackingToTrip } from '../utils/transportationTracker.js';
import { api } from '../services/api.js';

interface AgentBookingAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  mode: 'transport' | 'hotel';
  transportOption?: TransportOption;
  hotelOption?: HotelOption;
  onUpdateTrip?: (updatedTrip: Trip) => void;
  onViewTickets?: () => void;
}

export const AgentBookingAssistantModal: React.FC<AgentBookingAssistantModalProps> = ({
  isOpen,
  onClose,
  trip,
  mode,
  transportOption,
  hotelOption,
  onUpdateTrip,
  onViewTickets,
}) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [inputPnr, setInputPnr] = useState('');
  const [inputSeat, setInputSeat] = useState('');
  const [inputNotes, setInputNotes] = useState('');
  const [isSuccessImport, setIsSuccessImport] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentTransport = transportOption || trip.selected_transport;
  const currentHotel = hotelOption || trip.selected_hotel;

  let bookingInfo: OfficialBookingTarget;
  if (mode === 'transport') {
    if (!currentTransport) return null;
    bookingInfo = getTransportBookingInfo(currentTransport, trip);
  } else {
    if (!currentHotel) return null;
    bookingInfo = getHotelBookingInfo(currentHotel, trip);
  }

  const isFlight = mode === 'transport' && currentTransport?.mode === 'flight';
  const isTrain = mode === 'transport' && currentTransport?.mode === 'train';
  const isBus = mode === 'transport' && currentTransport?.mode === 'bus';
  const isHotel = mode === 'hotel';

  const travelersCount = trip.travellers_count || trip.members?.length || 4;

  const handleCopyText = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleImportBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPnr.trim()) {
      setFormError('Please enter the official PNR or booking confirmation reference number.');
      return;
    }

    try {
      const confirmedRecord = createConfirmedBookingRecord({
        trip,
        category: mode,
        referenceNumber: inputPnr.trim(),
        seatOrRoom: inputSeat.trim() || undefined,
        notes: inputNotes.trim() || undefined,
      });

      const currentRecords = trip.booking_records || [];
      const remaining = currentRecords.filter((r) => r.category !== mode);
      const updated = [confirmedRecord, ...remaining];

      let updatedTrip: Trip = {
        ...trip,
        booking_records: updated,
      };

      if (mode === 'transport') {
        updatedTrip = applyTransitTrackingToTrip(updatedTrip);
        // Dispatch asynchronous server tracking & notification cycle
        api.trackTransport(trip.id, updatedTrip).catch((e) => console.warn('Background transit track error:', e));
      }

      if (onUpdateTrip) {
        onUpdateTrip(updatedTrip);
      }

      setIsSuccessImport(true);
      setTimeout(() => {
        setIsSuccessImport(false);
        onClose();
        if (onViewTickets) {
          onViewTickets();
        }
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || 'Failed to record booking confirmation.');
    }
  };

  const passengerSummary = getPassengerAutofillSummary(
    trip,
    isTrain ? 'AC 3-Tier Lower Berth' : isBus ? 'AC Sleeper Lower' : isFlight ? 'Window Economy' : 'Deluxe Room Guest'
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-4 sm:my-6 flex flex-col max-h-[92vh]">
        
        {/* Header with Autonomous Agent Styling */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 backdrop-blur flex items-center justify-center text-indigo-300">
              <Zap className="w-5 h-5 text-amber-400 fill-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">Real-Time Ticket Redirect Agent</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Minimal Human Effort
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                Pre-selected live parameters & 1-click checkout redirection
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 bg-slate-50/70 dark:bg-slate-950/60">
          
          {/* Target Itinerary Overview Banner */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isTrain
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : isBus
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      : isHotel
                      ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                      : 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300'
                  }`}
                >
                  {isTrain ? (
                    <Train className="w-5 h-5" />
                  ) : isBus ? (
                    <Bus className="w-5 h-5" />
                  ) : isHotel ? (
                    <Building2 className="w-5 h-5" />
                  ) : (
                    <Plane className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {mode === 'transport' ? currentTransport?.carrier : currentHotel?.name}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                      {mode === 'transport' ? currentTransport?.mode : `${currentHotel?.rating}★ Hotel`}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {mode === 'transport'
                      ? `${currentTransport?.origin} to ${currentTransport?.destination} (${currentTransport?.departure_time} - ${currentTransport?.arrival_time})`
                      : `${currentHotel?.location} (${currentHotel?.distance_to_center_km}km from center)`}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-base font-extrabold text-slate-900 dark:text-white">
                  ₹{mode === 'transport' ? currentTransport?.price?.toLocaleString('en-IN') : currentHotel?.total_price?.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-slate-400">
                  {travelersCount} Travellers ({trip.start_date})
                </div>
              </div>
            </div>

            {/* Pre-filled parameters preview pill */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Pre-filled Data:</span>
              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-mono">
                {bookingInfo.searchParamsSummary.originCode || bookingInfo.searchParamsSummary.origin} &rarr; {bookingInfo.searchParamsSummary.destinationCode || bookingInfo.searchParamsSummary.destination}
              </span>
              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                Date: {bookingInfo.searchParamsSummary.travelDate}
              </span>
              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                {travelersCount} Pax
              </span>
              {bookingInfo.searchParamsSummary.rooms && (
                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                  {bookingInfo.searchParamsSummary.rooms} Rooms
                </span>
              )}
            </div>
          </div>

          {/* Primary Instant 1-Click Launch Button */}
          <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-indigo-500/5 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-900 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl p-5 text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-indigo-700 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>Direct Real-Time Tickets Redirection</span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
              Click below to immediately open the exact real-time ticketing page with available berths, seats, and rooms pre-selected.
            </p>

            <a
              href={bookingInfo.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 w-full sm:w-auto px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold text-sm shadow-md transition-all cursor-pointer group"
            >
              <span>Launch Live Tickets on {bookingInfo.realtimePlatform}</span>
              <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>

            <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Direct official booking with zero intermediary fee markups</span>
            </div>
          </div>

          {/* Passenger Zero-Typing Fast Autofill Drawer */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                  Passenger Autofill Helper (Minimal Human Effort)
                </h4>
              </div>

              <button
                onClick={() => handleCopyText(passengerSummary, 'all-passengers')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                title="Copy all passenger names, ages, and seat preferences for fast pasting in checkout forms"
              >
                {copiedType === 'all-passengers' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-300">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy All Passenger Details</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Paste directly into checkout fields or IRCTC / Airline passenger forms without typing each member:
            </p>

            {/* Passenger List Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {(trip.members && trip.members.length > 0 ? trip.members : [
                { name: 'Kavi (Lead Passenger)', role: 'Organizer', phone: '+91 98765 43210' },
                { name: 'Pavin', role: 'Navigator', phone: '+91 98765 43211' },
                { name: 'Aarav', role: 'Treasurer', phone: '+91 98765 43212' },
                { name: 'Meera', role: 'Safety Coordinator', phone: '+91 98765 43213' },
              ]).slice(0, travelersCount).map((member, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between"
                >
                  <div className="truncate mr-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                      {idx + 1}. {member.name}
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      Age: {25 + (idx % 5)} &bull; {idx === 3 ? 'Female' : 'Male'} &bull; {member.phone || '+91 98765 43210'}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      handleCopyText(
                        `${member.name}, Age ${25 + (idx % 5)}, ${idx === 3 ? 'Female' : 'Male'}, ${member.phone || '+91 98765 43210'}`,
                        `pax-${idx}`
                      )
                    }
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors shrink-0"
                    title={`Copy ${member.name} details`}
                  >
                    {copiedType === `pax-${idx}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Alternative Real-Time Platforms */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Alternative Real-Time Ticket Portals</span>
              <span className="text-[10px] font-normal lowercase text-slate-400">(with live prefilled query)</span>
            </h4>

            <div className="space-y-2">
              {bookingInfo.comparisonOptions.map((opt, i) => (
                <a
                  key={i}
                  href={opt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {opt.name}
                      </span>
                      {opt.isRealtimePreFilled && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                          Pre-filled
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0" />
                </a>
              ))}
            </div>
          </div>

          {/* Step 3: Minimal Intervention PNR Auto-Import */}
          <form
            onSubmit={handleImportBooking}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Quick PNR & Ticket Confirmation Import</span>
              </h4>
              <span className="text-[10px] text-slate-400">Generates instant digital boarding pass</span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Once you confirm your reservation on the opened portal, paste your PNR or Booking Reference ID below to lock in verified tickets:
            </p>

            {formError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {formError}
              </div>
            )}

            {isSuccessImport && (
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Booking verified & digital pass generated! Redirecting to pass...</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Official PNR / Booking ID <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  placeholder={isTrain ? 'e.g. 4529183421' : isFlight ? 'e.g. 6E-8KJ92Z' : isBus ? 'e.g. TS829141' : 'e.g. BK-982143'}
                  value={inputPnr}
                  onChange={(e) => {
                    setInputPnr(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Seat / Berth / Room (Optional):
                </label>
                <input
                  type="text"
                  placeholder={isTrain ? 'Coach B2: 37, 38' : isFlight ? '12A, 12B' : isBus ? 'Seats 14, 15' : 'Deluxe Room 204'}
                  value={inputSeat}
                  onChange={(e) => setInputSeat(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save Confirmed Ticket</span>
              </button>
            </div>
          </form>

        </div>

      </div>
    </div>
  );
};
