import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  Navigation,
  Compass,
  Layers,
  Crosshair,
  ExternalLink,
  Users,
  Radio,
  Battery,
  ShieldCheck,
  Sparkles,
  Maximize2,
  Minimize2,
  PhoneCall,
  BellRing,
  CheckCircle2,
  Info,
  ChevronRight,
  Eye,
  EyeOff,
  Locate,
  Route,
  Activity,
  AlertCircle,
  MessageSquare,
  UserPlus,
  AlertTriangle,
  Smartphone,
} from 'lucide-react';
import { ItineraryItem, HotelOption, TripMember, MapsGroundingInsight } from '../types.js';
import { api } from '../services/api.js';
import { AddMemberModal } from './AddMemberModal.js';
import {
  calculateDistanceMeters,
  formatDistance,
  calculateBearing,
  getCompassDirection,
  generateGpsJitter,
} from '../utils/geoUtils.js';

interface InteractiveMapProps {
  items: ItineraryItem[];
  hotel?: HotelOption;
  destinationCity: string;
  selectedItem?: ItineraryItem | null;
  onSelectItem?: (item: ItineraryItem) => void;
  members?: TripMember[];
  onUpdateMembers?: (members: TripMember[]) => void;
  selectedMemberProp?: TripMember | null;
  onSelectMember?: (member: TripMember | null) => void;
}

interface MapStop {
  id: string;
  lat: number;
  lng: number;
  title: string;
  category: string;
  address?: string;
  item?: ItineraryItem;
  hotel?: HotelOption;
}

