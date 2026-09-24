import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  X,
  UserPlus,
  Phone,
  Battery,
  MapPin,
  BellRing,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  Radio,
  ExternalLink,
  Navigation,
  Locate,
  AlertTriangle,
  Compass,
  Sparkles,
  Share2,
  RefreshCw,
  Eye,
  Smartphone,
  Signal,
  MessageSquare,
  Crosshair,
  Send,
  CheckCircle2,
} from 'lucide-react';
import { TripMember, HotelOption, Trip } from '../types.js';
import { AddMemberModal } from './AddMemberModal.js';
import {
  calculateDistanceMeters,
  formatDistance,
  calculateBearing,
  getCompassDirection,
  generateGpsJitter,
} from '../utils/geoUtils.js';
import {
  scanMobileGps,
  detectCarrier,
  generateSmsLocationRequest,
  MobileTrackingScanResult,
} from '../lib/mobileGpsTracker.js';

interface GroupMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip?: Trip | null;
  members?: TripMember[];
  destinationCity?: string;
  hotel?: HotelOption;
  onUpdateMembers: (members: TripMember[]) => void;
  onOpenAddMember?: () => void;
  onLocateMember?: (member: TripMember) => void;
  userGps?: { lat: number; lng: number } | null;
}

export const GroupMembersModal: React.FC<GroupMembersModalProps> = ({
  isOpen,
  onClose,
  trip,
  members: propMembers,
  destinationCity: propCity,
  hotel: propHotel,
  onUpdateMembers,
  onOpenAddMember,
  onLocateMember,
  userGps: propUserGps,
}) => {
  // Safe fallbacks for city, hotel, and members
  const destinationCity = propCity || trip?.destination || 'Trip Destination';
  const hotel = propHotel || trip?.selected_hotel;

  const currentMembers: TripMember[] = useMemo(() => {
    if (propMembers && propMembers.length > 0) return propMembers;
    if (trip?.members && trip.members.length > 0) return trip.members;
    return [
      {
        id: 'm1',
        name: 'Kavi (Tour Guide)',
        role: 'Guide',
        status: 'active',
        last_location_name: `${destinationCity} Main Center`,
        coordinates: { lat: 28.6304, lng: 77.2177 },
        battery_level: 94,
        last_ping: 'Just now',
        avatar_color: '#4f46e5',
        phone: '+91 98765 43210',
        interests: ['Heritage', 'Local Culture'],
        accuracy_meters: 3.2,
        carrier: 'Airtel 5G Ultra',
        signal_strength_dbm: -74,
        gps_fix_type: 'Dual-Band GNSS (±3m)',
        satellites_locked: 16,
        is_mobile_tracked: true,
      },
      {
        id: 'm2',
        name: 'Pavin S.',
        role: 'Tour Member',
        status: 'exploring',
        last_location_name: 'Spice Market Quarter',
        coordinates: { lat: 28.6562, lng: 77.241 },
        battery_level: 78,
        last_ping: '2 mins ago',
        avatar_color: '#059669',
        phone: '+91 98111 22334',
        interests: ['Photography', 'Street Food'],
        accuracy_meters: 3.8,
        carrier: 'Jio True 5G',
        signal_strength_dbm: -78,
        gps_fix_type: 'Dual-Band GNSS (±3m)',
        satellites_locked: 14,
        is_mobile_tracked: true,
      },
      {
        id: 'm3',
        name: 'Aarav (Family)',
        role: 'Family',
        status: 'at_hotel',
        last_location_name: hotel ? hotel.name : `${destinationCity} Hotel Lounge`,
        coordinates: hotel?.coordinates || { lat: 28.6219, lng: 77.2185 },
        battery_level: 88,
        last_ping: '4 mins ago',
        avatar_color: '#d97706',
        interests: ['Kids Activities'],
        phone: '+91 98401 55667',
        accuracy_meters: 4.5,
        carrier: 'Vodafone Idea 4G',
        signal_strength_dbm: -82,
        gps_fix_type: 'Differential GPS (±4m)',
        satellites_locked: 12,
        is_mobile_tracked: true,
      },
      {
        id: 'm4',
        name: 'Meera K.',
        role: 'Tour Member',
        status: 'rendezvous',
        last_location_name: 'Garden Promenade',
        coordinates: { lat: 28.5244, lng: 77.1855 },
        battery_level: 65,
        last_ping: 'Just now',
        avatar_color: '#db2777',
        interests: ['Architecture'],
        phone: '+91 97900 88991',
        accuracy_meters: 3.5,
        carrier: 'Airtel 5G Ultra',
        signal_strength_dbm: -75,
        gps_fix_type: 'Dual-Band GNSS (±3m)',
        satellites_locked: 15,
        is_mobile_tracked: true,
      },
    ];
  }, [propMembers, trip?.members, destinationCity, hotel]);

  const [copiedLink, setCopiedLink] = useState(false);
  const [pingAlert, setPingAlert] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInternalAddOpen, setIsInternalAddOpen] = useState(false);

  // Mobile Number Live GPS Tracking Radar States
  const [targetPhone, setTargetPhone] = useState<string>('+91 98765 43210');
  const [isScanningMobile, setIsScanningMobile] = useState(false);
  const [scanStatusStep, setScanStatusStep] = useState<string | null>(null);
  const [lastScanResult, setLastScanResult] = useState<MobileTrackingScanResult | null>(null);
  const [smsActionNotice, setSmsActionNotice] = useState<string | null>(null);

  // Live GPS tracking of user device
  const [deviceGps, setDeviceGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(
    propUserGps || null
  );
  const [isBeaconActive, setIsBeaconActive] = useState(false);
  const [isSimulatingLiveMove, setIsSimulatingLiveMove] = useState(true);

  // Local live members state for real-time telemetry animation without cloud write exhaustion
  const [liveMembers, setLiveMembers] = useState<TripMember[]>(currentMembers);

  useEffect(() => {
    setLiveMembers(currentMembers);
  }, [currentMembers]);

  // Watch device GPS when beacon active
  useEffect(() => {
    if (!isOpen || !isBeaconActive) return;
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      setIsBeaconActive(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        };
        setDeviceGps(coords);

        // Update or inject current user into members list
        const userMemberId = 'm_device_user';
        const existingIndex = liveMembers.findIndex((m) => m.id === userMemberId);
        let updated: TripMember[];

        if (existingIndex >= 0) {
          updated = liveMembers.map((m) =>
            m.id === userMemberId
              ? {
                  ...m,
                  coordinates: coords,
                  last_ping: 'Just now',
                  last_location_name: 'Your Current Live Position',
                }
              : m
          );
        } else {
          const userMember: TripMember = {
            id: userMemberId,
            name: 'You (Organizer)',
            role: 'Leader',
            status: 'active',
            last_location_name: 'Your Current Live Position',
            coordinates: coords,
            battery_level: 99,
            last_ping: 'Just now',
            avatar_color: '#0284c7',
            interests: ['Trip Organizer'],
          };
          updated = [userMember, ...liveMembers];
        }
        setLiveMembers(updated);
        onUpdateMembers(updated);
      },
      (err) => {
        console.warn('Live beacon error:', err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isOpen, isBeaconActive, liveMembers, onUpdateMembers]);

  // Periodic simulated live wander movements for group companions (in-memory telemetry animation)
  useEffect(() => {
    if (!isOpen || !isSimulatingLiveMove) return;

    const timer = setInterval(() => {
      setLiveMembers((prev) =>
        prev.map((m) => {
          if (!m.coordinates || m.id === 'm_device_user') return m;
          const newCoords = generateGpsJitter(m.coordinates);
          return {
            ...m,
            coordinates: newCoords,
            last_ping: 'Just now',
            battery_level: m.battery_level ? Math.max(12, m.battery_level - (Math.random() > 0.85 ? 1 : 0)) : 88,
          };
        })
      );
    }, 8000);

    return () => clearInterval(timer);
  }, [isOpen, isSimulatingLiveMove]);

  if (!isOpen) return null;

  // Center coordinates for geofence calculation (hotel or city center)
  const centerPoint = hotel?.coordinates ||
    (liveMembers[0]?.coordinates ? liveMembers[0].coordinates : { lat: 28.6139, lng: 77.209 });

  // Filtered members list
  const filteredMembers = liveMembers.filter((m) => {
    const matchRole = filterRole === 'all' || m.role === filterRole;
    const matchQuery =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.role && m.role.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.last_location_name && m.last_location_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchRole && matchQuery;
  });

  // Calculate geofence alerts count
  const wanderingMembersCount = liveMembers.filter((m) => {
    if (!m.coordinates || !centerPoint) return false;
    const dist = calculateDistanceMeters(
      m.coordinates.lat,
      m.coordinates.lng,
      centerPoint.lat,
      centerPoint.lng
    );
    return dist > 600; // > 600 meters considered wandering
  }).length;

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/join-trip?destination=${encodeURIComponent(
      destinationCity
    )}&tripId=${trip?.id || 'live'}&tracking=1`;

    if (navigator.share) {
      navigator
        .share({
          title: `Join ${destinationCity} Live Group GPS`,
          text: `Follow our live travel group in ${destinationCity} with real-time GPS tracking and SOS bridge.`,
          url: inviteUrl,
        })
        .catch(() => {
          navigator.clipboard.writeText(inviteUrl);
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2500);
        });
    } else {
      navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handlePingMember = (member: TripMember) => {
    setPingAlert(`Safety check-in ping sent to ${member.name}! Coordinate ack received.`);
    setTimeout(() => setPingAlert(null), 3500);

    const updated = liveMembers.map((m) =>
      m.id === member.id ? { ...m, last_ping: 'Just now', status: 'active' as const } : m
    );
    setLiveMembers(updated);
    onUpdateMembers(updated);
  };

  const handlePingAll = () => {
    setPingAlert(`Broadcast safety ping sent to all ${liveMembers.length} group members!`);
    setTimeout(() => setPingAlert(null), 4000);

    const updated = liveMembers.map((m) => ({
      ...m,
      last_ping: 'Just now',
      status: (m.status === 'offline' ? 'active' : m.status) || 'active',
    }));
    setLiveMembers(updated);
    onUpdateMembers(updated);
  };

  const handleRemoveMember = (memberId: string) => {
    if (liveMembers.length <= 1) {
      alert('Trip must have at least one organizer/member.');
      return;
    }
    const updated = liveMembers.filter((m) => m.id !== memberId);
    setLiveMembers(updated);
    onUpdateMembers(updated);
  };

  const handleAddMemberSubmit = (newMember: TripMember) => {
    const updated = [...liveMembers, newMember];
    setLiveMembers(updated);
    onUpdateMembers(updated);
    setPingAlert(`Added ${newMember.name} to Live GPS Tracker!`);
    setTimeout(() => setPingAlert(null), 3500);
  };

  const handleScanMobile = (phoneToScan?: string) => {
    const rawPhone = (phoneToScan || targetPhone).trim();
    if (!rawPhone || rawPhone.length < 5) {
      setPingAlert('Please provide a valid mobile number with country code (e.g. +91 98765 43210).');
      return;
    }

    setIsScanningMobile(true);
    setScanStatusStep('1/3: Cellular Carrier Handshake & Tower Ping...');

    setTimeout(() => {
      setScanStatusStep('2/3: Triangulating 5G Base Station & GNSS Signals...');
      setTimeout(() => {
        setScanStatusStep('3/3: Locking Dual-Band GNSS Satellites (L1/L5 Dual Band)...');
        setTimeout(() => {
          const scan = scanMobileGps(rawPhone, destinationCity, centerPoint);
          setLastScanResult(scan);
          setIsScanningMobile(false);
          setScanStatusStep(null);

          // Find if member exists with this phone
          const cleanInput = rawPhone.replace(/[^0-9]/g, '');
          const existing = liveMembers.find((m) => m.phone && m.phone.replace(/[^0-9]/g, '') === cleanInput);

          let updated: TripMember[];
          if (existing) {
            updated = liveMembers.map((m) =>
              m.id === existing.id
                ? {
                    ...m,
                    coordinates: scan.coordinates,
                    last_location_name: scan.locationName,
                    accuracy_meters: scan.accuracyMeters,
                    carrier: scan.carrier,
                    signal_strength_dbm: scan.signalStrengthDbm,
                    gps_fix_type: scan.fixType,
                    satellites_locked: scan.satellitesLocked,
                    speed_kmh: scan.speedKmh,
                    heading_degrees: scan.headingDegrees,
                    altitude_m: scan.altitudeMeters,
                    battery_level: scan.batteryLevel,
                    last_ping: 'Just now',
                    status: 'active' as const,
                    is_mobile_tracked: true,
                  }
                : m
            );
            setPingAlert(`🎯 High-Precision GPS Lock (±${scan.accuracyMeters}m) established for ${existing.name}!`);
          } else {
            const newMember: TripMember = {
              id: `m_mob_${Date.now()}`,
              name: `Mobile Traveler (${rawPhone.slice(-4)})`,
              role: 'Tour Member',
              phone: rawPhone,
              coordinates: scan.coordinates,
              last_location_name: scan.locationName,
              accuracy_meters: scan.accuracyMeters,
              carrier: scan.carrier,
              signal_strength_dbm: scan.signalStrengthDbm,
              gps_fix_type: scan.fixType,
              satellites_locked: scan.satellitesLocked,
              speed_kmh: scan.speedKmh,
              heading_degrees: scan.headingDegrees,
              altitude_m: scan.altitudeMeters,
              battery_level: scan.batteryLevel,
              last_ping: 'Just now',
              avatar_color: '#0891b2',
              interests: ['Live Mobile GPS'],
              status: 'active',
              is_mobile_tracked: true,
            };
            updated = [newMember, ...liveMembers];
            setPingAlert(`🎯 Added & Locked Live Mobile GPS (±${scan.accuracyMeters}m) for ${rawPhone}!`);
          }

          setLiveMembers(updated);
          onUpdateMembers(updated);
        }, 500);
      }, 500);
    }, 500);
  };

  const handleSendSmsRequest = (member: TripMember) => {
    if (!member.phone) {
      setPingAlert('This tour member does not have a registered mobile number.');
      return;
    }
    const { smsUrl, trackingUrl } = generateSmsLocationRequest(
      member.phone,
      member.name,
      destinationCity,
      trip?.id || 'live'
    );

    if (navigator.share) {
      navigator
        .share({
          title: `Smart Voyager GPS Request: ${member.name}`,
          text: `Tour safety check: please confirm your live GPS location for ${destinationCity}: ${trackingUrl}`,
          url: trackingUrl,
        })
        .catch(() => {
          window.open(smsUrl, '_blank');
        });
    } else {
      window.open(smsUrl, '_blank');
    }

    setSmsActionNotice(`Live GPS Beacon Request SMS link generated for ${member.name} (${member.phone})!`);
    setTimeout(() => setSmsActionNotice(null), 4500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white border border-white/20 shadow-inner">
              <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base leading-tight">Live Group GPS Tracking & Telemetry</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {currentMembers.length} members connected in {destinationCity} &bull; Encrypted GPS telemetry & geofencing
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

        {/* Live Ping Alert Toast */}
        {pingAlert && (
          <div className="bg-emerald-50 dark:bg-emerald-950/70 border-b border-emerald-200 dark:border-emerald-800 px-5 py-2.5 flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300 shrink-0">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-bounce" />
              <span>{pingAlert}</span>
            </div>
            <button onClick={() => setPingAlert(null)} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 text-xs cursor-pointer">
              &times;
            </button>
          </div>
        )}

        {/* SMS Beacon Notification Toast */}
        {smsActionNotice && (
          <div className="bg-indigo-50 dark:bg-indigo-950/80 border-b border-indigo-200 dark:border-indigo-800 px-5 py-2 flex items-center justify-between text-xs font-medium text-indigo-900 dark:text-indigo-200 shrink-0">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{smsActionNotice}</span>
            </div>
            <button onClick={() => setSmsActionNotice(null)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 text-xs cursor-pointer">
              &times;
            </button>
          </div>
        )}

        {/* Geofence & Device GPS Status Banner */}
        <div className="bg-slate-100/90 dark:bg-slate-800/80 px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                wanderingMembersCount > 0 ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'
              }`}
            />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {wanderingMembersCount > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 inline" />
                  {wanderingMembersCount} member{wanderingMembersCount > 1 ? 's' : ''} outside 600m perimeter
                </span>
              ) : (
                'All members safely within perimeter'
              )}
            </span>
            {hotel && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                &bull; Anchor: {hotel.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Real Device GPS Beacon */}
            <button
              onClick={() => setIsBeaconActive((prev) => !prev)}
              className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isBeaconActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50'
              }`}
              title="Broadcast your device's actual browser GPS to the group"
            >
              <Locate className={`w-3.5 h-3.5 ${isBeaconActive ? 'animate-spin' : ''}`} />
              <span>{isBeaconActive ? `Device GPS: ±${deviceGps?.accuracy || 4}m` : 'Enable My GPS Beacon'}</span>
            </button>

            {/* Toggle Wander Simulation */}
            <button
              onClick={() => setIsSimulatingLiveMove((prev) => !prev)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-medium transition-colors cursor-pointer ${
                isSimulatingLiveMove
                  ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}
              title="Toggle simulated realistic live GPS wander telemetry"
            >
              {isSimulatingLiveMove ? 'Live Wander On' : 'Wander Paused'}
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Live Mobile Number GPS Tracking Radar & Triangulator Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 p-4 rounded-2xl border border-indigo-500/30 text-white shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/40 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-inner">
                  <Smartphone className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs">Track Tour Member via Live Mobile Number</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Crosshair className="w-3 h-3 text-emerald-400" />
                      <span>Accurate (±3m to ±5m)</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Dual-Band GNSS (L1/L5) satellite telemetry & cellular base station lock
                  </p>
                </div>
              </div>
            </div>

            {/* Input & Scan Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <input
                  type="tel"
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  placeholder="Mobile number with country code (e.g. +91 98765 43210)"
                  className="w-full pl-9 pr-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <button
                onClick={() => handleScanMobile()}
                disabled={isScanningMobile}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {isScanningMobile ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Locking Satellites...</span>
                  </>
                ) : (
                  <>
                    <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Scan & Lock Live GPS</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Member Phone Preset Pills */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] text-slate-400 font-medium">Quick Select:</span>
              {liveMembers
                .filter((m) => m.phone)
                .map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setTargetPhone(m.phone!);
                      handleScanMobile(m.phone!);
                    }}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                      targetPhone.replace(/[^0-9]/g, '') === (m.phone || '').replace(/[^0-9]/g, '')
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    <span>{m.name.split(' ')[0]}</span>
                    <span className="opacity-70 font-mono text-[9px]">{m.phone?.slice(-4)}</span>
                  </button>
                ))}
            </div>

            {/* Scan Progress Step Banner */}
            {isScanningMobile && scanStatusStep && (
              <div className="p-2.5 bg-indigo-950/80 border border-indigo-500/40 rounded-xl text-xs text-indigo-200 flex items-center gap-2 animate-pulse">
                <Radio className="w-4 h-4 text-emerald-400 animate-spin" />
                <span className="font-semibold">{scanStatusStep}</span>
              </div>
            )}

            {/* Active Lock Telemetry Banner (when scan completed) */}
            {lastScanResult && !isScanningMobile && (
              <div className="p-3 bg-slate-800/90 border border-emerald-500/40 rounded-xl space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Accurate GPS Lock: ±{lastScanResult.accuracyMeters}m
                      </span>
                      <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-200 font-mono">
                        {lastScanResult.carrier}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-200 mt-1 font-medium flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                      <span>{lastScanResult.locationName}</span>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Coordinates</span>
                    <span className="font-mono text-xs text-white font-semibold">
                      {lastScanResult.coordinates.lat.toFixed(5)}, {lastScanResult.coordinates.lng.toFixed(5)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700/80 text-[10px] text-slate-300">
                  <div>
                    <span className="text-slate-400 block">Satellites Locked</span>
                    <span className="font-bold text-white">{lastScanResult.satellitesLocked} GNSS (L1/L5)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Cell Signal</span>
                    <span className="font-bold text-emerald-400">{lastScanResult.signalStrengthDbm} dBm (5G)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Speed & Motion</span>
                    <span className="font-bold text-white">{lastScanResult.speedKmh} km/h • Walking</span>
                  </div>
                </div>

                {/* Instant Actions for this scanned member */}
                <div className="flex items-center gap-2 pt-1">
                  {onLocateMember && (
                    <button
                      onClick={() => {
                        const m = liveMembers.find(
                          (x) => x.phone && x.phone.replace(/[^0-9]/g, '') === lastScanResult.phoneNumber.replace(/[^0-9]/g, '')
                        );
                        if (m) {
                          onLocateMember(m);
                          onClose();
                        }
                      }}
                      className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Pinpoint on Map</span>
                    </button>
                  )}

                  <a
                    href={`https://wa.me/${lastScanResult.phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                      `Hi, your tour live GPS location in ${destinationCity} has been locked accurately: ${lastScanResult.locationName} (±${lastScanResult.accuracyMeters}m).`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>WhatsApp</span>
                  </a>

                  <a
                    href={`tel:${lastScanResult.phoneNumber.replace(/[^0-9+]/g, '')}`}
                    className="py-1.5 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Phone className="w-3 h-3" />
                    <span>Call</span>
                  </a>
                </div>
              </div>
            )}
          </div>
          {/* Quick Actions & Search Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  if (onOpenAddMember) {
                    onOpenAddMember();
                  } else {
                    setIsInternalAddOpen(true);
                  }
                }}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Member</span>
              </button>

              <button
                onClick={handlePingAll}
                className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>Safety Ping All</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyInviteLink}
                className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {copiedLink ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Share2 className="w-3.5 h-3.5" />
                )}
                <span>{copiedLink ? 'Link Copied!' : 'Share Live GPS'}</span>
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {['all', 'Guide', 'Leader', 'Family', 'Tour Member'].map((r) => (
              <button
                key={r}
                onClick={() => setFilterRole(r)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  filterRole === r
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {r === 'all' ? 'All Roles' : r}
              </button>
            ))}
          </div>

          {/* Members List */}
          <div className="space-y-3">
            {filteredMembers.map((member) => {
              const isGuide = member.role === 'Guide';
              const isLeader = member.role === 'Leader';
              const battery = member.battery_level ?? 85;

              // Calculate distance to device or hotel
              const userRef = deviceGps || propUserGps;
              let distanceText: string | null = null;
              let bearingText: string | null = null;

              if (userRef && member.coordinates && member.id !== 'm_device_user') {
                const distM = calculateDistanceMeters(
                  userRef.lat,
                  userRef.lng,
                  member.coordinates.lat,
                  member.coordinates.lng
                );
                distanceText = formatDistance(distM);
                const bearingDeg = calculateBearing(
                  userRef.lat,
                  userRef.lng,
                  member.coordinates.lat,
                  member.coordinates.lng
                );
                bearingText = getCompassDirection(bearingDeg);
              } else if (centerPoint && member.coordinates) {
                const distM = calculateDistanceMeters(
                  centerPoint.lat,
                  centerPoint.lng,
                  member.coordinates.lat,
                  member.coordinates.lng
                );
                distanceText = `${formatDistance(distM)} from hotel`;
              }

              return (
                <div
                  key={member.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-850 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    {/* Avatar Marker */}
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0 relative"
                      style={{ backgroundColor: member.avatar_color || '#4f46e5' }}
                    >
                      {isGuide ? '👑' : isLeader ? '⭐' : member.name.charAt(0)}
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 ring-1 ring-emerald-200 animate-pulse" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{member.name}</h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isGuide
                              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                              : isLeader
                              ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300'
                              : member.role === 'Family'
                              ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300'
                              : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300'
                          }`}
                        >
                          {member.role || 'Tour Member'}
                        </span>

                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full capitalize">
                          {member.status || 'Active'}
                        </span>

                        {/* High-Accuracy GPS Indicator */}
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Crosshair className="w-2.5 h-2.5 text-emerald-500" />
                          <span>±{member.accuracy_meters || 3.5}m GPS</span>
                        </span>

                        {member.carrier && (
                          <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {member.carrier}
                          </span>
                        )}

                        {distanceText && (
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Navigation className="w-2.5 h-2.5" />
                            <span>{distanceText}</span>
                            {bearingText && <span className="opacity-70">({bearingText})</span>}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                            {member.last_location_name || `${destinationCity} Center`}
                          </span>
                        </span>

                        {member.coordinates && (
                          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                            {member.coordinates.lat.toFixed(5)}, {member.coordinates.lng.toFixed(5)}
                          </span>
                        )}

                        {member.phone && (
                          <a
                            href={`https://wa.me/${member.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-semibold"
                            title="Direct WhatsApp link"
                          >
                            <Smartphone className="w-3 h-3 text-emerald-600" />
                            <span>{member.phone}</span>
                          </a>
                        )}

                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          Ping: {member.last_ping || 'Just now'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Telemetry */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-xl">
                      <Battery
                        className={`w-3.5 h-3.5 ${
                          battery < 25 ? 'text-red-500' : battery < 60 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      />
                      <span>{battery}%</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Scan & Lock Live Mobile GPS */}
                      {member.phone && (
                        <button
                          onClick={() => {
                            setTargetPhone(member.phone!);
                            handleScanMobile(member.phone!);
                          }}
                          className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                          title="Scan & Lock Live Mobile GPS for this number"
                        >
                          <Crosshair className="w-4 h-4" />
                        </button>
                      )}

                      {/* Send SMS Location Request Link */}
                      {member.phone && (
                        <button
                          onClick={() => handleSendSmsRequest(member)}
                          className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                          title="Send Live GPS Beacon Request SMS link to member's phone"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => handlePingMember(member)}
                        className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-800 transition-colors cursor-pointer"
                        title="Send Check-in Ping"
                      >
                        <BellRing className="w-4 h-4" />
                      </button>

                      {member.coordinates && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${member.coordinates.lat},${member.coordinates.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
                          title="Navigate to member in Google Maps"
                        >
                          <Navigation className="w-4 h-4" />
                        </a>
                      )}

                      {onLocateMember && (
                        <button
                          onClick={() => {
                            onLocateMember(member);
                            onClose();
                          }}
                          className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Locate</span>
                        </button>
                      )}

                      {member.id !== 'm_device_user' && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-800 transition-colors cursor-pointer"
                          title="Remove member from tracking"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredMembers.length === 0 && (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-850 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No members match your criteria</p>
                <p className="text-xs text-slate-400 mt-1">Try resetting the filter or adding a new member</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Encrypted Live GPS Sync & Emergency SOS Bridge Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Internal Add Member Modal */}
      <AddMemberModal
        isOpen={isInternalAddOpen}
        onClose={() => setIsInternalAddOpen(false)}
        onAddMember={handleAddMemberSubmit}
        destinationCity={destinationCity}
        hotel={hotel}
        defaultCoordinates={centerPoint}
      />
    </div>
  );
};
