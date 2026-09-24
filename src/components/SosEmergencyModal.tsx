import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Phone,
  PhoneCall,
  MapPin,
  Compass,
  Copy,
  Check,
  ShieldAlert,
  AlertTriangle,
  Share2,
  ExternalLink,
  Navigation,
  Crosshair,
  Building2,
  Shield,
  LifeBuoy,
  HeartPulse,
  Radio,
  Clock,
  Send,
  Volume2,
  VolumeX,
  Flame,
  Users,
  AlertCircle,
  RotateCw,
  Eye,
  Activity,
  FileWarning,
  Battery,
  ShieldCheck,
  Locate,
  Radar,
  BellRing,
} from 'lucide-react';
import { Trip, DisruptionAlert } from '../types.js';
import {
  calculateDistanceMeters,
  formatDistance,
  calculateBearing,
  getCompassDirection,
} from '../utils/geoUtils.js';

interface SosEmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  destination: string;
  currentTrip?: Trip | null;
  onLogEmergencyAlert?: (alert: DisruptionAlert) => void;
}

interface EmergencyContact {
  id: string;
  name: string;
  number: string;
  category: 'national' | 'police' | 'medical' | 'fire' | 'tourist' | 'hospital' | 'women';
  description: string;
  hours: string;
  isPrimary?: boolean;
}

interface DestinationGpsInfo {
  city: string;
  country: string;
  lat: number;
  lng: number;
  dms: string;
  zoneName: string;
  nearestLandmark: string;
  nearestPolice: string;
  contacts: EmergencyContact[];
}

