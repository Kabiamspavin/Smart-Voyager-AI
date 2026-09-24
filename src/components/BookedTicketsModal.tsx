import React, { useState, useEffect } from 'react';
import {
  Plane,
  Train,
  Bus,
  Building2,
  X,
  ExternalLink,
  CheckCircle2,
  Copy,
  Printer,
  Edit3,
  Plus,
  QrCode,
  ShieldCheck,
  Calendar,
  Clock,
  MapPin,
  Users,
  Luggage,
  Sparkles,
  Search,
  AlertCircle,
  Trash2,
  Check,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { BookingRecord, Trip } from '../types.js';
import {
  getTransportBookingInfo,
  getHotelBookingInfo,
  createConfirmedBookingRecord,
  getPassengerAutofillSummary,
} from '../utils/bookingUrls.js';
import { applyTransitTrackingToTrip } from '../utils/transportationTracker.js';
import { api } from '../services/api.js';

interface BookedTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onUpdateTrip?: (updatedTrip: Trip) => void;
  initialCategory?: 'all' | 'transport' | 'hotel';
}

export const BookedTicketsModal: React.FC<BookedTicketsModalProps> = ({
  isOpen,
  onClose,
  trip,
  onUpdateTrip,
  initialCategory = 'all',
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'transport' | 'hotel'>(initialCategory);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editPnr, setEditPnr] = useState('');
  const [editSeat, setEditSeat] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Complete Booking Dialog state
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completeCategory, setCompleteCategory] = useState<'transport' | 'hotel'>('transport');
  const [inputReference, setInputReference] = useState('');
  const [inputSeatOrRoom, setInputSeatOrRoom] = useState('');
  const [inputPrice, setInputPrice] = useState<number>(0);
  const [inputNotes, setInputNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Sync initialCategory on open
  useEffect(() => {
    if (isOpen) {
      setActiveFilter(initialCategory);
    }
  }, [isOpen, initialCategory]);

  if (!isOpen) return null;

  // Real confirmed records from trip only (NO synthetic data)
  const allRecords: BookingRecord[] = trip.booking_records || [];
  const confirmedRecords = allRecords.filter(
    (rec) =>
      rec.booking_status === 'CONFIRMED' &&
      (activeFilter === 'all' || rec.category === activeFilter)
  );

  // Check if current transport and hotel selections are completed
  const isTransportBooked = allRecords.some(
    (r) => r.category === 'transport' && r.booking_status === 'CONFIRMED'
  );
  const isHotelBooked = allRecords.some(
    (r) => r.category === 'hotel' && r.booking_status === 'CONFIRMED'
  );

  const showPendingTransport =
    !isTransportBooked &&
    trip.selected_transport &&
    (activeFilter === 'all' || activeFilter === 'transport');

  const showPendingHotel =
    !isHotelBooked &&
    trip.selected_hotel &&
    (activeFilter === 'all' || activeFilter === 'hotel');

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleStartEdit = (rec: BookingRecord) => {
    setEditingRecordId(rec.id);
    setEditPnr(rec.reference_number);
    setEditSeat(rec.seat_or_room);
    setEditNotes(rec.notes || '');
  };

  const handleSaveEdit = (recordId: string) => {
    const updated = allRecords.map((rec) => {
      if (rec.id === recordId) {
        return {
          ...rec,
          reference_number: editPnr.trim() || rec.reference_number,
          seat_or_room: editSeat.trim() || rec.seat_or_room,
          notes: editNotes.trim() || rec.notes,
        };
      }
      return rec;
    });

    if (onUpdateTrip) {
      onUpdateTrip({
        ...trip,
        booking_records: updated,
      });
    }
    setEditingRecordId(null);
  };

  const handleDeleteRecord = (recordId: string) => {
    const updated = allRecords.filter((rec) => rec.id !== recordId);
    if (onUpdateTrip) {
      onUpdateTrip({
        ...trip,
        booking_records: updated,
      });
    }
  };

  const handleOpenCompleteDialog = (category: 'transport' | 'hotel') => {
    setCompleteCategory(category);
    setFormError(null);
    setInputReference('');
    setInputNotes('');

    if (category === 'transport' && trip.selected_transport) {
      setInputPrice(trip.selected_transport.price || 0);
      setInputSeatOrRoom(
        trip.selected_transport.mode === 'train'
          ? 'Coach B2: Berths 37, 38'
          : trip.selected_transport.mode === 'bus'
          ? 'Seats 14, 15'
          : 'Seats 12A, 12B'
      );
    } else if (category === 'hotel' && trip.selected_hotel) {
      setInputPrice(trip.selected_hotel.total_price || 0);
      setInputSeatOrRoom('Deluxe Room / Suite');
    }
    setShowCompleteDialog(true);
  };

  const handleConfirmBookingSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputReference.trim()) {
      setFormError('Please enter the official PNR or booking confirmation reference number.');
      return;
    }

    try {
      const newRecord = createConfirmedBookingRecord({
        trip,
        category: completeCategory,
        referenceNumber: inputReference.trim(),
        seatOrRoom: inputSeatOrRoom.trim() || undefined,
        pricePaid: inputPrice,
        notes: inputNotes.trim() || undefined,
      });

      // Filter out any previous record for the same category to replace it with confirmed
      const remaining = allRecords.filter((r) => r.category !== completeCategory);
      const updated = [newRecord, ...remaining];

      let updatedTrip: Trip = {
        ...trip,
        booking_records: updated,
      };

      if (completeCategory === 'transport') {
        updatedTrip = applyTransitTrackingToTrip(updatedTrip);
        api.trackTransport(trip.id, updatedTrip).catch((e) => console.warn('Background transit track error:', e));
      }

      if (onUpdateTrip) {
        onUpdateTrip(updatedTrip);
      }

      setShowCompleteDialog(false);
      setInputReference('');
      setInputSeatOrRoom('');
      setInputNotes('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to record booking confirmation.');
    }
  };

  // Official booking info for currently active trip selections
  const transportInfo = trip.selected_transport ? getTransportBookingInfo(trip.selected_transport, trip) : null;
  const hotelInfo = trip.selected_hotel ? getHotelBookingInfo(trip.selected_hotel, trip) : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:bg-white print:p-0 print:static">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-4 sm:my-6 flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-0 print:my-0">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center text-white border border-white/20">
              <QrCode className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">Booked Tickets & Stay Vouchers</h3>
                {confirmedRecords.length > 0 ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {confirmedRecords.length} Confirmed
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Booking Pending
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {trip.title} &bull; {trip.origin} &rarr; {trip.destination} ({trip.start_date} - {trip.end_date})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {confirmedRecords.length > 0 && (
              <button
                onClick={handlePrint}
                title="Print or Save PDF Tickets"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Print / Save PDF</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Real Official Booking Portal Quick Launcher (Banner) */}
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/40 p-3 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">Real-Time Booking Portals:</span>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                Direct links to official airline, IRCTC railway, and hotel reservation systems
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {transportInfo && (
              <a
                href={transportInfo.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs"
              >
                {trip.selected_transport?.mode === 'train' ? (
                  <Train className="w-3.5 h-3.5" />
                ) : (
                  <Plane className="w-3.5 h-3.5" />
                )}
                <span>{transportInfo.officialSiteName.split('(')[0].trim()}</span>
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
            )}

            {hotelInfo && (
              <a
                href={hotelInfo.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs"
              >
                <Building2 className="w-3.5 h-3.5 text-amber-300" />
                <span>{hotelInfo.officialSiteName.split('(')[0].trim()}</span>
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
            )}
          </div>
        </div>

        {/* Filter Navigation */}
        <div className="p-3 sm:px-5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              All Items ({confirmedRecords.length} Booked)
            </button>
            <button
              onClick={() => setActiveFilter('transport')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                activeFilter === 'transport'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Plane className="w-3.5 h-3.5" />
              <span>Transport</span>
            </button>
            <button
              onClick={() => setActiveFilter('hotel')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                activeFilter === 'hotel'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Hotel Stay</span>
            </button>
          </div>

          {/* Quick Complete Action */}
          <div className="flex items-center gap-2">
            {!isTransportBooked && trip.selected_transport && (
              <button
                onClick={() => handleOpenCompleteDialog('transport')}
                className="flex items-center gap-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Confirm Transit Booking</span>
              </button>
            )}
            {!isHotelBooked && trip.selected_hotel && (
              <button
                onClick={() => handleOpenCompleteDialog('hotel')}
                className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Confirm Hotel Booking</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1 bg-slate-100/60 dark:bg-slate-950/60 print:bg-white print:p-0 print:space-y-8">
          
          {/* Confirmed Tickets Section (Shown only after completing booking) */}
          {confirmedRecords.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between print:hidden">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Confirmed Travel Documents ({confirmedRecords.length})</span>
                </h4>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Ready for boarding & hotel check-in
                </span>
              </div>

              {confirmedRecords.map((rec) => {
                const isFlight = rec.type === 'flight';
                const isTrain = rec.type === 'train';
                const isHotel = rec.type === 'hotel';
                const isBus = rec.type === 'bus';

                return (
                  <div
                    key={rec.id}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden transition-all print:border-2 print:border-slate-800 print:shadow-none print:break-inside-avoid"
                  >
                    {/* Authentic Top Header */}
                    <div
                      className={`p-4 sm:px-6 text-white flex flex-wrap items-center justify-between gap-3 ${
                        isFlight
                          ? 'bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-900'
                          : isTrain
                          ? 'bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900'
                          : isBus
                          ? 'bg-gradient-to-r from-amber-700 via-orange-700 to-amber-900'
                          : 'bg-gradient-to-r from-purple-800 via-indigo-900 to-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center border border-white/20 shrink-0">
                          {isFlight ? (
                            <Plane className="w-5 h-5 text-white" />
                          ) : isTrain ? (
                            <Train className="w-5 h-5 text-white" />
                          ) : isBus ? (
                            <Bus className="w-5 h-5 text-white" />
                          ) : (
                            <Building2 className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/20 text-white">
                              {isFlight
                                ? 'Boarding Pass & E-Ticket'
                                : isTrain
                                ? 'IRCTC Electronic Reservation Slip'
                                : isBus
                                ? 'Bus Ticket'
                                : 'Hotel Stay Voucher'}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-400 text-emerald-950 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              CONFIRMED
                            </span>
                          </div>
                          <h4 className="font-bold text-base sm:text-lg mt-0.5">{rec.title}</h4>
                        </div>
                      </div>

                      {/* Reference / PNR Box */}
                      <div className="bg-white/15 backdrop-blur border border-white/20 rounded-2xl p-2.5 px-4 text-right">
                        <div className="text-[10px] uppercase font-bold text-white/80">
                          {isHotel ? 'Booking ID' : isTrain ? 'IRCTC PNR' : 'Airline PNR / E-Ticket'}
                        </div>
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <span className="font-mono font-extrabold text-sm sm:text-base tracking-wider text-white">
                            {rec.reference_number}
                          </span>
                          <button
                            onClick={() => handleCopy(rec.reference_number, rec.id)}
                            className="p-1 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
                            title="Copy PNR / Confirmation Code"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {copiedId === rec.id && (
                          <div className="text-[10px] text-emerald-300 font-bold mt-0.5">Copied to clipboard!</div>
                        )}
                      </div>
                    </div>

                    {/* Perforated Divider (Aesthetic Ticket Notch) */}
                    <div className="relative border-b-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-slate-100/60 dark:bg-slate-950/60 print:hidden" />
                      <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-slate-100/60 dark:bg-slate-950/60 print:hidden" />
                    </div>

                    {/* Ticket Details Body */}
                    <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 space-y-5">
                      {/* Route / Property Header Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            {isHotel ? 'Property & City' : 'Origin & Departure'}
                          </span>
                          <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span>{rec.origin || trip.origin}</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{rec.departure_time || '14:00 (Check-in)'}</span>
                          </div>
                        </div>

                        <div>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            {isHotel ? 'Location & Distance' : 'Destination & Arrival'}
                          </span>
                          <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>{rec.destination || trip.destination}</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{rec.arrival_time || '11:00 (Check-out)'}</span>
                          </div>
                        </div>

                        <div>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            Travel / Stay Dates
                          </span>
                          <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span>{rec.travel_date}</span>
                            {rec.end_date && rec.end_date !== rec.travel_date && (
                              <span> &rarr; {rec.end_date}</span>
                            )}
                          </div>
                          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                            Amount Paid: ₹{rec.price_paid.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>

                      {/* Seat, Room, Class & Gate Info */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            {isHotel ? 'Room Category' : 'Class / Coach'}
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                            {rec.class_tier || (isHotel ? 'Deluxe Room' : 'Economy')}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            {isHotel ? 'Assigned Room' : 'Seat / Berth Details'}
                          </span>
                          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 mt-0.5 block">
                            {rec.seat_or_room}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            {isHotel ? 'Check-in Counter' : isTrain ? 'Platform' : 'Gate / Terminal'}
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                            {rec.gate_or_platform || 'Main Terminal'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            {isHotel ? 'Inclusions' : 'Baggage Allowance'}
                          </span>
                          <span
                            className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5 block truncate"
                            title={rec.baggage_or_inclusions}
                          >
                            <Luggage className="w-3 h-3 inline mr-1 text-slate-500" />
                            {rec.baggage_or_inclusions || 'Included'}
                          </span>
                        </div>
                      </div>

                      {/* Passenger / Guest Table */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-slate-500" />
                            <span>{isHotel ? 'Confirmed Guests' : 'Confirmed Passengers'} ({rec.passengers?.length || 1})</span>
                          </span>
                          <span className="text-[11px] text-slate-500">Government Photo ID mandatory</span>
                        </div>

                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                          {rec.passengers?.map((p, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 px-3 flex items-center justify-between bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                  {p.seat_or_berth || rec.seat_or_room}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                  CONFIRMED
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Autonomous Agent Timing & Telemetry Status */}
                      {!isHotel && trip.transport_tracking && (
                        <div className="p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="relative flex h-2.5 w-2.5 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </div>
                            <div>
                              <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                                <span>Agent Timing Tracking Active</span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    trip.transport_tracking.delay_minutes > 0
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  }`}
                                >
                                  {trip.transport_tracking.delay_minutes > 0
                                    ? `Delayed +${trip.transport_tracking.delay_minutes}m`
                                    : '● On-Time'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                                Estimated Dep:{' '}
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {trip.transport_tracking.estimated_departure}
                                </span>{' '}
                                &bull; {trip.transport_tracking.gate_or_platform} &bull;{' '}
                                <span className="text-indigo-700 dark:text-indigo-300 font-semibold">
                                  Leave Home By {trip.transport_tracking.recommended_leave_time}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="text-[10px] text-slate-400 font-mono self-end sm:self-center">
                            Radar Synced
                          </div>
                        </div>
                      )}

                      {/* Barcode & Validation Area */}
                      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0">
                            <QrCode className="w-12 h-12 text-slate-800 dark:text-slate-200" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Digital Travel Pass & Check-in Document</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-sm leading-relaxed">
                              {rec.notes || 'Present this mobile pass or printout at the gate/desk along with your original photo identification.'}
                            </p>
                          </div>
                        </div>

                        {/* Barcode Graphic */}
                        <div className="hidden sm:flex flex-col items-center">
                          <div className="h-9 flex items-center gap-0.5 px-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                            {Array.from({ length: 32 }).map((_, i) => (
                              <div
                                key={i}
                                className="h-full bg-slate-800 dark:bg-slate-200"
                                style={{
                                  width: `${(i % 3 === 0 ? 3 : i % 2 === 0 ? 1 : 2)}px`,
                                  opacity: i % 5 === 0 ? 0.4 : 1,
                                }}
                              />
                            ))}
                          </div>
                          <span className="font-mono text-[9px] text-slate-400 mt-0.5">{rec.reference_number}</span>
                        </div>
                      </div>

                      {/* Inline Edit Form */}
                      {editingRecordId === rec.id && (
                        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 space-y-3 print:hidden">
                          <h5 className="font-bold text-xs text-indigo-950 dark:text-indigo-200">Update Booking Details</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                            <div>
                              <label className="block text-[11px] font-semibold text-indigo-900 dark:text-indigo-300 mb-1">
                                Official PNR / Booking Reference:
                              </label>
                              <input
                                type="text"
                                value={editPnr}
                                onChange={(e) => setEditPnr(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-indigo-900 dark:text-indigo-300 mb-1">
                                Seat / Room Allocation:
                              </label>
                              <input
                                type="text"
                                value={editSeat}
                                onChange={(e) => setEditSeat(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-indigo-900 dark:text-indigo-300 mb-1">
                              Special Notes:
                            </label>
                            <input
                              type="text"
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl text-xs text-slate-800 dark:text-white"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              onClick={() => setEditingRecordId(null)}
                              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEdit(rec.id)}
                              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
                            >
                              Save Changes
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Actions Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 print:hidden">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStartEdit(rec)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit Reference</span>
                          </button>

                          {rec.pnr_verification_url && (
                            <a
                              href={rec.pnr_verification_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors"
                            >
                              <Search className="w-3.5 h-3.5" />
                              <span>Verify PNR</span>
                              <ExternalLink className="w-3 h-3 ml-0.5" />
                            </a>
                          )}

                          <button
                            onClick={() => handleDeleteRecord(rec.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-800 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                            title="Remove this confirmed booking and revert to pending"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>

                        <a
                          href={rec.official_site_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 bg-slate-900 dark:bg-white hover:bg-indigo-600 text-white dark:text-slate-900 dark:hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs"
                        >
                          <span>Manage on Carrier Site</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pending Bookings Section (Awaiting Booking Completion) */}
          {(showPendingTransport || showPendingHotel) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>Pending Real-Time Bookings (Awaiting Completion)</span>
                </h4>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tickets unlocked upon completing booking
                </span>
              </div>

              {/* Status Explanation Banner */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-bold">Authentic Live System &mdash; No Synthetic Tickets</p>
                  <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                    To maintain strict real-time data integrity, boarding passes and stay vouchers are generated only after you complete the actual booking. Book directly on official airline, railway, or hotel websites below, then enter your official booking confirmation/PNR to unlock verified passes.
                  </p>
                </div>
              </div>

              {/* Pending Transport Card */}
              {showPendingTransport && trip.selected_transport && (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
                        {trip.selected_transport.mode === 'train' ? (
                          <Train className="w-5 h-5" />
                        ) : trip.selected_transport.mode === 'bus' ? (
                          <Bus className="w-5 h-5" />
                        ) : (
                          <Plane className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-slate-900 dark:text-white">
                            {trip.selected_transport.carrier}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                            Booking Pending
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {trip.selected_transport.origin} &rarr; {trip.selected_transport.destination} &bull; {trip.start_date} ({trip.selected_transport.departure_time} - {trip.selected_transport.arrival_time})
                        </div>
                      </div>
                    </div>

                    <div className="text-right sm:text-right">
                      <span className="text-base font-extrabold text-slate-900 dark:text-white">
                        ₹{trip.selected_transport.price.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        Live Fare ({trip.travellers_count || 1} Travellers)
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Live Fare via {trip.selected_transport.source?.source_name || 'Official Schedules'}</span>
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {transportInfo && (
                        <a
                          href={transportInfo.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer group"
                          title="Minimal human intervention: Redirect to pre-filled live ticketing site"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-pulse" />
                          <span>Instant Live Tickets ({transportInfo.realtimePlatform.split('&')[0].trim()})</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}

                      <button
                        onClick={() => handleOpenCompleteDialog('transport')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Enter PNR</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Pending Hotel Card */}
              {showPendingHotel && trip.selected_hotel && (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-slate-900 dark:text-white">
                            {trip.selected_hotel.name}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                            Reservation Pending
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {trip.selected_hotel.location} &bull; {trip.selected_hotel.rating}★ &bull; Check-in {trip.start_date} to {trip.end_date}
                        </div>
                      </div>
                    </div>

                    <div className="text-right sm:text-right">
                      <span className="text-base font-extrabold text-slate-900 dark:text-white">
                        ₹{trip.selected_hotel.total_price.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        Live Stay Estimate
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Verified via {trip.selected_hotel.source?.source_name || 'Hotel GDS Feed'}</span>
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {hotelInfo && (
                        <a
                          href={hotelInfo.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer group"
                          title="Minimal human intervention: Redirect to pre-filled live hotel booking"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-pulse" />
                          <span>Instant Live Rooms ({hotelInfo.realtimePlatform.split('&')[0].trim()})</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}

                      <button
                        onClick={() => handleOpenCompleteDialog('hotel')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Enter Ref ID</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty State when no pending and no confirmed */}
          {confirmedRecords.length === 0 && !showPendingTransport && !showPendingHotel && (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
              <QrCode className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">No Bookings Recorded Yet</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                Tickets and stay vouchers are generated only after booking on official portals.
              </p>
            </div>
          )}
        </div>

        {/* Complete Booking Modal Dialog */}
        {showCompleteDialog && (
          <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <form
              onSubmit={handleConfirmBookingSubmission}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white ${
                    completeCategory === 'transport' ? 'bg-indigo-600' : 'bg-emerald-600'
                  }`}>
                    {completeCategory === 'transport' ? (
                      <Plane className="w-4 h-4" />
                    ) : (
                      <Building2 className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      Confirm {completeCategory === 'transport' ? 'Transportation' : 'Accommodation'} Booking
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Record your official confirmation to unlock live travel documents
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCompleteDialog(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              <div className="space-y-3.5 text-xs">
                {/* Provider info read-only chip */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    {completeCategory === 'transport' ? 'Carrier / Transport' : 'Hotel / Property'}
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block mt-0.5">
                    {completeCategory === 'transport'
                      ? trip.selected_transport?.carrier
                      : trip.selected_hotel?.name}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    {completeCategory === 'transport'
                      ? `${trip.selected_transport?.origin} → ${trip.selected_transport?.destination} on ${trip.start_date}`
                      : `${trip.selected_hotel?.location} (${trip.start_date} to ${trip.end_date})`}
                  </span>

                  <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    {completeCategory === 'transport' && transportInfo && (
                      <a
                        href={transportInfo.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg"
                      >
                        <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                        <span>Launch Live ({transportInfo.realtimePlatform.split('&')[0].trim()})</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    )}
                    {completeCategory === 'hotel' && hotelInfo && (
                      <a
                        href={hotelInfo.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg"
                      >
                        <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                        <span>Launch Live ({hotelInfo.realtimePlatform.split('&')[0].trim()})</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const summary = getPassengerAutofillSummary(trip);
                        navigator.clipboard.writeText(summary);
                        setCopiedId('dialog-pax');
                        setTimeout(() => setCopiedId(null), 2500);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg cursor-pointer"
                    >
                      {copiedId === 'dialog-pax' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-600 font-bold">Copied All Pax!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-500" />
                          <span>Copy Pax Data</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Official Reference / PNR Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={inputReference}
                    onChange={(e) => {
                      setInputReference(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder={
                      completeCategory === 'transport'
                        ? trip.selected_transport?.mode === 'train'
                          ? 'e.g. 452-9182374 (10-digit IRCTC PNR)'
                          : 'e.g. 6E-W8Q2KP (Airline PNR)'
                        : 'e.g. BK-98765432 or HTL-CONF-1092'
                    }
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white uppercase placeholder:normal-case placeholder:font-sans placeholder:font-normal focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Found in your booking confirmation SMS or email receipt
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {completeCategory === 'transport' ? 'Assigned Seats / Berths' : 'Room Category / Number'}
                    </label>
                    <input
                      type="text"
                      value={inputSeatOrRoom}
                      onChange={(e) => setInputSeatOrRoom(e.target.value)}
                      placeholder={completeCategory === 'transport' ? 'e.g. Seats 12A, 12B' : 'e.g. Deluxe King Suite'}
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Final Price Paid (INR)
                    </label>
                    <input
                      type="number"
                      value={inputPrice}
                      onChange={(e) => setInputPrice(Number(e.target.value))}
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Notes / Confirmation Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    value={inputNotes}
                    onChange={(e) => setInputNotes(e.target.value)}
                    placeholder="e.g. Direct window seat booked, breakfast included"
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCompleteDialog(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer ${
                    completeCategory === 'transport'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm & Unlock Passes</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
