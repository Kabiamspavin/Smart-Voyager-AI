import React, { useState } from 'react';
import {
  Building2,
  X,
  Check,
  Star,
  MapPin,
  Sparkles,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Wifi,
  Coffee,
  Waves,
  Train,
  ExternalLink,
  QrCode,
  Zap,
} from 'lucide-react';
import { HotelOption, Trip } from '../types.js';
import { getHotelBookingInfo } from '../utils/bookingUrls.js';

interface HotelSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onSelectHotel: (hotelId: string) => Promise<void>;
  isLoading?: boolean;
  onViewVoucher?: () => void;
}

export const HotelSwitcherModal: React.FC<HotelSwitcherModalProps> = ({
  isOpen,
  onClose,
  trip,
  onSelectHotel,
  isLoading = false,
  onViewVoucher,
}) => {
  const [filterTier, setFilterTier] = useState<'all' | 'budget' | 'comfort' | 'luxury'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentHotel = trip.selected_hotel;
  const currentTotal = currentHotel?.total_price || 0;
  const hotelOptions = trip.hotel_options || (currentHotel ? [currentHotel] : []);

  const filteredHotels = hotelOptions.filter((hotel) => {
    if (filterTier === 'budget') return hotel.price_per_night <= 2500;
    if (filterTier === 'comfort') return hotel.price_per_night > 2500 && hotel.price_per_night <= 4500;
    if (filterTier === 'luxury') return hotel.price_per_night > 4500;
    return true;
  });

  const handleChoose = async (hotel: HotelOption) => {
    if (isLoading || hotel.id === currentHotel?.id) return;
    setSelectedId(hotel.id);
    await onSelectHotel(hotel.id);
    setSelectedId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-indigo-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white border border-white/20">
              <Building2 className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">Select Hotel (Budget-Optimized)</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Live Rates
                </span>
              </div>
              <p className="text-xs text-indigo-100 mt-0.5">
                Compare verified stays in {trip.destination} tailored to your ₹{trip.budget.toLocaleString('en-IN')} budget cap
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

        {/* Filter Pills */}
        <div className="p-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">Budget Tier:</span>
            <button
              onClick={() => setFilterTier('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filterTier === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              All Stays ({hotelOptions.length})
            </button>
            <button
              onClick={() => setFilterTier('budget')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filterTier === 'budget'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Budget (&lt; ₹2.5k)
            </button>
            <button
              onClick={() => setFilterTier('comfort')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filterTier === 'comfort'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Comfort (₹2.5k - ₹4.5k)
            </button>
            <button
              onClick={() => setFilterTier('luxury')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filterTier === 'luxury'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Luxury (&gt; ₹4.5k)
            </button>
          </div>

          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Current Stay: <strong className="text-slate-800 dark:text-white">₹{currentTotal.toLocaleString('en-IN')}</strong>
          </div>
        </div>

        {/* Hotels List */}
        <div className="p-6 space-y-3.5 max-h-[420px] overflow-y-auto">
          {filteredHotels.map((hotel) => {
            const isSelected = currentHotel?.id === hotel.id;
            const isProcessing = selectedId === hotel.id || (isLoading && isSelected);
            const priceDiff = currentTotal - hotel.total_price;
            const isCheaper = priceDiff > 0;
            const isMoreExpensive = priceDiff < 0;
            const bookingInfo = getHotelBookingInfo(hotel, trip);

            return (
              <div
                key={hotel.id}
                onClick={() => !isProcessing && handleChoose(hotel)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/50 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 bg-white dark:bg-slate-850 shadow-xs'
                }`}
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{hotel.name}</h4>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 px-1.5 py-0.2 rounded-md">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{hotel.rating}★</span>
                    </span>

                    {/* Budget Impact Badge */}
                    {isCheaper && !isSelected && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                        <TrendingDown className="w-3 h-3" />
                        <span>Saves ₹{priceDiff.toLocaleString('en-IN')}</span>
                      </span>
                    )}

                    {isMoreExpensive && !isSelected && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full">
                        <TrendingUp className="w-3 h-3" />
                        <span>+₹{Math.abs(priceDiff).toLocaleString('en-IN')} Upgrade</span>
                      </span>
                    )}

                    {isSelected && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" />
                        <span>Currently Booked</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span>{hotel.location}</span>
                    <span>&bull;</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{hotel.distance_to_center_km}km from center</span>
                  </p>

                  {/* Amenities */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {hotel.amenities?.map((amenity, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>

                  {/* Official Booking Site Direct Links */}
                  <div className="flex flex-wrap items-center gap-2 pt-1.5" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={bookingInfo.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 px-2.5 py-1 rounded-lg transition-all shadow-2xs cursor-pointer"
                      title={`Open pre-filled real-time available rooms for ${hotel.name}`}
                    >
                      <Zap className="w-3 h-3 text-amber-300 fill-amber-300 animate-pulse" />
                      <span>Live Available Rooms ({bookingInfo.realtimePlatform.split('&')[0].trim()})</span>
                      <ExternalLink className="w-3 h-3 ml-0.5" />
                    </a>

                    {isSelected && onViewVoucher && (
                      <button
                        onClick={onViewVoucher}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        <QrCode className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>View Stay Voucher</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Price and Action */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                  <div className="text-left sm:text-right">
                    <div className="text-base font-bold text-slate-900 dark:text-white">
                      ₹{hotel.price_per_night?.toLocaleString('en-IN')}
                      <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400"> /night</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Total: ₹{hotel.total_price?.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <button
                    disabled={isSelected || isProcessing}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white cursor-default'
                        : 'bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-700 text-white shadow-xs'
                    }`}
                  >
                    {isProcessing ? (
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    ) : isSelected ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5" />
                    )}
                    <span>{isSelected ? 'Active Stay' : isProcessing ? 'Re-balancing...' : 'Select Stay'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Budget Agent guarantees accommodation cost fits under ₹{trip.budget.toLocaleString('en-IN')}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold cursor-pointer transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