// Comprehensive emergency database tailored to travel hubs across India and international favorites
const DESTINATION_EMERGENCY_DATA: Record<string, DestinationGpsInfo> = {
  Delhi: {
    city: 'Delhi',
    country: 'India',
    lat: 28.6139,
    lng: 77.209,
    dms: `28° 36' 50.0" N, 77° 12' 32.4" E`,
    zoneName: 'Central Secretariat / Connaught Place District, New Delhi',
    nearestLandmark: 'India Gate & National War Memorial (1.2 km)',
    nearestPolice: 'Parliament Street Police Station / Connaught Place Tourist Police Booth',
    contacts: [
      {
        id: 'del_112',
        name: 'National Emergency All-in-One (ERSS)',
        number: '112',
        category: 'national',
        description: 'Unified 24/7 response for Police, Fire, Ambulance & Disaster Management',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'del_police',
        name: 'Delhi Police Control Room',
        number: '100',
        category: 'police',
        description: 'Direct PCR van dispatch and city-wide law enforcement assistance',
        hours: '24/7 Available',
      },
      {
        id: 'del_ambulance',
        name: 'Delhi Emergency Medical Ambulance',
        number: '102',
        category: 'medical',
        description: 'CATS Ambulance (Central Ambulance Trauma Services) network',
        hours: '24/7 Toll-free',
      },
      {
        id: 'del_tourist',
        name: 'Incredible India Tourist Helpline',
        number: '1363',
        category: 'tourist',
        description: 'Ministry of Tourism 24/7 multi-lingual guidance (English, Hindi & 10 foreign languages)',
        hours: '24/7 Toll-free',
        isPrimary: true,
      },
      {
        id: 'del_women',
        name: "Women's Safety Helpline",
        number: '1091',
        category: 'women',
        description: 'Dedicated anti-harassment and rapid response team for women and families',
        hours: '24/7 Immediate Response',
      },
      {
        id: 'del_fire',
        name: 'Delhi Fire Service',
        number: '101',
        category: 'fire',
        description: 'Fire hazard suppression and emergency structural rescue',
        hours: '24/7 Immediate Dispatch',
      },
      {
        id: 'del_aiims',
        name: 'AIIMS Apex Trauma Centre',
        number: '+91 11 2658 8500',
        category: 'hospital',
        description: 'Premier level-1 multi-speciality trauma center (Ring Road, Ansari Nagar)',
        hours: '24/7 Emergency Casualty',
      },
      {
        id: 'del_safdarjung',
        name: 'Safdarjung Hospital Emergency',
        number: '+91 11 2616 5060',
        category: 'hospital',
        description: 'Major central government multi-speciality hospital and casualty ward',
        hours: '24/7 Casualty',
      },
      {
        id: 'del_tourist_police',
        name: 'Delhi Tourist Police Assistance Cell',
        number: '+91 11 2337 0927',
        category: 'tourist',
        description: 'Specialized personnel assisting foreign and domestic visitors with transit, scams, or lost documents',
        hours: '8:00 AM - 10:00 PM',
      },
    ],
  },
  Chennai: {
    city: 'Chennai',
    country: 'India',
    lat: 13.0827,
    lng: 80.2707,
    dms: `13° 04' 57.7" N, 80° 16' 14.5" E`,
    zoneName: 'Central District / Ripon Building Precinct, Chennai, Tamil Nadu',
    nearestLandmark: 'Chennai Central Railway Hub & Marina Promenade (1.5 km)',
    nearestPolice: 'Periamet Police Station & Marina Tourist Police Patrol Unit',
    contacts: [
      {
        id: 'che_112',
        name: 'National Emergency Response (ERSS)',
        number: '112',
        category: 'national',
        description: 'Unified 24/7 emergency dispatch for Police, Fire, Ambulance',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'che_police',
        name: 'Greater Chennai Police Control Room',
        number: '100',
        category: 'police',
        description: 'Direct response patrol for metropolitan Chennai and tourist corridors',
        hours: '24/7 Available',
      },
      {
        id: 'che_ambulance',
        name: 'Tamil Nadu 108 Emergency Ambulance',
        number: '108',
        category: 'medical',
        description: 'State-wide GVK EMRI life support ambulance transit network',
        hours: '24/7 Toll-free',
        isPrimary: true,
      },
      {
        id: 'che_tourist',
        name: 'Tamil Nadu Tourism Helpline',
        number: '1363',
        category: 'tourist',
        description: '24/7 Tourist support and helpline for domestic & overseas travellers',
        hours: '24/7 Toll-free',
      },
      {
        id: 'che_women',
        name: "Tamil Nadu Women's Safety Wing",
        number: '1091',
        category: 'women',
        description: 'All-women emergency helpline and patrol rapid response',
        hours: '24/7 Toll-free',
      },
      {
        id: 'che_apollo',
        name: 'Apollo Hospitals Emergency & Trauma (Greams Rd)',
        number: '+91 44 2829 0200',
        category: 'hospital',
        description: 'Internationally accredited emergency and critical care center',
        hours: '24/7 Emergency Casualty',
      },
      {
        id: 'che_rggh',
        name: 'Rajiv Gandhi Govt General Hospital Trauma',
        number: '+91 44 2530 5000',
        category: 'hospital',
        description: 'Premier state tertiary trauma center opposite Chennai Central',
        hours: '24/7 Casualty',
      },
      {
        id: 'che_coastguard',
        name: 'Indian Coast Guard SAR (East Coast)',
        number: '1554',
        category: 'national',
        description: 'Maritime search and coastal rescue along Chennai coastal waters',
        hours: '24/7 Distress Frequency',
      },
    ],
  },
  Mumbai: {
    city: 'Mumbai',
    country: 'India',
    lat: 18.922,
    lng: 72.8347,
    dms: `18° 55' 19.2" N, 72° 50' 04.9" E`,
    zoneName: 'Colaba / Gateway of India Tourist Waterfront, South Mumbai',
    nearestLandmark: 'Gateway of India & Taj Mahal Palace Hotel (250 m)',
    nearestPolice: 'Colaba Police Station & Mumbai Coastal Security Police Beat',
    contacts: [
      {
        id: 'bom_112',
        name: 'National Emergency Response (ERSS)',
        number: '112',
        category: 'national',
        description: 'Unified Mumbai control room dispatch for Police, Fire, Ambulance',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'bom_police',
        name: 'Mumbai City Police Control Room',
        number: '100',
        category: 'police',
        description: 'Metropolitan Mumbai police dispatch and Quick Response Team (QRT)',
        hours: '24/7 Available',
      },
      {
        id: 'bom_ambulance',
        name: 'Maharashtra 108 Emergency Medical Service',
        number: '108',
        category: 'medical',
        description: 'MEMS 108 Advanced and Basic Life Support fleet across Mumbai',
        hours: '24/7 Toll-free',
        isPrimary: true,
      },
      {
        id: 'bom_tourist',
        name: 'Incredible India & MTDC Tourism Helpline',
        number: '1363',
        category: 'tourist',
        description: 'Multi-lingual tourist helpline and guidance support',
        hours: '24/7 Toll-free',
      },
      {
        id: 'bom_women',
        name: "Mumbai Police Women's Cell",
        number: '103',
        category: 'women',
        description: 'Dedicated women & child safety helpline across Mumbai metropolitan area',
        hours: '24/7 Response',
      },
      {
        id: 'bom_kavach',
        name: 'Bombay Hospital & Medical Research Centre Trauma',
        number: '+91 22 2206 7676',
        category: 'hospital',
        description: 'Apex trauma and cardiology emergency near Marine Lines',
        hours: '24/7 Emergency Casualty',
      },
      {
        id: 'bom_khed',
        name: 'KEM Hospital & Seth GS Medical College',
        number: '+91 22 2410 7000',
        category: 'hospital',
        description: 'Premier civic tertiary trauma center in Central Mumbai (Parel)',
        hours: '24/7 Casualty',
      },
    ],
  },
  Jaipur: {
    city: 'Jaipur',
    country: 'India',
    lat: 26.9124,
    lng: 75.7873,
    dms: `26° 54' 44.6" N, 75° 47' 14.3" E`,
    zoneName: 'Walled Pink City / Hawa Mahal Heritage Precinct, Jaipur, Rajasthan',
    nearestLandmark: 'Hawa Mahal Palace & City Palace Complex (400 m)',
    nearestPolice: 'Manak Chowk Police Station & Tourist Assistance Force (TAF) Chowki',
    contacts: [
      {
        id: 'jai_112',
        name: 'Rajasthan Emergency Response (ERSS)',
        number: '112',
        category: 'national',
        description: 'Unified 24/7 emergency dispatch for Police, Fire, Ambulance',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'jai_taf',
        name: 'Rajasthan Tourist Assistance Force (TAF)',
        number: '+91 141 282 2863',
        category: 'tourist',
        description: 'Dedicated tourist police unit stationed across heritage monuments',
        hours: '24/7 Active',
        isPrimary: true,
      },
      {
        id: 'jai_ambulance',
        name: 'Rajasthan 108 Emergency Ambulance',
        number: '108',
        category: 'medical',
        description: 'State-wide GVK EMRI life support ambulance transit network',
        hours: '24/7 Toll-free',
      },
      {
        id: 'jai_sms_hospital',
        name: 'Sawai Man Singh (SMS) Govt Hospital Trauma Centre',
        number: '+91 141 256 0291',
        category: 'hospital',
        description: 'Largest tertiary care government hospital and level-1 trauma wing in Rajasthan',
        hours: '24/7 Casualty',
      },
      {
        id: 'jai_fortis',
        name: 'Fortis Escorts Hospital Emergency (JLN Marg)',
        number: '+91 141 254 7000',
        category: 'hospital',
        description: 'Leading multi-speciality tertiary care and cardiology center',
        hours: '24/7 Emergency Casualty',
      },
    ],
  },
  Bengaluru: {
    city: 'Bengaluru',
    country: 'India',
    lat: 12.9716,
    lng: 77.5946,
    dms: `12° 58' 17.8" N, 77° 35' 40.6" E`,
    zoneName: 'MG Road / Cubbon Park Central Business District, Bengaluru, Karnataka',
    nearestLandmark: 'Vidhana Soudha & Cubbon Park (800 m)',
    nearestPolice: 'Cubbon Park Police Station & Ashok Nagar Law & Order Division',
    contacts: [
      {
        id: 'blr_112',
        name: 'Karnataka Emergency Response (ERSS)',
        number: '112',
        category: 'national',
        description: 'Unified command and control center for Police, Fire, Ambulance',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'blr_police',
        name: 'Bengaluru City Police Namma 112',
        number: '112',
        category: 'police',
        description: 'Namma 112 city hoysala patrol response within 10 minutes',
        hours: '24/7 Available',
      },
      {
        id: 'blr_ambulance',
        name: 'Arogya Kavacha 108 Ambulance',
        number: '108',
        category: 'medical',
        description: 'Free statewide emergency medical and trauma transit service',
        hours: '24/7 Toll-free',
        isPrimary: true,
      },
      {
        id: 'blr_tourist',
        name: 'Karnataka Tourism Information Helpline',
        number: '1363',
        category: 'tourist',
        description: 'KSTDC visitor assistance, transit information, and safety helpline',
        hours: '24/7 Toll-free',
      },
      {
        id: 'blr_manipal',
        name: 'Manipal Hospital Emergency (Old Airport Rd)',
        number: '+91 80 2502 4444',
        category: 'hospital',
        description: 'Comprehensive tertiary trauma and emergency medicine department',
        hours: '24/7 Emergency Casualty',
      },
      {
        id: 'blr_nimhans',
        name: 'NIMHANS Emergency Care & Trauma',
        number: '+91 80 2699 5000',
        category: 'hospital',
        description: 'Apex neurological and emergency trauma care institute',
        hours: '24/7 Casualty',
      },
    ],
  },
  Goa: {
    city: 'Goa',
    country: 'India',
    lat: 15.2993,
    lng: 73.985,
    dms: `15° 17' 57.5" N, 73° 59' 06.0" E`,
    zoneName: 'North & South Goa Coastal Tourism Corridor, Goa',
    nearestLandmark: 'Calangute / Baga Coastal Beach Promenade (1 km)',
    nearestPolice: 'Calangute Police Station & Goa Tourist Police Unit Panaji',
    contacts: [
      {
        id: 'goa_112',
        name: 'Goa Emergency Services (ERSS)',
        number: '112',
        category: 'national',
        description: 'Unified Goa emergency command for Police, Fire, Ambulance',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'goa_tourist',
        name: 'Goa Tourist Police Cell Panaji',
        number: '+91 832 242 7083',
        category: 'tourist',
        description: 'Dedicated tourism security force safeguarding visitors across beaches and night spots',
        hours: '24/7 Active',
        isPrimary: true,
      },
      {
        id: 'goa_ambulance',
        name: 'Goa 108 Emergency Ambulance',
        number: '108',
        category: 'medical',
        description: 'Rapid life-support transit across North and South Goa districts',
        hours: '24/7 Toll-free',
      },
      {
        id: 'goa_gmc',
        name: 'Goa Medical College (GMC) Hospital Bambolim',
        number: '+91 832 245 8700',
        category: 'hospital',
        description: 'Premier state tertiary trauma center with 24/7 casualty wing',
        hours: '24/7 Casualty',
      },
      {
        id: 'goa_lifeguards',
        name: 'Drishti Marine Beach Lifeguard Emergency',
        number: '+91 832 240 1000',
        category: 'national',
        description: 'Water rescue and ocean rip-current emergency across all designated beaches',
        hours: 'Sunrise to Sunset',
      },
    ],
  },
  Agra: {
    city: 'Agra',
    country: 'India',
    lat: 27.1751,
    lng: 78.0421,
    dms: `27° 10' 30.4" N, 78° 02' 31.6" E`,
    zoneName: 'Tajganj Heritage District, Agra, Uttar Pradesh',
    nearestLandmark: 'Taj Mahal East Gate & Agra Fort (800 m)',
    nearestPolice: 'Tajganj Tourist Police Station & UP 112 Dial',
    contacts: [
      {
        id: 'agr_112',
        name: 'UP 112 Integrated Emergency (ERSS)',
        number: '112',
        category: 'national',
        description: 'Rapid PCR van response across Agra tourist sectors',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'agr_tourist',
        name: 'Agra Tourist Police Station Tajganj',
        number: '+91 562 222 6428',
        category: 'tourist',
        description: 'Specialized police booth assisting visitors with guides, ticketing, and scams',
        hours: '24/7 Active',
        isPrimary: true,
      },
      {
        id: 'agr_ambulance',
        name: 'UP 108 Emergency Ambulance',
        number: '108',
        category: 'medical',
        description: 'Emergency trauma ambulance dispatch',
        hours: '24/7 Toll-free',
      },
      {
        id: 'agr_snmc',
        name: 'S.N. Medical College & Hospital Trauma',
        number: '+91 562 226 0353',
        category: 'hospital',
        description: 'Major government tertiary emergency trauma and casualty unit',
        hours: '24/7 Casualty',
      },
    ],
  },
  Varanasi: {
    city: 'Varanasi',
    country: 'India',
    lat: 25.3176,
    lng: 82.9739,
    dms: `25° 19' 03.4" N, 82° 58' 26.0" E`,
    zoneName: 'Dashashwamedh Ghat & Kashi Vishwanath Corridor, Varanasi, UP',
    nearestLandmark: 'Dashashwamedh Ghat & Kashi Vishwanath Temple (300 m)',
    nearestPolice: 'Dashashwamedh Police Station & River Police Unit',
    contacts: [
      {
        id: 'vns_112',
        name: 'UP 112 Emergency Services',
        number: '112',
        category: 'national',
        description: 'Unified emergency dispatch for Police, Fire, Ambulance',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'vns_tourist',
        name: 'Varanasi Tourist Police Chowki',
        number: '+91 542 250 8461',
        category: 'tourist',
        description: 'Dedicated ghats and pilgrim security cell',
        hours: '24/7 Active',
        isPrimary: true,
      },
      {
        id: 'vns_bhu',
        name: 'BHU Sir Sunderlal Hospital Trauma Centre',
        number: '+91 542 236 9381',
        category: 'hospital',
        description: 'Premier level-1 multi-speciality university trauma institute',
        hours: '24/7 Casualty',
      },
    ],
  },
  Kolkata: {
    city: 'Kolkata',
    country: 'India',
    lat: 22.5726,
    lng: 88.3639,
    dms: `22° 34' 21.4" N, 88° 21' 50.0" E`,
    zoneName: 'Park Street / Victoria Memorial Heritage Hub, Kolkata, West Bengal',
    nearestLandmark: 'Victoria Memorial Hall & Park Street (1 km)',
    nearestPolice: 'Park Street Police Station & Lalbazar Central Police Control',
    contacts: [
      {
        id: 'kol_112',
        name: 'National Emergency Response (ERSS)',
        number: '112',
        category: 'national',
        description: 'Unified emergency dispatch for Police, Fire, Ambulance',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'kol_police',
        name: 'Kolkata Police Lalbazar Control Room',
        number: '100',
        category: 'police',
        description: 'Metropolitan Kolkata direct police response',
        hours: '24/7 Available',
      },
      {
        id: 'kol_sskm',
        name: 'SSKM Govt Hospital & Apex Trauma Centre',
        number: '+91 33 2223 1589',
        category: 'hospital',
        description: 'Premier level-1 multi-speciality state trauma center',
        hours: '24/7 Casualty',
      },
      {
        id: 'kol_tourist',
        name: 'West Bengal Tourism Tourist Helpline',
        number: '1363',
        category: 'tourist',
        description: 'Tourist helpline and visitor safety guidance',
        hours: '24/7 Toll-free',
      },
    ],
  },
  Hyderabad: {
    city: 'Hyderabad',
    country: 'India',
    lat: 17.385,
    lng: 78.4867,
    dms: `17° 23' 06.0" N, 78° 29' 12.1" E`,
    zoneName: 'Charminar Heritage & Banjara Hills Hub, Hyderabad, Telangana',
    nearestLandmark: 'Charminar & Salar Jung Museum (700 m)',
    nearestPolice: 'Charminar Police Station & Telangana Tourist Police Cell',
    contacts: [
      {
        id: 'hyd_112',
        name: 'Telangana Emergency Response (ERSS)',
        number: '112',
        category: 'national',
        description: 'Unified command and control center for Police, Fire, Ambulance',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'hyd_ambulance',
        name: 'Telangana 108 Emergency Ambulance',
        number: '108',
        category: 'medical',
        description: 'GVK EMRI state-wide emergency life support network',
        hours: '24/7 Toll-free',
        isPrimary: true,
      },
      {
        id: 'hyd_osmania',
        name: 'Osmania General Hospital Trauma Unit',
        number: '+91 40 2460 0121',
        category: 'hospital',
        description: 'Tertiary government casualty and emergency surgical wing',
        hours: '24/7 Casualty',
      },
      {
        id: 'hyd_tourist',
        name: 'Telangana Tourism Helpline',
        number: '1363',
        category: 'tourist',
        description: 'State tourism and visitor assistance desk',
        hours: '24/7 Toll-free',
      },
    ],
  },
  Kochi: {
    city: 'Kochi',
    country: 'India',
    lat: 9.9312,
    lng: 76.2673,
    dms: `09° 55' 52.3" N, 76° 16' 02.3" E`,
    zoneName: 'Fort Kochi / Mattancherry Heritage Sector, Kochi, Kerala',
    nearestLandmark: 'Chinese Fishing Nets & St. Francis Church (400 m)',
    nearestPolice: 'Fort Kochi Police Station & Coastal Police Station',
    contacts: [
      {
        id: 'koc_112',
        name: 'Kerala Emergency Response (ERSS)',
        number: '112',
        category: 'national',
        description: 'Unified command center for Police, Fire, Ambulance',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'koc_tourist',
        name: 'Kerala Tourist Police Fort Kochi',
        number: '+91 484 222 6555',
        category: 'tourist',
        description: 'Specialized tourist police station stationed directly on Fort Kochi beach',
        hours: '24/7 Active',
        isPrimary: true,
      },
      {
        id: 'koc_hospital',
        name: 'Ernakulam Govt General Hospital Trauma',
        number: '+91 484 236 1251',
        category: 'hospital',
        description: 'Major district casualty and tertiary trauma unit',
        hours: '24/7 Casualty',
      },
    ],
  },
  Bangkok: {
    city: 'Bangkok',
    country: 'Thailand',
    lat: 13.7563,
    lng: 100.5018,
    dms: `13° 45' 22.7" N, 100° 30' 06.5" E`,
    zoneName: 'Rattanakosin / Sukhumvit Tourist District, Bangkok, Thailand',
    nearestLandmark: 'Grand Palace & Wat Phra Kaew (800 m)',
    nearestPolice: 'Royal Thai Police & Tourist Police Bureau HQ',
    contacts: [
      {
        id: 'bkk_1155',
        name: 'Thailand Tourist Police (Multi-lingual)',
        number: '1155',
        category: 'tourist',
        description: 'Dedicated English-speaking tourist police dispatch across Thailand',
        hours: '24/7 Toll-free',
        isPrimary: true,
      },
      {
        id: 'bkk_191',
        name: 'General Police Emergency',
        number: '191',
        category: 'police',
        description: 'Metropolitan Bangkok police emergency dispatch',
        hours: '24/7 Dispatch',
      },
      {
        id: 'bkk_1669',
        name: 'Medical Emergency & Ambulance',
        number: '1669',
        category: 'medical',
        description: 'National Institute for Emergency Medicine Thailand',
        hours: '24/7 Toll-free',
        isPrimary: true,
      },
      {
        id: 'bkk_hospital',
        name: 'Bangkok Hospital Trauma & Emergency',
        number: '+66 2 310 3000',
        category: 'hospital',
        description: 'Leading international JCI-accredited emergency center',
        hours: '24/7 Emergency Casualty',
      },
    ],
  },
  Dubai: {
    city: 'Dubai',
    country: 'United Arab Emirates',
    lat: 25.1972,
    lng: 55.2744,
    dms: `25° 11' 49.9" N, 55° 16' 27.8" E`,
    zoneName: 'Downtown Dubai / Burj Khalifa Precinct, Dubai, UAE',
    nearestLandmark: 'Burj Khalifa & Dubai Mall (300 m)',
    nearestPolice: 'Dubai Police Smart Police Station (SPS) Downtown',
    contacts: [
      {
        id: 'dxb_999',
        name: 'Dubai Police General Emergency',
        number: '999',
        category: 'police',
        description: 'Fastest law enforcement dispatch across Dubai',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'dxb_998',
        name: 'Dubai Ambulance Emergency (DCAS)',
        number: '998',
        category: 'medical',
        description: 'Dubai Corporation for Ambulance Services',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'dxb_tourist',
        name: 'Dubai Tourist Police Helpline',
        number: '+971 800 2626',
        category: 'tourist',
        description: 'Tourism security department toll-free assistance line',
        hours: '24/7 Toll-free',
      },
      {
        id: 'dxb_rashid',
        name: 'Rashid Hospital Level-1 Trauma Centre',
        number: '+971 4 219 2000',
        category: 'hospital',
        description: 'Premier specialized public trauma and disaster hospital',
        hours: '24/7 Casualty',
      },
    ],
  },
  Singapore: {
    city: 'Singapore',
    country: 'Singapore',
    lat: 1.2863,
    lng: 103.854,
    dms: `01° 17' 10.7" N, 103° 51' 14.4" E`,
    zoneName: 'Marina Bay / Downtown Core, Singapore',
    nearestLandmark: 'Marina Bay Sands & Gardens by the Bay (500 m)',
    nearestPolice: 'Marina Bay Neighbourhood Police Centre',
    contacts: [
      {
        id: 'sg_999',
        name: 'Singapore Police Force Emergency',
        number: '999',
        category: 'police',
        description: 'Emergency police response across Singapore',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'sg_995',
        name: 'SCDF Emergency Ambulance & Fire',
        number: '995',
        category: 'medical',
        description: 'Singapore Civil Defence Force emergency medical dispatch',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'sg_sgh',
        name: 'Singapore General Hospital (SGH) A&E',
        number: '+65 6222 3322',
        category: 'hospital',
        description: 'Largest tertiary emergency care hospital in Singapore',
        hours: '24/7 Casualty',
      },
      {
        id: 'sg_tourist',
        name: 'Singapore Tourist Line',
        number: '1800 736 2000',
        category: 'tourist',
        description: 'Singapore Tourism Board 24/7 visitor assistance',
        hours: '24/7 Toll-free',
      },
    ],
  },
  London: {
    city: 'London',
    country: 'United Kingdom',
    lat: 51.5074,
    lng: -0.1278,
    dms: `51° 30' 26.6" N, 00° 07' 40.1" W`,
    zoneName: 'City of Westminster / West End, London, UK',
    nearestLandmark: 'Trafalgar Square & Houses of Parliament (500 m)',
    nearestPolice: 'Charing Cross Police Station',
    contacts: [
      {
        id: 'lon_999',
        name: 'UK Emergency Services (Police / Fire / Ambulance)',
        number: '999',
        category: 'national',
        description: 'Primary UK emergency services dispatch',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'lon_112',
        name: 'European Emergency Number',
        number: '112',
        category: 'national',
        description: 'Alternative unified emergency dispatch',
        hours: '24/7 Dispatch',
      },
      {
        id: 'lon_111',
        name: 'NHS Urgent Non-Emergency Medical Helpline',
        number: '111',
        category: 'medical',
        description: 'National Health Service clinical triage and medical advice',
        hours: '24/7 Toll-free',
      },
      {
        id: 'lon_stthomas',
        name: "St Thomas' Hospital A&E (Westminster)",
        number: '+44 20 7188 7188',
        category: 'hospital',
        description: 'Major central London emergency department opposite Parliament',
        hours: '24/7 Emergency Casualty',
      },
    ],
  },
  Paris: {
    city: 'Paris',
    country: 'France',
    lat: 48.8566,
    lng: 2.3522,
    dms: `48° 51' 23.8" N, 02° 21' 07.9" E`,
    zoneName: '1st Arrondissement / Louvre Precinct, Paris, France',
    nearestLandmark: 'Louvre Museum & Seine Riverbank (400 m)',
    nearestPolice: 'Commissariat Central de Paris Centre',
    contacts: [
      {
        id: 'par_112',
        name: 'European Unified Emergency Number',
        number: '112',
        category: 'national',
        description: 'Multi-lingual emergency response for Police, Fire, Ambulance',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'par_15',
        name: 'SAMU Medical Emergency & Ambulance',
        number: '15',
        category: 'medical',
        description: 'Service d’Aide Médicale Urgente doctor-guided emergency dispatch',
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'par_17',
        name: 'Police Nationale Secours',
        number: '17',
        category: 'police',
        description: 'French national police emergency line',
        hours: '24/7 Dispatch',
      },
      {
        id: 'par_hotel_dieu',
        name: 'Hôpital Hôtel-Dieu A&E (Île de la Cité)',
        number: '+33 1 42 34 82 34',
        category: 'hospital',
        description: 'Historic central Paris emergency hospital next to Notre-Dame',
        hours: '24/7 Casualty',
      },
    ],
  },
};

