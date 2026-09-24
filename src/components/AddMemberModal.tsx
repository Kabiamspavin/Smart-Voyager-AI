import React, { useState } from 'react';
import {
  Users,
  X,
  UserPlus,
  Phone,
  Shield,
  MapPin,
  Sparkles,
  Heart,
  Palette,
  Check,
} from 'lucide-react';
import { TripMember, HotelOption } from '../types.js';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMember: (member: TripMember) => void;
  destinationCity: string;
  hotel?: HotelOption;
  defaultCoordinates?: { lat: number; lng: number };
}

const AVATAR_COLORS = [
  '#4f46e5', // Indigo
  '#059669', // Emerald
  '#d97706', // Amber
  '#db2777', // Pink
  '#0284c7', // Sky
  '#7c3aed', // Violet
  '#dc2626', // Red
  '#0d9488', // Teal
];

const INTEREST_TAGS = ['Heritage', 'Photography', 'Food & Dining', 'Shopping', 'Nature', 'Kids Activities', 'Spiritual', 'Nightlife'];

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  isOpen,
  onClose,
  onAddMember,
  destinationCity,
  hotel,
  defaultCoordinates,
}) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Tour Member' | 'Family' | 'Guide' | 'Leader'>('Tour Member');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'active' | 'exploring' | 'at_hotel' | 'rendezvous'>('active');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [locationPreset, setLocationPreset] = useState<'city_center' | 'hotel' | 'custom'>('city_center');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['Heritage', 'Food & Dining']);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleInterest = (tag: string) => {
    if (selectedInterests.includes(tag)) {
      setSelectedInterests(selectedInterests.filter((t) => t !== tag));
    } else {
      setSelectedInterests([...selectedInterests, tag]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter member name');
      return;
    }

    // Determine initial coordinates with subtle offset so markers don't overlap exactly
    const baseLat = defaultCoordinates?.lat || hotel?.coordinates?.lat || 28.6139;
    const baseLng = defaultCoordinates?.lng || hotel?.coordinates?.lng || 77.2090;

    let coords = { lat: baseLat, lng: baseLng };
    let locationName = `${destinationCity} Center`;

    if (locationPreset === 'hotel' && hotel) {
      coords = {
        lat: hotel.coordinates?.lat || baseLat,
        lng: hotel.coordinates?.lng || baseLng,
      };
      locationName = hotel.name;
    } else {
      // Add small realistic offset ~ 100-300m
      const jitterLat = (Math.random() - 0.5) * 0.006;
      const jitterLng = (Math.random() - 0.5) * 0.006;
      coords = { lat: baseLat + jitterLat, lng: baseLng + jitterLng };
      if (status === 'exploring') {
        locationName = `${destinationCity} Promenade`;
      } else if (status === 'at_hotel') {
        locationName = hotel ? hotel.name : `${destinationCity} Hotel Lounge`;
      }
    }

    const newMember: TripMember = {
      id: `m_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: name.trim(),
      role,
      phone: phone.trim() || undefined,
      status,
      last_location_name: locationName,
      coordinates: coords,
      battery_level: Math.floor(Math.random() * 20) + 80, // 80 - 100%
      last_ping: 'Just now',
      avatar_color: avatarColor,
      interests: selectedInterests,
    };

    onAddMember(newMember);
    onClose();

    // Reset form
    setName('');
    setPhone('');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white border border-white/20">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-snug">Add Group Member for Live Tracking</h3>
              <p className="text-xs text-indigo-100 mt-0.5">
                Real-time GPS beacon & safety sync for {destinationCity}
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

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Member Name & Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Member Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. Priya S. / Travel Buddy"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Trip Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800"
              >
                <option value="Tour Member">Tour Member</option>
                <option value="Family">Family Member</option>
                <option value="Guide">Tour Guide / Lead</option>
                <option value="Leader">Group Organizer</option>
              </select>
            </div>
          </div>

          {/* Phone / WhatsApp for Live SOS & Pings */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Mobile / WhatsApp (for Safety Pings & SOS)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Enables one-tap SMS/WhatsApp check-in alerts directly from the interactive map.
            </p>
          </div>

          {/* Initial Status & Location Preset */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Current Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800"
              >
                <option value="active">Active & Exploring</option>
                <option value="exploring">Sightseeing Independently</option>
                <option value="at_hotel">Relaxing at Hotel</option>
                <option value="rendezvous">At Meeting Point</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Map Beacon Position</span>
              </label>
              <select
                value={locationPreset}
                onChange={(e) => setLocationPreset(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800"
              >
                <option value="city_center">{destinationCity} City Center Area</option>
                {hotel && <option value="hotel">Current Hotel ({hotel.name.slice(0, 20)}...)</option>}
              </select>
            </div>
          </div>

          {/* Color Badge Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Map Marker Avatar Color</span>
            </label>
            <div className="flex items-center gap-3">
              {AVATAR_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => setAvatarColor(color)}
                  style={{ backgroundColor: color }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-white transition-transform cursor-pointer ${
                    avatarColor === color ? 'ring-3 ring-indigo-300 ring-offset-2 scale-110' : 'hover:scale-105'
                  }`}
                >
                  {avatarColor === color && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Interests Tags */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>Member Travel Interests</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {INTEREST_TAGS.map((tag) => {
                const isSelected = selectedInterests.includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => toggleInterest(tag)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-100 dark:shadow-none transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add to Live Tracker</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