// Controller to smoothly fit bounds or pan to selected item
function MapViewController({
  center,
  zoom,
  targetPoint,
}: {
  center: { lat: number; lng: number };
  zoom: number;
  targetPoint: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (targetPoint) {
      map.panTo(targetPoint);
      map.setZoom(15);
    }
  }, [map, targetPoint]);

  return null;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  items = [],
  hotel,
  destinationCity,
  selectedItem,
  onSelectItem,
  members: propMembers,
  onUpdateMembers,
  selectedMemberProp,
  onSelectMember,
}) => {
  const apiKey =
    ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string) ||
    (window as any).GOOGLE_MAPS_API_KEY ||
    '';

  // Fallback / default tour members if not provided or empty
  const initialMembers = useMemo<TripMember[]>(() => {
    if (propMembers && propMembers.length > 0) return propMembers;
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
        interests: ['Heritage', 'Local Culture'],
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
        interests: ['Photography', 'Street Food'],
      },
      {
        id: 'm3',
        name: 'Aarav (Family)',
        role: 'Family',
        status: 'at_hotel',
        last_location_name: hotel ? hotel.name : 'Heritage Hotel Lounge',
        coordinates: hotel?.coordinates || { lat: 28.6219, lng: 77.2185 },
        battery_level: 88,
        last_ping: '4 mins ago',
        avatar_color: '#d97706',
        interests: ['Kids Activities'],
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
      },
    ];
  }, [propMembers, destinationCity, hotel]);

  const [tourMembers, setTourMembers] = useState<TripMember[]>(initialMembers);
  const [showMembers, setShowMembers] = useState(true);
  const [selectedMember, setSelectedMember] = useState<TripMember | null>(null);
  const [selectedStop, setSelectedStop] = useState<MapStop | null>(null);
  const [isSimulatingLiveMove, setIsSimulatingLiveMove] = useState(true);
  const [userLiveLocation, setUserLiveLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isTrackingUserGps, setIsTrackingUserGps] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'terrain'>('roadmap');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [trackerTabOpen, setTrackerTabOpen] = useState(true);
  const [pingAlertMessage, setPingAlertMessage] = useState<string | null>(null);
  const [panTarget, setPanTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);

  const handleAddMember = (newMember: TripMember) => {
    const updated = [...tourMembers, newMember];
    setTourMembers(updated);
    onUpdateMembers?.(updated);
    setSelectedMember(newMember);
    setPanTarget(newMember.coordinates);
    setPingAlertMessage(`Added ${newMember.name} to Live GPS Tracker!`);
    setTimeout(() => setPingAlertMessage(null), 3500);
  };

  // Maps Grounding State with Gemini
  const [groundingLoading, setGroundingLoading] = useState(false);
  const [groundingData, setGroundingData] = useState<MapsGroundingInsight | null>(null);
  const [groundingTargetName, setGroundingTargetName] = useState<string | null>(null);

  // Keep tour members updated if prop changes
  useEffect(() => {
    if (propMembers && propMembers.length > 0) {
      setTourMembers(propMembers);
    }
  }, [propMembers]);

  // Combine stops from Itinerary Items and Hotel
  const stops = useMemo<MapStop[]>(() => {
    const list: MapStop[] = [];

    if (hotel?.coordinates && hotel.coordinates.lat && hotel.coordinates.lng) {
      list.push({
        id: 'hotel_stop',
        lat: hotel.coordinates.lat,
        lng: hotel.coordinates.lng,
        title: hotel.name,
        category: 'hotel',
        address: hotel.address,
        hotel,
      });
    }

    items.forEach((it) => {
      if (it.coordinates && it.coordinates.lat && it.coordinates.lng) {
        list.push({
          id: it.id,
          lat: it.coordinates.lat,
          lng: it.coordinates.lng,
          title: it.title,
          category: it.category,
          address: it.location,
          item: it,
        });
      }
    });

    return list;
  }, [items, hotel]);

  // Determine Default Center
  const defaultCenter = useMemo(() => {
    if (stops.length > 0) {
      return { lat: stops[0].lat, lng: stops[0].lng };
    }
    if (tourMembers.length > 0 && tourMembers[0].coordinates) {
      return { lat: tourMembers[0].coordinates.lat, lng: tourMembers[0].coordinates.lng };
    }
    // Fallback coordinates for Delhi
    return { lat: 28.6139, lng: 77.209 };
  }, [stops, tourMembers]);

  // Sync selectedItem from parent with selectedStop
  useEffect(() => {
    if (selectedItem?.coordinates) {
      const match = stops.find((s) => s.id === selectedItem.id);
      if (match) {
        setSelectedStop(match);
        setSelectedMember(null);
        setPanTarget({ lat: match.lat, lng: match.lng });
      }
    }
  }, [selectedItem, stops]);

  // Sync selectedMemberProp from parent (e.g. from GroupMembersModal or SOS modal)
  useEffect(() => {
    if (selectedMemberProp && selectedMemberProp.coordinates) {
      const matched = tourMembers.find((m) => m.id === selectedMemberProp.id) || selectedMemberProp;
      setSelectedMember(matched);
      setSelectedStop(null);
      setPanTarget({ lat: matched.coordinates!.lat, lng: matched.coordinates!.lng });
    }
  }, [selectedMemberProp, tourMembers]);

  // Live Tour Members movement simulation
  useEffect(() => {
    if (!isSimulatingLiveMove) return;

    const interval = setInterval(() => {
      setTourMembers((prev) =>
        prev.map((m) => {
          if (!m.coordinates) return m;
          // Small realistic GPS wander delta (approx 10-30 meters)
          const deltaLat = (Math.random() - 0.5) * 0.0004;
          const deltaLng = (Math.random() - 0.5) * 0.0004;
          const currentBattery = m.battery_level ?? 85;
          const batteryDrop = Math.random() > 0.85 ? Math.max(15, currentBattery - 1) : currentBattery;

          return {
            ...m,
            coordinates: {
              lat: m.coordinates.lat + deltaLat,
              lng: m.coordinates.lng + deltaLng,
            },
            battery_level: batteryDrop,
            last_ping: 'Just now',
          };
        })
      );
    }, 9000);

    return () => clearInterval(interval);
  }, [isSimulatingLiveMove]);

  // Watch user GPS live location
  useEffect(() => {
    if (!isTrackingUserGps) return;
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      setIsTrackingUserGps(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLiveLocation(coords);
      },
      (err) => {
        console.warn('Geolocation error in watchPosition:', err);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isTrackingUserGps]);

  // User manual "Near Me" trigger
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLiveLocation(coords);
        setIsTrackingUserGps(true);
        setPanTarget(coords);
      },
      (err) => {
        alert('Could not retrieve current GPS location: ' + err.message);
      }
    );
  };

  // Ping All Members / Send Safety Check
  const handlePingAllMembers = () => {
    setPingAlertMessage('Broadcasting safety check to all tour members...');
    setTimeout(() => {
      setTourMembers((prev) =>
        prev.map((m) => ({
          ...m,
          status: 'active',
          last_ping: 'Just now',
        }))
      );
      setPingAlertMessage(`All ${tourMembers.length} tour members responded: Safely accounted for!`);
      setTimeout(() => setPingAlertMessage(null), 4500);
    }, 1200);
  };

  // Focus on a tour member
  const handleFocusMember = (member: TripMember) => {
    if (!member.coordinates) return;
    setSelectedMember(member);
    setSelectedStop(null);
    setPanTarget({ lat: member.coordinates.lat, lng: member.coordinates.lng });
  };

  // Fetch Maps Grounding with Gemini
  const handleFetchGrounding = async (placeTitle: string, lat?: number, lng?: number) => {
    try {
      setGroundingLoading(true);
      setGroundingTargetName(placeTitle);
      setGroundingData(null);
      const res = await api.getMapsGrounding(placeTitle, destinationCity, lat, lng);
      setGroundingData(res);
    } catch (err) {
      console.warn('Failed to fetch Maps Grounding:', err);
    } finally {
      setGroundingLoading(false);
    }
  };

  // Category Color Map
  const categoryColors: Record<string, { bg: string; border: string; glyph: string }> = {
    hotel: { bg: '#4f46e5', border: '#3730a3', glyph: '🏨' },
    attraction: { bg: '#059669', border: '#047857', glyph: '🏛️' },
    restaurant: { bg: '#d97706', border: '#b45309', glyph: '🍽️' },
    shopping: { bg: '#db2777', border: '#be185d', glyph: '🛍️' },
    flight: { bg: '#7c3aed', border: '#6d28d9', glyph: '✈️' },
    transport: { bg: '#2563eb', border: '#1d4ed8', glyph: '🚆' },
    activity: { bg: '#0891b2', border: '#0e7490', glyph: '🎯' },
  };

  return (
    <div
      id="smart-interactive-google-map"
      className={`relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-900 flex flex-col transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none h-screen' : 'h-full min-h-[440px]'
      }`}
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
        {/* Destination & Active Stats Pill */}
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-md flex items-center gap-2.5 pointer-events-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white">{destinationCity} Tour Map</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                Google Maps
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span>{stops.length} Itinerary Stops</span>
              <span>&bull;</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{tourMembers.length} Tour Members Live</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Tour Members Toggle */}
          <button
            onClick={() => setShowMembers((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all cursor-pointer ${
              showMembers
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-100 dark:shadow-none'
                : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="Toggle Tour Member Markers"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Members</span>
            <span className="bg-white/20 text-[10px] px-1 rounded-full">{tourMembers.length}</span>
          </button>

          {/* Member Tracker Drawer Toggle */}
          <button
            onClick={() => setTrackerTabOpen((prev) => !prev)}
            className={`p-2 rounded-xl border shadow-md transition-all cursor-pointer ${
              trackerTabOpen
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-100 dark:shadow-none'
                : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="Toggle Tour Member Tracking Panel"
          >
            <Radio className="w-4 h-4" />
          </button>

          {/* Near Me / GPS Button */}
          <button
            onClick={handleLocateMe}
            className={`p-2 rounded-xl border shadow-md transition-all cursor-pointer ${
              isTrackingUserGps
                ? 'bg-blue-600 text-white border-blue-700'
                : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="Locate my position (GPS)"
          >
            <Locate className={`w-4 h-4 ${isTrackingUserGps ? 'animate-pulse' : ''}`} />
          </button>

          {/* Fullscreen Expand Button */}
          <button
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="p-2 rounded-xl bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map View'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Ping Broadcast Alert Banner */}
      {pingAlertMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 text-white px-4 py-2 rounded-xl border border-slate-700 shadow-xl flex items-center gap-2 text-xs font-semibold backdrop-blur animate-in fade-in slide-in-from-top-2">
          <BellRing className="w-4 h-4 text-emerald-400 animate-bounce" />
          <span>{pingAlertMessage}</span>
        </div>
      )}

      {/* Main Google Map Canvas */}
      <div className="w-full h-full flex-1 relative">
        <APIProvider apiKey={apiKey} libraries={['marker']}>
          <Map
            mapId="DEMO_MAP_ID"
            defaultCenter={defaultCenter}
            defaultZoom={13}
            mapTypeId={mapType}
            gestureHandling="greedy"
            disableDefaultUI={false}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            className="w-full h-full min-h-[440px]"
          >
            <MapViewController center={defaultCenter} zoom={13} targetPoint={panTarget} />

            {/* Itinerary Stops Markers */}
            {stops.map((stop, idx) => {
              const categoryConfig = categoryColors[stop.category] || categoryColors.attraction;
              const isSelected = selectedStop?.id === stop.id;

              return (
                <AdvancedMarker
                  key={stop.id}
                  position={{ lat: stop.lat, lng: stop.lng }}
                  title={stop.title}
                  onClick={() => {
                    setSelectedStop(stop);
                    setSelectedMember(null);
                    setPanTarget({ lat: stop.lat, lng: stop.lng });
                    if (stop.item && onSelectItem) {
                      onSelectItem(stop.item);
                    }
                  }}
                >
                  <Pin
                    background={categoryConfig.bg}
                    borderColor={isSelected ? '#ffffff' : categoryConfig.border}
                    glyphColor="#ffffff"
                    scale={isSelected ? 1.25 : 1.0}
                  >
                    <span className="text-[11px] select-none">{categoryConfig.glyph}</span>
                  </Pin>
                </AdvancedMarker>
              );
            })}

            {/* Tour Members Markers */}
            {showMembers &&
              tourMembers.map((member) => {
                if (!member.coordinates) return null;
                const isSelected = selectedMember?.id === member.id;
                const isGuide = member.role === 'Guide';

                return (
                  <AdvancedMarker
                    key={member.id}
                    position={{ lat: member.coordinates.lat, lng: member.coordinates.lng }}
                    title={`${member.name} (${member.role || 'Member'})`}
                    onClick={() => {
                      setSelectedMember(member);
                      setSelectedStop(null);
                      setPanTarget({ lat: member.coordinates!.lat, lng: member.coordinates!.lng });
                    }}
                  >
                    <div className="relative group cursor-pointer flex flex-col items-center">
                      {/* Live Pulsing Beacon Ring */}
                      <span
                        className="absolute -inset-1.5 rounded-full animate-ping opacity-40"
                        style={{ backgroundColor: member.avatar_color || '#4f46e5' }}
                      />

                      {/* GNSS Accuracy Radius Halo */}
                      <span
                        className="absolute -inset-2.5 rounded-full border border-indigo-400/50 bg-indigo-500/10 pointer-events-none"
                        title={`High-Precision GNSS: ±${member.accuracy_meters || 3.5}m`}
                      />

                      {/* Member Marker Badge */}
                      <div
                        className={`relative flex items-center justify-center rounded-full text-white font-bold text-[11px] shadow-lg border-2 transition-transform ${
                          isSelected ? 'scale-125 border-white ring-2 ring-indigo-500' : 'border-white'
                        }`}
                        style={{
                          backgroundColor: member.avatar_color || '#4f46e5',
                          width: isGuide ? 34 : 28,
                          height: isGuide ? 34 : 28,
                        }}
                      >
                        {isGuide ? '👑' : member.name.charAt(0)}
                      </div>

                      {/* Tooltip / Label with Mobile Accuracy */}
                      <div className="mt-1 bg-slate-950/95 text-white text-[10px] font-semibold px-2 py-0.5 rounded-lg shadow-md whitespace-nowrap backdrop-blur border border-indigo-500/40 flex items-center gap-1">
                        <span>{member.name.split(' ')[0]}</span>
                        <span className="text-[9px] text-emerald-400 font-mono font-bold">±{member.accuracy_meters || 3.5}m</span>
                      </div>
                    </div>
                  </AdvancedMarker>
                );
              })}

            {/* User Live GPS Location Marker */}
            {userLiveLocation && (
              <AdvancedMarker position={userLiveLocation} title="You (Current GPS Location)">
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-ping" />
                  <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg" />
                </div>
              </AdvancedMarker>
            )}

            {/* InfoWindow for Itinerary Stop */}
            {selectedStop && (
              <InfoWindow
                position={{ lat: selectedStop.lat, lng: selectedStop.lng }}
                onCloseClick={() => {
                  setSelectedStop(null);
                  setGroundingData(null);
                }}
                maxWidth={320}
              >
                <div className="p-1 space-y-2 text-slate-800">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                        {selectedStop.category}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900 mt-1 leading-tight">{selectedStop.title}</h3>
                      {selectedStop.address && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{selectedStop.address}</p>
                      )}
                    </div>
                  </div>

                  {selectedStop.item && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Timing</span>
                        <span className="font-medium text-slate-700">{selectedStop.item.time}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Cost</span>
                        <span className="font-semibold text-slate-800">
                          {selectedStop.item.category === 'flight' || selectedStop.item.category === 'transport'
                            ? selectedStop.item.cost_estimate === 0
                              ? 'Ticket Included'
                              : `₹${selectedStop.item.cost_estimate.toLocaleString('en-IN')}`
                            : selectedStop.item.cost_estimate === 0
                            ? 'Free Entry'
                            : `₹${selectedStop.item.cost_estimate.toLocaleString('en-IN')}`}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Actions: Navigation & Maps Grounding */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selectedStop.lat},${selectedStop.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-3 rounded-lg text-xs font-semibold shadow-xs transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Directions on Google Maps</span>
                      <ExternalLink className="w-3 h-3 ml-auto opacity-70" />
                    </a>

                    {/* Ground with Google Maps Gemini button */}
                    <button
                      onClick={() => handleFetchGrounding(selectedStop.title, selectedStop.lat, selectedStop.lng)}
                      disabled={groundingLoading}
                      className="w-full flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 py-1.5 px-3 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${groundingLoading ? 'animate-spin' : ''}`} />
                      <span>{groundingLoading ? 'Fetching Grounded Insights...' : 'Live Maps Grounding (Gemini)'}</span>
                    </button>
                  </div>

                  {/* Grounding Insights Display */}
                  {groundingData && groundingTargetName === selectedStop.title && (
                    <div className="mt-2 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-1.5 text-left">
                      <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Google Maps Grounded Info</span>
                      </div>
                      <p className="text-[11px] text-slate-700 leading-relaxed">{groundingData.summary}</p>

                      {/* Google Maps Official Links as Required by Guidelines */}
                      {groundingData.grounding_sources && groundingData.grounding_sources.length > 0 && (
                        <div className="pt-1.5 border-t border-emerald-200/80">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Verified Sources:</span>
                          <div className="flex flex-col gap-1 mt-1">
                            {groundingData.grounding_sources.map((src, i) => (
                              <a
                                key={i}
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-indigo-700 hover:text-indigo-900 underline flex items-center gap-1 font-medium"
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="line-clamp-1">{src.title}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Grounded Review Snippets */}
                      {groundingData.review_snippets && groundingData.review_snippets.length > 0 && (
                        <div className="pt-1 border-t border-emerald-200/80">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Visitor Feedback:</span>
                          <p className="text-[11px] italic text-slate-600 mt-0.5">
                            "{groundingData.review_snippets[0]}"
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </InfoWindow>
            )}

            {/* InfoWindow for Tour Member */}
            {selectedMember && selectedMember.coordinates && (() => {
              const userRef = userLiveLocation || (hotel?.coordinates ? hotel.coordinates : null);
              let distStr: string | null = null;
              let bearingStr: string | null = null;
              let isWander = false;

              if (userRef) {
                const distM = calculateDistanceMeters(
                  userRef.lat,
                  userRef.lng,
                  selectedMember.coordinates.lat,
                  selectedMember.coordinates.lng
                );
                distStr = formatDistance(distM);
                const bearingDeg = calculateBearing(
                  userRef.lat,
                  userRef.lng,
                  selectedMember.coordinates.lat,
                  selectedMember.coordinates.lng
                );
                bearingStr = getCompassDirection(bearingDeg);
                isWander = distM > 600;
              }

              return (
                <InfoWindow
                  position={{ lat: selectedMember.coordinates.lat, lng: selectedMember.coordinates.lng }}
                  onCloseClick={() => {
                    setSelectedMember(null);
                    onSelectMember?.(null);
                  }}
                  maxWidth={300}
                >
                  <div className="p-1.5 space-y-2 text-slate-800">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0"
                        style={{ backgroundColor: selectedMember.avatar_color || '#4f46e5' }}
                      >
                        {selectedMember.role === 'Guide' ? '👑' : selectedMember.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-900 truncate">{selectedMember.name}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600">
                            {selectedMember.role || 'Tour Member'}
                          </span>
                          {isWander && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Wandering
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Live Mobile Number & Carrier Badge */}
                    {selectedMember.phone && (
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 text-[11px] flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="font-semibold text-slate-800">{selectedMember.phone}</span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {selectedMember.carrier || '5G Cellular'}
                        </span>
                      </div>
                    )}

                    {/* High Precision GNSS Telemetry */}
                    <div className="p-2 bg-indigo-50/70 rounded-xl border border-indigo-100 text-[10px] text-indigo-900 space-y-1">
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1 text-emerald-700">
                          <Crosshair className="w-3 h-3 text-emerald-600" />
                          <span>Accuracy: ±{selectedMember.accuracy_meters || 3.5}m</span>
                        </span>
                        <span className="font-mono text-[9px]">{selectedMember.gps_fix_type || 'Dual-Band GNSS'}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[9px]">
                        <span>Satellites: {selectedMember.satellites_locked ?? 14} locked (L1/L5)</span>
                        <span>Signal: {selectedMember.signal_strength_dbm ?? -75} dBm</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs py-1 border-y border-slate-100">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Status</span>
                        <span className="font-semibold capitalize text-emerald-600">
                          {selectedMember.status || 'Active'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Battery</span>
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          <Battery className="w-3.5 h-3.5 text-emerald-600" />
                          {selectedMember.battery_level ?? 90}%
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Location:</span>
                        <span className="font-medium text-slate-800">
                          {selectedMember.last_location_name || 'Exploring destination area'}
                        </span>
                      </div>

                      {distStr && (
                        <div className="text-indigo-600 font-semibold text-[11px] flex items-center gap-1">
                          <Navigation className="w-3 h-3" />
                          <span>{distStr} {bearingStr ? `(${bearingStr})` : ''} from {userLiveLocation ? 'you' : 'hotel'}</span>
                        </div>
                      )}

                      <div className="text-[10px] font-mono text-slate-400">
                        {selectedMember.coordinates.lat.toFixed(5)}, {selectedMember.coordinates.lng.toFixed(5)} &bull; Ping: {selectedMember.last_ping || 'Just now'}
                      </div>
                    </div>

                    {/* Action Buttons: Walking Directions & Direct Communication */}
                    <div className="pt-1.5 space-y-1.5">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedMember.coordinates.lat},${selectedMember.coordinates.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-3 rounded-xl text-xs font-bold shadow-2xs transition-colors"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Walking Directions</span>
                        <ExternalLink className="w-3 h-3 ml-auto opacity-75" />
                      </a>

                      <div className="flex gap-1.5">
                        {selectedMember.phone ? (
                          <a
                            href={`tel:${selectedMember.phone.replace(/[^0-9+]/g, '')}`}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-1.5 rounded-xl flex items-center justify-center gap-1 shadow-2xs"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span>Call</span>
                          </a>
                        ) : null}

                        <a
                          href={`https://wa.me/${(selectedMember.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                            `Hi ${selectedMember.name}, sending a live tour safety check-in from ${destinationCity}. Please verify your GPS position.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold py-1.5 rounded-xl flex items-center justify-center gap-1 transition-colors"
                        >
                          <MessageSquare className="w-3 h-3 text-emerald-600" />
                          <span>WhatsApp</span>
                        </a>

                        <button
                          onClick={() => handlePingAllMembers()}
                          className="px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-1.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          title="Send Check-in Ping"
                        >
                          <BellRing className="w-3 h-3 text-slate-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                </InfoWindow>
              );
            })()}
          </Map>
        </APIProvider>
      </div>

      {/* Tour Member Tracking Drawer / Floating Panel */}
      {trackerTabOpen && (
        <div className="absolute bottom-3 right-3 left-3 sm:left-auto sm:w-88 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl p-3.5 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-3 max-h-[340px] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Live Group GPS Tracker</h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{tourMembers.length} members connected &bull; 10m telemetry</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsAddMemberModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Add Group Member for Live Tracking"
              >
                <UserPlus className="w-3 h-3" />
                <span>+ Member</span>
              </button>

              {/* Broadcast Check-in Ping */}
              <button
                onClick={handlePingAllMembers}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Send Safety Check Ping to All"
              >
                <BellRing className="w-3 h-3" />
                <span>Ping All</span>
              </button>
              <button
                onClick={() => setTrackerTabOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 text-xs"
              >
                &times;
              </button>
            </div>
          </div>

          {/* Member List Scrollable */}
          <div className="space-y-2 overflow-y-auto max-h-[170px] pr-1">
            {tourMembers.map((member) => {
              const isSelected = selectedMember?.id === member.id;
              const isGuide = member.role === 'Guide';
              const userRef = userLiveLocation || (hotel?.coordinates ? hotel.coordinates : null);
              let distanceStr: string | null = null;
              let isWandering = false;

              if (userRef && member.coordinates) {
                const distM = calculateDistanceMeters(
                  userRef.lat,
                  userRef.lng,
                  member.coordinates.lat,
                  member.coordinates.lng
                );
                distanceStr = formatDistance(distM);
                isWandering = distM > 600;
              }

              return (
                <div
                  key={member.id}
                  onClick={() => {
                    handleFocusMember(member);
                    onSelectMember?.(member);
                  }}
                  className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 dark:border-indigo-500 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                      style={{ backgroundColor: member.avatar_color || '#4f46e5' }}
                    >
                      {isGuide ? '👑' : member.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{member.name}</span>
                        {isGuide && (
                          <span className="text-[9px] bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold px-1 py-0.2 rounded">
                            Guide
                          </span>
                        )}
                        <span className="text-[8px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-1 py-0.2 rounded font-bold">
                          ±{member.accuracy_meters || 3.5}m
                        </span>
                        {isWandering && (
                          <span className="text-[8px] bg-amber-100 text-amber-800 font-bold px-1 rounded">
                            &gt;600m
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        <span className="truncate">{member.last_location_name || 'En route'}</span>
                        {member.phone && (
                          <span className="font-mono text-[9px] text-slate-400">
                            &bull; {member.phone.slice(-4)}
                          </span>
                        )}
                        {distanceStr && (
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            &bull; {distanceStr}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                        <Battery className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{member.battery_level ?? 92}%</span>
                      </div>
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium block">
                        {member.status || 'Active'}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFocusMember(member);
                        onSelectMember?.(member);
                      }}
                      className="p-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
                      title="Locate on map"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Simulation Toggle / Status footer */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Tour Safety Sync Active</span>
            </span>
            <button
              onClick={() => setIsSimulatingLiveMove((prev) => !prev)}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium cursor-pointer"
            >
              {isSimulatingLiveMove ? 'Pause Live Wander' : 'Resume Live Wander'}
            </button>
          </div>
        </div>
      )}

      {/* Bottom Map Legend & Map Type Selector */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-none flex flex-wrap items-center gap-1.5">
        {/* Layer Selector */}
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur px-2 py-1 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-md flex items-center gap-1 pointer-events-auto">
          <button
            onClick={() => setMapType('roadmap')}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
              mapType === 'roadmap'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Map
          </button>
          <button
            onClick={() => setMapType('satellite')}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
              mapType === 'satellite'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Satellite
          </button>
          <button
            onClick={() => setMapType('terrain')}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
              mapType === 'terrain'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Terrain
          </button>
        </div>

        {/* Legend Pills */}
        <div className="hidden md:flex items-center gap-1.5 pointer-events-auto">
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600" /> Attraction
          </div>
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-indigo-600" /> Hotel
          </div>
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-amber-600" /> Dining
          </div>
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-pink-600" /> Shopping
          </div>
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" /> Member
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        onAddMember={handleAddMember}
        destinationCity={destinationCity}
        hotel={hotel}
        defaultCoordinates={selectedItem?.coordinates || hotel?.coordinates}
      />
    </div>
  );
};