// Dynamic fallback resolver for any other unlisted city or global territory
function resolveEmergencyData(destinationStr: string, currentTrip?: Trip | null): DestinationGpsInfo {
  const cleanDest = (destinationStr || '').trim().toLowerCase();

  // Try exact or substring matches in pre-populated destinations
  const matchedKey = Object.keys(DESTINATION_EMERGENCY_DATA).find(
    (k) =>
      k.toLowerCase() === cleanDest ||
      cleanDest.includes(k.toLowerCase()) ||
      k.toLowerCase().includes(cleanDest) ||
      (currentTrip?.destinations || []).some((d) => d.toLowerCase().includes(k.toLowerCase()))
  );

  if (matchedKey) {
    return DESTINATION_EMERGENCY_DATA[matchedKey];
  }

  // Fallback: derive dynamically from current trip metadata or country standards
  const displayName = destinationStr ? destinationStr.trim() : 'Destination Hub';

  // Check if international by common country keywords
  const isUS = cleanDest.includes('usa') || cleanDest.includes('york') || cleanDest.includes('california') || cleanDest.includes('states');
  const isUK = cleanDest.includes('london') || cleanDest.includes('uk') || cleanDest.includes('britain') || cleanDest.includes('scotland');
  const isAus = cleanDest.includes('australia') || cleanDest.includes('sydney') || cleanDest.includes('melbourne');
  const isEurope = cleanDest.includes('france') || cleanDest.includes('germany') || cleanDest.includes('italy') || cleanDest.includes('spain') || cleanDest.includes('europe');

  const defaultCoords = {
    lat: currentTrip?.days?.[0]?.items?.[0]?.coordinates?.lat || 28.6139,
    lng: currentTrip?.days?.[0]?.items?.[0]?.coordinates?.lng || 77.209,
  };

  const primaryNumber = isUS ? '911' : isUK ? '999' : isAus ? '000' : '112';

  return {
    city: displayName,
    country: isUS ? 'USA' : isUK ? 'UK' : isEurope ? 'Europe' : 'India',
    lat: defaultCoords.lat,
    lng: defaultCoords.lng,
    dms: `${defaultCoords.lat.toFixed(4)}° N, ${defaultCoords.lng.toFixed(4)}° E`,
    zoneName: `${displayName} Metropolitan Area`,
    nearestLandmark: currentTrip?.selected_hotel?.name || `${displayName} City Center & Transit Station`,
    nearestPolice: `${displayName} Central Police Division / ERSS Emergency Command`,
    contacts: [
      {
        id: 'dyn_primary',
        name: `Unified Emergency Dispatch (${primaryNumber})`,
        number: primaryNumber,
        category: 'national',
        description: `Rapid 24/7 unified emergency response for Police, Fire, and Ambulance in ${displayName}`,
        hours: '24/7 Dispatch',
        isPrimary: true,
      },
      {
        id: 'dyn_police',
        name: `${displayName} Police Patrol`,
        number: isUS ? '911' : isUK ? '999' : '100',
        category: 'police',
        description: 'Direct local law enforcement and rapid response team',
        hours: '24/7 Available',
      },
      {
        id: 'dyn_ambulance',
        name: `${displayName} Medical Ambulance`,
        number: isUS ? '911' : isUK ? '111' : '108',
        category: 'medical',
        description: 'Emergency trauma ambulance and paramedic transit',
        hours: '24/7 Toll-free',
        isPrimary: true,
      },
      {
        id: 'dyn_tourist',
        name: 'National Tourist & Traveler Helpline',
        number: isUS ? '311' : '1363',
        category: 'tourist',
        description: '24/7 multi-lingual visitor safety and emergency guidance assistance',
        hours: '24/7 Toll-free',
      },
      {
        id: 'dyn_women',
        name: "Women's Rapid Safety Helpline",
        number: '1091',
        category: 'women',
        description: 'Emergency anti-harassment and crisis response hotline',
        hours: '24/7 Toll-free',
      },
    ],
  };
}

export const SosEmergencyModal: React.FC<SosEmergencyModalProps> = ({
  isOpen,
  onClose,
  destination,
  currentTrip,
  onLogEmergencyAlert,
}) => {
  // Resolve localized emergency data
  const destData = resolveEmergencyData(destination, currentTrip);
  const matchedCity = destData.city;

  // GPS State
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'device' | 'destination'>('loading');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; accuracy?: number; altitude?: number }>({
    lat: destData.lat,
    lng: destData.lng,
  });
  const [gpsAddress, setGpsAddress] = useState<string>(destData.zoneName);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [smsSent, setSmsSent] = useState(false);
  const [loggedAlert, setLoggedAlert] = useState(false);

  // Audio Siren & Visual Strobe State
  const [isSirenActive, setIsSirenActive] = useState(false);
  const [isStrobeActive, setIsStrobeActive] = useState(false);
  const [showFirstAid, setShowFirstAid] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sirenIntervalRef = useRef<any>(null);

  // Function to start the Web Audio API distress siren
  const startSiren = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('Web Audio API not supported on this browser');
        return;
      }

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }

      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Create oscillator and gain
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);

      gain.gain.setValueAtTime(0.35, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      oscRef.current = osc;
      gainRef.current = gain;

      // Modulate frequency between 750Hz and 1250Hz (two-tone European/Indian emergency siren)
      let highTone = false;
      sirenIntervalRef.current = setInterval(() => {
        if (!oscRef.current || !audioCtxRef.current) return;
        const now = audioCtxRef.current.currentTime;
        const targetFreq = highTone ? 750 : 1250;
        oscRef.current.frequency.cancelScheduledValues(now);
        oscRef.current.frequency.linearRampToValueAtTime(targetFreq, now + 0.15);
        highTone = !highTone;
      }, 350);

      setIsSirenActive(true);
    } catch (err) {
      console.error('Failed to trigger audio siren:', err);
    }
  };

  const stopSiren = () => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
      sirenIntervalRef.current = null;
    }
    if (oscRef.current) {
      try {
        oscRef.current.stop();
        oscRef.current.disconnect();
      } catch {
        // ignore already stopped
      }
      oscRef.current = null;
    }
    if (gainRef.current) {
      try {
        gainRef.current.disconnect();
      } catch {
        // ignore
      }
      gainRef.current = null;
    }
    setIsSirenActive(false);
  };

  // Turn off siren and strobe on close or unmount
  useEffect(() => {
    if (!isOpen) {
      stopSiren();
      setIsStrobeActive(false);
    }
    return () => {
      stopSiren();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [isOpen]);

  // Handle live GPS acquisition with sensible timeout
  const acquireGps = () => {
    setGpsStatus('loading');

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsCoords({
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6)),
            accuracy: Math.round(position.coords.accuracy),
            altitude: position.coords.altitude ? Math.round(position.coords.altitude) : undefined,
          });
          setGpsStatus('device');
          setGpsAddress(
            `Live Device GPS Fix (Accuracy: ±${Math.round(position.coords.accuracy)}m) in ${matchedCity}`
          );
        },
        (error) => {
          console.warn('Geolocation unavailable or denied, falling back to destination center:', error.message);
          setGpsCoords({ lat: destData.lat, lng: destData.lng });
          setGpsStatus('destination');
          setGpsAddress(`${destData.zoneName} (Grounding Fallback)`);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }
      );
    } else {
      setGpsCoords({ lat: destData.lat, lng: destData.lng });
      setGpsStatus('destination');
      setGpsAddress(destData.zoneName);
    }
  };

  useEffect(() => {
    if (isOpen) {
      acquireGps();
    }
  }, [isOpen, destination]);

  const [showGpsRadar, setShowGpsRadar] = useState(false);
  const [selectedRadarMemberId, setSelectedRadarMemberId] = useState<string | null>(null);
  const [companionsBroadcastStatus, setCompanionsBroadcastStatus] = useState<string | null>(null);

  const handleBroadcastSosToCompanions = () => {
    if (!currentTrip?.members || currentTrip.members.length === 0) return;
    const msg = `🚨 EMERGENCY SOS ALERT from ${matchedCity}! My live GPS: https://maps.google.com/?q=${gpsCoords.lat},${gpsCoords.lng} (Accuracy: ±${gpsCoords.accuracy || 10}m). Immediate assistance requested!`;

    if (navigator.share) {
      navigator
        .share({
          title: `EMERGENCY SOS: ${matchedCity}`,
          text: msg,
          url: `https://maps.google.com/?q=${gpsCoords.lat},${gpsCoords.lng}`,
        })
        .catch(() => {});
    }

    setCompanionsBroadcastStatus(`Distress beacon transmitted to all ${currentTrip.members.length} companions!`);
    setTimeout(() => setCompanionsBroadcastStatus(null), 5000);

    if (onLogEmergencyAlert) {
      onLogEmergencyAlert({
        id: `sos_group_${Date.now()}`,
        type: 'safety',
        title: `🚨 Emergency SOS Broadcast to Group (${matchedCity})`,
        description: `SOS signal triggered with live GPS coordinates: ${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)}`,
        severity: 'critical',
        timestamp: new Date().toLocaleTimeString(),
        status: 'active',
      });
    }
  };

  if (!isOpen) return null;

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyCoordinates = () => {
    const mapsUrl = `https://maps.google.com/?q=${gpsCoords.lat},${gpsCoords.lng}`;
    const coordString = `🚨 EMERGENCY GPS COORDINATES:
Latitude: ${gpsCoords.lat.toFixed(6)}
Longitude: ${gpsCoords.lng.toFixed(6)}
Accuracy: ${gpsCoords.accuracy ? `±${gpsCoords.accuracy}m` : 'Hub Center'}
Location: ${matchedCity}, ${destData.country}
Google Maps Pin: ${mapsUrl}`;
    handleCopyText(coordString, 'coords');
  };

  // Direct Call helper that also copies number to clipboard in case tel: is blocked on desktop
  const handleCallNumber = (num: string, id: string) => {
    const cleanNum = num.replace(/[^0-9+]/g, '');
    navigator.clipboard.writeText(num);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
    window.location.href = `tel:${cleanNum}`;
  };

  // Universal native share or WhatsApp / SMS fallback
  const handleNativeShare = async () => {
    const shareData = {
      title: `🚨 EMERGENCY SOS - ${matchedCity}`,
      text: `EMERGENCY ALERT: I need immediate assistance in ${matchedCity}.\nGPS: ${gpsCoords.lat}, ${gpsCoords.lng}\nLandmark: ${destData.nearestLandmark}\nPolice: ${destData.nearestPolice}`,
      url: `https://maps.google.com/?q=${gpsCoords.lat},${gpsCoords.lng}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleTriggerWhatsAppAlert();
        }
      }
    } else {
      handleTriggerWhatsAppAlert();
    }
  };

  const handleTriggerSmsAlert = () => {
    const emergencyMessage = encodeURIComponent(
      `🚨 EMERGENCY SOS ALERT!\nI need urgent assistance in ${matchedCity}.\nMy GPS Location: ${gpsCoords.lat}, ${gpsCoords.lng}\nGoogle Maps: https://maps.google.com/?q=${gpsCoords.lat},${gpsCoords.lng}\nNearest Landmark: ${destData.nearestLandmark}\nPlease dispatch help immediately!`
    );

    window.open(`sms:112?body=${emergencyMessage}`, '_blank');
    setSmsSent(true);
    setTimeout(() => setSmsSent(false), 5000);
  };

  const handleTriggerWhatsAppAlert = () => {
    const emergencyMessage = encodeURIComponent(
      `🚨 *EMERGENCY SOS ALERT!*\nI require immediate assistance in *${matchedCity}*.\n📍 *My Current GPS Coordinates:* ${gpsCoords.lat}, ${gpsCoords.lng}\n🗺️ *Live Location Map:* https://maps.google.com/?q=${gpsCoords.lat},${gpsCoords.lng}\n🏛️ *Nearest Known Landmark:* ${destData.nearestLandmark}\n🚓 *Closest Station:* ${destData.nearestPolice}\nPlease send help or contact local emergency authorities!`
    );
    window.open(`https://api.whatsapp.com/send?text=${emergencyMessage}`, '_blank');
  };

  // Log SOS as an active critical alert on currentTrip
  const handleLogSosToTrip = () => {
    if (!onLogEmergencyAlert || !currentTrip) return;

    const newAlert: DisruptionAlert = {
      id: `sos_alert_${Date.now()}`,
      trip_id: currentTrip.id,
      severity: 'critical',
      title: `SOS Emergency Signal Dispatched (${matchedCity})`,
      description: `Emergency distress event logged at ${new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}. Coordinates: ${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)}. Local helplines notified.`,
      suggested_action: `Monitor safety of all group members, verify emergency team arrival, and remain near known landmark: ${destData.nearestLandmark}.`,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    onLogEmergencyAlert(newAlert);
    setLoggedAlert(true);
    setTimeout(() => setLoggedAlert(false), 4000);
  };

  const filteredContacts = destData.contacts.filter((c) => {
    if (activeCategory === 'all') return true;
    return c.category === activeCategory;
  });

  return (
    <>
      {/* Visual Strobe Beacon Overlay if activated */}
      {isStrobeActive && (
        <div
          id="sos-strobe-overlay"
          onClick={() => setIsStrobeActive(false)}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 animate-pulse cursor-pointer select-none"
          style={{
            backgroundColor: '#DC2626',
            animation: 'sosStrobe 0.33s infinite alternate',
          }}
        >
          <style>{`
            @keyframes sosStrobe {
              0% { background-color: #DC2626; color: #FFFFFF; }
              50% { background-color: #FFFFFF; color: #DC2626; }
              100% { background-color: #991B1B; color: #FFFFFF; }
            }
          `}</style>
          <div className="bg-black/90 p-6 rounded-3xl text-center space-y-4 shadow-2xl border-4 border-white max-w-sm">
            <ShieldAlert className="w-16 h-16 text-red-500 mx-auto animate-bounce" />
            <div className="space-y-1">
              <h2 className="text-2xl font-black tracking-widest text-white uppercase">DISTRESS STROBE ACTIVE</h2>
              <p className="text-xs text-slate-300 font-semibold">
                Flashing high-contrast beacon to signal search & rescue or emergency personnel.
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsStrobeActive(false);
              }}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg cursor-pointer border border-white"
            >
              Stop Strobe Light
            </button>
            <p className="text-[10px] text-slate-400">Tap anywhere on screen to turn off</p>
          </div>
        </div>
      )}

      {/* Main Modal Backdrop */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 dark:bg-black/85 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border-2 border-red-500/40 dark:border-red-500/50 overflow-hidden flex flex-col my-auto transition-all">
          {/* Urgent Emergency Header Banner */}
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white px-5 sm:px-6 py-4 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
                <ShieldAlert className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-widest bg-white text-red-700 px-2 py-0.5 rounded-full shadow-2xs">
                    SOS Emergency Hub
                  </span>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                  </span>
                  <span className="text-[11px] font-semibold text-red-100 hidden sm:inline">24/7 Rapid Response</span>
                </div>
                <h2 className="font-extrabold text-base sm:text-lg text-white mt-0.5 flex items-center gap-1.5">
                  <span>Emergency Helplines & Live GPS</span>
                  <span className="text-xs font-semibold text-white/85">({matchedCity})</span>
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                id="sos-modal-close-btn"
                onClick={onClose}
                className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                title="Close SOS Window"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Distress Tools Bar (Siren, Strobe, Share, First Aid) */}
          <div className="bg-red-950/20 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/60 p-2.5 sm:px-6 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Loud Siren Toggle */}
              <button
                id="sos-toggle-siren-btn"
                onClick={() => {
                  if (isSirenActive) {
                    stopSiren();
                  } else {
                    startSiren();
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  isSirenActive
                    ? 'bg-amber-500 text-slate-950 animate-bounce shadow-md'
                    : 'bg-red-600 hover:bg-red-700 text-white shadow-xs'
                }`}
                title="Play loud emergency two-tone distress alarm"
              >
                {isSirenActive ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 animate-pulse" />}
                <span>{isSirenActive ? 'SILENCE SIREN' : 'SOUND SIREN'}</span>
              </button>

              {/* Visual Strobe Beacon Toggle */}
              <button
                id="sos-toggle-strobe-btn"
                onClick={() => setIsStrobeActive(!isStrobeActive)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700 shadow-xs"
                title="Turn device screen into high-contrast flashing strobe light"
              >
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>Visual Strobe</span>
              </button>

              {/* First-Aid Quick Guide Toggle */}
              <button
                id="sos-toggle-firstaid-btn"
                onClick={() => setShowFirstAid(!showFirstAid)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  showFirstAid
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                <span>{showFirstAid ? 'Hide First-Aid' : 'First-Aid Guide'}</span>
              </button>
            </div>

            {/* Log to Trip Alerts button */}
            {currentTrip && onLogEmergencyAlert && (
              <button
                id="sos-log-alert-btn"
                onClick={handleLogSosToTrip}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  loggedAlert
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
                }`}
                title="Record this emergency alert to your trip itinerary timeline"
              >
                <Activity className="w-3.5 h-3.5 text-red-500" />
                <span>{loggedAlert ? 'Logged to Trip!' : 'Record SOS in Itinerary'}</span>
              </button>
            )}
          </div>

          {/* First Aid Expandable Section */}
          {showFirstAid && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-900/60 p-4 sm:px-6 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-950 dark:text-rose-200 flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-rose-600" />
                  <span>Emergency Medical & First-Aid Quick Protocols</span>
                </h4>
                <button
                  onClick={() => setShowFirstAid(false)}
                  className="text-xs text-rose-700 dark:text-rose-300 hover:underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-white dark:bg-slate-850 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-1">
                  <span className="font-bold text-rose-900 dark:text-rose-300 block">CPR Life-Support Steps</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Place hands at center of chest. Give <strong>30 firm chest compressions</strong> (depth 5 cm, 100-120 bpm), followed by <strong>2 rescue breaths</strong>. Continue until paramedics arrive.
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-slate-850 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-1">
                  <span className="font-bold text-rose-900 dark:text-rose-300 block">Severe Bleeding & Wounds</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Apply firm, continuous direct pressure with a clean cloth or sterile dressing. Elevate limb above heart level. Do not remove dressing; layer more over it if soaked.
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-slate-850 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-1">
                  <span className="font-bold text-rose-900 dark:text-rose-300 block">Heat Stroke & Dehydration</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Move immediately to shade/AC. Apply cool, wet towels to neck, armpits, and groin. Provide small sips of water with electrolytes or ORS. Fan continuously.
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-slate-850 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-1">
                  <span className="font-bold text-rose-900 dark:text-rose-300 block">Lost Documents / Police FIR</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Dial <strong>112</strong> or visit the nearest Tourist Police booth. File an online Police Loss Report or FIR immediately to obtain travel documents and contact your embassy.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Content Body */}
          <div className="p-4 sm:p-6 overflow-y-auto max-h-[72vh] space-y-5 bg-slate-50/40 dark:bg-slate-950/60">
            {/* Section 1: Real-Time GPS Location Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border-2 border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
                    <Crosshair className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2 flex-wrap">
                      <span>Current GPS Coordinates</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          gpsStatus === 'device'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : gpsStatus === 'destination'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300'
                            : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300'
                        }`}
                      >
                        {gpsStatus === 'device'
                          ? '🟢 Live Device GPS Active'
                          : gpsStatus === 'destination'
                          ? `📍 ${matchedCity} Hub Center`
                          : '📡 Acquiring Satellite Fix...'}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{gpsAddress}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={acquireGps}
                    className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    title="Refresh GPS Coordinates"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${gpsStatus === 'loading' ? 'animate-spin' : ''}`} />
                  </button>

                  <a
                    href={`https://maps.google.com/?q=${gpsCoords.lat},${gpsCoords.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[11px] font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span className="hidden sm:inline">Google Maps</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                </div>
              </div>

              {/* Coordinates Display Box */}
              <div className="p-3.5 rounded-xl bg-slate-900 dark:bg-slate-950 text-white font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner border border-slate-800">
                <div className="space-y-1">
                  <div className="text-sm sm:text-base font-bold text-emerald-400 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {gpsCoords.lat.toFixed(6)}°, {gpsCoords.lng.toFixed(6)}°
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap font-sans">
                    <span>DMS: {destData.dms}</span>
                    {gpsCoords.accuracy && <span>&bull; Accuracy: ±{gpsCoords.accuracy}m</span>}
                    {gpsCoords.altitude && <span>&bull; Alt: {gpsCoords.altitude}m</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="sos-copy-coords-btn"
                    onClick={handleCopyCoordinates}
                    className="flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-sans px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
                  >
                    {copiedId === 'coords' ? (
                      <>
                        <Check className="w-4 h-4 text-slate-950" />
                        <span>Copied Coordinates!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Coordinates</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Local Proximity Landmarks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700 flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Nearest Major Landmark</span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">{destData.nearestLandmark}</span>
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700 flex items-start gap-2">
                  <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Nearest Police Division</span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold truncate block">{destData.nearestPolice}</span>
                  </div>
                </div>
              </div>

              {/* Quick Location Broadcast Actions */}
              <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  id="sos-send-sms-btn"
                  onClick={handleTriggerSmsAlert}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/70 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{smsSent ? 'SMS Dispatched!' : 'Send SMS (112)'}</span>
                </button>

                <button
                  id="sos-share-whatsapp-btn"
                  onClick={handleTriggerWhatsAppAlert}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share on WhatsApp</span>
                </button>

                <button
                  id="sos-native-share-btn"
                  onClick={handleNativeShare}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/70 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share via Any App</span>
                </button>
              </div>
            </div>

            {/* Travel Group Companions Section if members exist */}
            {currentTrip?.members && currentTrip.members.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-indigo-200 dark:border-indigo-900/50 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Trip Companions & Live GPS Proximity ({currentTrip.members.length})</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Real-time distance from your SOS coordinates &bull; Encrypted check-in bridge
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowGpsRadar((prev) => !prev)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        showGpsRadar
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                      }`}
                    >
                      <Radar className="w-3.5 h-3.5" />
                      <span>{showGpsRadar ? 'Hide Radar' : 'Live GPS Radar'}</span>
                    </button>

                    <button
                      onClick={handleBroadcastSosToCompanions}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-95"
                    >
                      <BellRing className="w-3.5 h-3.5 animate-bounce" />
                      <span>SOS All</span>
                    </button>
                  </div>
                </div>

                {/* Broadcast Confirmation Banner */}
                {companionsBroadcastStatus && (
                  <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 font-semibold flex items-center gap-2 animate-in fade-in">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{companionsBroadcastStatus}</span>
                  </div>
                )}

                {/* Live Tactical GPS Radar */}
                {showGpsRadar && (
                  <div className="p-3 bg-slate-950 rounded-2xl border border-indigo-900/60 text-center flex flex-col items-center justify-center relative overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="text-[10px] uppercase font-mono tracking-widest text-emerald-400/80 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>Tactical Proximity Radar &bull; Range 1,000m</span>
                    </div>

                    <div className="relative w-64 h-64 mx-auto flex items-center justify-center my-1">
                      {/* Concentric distance rings */}
                      <div className="absolute inset-0 rounded-full border border-emerald-500/20" />
                      <div className="absolute w-44 h-44 rounded-full border border-emerald-500/30" />
                      <div className="absolute w-24 h-24 rounded-full border border-emerald-500/40" />
                      
                      {/* Crosshairs */}
                      <div className="absolute w-full h-[1px] bg-emerald-500/20" />
                      <div className="absolute h-full w-[1px] bg-emerald-500/20" />

                      {/* Compass Marks */}
                      <span className="absolute top-1 text-[9px] font-mono text-emerald-400/70 font-bold">N</span>
                      <span className="absolute bottom-1 text-[9px] font-mono text-emerald-400/70 font-bold">S</span>
                      <span className="absolute left-1 text-[9px] font-mono text-emerald-400/70 font-bold">W</span>
                      <span className="absolute right-1 text-[9px] font-mono text-emerald-400/70 font-bold">E</span>

                      {/* Radar sweep animation */}
                      <div
                        className="absolute inset-0 rounded-full pointer-events-none opacity-40"
                        style={{
                          background: 'conic-gradient(from 0deg, transparent 0deg, rgba(16, 185, 129, 0.25) 60deg, transparent 65deg)',
                          animation: 'spin 4s linear infinite',
                        }}
                      />

                      {/* Center User in Distress Marker */}
                      <div className="absolute z-10 flex flex-col items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow-lg animate-ping absolute" />
                        <div className="w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow-lg relative flex items-center justify-center text-[8px] text-white font-black">
                          !
                        </div>
                        <span className="text-[9px] font-bold text-red-400 bg-black/80 px-1 rounded mt-1 shadow-xs">
                          YOU (SOS)
                        </span>
                      </div>

                      {/* Plot companions on radar relative to distance & bearing */}
                      {currentTrip.members.map((member) => {
                        if (!member.coordinates) return null;
                        const distM = calculateDistanceMeters(
                          gpsCoords.lat,
                          gpsCoords.lng,
                          member.coordinates.lat,
                          member.coordinates.lng
                        );
                        const bearingDeg = calculateBearing(
                          gpsCoords.lat,
                          gpsCoords.lng,
                          member.coordinates.lat,
                          member.coordinates.lng
                        );

                        // Max radius in pixels is ~110px representing 1000m
                        const radiusPx = Math.min(115, Math.max(18, (distM / 1000) * 115));
                        const angleRad = (bearingDeg * Math.PI) / 180;
                        const x = radiusPx * Math.sin(angleRad);
                        const y = -radiusPx * Math.cos(angleRad);

                        const isSelected = selectedRadarMemberId === member.id;

                        return (
                          <div
                            key={member.id}
                            onClick={() => setSelectedRadarMemberId(isSelected ? null : member.id)}
                            style={{
                              transform: `translate(${x}px, ${y}px)`,
                            }}
                            className="absolute z-20 cursor-pointer group transition-transform duration-500"
                            title={`${member.name}: ${formatDistance(distM)} away`}
                          >
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[9px] shadow-md border-2 border-white dark:border-slate-900 transition-all ${
                                isSelected ? 'scale-125 ring-2 ring-emerald-400' : 'group-hover:scale-110'
                              }`}
                              style={{ backgroundColor: member.avatar_color || '#4f46e5' }}
                            >
                              {member.name.charAt(0)}
                            </div>
                            <span className="text-[8px] font-bold text-emerald-300 bg-black/90 px-1 py-0.2 rounded absolute top-5 -left-3 whitespace-nowrap opacity-90 group-hover:opacity-100">
                              {member.name.split(' ')[0]} ({formatDistance(distM)})
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-[10px] text-slate-400 mt-1">
                      Tap any companion icon on radar to highlight their emergency contact details
                    </p>
                  </div>
                )}

                {/* Companions Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {currentTrip.members.map((member) => {
                    const isGuide = member.role === 'Guide';
                    let distanceStr: string | null = null;
                    let bearingStr: string | null = null;

                    if (member.coordinates) {
                      const distM = calculateDistanceMeters(
                        gpsCoords.lat,
                        gpsCoords.lng,
                        member.coordinates.lat,
                        member.coordinates.lng
                      );
                      distanceStr = formatDistance(distM);
                      const bearingDeg = calculateBearing(
                        gpsCoords.lat,
                        gpsCoords.lng,
                        member.coordinates.lat,
                        member.coordinates.lng
                      );
                      bearingStr = getCompassDirection(bearingDeg);
                    }

                    const isHighlighted = selectedRadarMemberId === member.id;

                    return (
                      <div
                        key={member.id}
                        className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                          isHighlighted
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 dark:border-indigo-400 shadow-md ring-1 ring-indigo-400'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs"
                              style={{ backgroundColor: member.avatar_color || '#4f46e5' }}
                            >
                              {isGuide ? '👑' : member.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                                  {member.name}
                                </span>
                                {isGuide && (
                                  <span className="text-[9px] bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold px-1.5 py-0.2 rounded">
                                    Guide
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {member.last_location_name || 'Destination Area'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-600 shrink-0">
                            <Battery className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>{member.battery_level ?? 90}%</span>
                          </div>
                        </div>

                        {/* GPS Distance & Telemetry */}
                        {distanceStr && (
                          <div className="flex items-center justify-between text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40 px-2 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                            <span className="flex items-center gap-1">
                              <Navigation className="w-3 h-3" />
                              <span>{distanceStr} {bearingStr ? `(${bearingStr})` : ''}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              Ping: {member.last_ping || 'Just now'}
                            </span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                          {member.phone && (
                            <a
                              href={`tel:${member.phone.replace(/[^0-9+]/g, '')}`}
                              className="flex-1 py-1 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-2xs transition-colors"
                            >
                              <Phone className="w-3 h-3" />
                              <span>Call</span>
                            </a>
                          )}

                          <a
                            href={`https://wa.me/${(member.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                              `EMERGENCY SOS: I need urgent assistance in ${matchedCity}! Live GPS: https://maps.google.com/?q=${gpsCoords.lat},${gpsCoords.lng}. Please respond!`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-2xs transition-colors"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>SOS Alert</span>
                          </a>

                          {member.coordinates && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${member.coordinates.lat},${member.coordinates.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors"
                              title="Route to Companion in Google Maps"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 2: Local Emergency Contacts Header & Filter Chips */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    <PhoneCall className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <span>Emergency Contacts for {matchedCity}</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tap &apos;Call Now&apos; or copy number for local emergency dispatchers
                  </p>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: 'all', label: 'All Contacts' },
                    { id: 'national', label: '112 Unified' },
                    { id: 'police', label: 'Police' },
                    { id: 'medical', label: 'Medical & Ambulance' },
                    { id: 'tourist', label: 'Tourist Helpline' },
                    { id: 'hospital', label: 'Hospitals' },
                    { id: 'women', label: "Women's Helpline" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveCategory(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                        activeCategory === tab.id
                          ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contacts Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredContacts.map((contact) => {
                  const isCopied = copiedId === contact.id;
                  return (
                    <div
                      key={contact.id}
                      className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                        contact.isPrimary
                          ? 'bg-red-50/40 dark:bg-red-950/25 border-red-200 dark:border-red-900/50 hover:border-red-300 dark:hover:border-red-800'
                          : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      } shadow-xs`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-xs text-slate-900 dark:text-white">{contact.name}</span>
                              {contact.isPrimary && (
                                <span className="text-[9px] font-black uppercase tracking-wider bg-red-600 text-white px-1.5 py-0.2 rounded">
                                  Priority
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-2">
                              {contact.description}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                          <span className="text-base text-red-600 dark:text-red-400 font-extrabold tracking-tight">{contact.number}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans font-medium">{contact.hours}</span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                        <button
                          onClick={() => handleCallNumber(contact.number, contact.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white py-1.5 px-3 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{isCopied ? 'Calling & Copied!' : 'Call Now'}</span>
                        </button>

                        <button
                          onClick={() => handleCopyText(contact.number, contact.id)}
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
                          title="Copy Number"
                        >
                          {isCopied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Safety & Emergency Guidelines */}
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 text-amber-950 dark:text-amber-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <span>Smart Travel Emergency Guidelines</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-amber-900/90 dark:text-amber-300/90 text-[11px] leading-relaxed">
                <li>
                  <strong>Dial 112 directly:</strong> Connects to the nearest police patrol or ambulance dispatch automatically based on cellular tower.
                </li>
                <li>
                  <strong>Quote your GPS Coordinates:</strong> State latitude & longitude from the top card to emergency dispatchers for rapid pinpointing.
                </li>
                <li>
                  <strong>Tourist Support:</strong> The Ministry of Tourism 24/7 Helpline <strong>1363</strong> offers guidance in English, Hindi, German, French, Spanish, Japanese, and Mandarin.
                </li>
                <li>
                  <strong>Sound Siren / Strobe:</strong> If stranded in dark alleys, trails, or unfamiliar zones, use the audio siren or strobe light to attract local help or rescue parties.
                </li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 sm:px-6 py-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
              <span>Emergency Services Active in {matchedCity}, {destData.country}</span>
            </span>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-750 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs border dark:border-slate-700"
            >
              Close SOS Window
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
