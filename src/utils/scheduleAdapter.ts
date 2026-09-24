import { Trip, TransportOption, ItineraryDay, ItineraryItem, HotelOption } from '../types.js';

/**
 * Parses time strings like:
 * '06:15 AM', '09:00 AM', '10:30 AM (+1d)', '19:30', '14:00', '6:15 PM'
 * into total minutes from midnight (0 to 1439).
 */
export function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  // Clean up extras like (+1d), extra spaces
  const clean = timeStr.replace(/\(\+.*?d\)/gi, '').trim();

  // Check 12-hour format with AM/PM
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  // Check 24-hour format (HH:mm)
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }

  // Check simple range or first number if formatted as '06:15 - 09:00'
  const matchFirst = clean.match(/(\d{1,2}):(\d{2})/);
  if (matchFirst) {
    const hours = parseInt(matchFirst[1], 10);
    const minutes = parseInt(matchFirst[2], 10);
    return hours * 60 + minutes;
  }

  return null;
}

/**
 * Converts total minutes from midnight into standard 24h/12h time string 'HH:mm' or 'hh:mm AM/PM'.
 */
export function minutesToTimeString(minutes: number, use12h = false): string {
  let normalized = Math.round(minutes) % 1440;
  if (normalized < 0) normalized += 1440;

  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const minsStr = mins < 10 ? `0${mins}` : `${mins}`;

  if (!use12h) {
    const hoursStr = hours24 < 10 ? `0${hours24}` : `${hours24}`;
    return `${hoursStr}:${minsStr}`;
  }

  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const hours12Str = hours12 < 10 ? `0${hours12}` : `${hours12}`;
  return `${hours12Str}:${minsStr} ${period}`;
}

export function formatTimeRange(startMins: number, endMins: number): string {
  return `${minutesToTimeString(startMins, false)} - ${minutesToTimeString(endMins, false)}`;
}

export interface TransportTimingProfile {
  arrivalMinutes: number;
  departureMinutes: number;
  terminalName: string;
  transferDurationMinutes: number;
  hotelBufferMinutes: number;
  readyForActivitiesMinutes: number;
  terminalBufferMinutes: number;
  modeLabel: string;
}

/**
 * Returns logistics profile for arrival and departure according to transport mode
 */
export function getTransportTimingProfile(
  transport: TransportOption,
  hotel?: HotelOption,
  destinationName = 'Destination'
): TransportTimingProfile {
  const mode = transport.mode || 'flight';

  // Default arrival times if not found
  const defaultArrivals: Record<string, number> = {
    flight: 9 * 60, // 09:00 AM
    train: 10 * 60 + 30, // 10:30 AM
    bus: 6 * 60, // 06:00 AM
    car: 11 * 60, // 11:00 AM
  };

  const defaultDepartures: Record<string, number> = {
    flight: 6 * 60 + 15, // 06:15 AM
    train: 6 * 60 + 5, // 06:05 AM
    bus: 19 * 60 + 30, // 07:30 PM (previous evening)
    car: 8 * 60, // 08:00 AM
  };

  const arrParsed = parseTimeToMinutes(transport.arrival_time);
  const depParsed = parseTimeToMinutes(transport.departure_time);

  const arrivalMinutes = arrParsed !== null ? arrParsed : defaultArrivals[mode] || 540;
  const departureMinutes = depParsed !== null ? depParsed : defaultDepartures[mode] || 360;

  if (mode === 'flight') {
    return {
      arrivalMinutes,
      departureMinutes,
      terminalName: `${destinationName} International Airport (Terminal 3)`,
      transferDurationMinutes: 60, // Airport to hotel transit (cabs/express metro)
      hotelBufferMinutes: 45, // Baggage drop, check-in, freshen up
      readyForActivitiesMinutes: arrivalMinutes + 35 + 60 + 45, // ~140m after touchdown
      terminalBufferMinutes: 120, // 2 hours airport check-in requirement
      modeLabel: 'Flight',
    };
  }

  if (mode === 'train') {
    return {
      arrivalMinutes,
      departureMinutes,
      terminalName: `${destinationName} Central Railway Station`,
      transferDurationMinutes: 35, // Central station is much closer to city center
      hotelBufferMinutes: 40, // Platform exit & hotel check-in
      readyForActivitiesMinutes: arrivalMinutes + 20 + 35 + 40, // ~95m after train stop
      terminalBufferMinutes: 60, // 1 hour station arrival requirement
      modeLabel: 'Train',
    };
  }

  if (mode === 'bus') {
    return {
      arrivalMinutes,
      departureMinutes,
      terminalName: `${destinationName} Intercity Bus Terminal (ISBT)`,
      transferDurationMinutes: 40,
      hotelBufferMinutes: 60, // Early arrival allows luggage storage & morning breakfast
      readyForActivitiesMinutes: arrivalMinutes + 15 + 40 + 60, // ~115m after arrival
      terminalBufferMinutes: 45, // 45m bus terminal requirement
      modeLabel: 'Bus',
    };
  }

  // Car / Cab
  return {
    arrivalMinutes,
    departureMinutes,
    terminalName: `${destinationName} Highway Entry`,
    transferDurationMinutes: 20,
    hotelBufferMinutes: 30,
    readyForActivitiesMinutes: arrivalMinutes + 50,
    terminalBufferMinutes: 30,
    modeLabel: 'Road Travel',
  };
}

/**
 * Intelligently adapts an entire trip's itinerary days to match a new transport mode and timing.
 */
export function adaptItineraryToTransport(
  trip: Trip,
  targetTransport: TransportOption,
  targetHotel?: HotelOption
): { updatedDays: ItineraryDay[]; changeNotes: string[] } {
  const hotel = targetHotel || trip.selected_hotel || trip.hotel_options[0];
  const profile = getTransportTimingProfile(targetTransport, hotel, trip.destination);
  const changeNotes: string[] = [];

  const updatedDays: ItineraryDay[] = JSON.parse(JSON.stringify(trip.days || []));
  if (updatedDays.length === 0) {
    return { updatedDays, changeNotes };
  }

  const isFlight = targetTransport.mode === 'flight';
  const isTrain = targetTransport.mode === 'train';
  const isBus = targetTransport.mode === 'bus';

  // -------------------------------------------------------------
  // 1. ADAPT DAY 1 (ARRIVAL DAY)
  // -------------------------------------------------------------
  const day1 = updatedDays[0];
  if (day1) {
    const outwardCategory = isFlight ? 'flight' : 'transport';
    const outwardTimeStr = targetTransport.departure_time && targetTransport.arrival_time
      ? `${targetTransport.departure_time} - ${targetTransport.arrival_time}`
      : formatTimeRange(profile.departureMinutes, profile.arrivalMinutes);

    const outwardTitle = isFlight
      ? `Flight: ${targetTransport.origin} to ${targetTransport.destination} (${targetTransport.carrier})`
      : isTrain
      ? `Train: ${targetTransport.carrier} (${targetTransport.number}) to ${trip.destination}`
      : `Intercity Bus: ${targetTransport.carrier} to ${trip.destination} ISBT`;

    const outwardDesc = isFlight
      ? `Confirmed air journey aboard ${targetTransport.carrier} landing at ${profile.terminalName}. Baggage: ${targetTransport.baggage_included || 'Standard allowance'}.`
      : isTrain
      ? `Confirmed rail journey on ${targetTransport.carrier} arriving at ${profile.terminalName} platform. Relaxed travel with scenery.`
      : `Overnight AC sleeper journey with ${targetTransport.carrier} reaching ${profile.terminalName}.`;

    // 1.1 Inbound Transport Item
    let transItem = day1.items.find(
      (it) => it.id.includes('transport_arrival') || it.category === 'flight' || (it.category === 'transport' && it.id.includes('1_1'))
    );

    if (!transItem) {
      transItem = day1.items[0];
    }

    if (transItem) {
      transItem.title = outwardTitle;
      transItem.category = outwardCategory as any;
      transItem.time = outwardTimeStr;
      transItem.description = outwardDesc;
      transItem.location = `${targetTransport.origin} → ${profile.terminalName}`;
      transItem.cost_estimate = Math.round(targetTransport.price / 2);
      transItem.cost_type = 'CONFIRMED';
      transItem.source = targetTransport.source;
    }

    // 1.2 Transfer & Check-in Items
    const exitBuffer = isFlight ? 30 : 15;
    const transferStart = profile.arrivalMinutes + exitBuffer;
    const transferEnd = transferStart + profile.transferDurationMinutes;

    let transferItem = day1.items.find(
      (it) => it.id.includes('transfer') || (it.category === 'transport' && it !== transItem)
    );

    const transferTitle = isFlight
      ? `Airport Transfer to ${hotel?.name || 'Hotel'}`
      : isTrain
      ? `Station Transfer from ${profile.terminalName} to ${hotel?.name || 'Hotel'}`
      : `Terminal Transfer from ISBT to ${hotel?.name || 'Hotel'}`;

    const transferDesc = isFlight
      ? `Pre-arranged transit via Airport Express corridor directly to ${hotel?.location || hotel?.name || 'hotel'}.`
      : isTrain
      ? `Short city cab or metro transfer from central railway station to ${hotel?.location || hotel?.name || 'hotel'}.`
      : `Early morning cab transit across Delhi to ${hotel?.location || hotel?.name || 'hotel'}.`;

    if (transferItem) {
      transferItem.title = transferTitle;
      transferItem.time = formatTimeRange(transferStart, transferEnd);
      transferItem.description = transferDesc;
      transferItem.location = `${profile.terminalName} to ${hotel?.location || hotel?.name || 'Hotel'}`;
      transferItem.category = 'transport';
    }

    // 1.3 Hotel Check-in / Bag Drop
    const checkinStart = transferEnd + 10;
    const checkinEnd = checkinStart + profile.hotelBufferMinutes;

    let checkinItem = day1.items.find(
      (it) => it.id.includes('hotel_checkin') || it.category === 'hotel'
    );

    const checkinTitle = isBus
      ? `Early Luggage Drop & Breakfast: ${hotel?.name || 'Hotel'}`
      : isTrain
      ? `Hotel Arrival & Freshen Up: ${hotel?.name || 'Hotel'}`
      : `Hotel Check-in & Room Allocation: ${hotel?.name || 'Hotel'}`;

    const checkinDesc = isBus
      ? `Deposit luggage at concierge, freshen up in guest lounge, and enjoy morning breakfast before exploring.`
      : `Front desk check-in, key collection, and quick recharge at ${hotel?.name || 'hotel'}.`;

    if (checkinItem) {
      checkinItem.title = checkinTitle;
      checkinItem.time = formatTimeRange(checkinStart, checkinEnd);
      checkinItem.description = checkinDesc;
      checkinItem.category = 'hotel';
    }

    // 1.4 Re-sequence Afternoon & Evening Activities for Day 1
    // Filter activities that occur after check-in
    const baseItems = day1.items.filter(
      (it) => it !== transItem && it !== transferItem && it !== checkinItem
    );

    let currentCursorMinutes = checkinEnd + 20; // 20 min leisure break

    baseItems.forEach((act, idx) => {
      // If arrival is late afternoon (e.g. after 15:00), morning items convert to illuminated evening visits
      const duration = Math.min(150, Math.max(60, act.duration_minutes || 90));
      const startMins = currentCursorMinutes;
      const endMins = startMins + duration;

      act.time = formatTimeRange(startMins, endMins);

      // If pushed into dinner hours (>= 19:30) and not marked dining, keep it appropriate
      if (startMins >= 19 * 60 + 30 && act.category === 'attraction') {
        act.title = act.title.includes('Illuminated') || act.title.includes('Night')
          ? act.title
          : `${act.title} (Evening Walk / Illumination)`;
      }

      currentCursorMinutes = endMins + 20; // 20 min transit buffer between stops
    });

    // Reconstruct Day 1 items in chronological order
    const orderedDay1: ItineraryItem[] = [];
    if (transItem) orderedDay1.push(transItem);
    if (transferItem) orderedDay1.push(transferItem);
    if (checkinItem) orderedDay1.push(checkinItem);
    orderedDay1.push(...baseItems);

    day1.items = orderedDay1;
    day1.day_cost_estimate = day1.items.reduce((s, it) => s + (it.cost_estimate || 0), 0);

    changeNotes.push(
      `Day 1 schedule adapted: Inbound arrival set to ${minutesToTimeString(profile.arrivalMinutes, true)} at ${profile.terminalName}. Sightseeing begins at ${minutesToTimeString(checkinEnd + 20, true)} after check-in.`
    );
  }

  // -------------------------------------------------------------
  // 2. ADAPT RETURN DAY (FINAL DAY)
  // -------------------------------------------------------------
  if (updatedDays.length > 1) {
    const lastDay = updatedDays[updatedDays.length - 1];

    // Return transport timings
    const returnDepMinutes = isFlight
      ? 16 * 60 + 45 // 16:45 Flight
      : isTrain
      ? 17 * 60 + 15 // 17:15 Train
      : 19 * 60 + 30; // 19:30 Bus

    const returnDurationMins = isFlight ? 165 : isTrain ? 360 : 600;
    const returnArrMinutes = returnDepMinutes + returnDurationMins;

    const returnCategory = isFlight ? 'flight' : 'transport';
    const returnTitle = isFlight
      ? `Return Flight to ${trip.origin} (${targetTransport.carrier})`
      : isTrain
      ? `Return Train Journey: ${targetTransport.carrier} to ${trip.origin}`
      : `Return Bus Journey: ${targetTransport.carrier} to ${trip.origin}`;

    // Find return transport item
    let returnTransItem = lastDay.items.find(
      (it) => it.id.includes('homeward') || it.id.includes('return') || (it.category === 'flight' || it.category === 'transport')
    );

    const terminalDepartureBuffer = profile.terminalBufferMinutes; // 120m for flight, 60m for train, 45m for bus
    const transitToTerminalDuration = profile.transferDurationMinutes;
    const stationArrivalMinutes = returnDepMinutes - terminalDepartureBuffer;
    const departureFromHotelOrAttractionMinutes = stationArrivalMinutes - transitToTerminalDuration;

    if (returnTransItem) {
      returnTransItem.title = returnTitle;
      returnTransItem.category = returnCategory as any;
      returnTransItem.time = formatTimeRange(returnDepMinutes, returnArrMinutes);
      returnTransItem.location = `${profile.terminalName} → ${trip.origin}`;
      returnTransItem.cost_estimate = targetTransport.price - Math.round(targetTransport.price / 2);
      returnTransItem.source = targetTransport.source;
    }

    // Final Day Activities must conclude before departureFromHotelOrAttractionMinutes
    const otherLastDayItems = lastDay.items.filter((it) => it !== returnTransItem);

    let morningCursor = 9 * 60; // 09:00 AM start
    otherLastDayItems.forEach((it, idx) => {
      const dur = Math.min(120, Math.max(60, it.duration_minutes || 90));
      const plannedStart = morningCursor;
      const plannedEnd = plannedStart + dur;

      // Ensure we don't exceed the transit cutoff
      if (plannedEnd <= departureFromHotelOrAttractionMinutes) {
        it.time = formatTimeRange(plannedStart, plannedEnd);
        morningCursor = plannedEnd + 20;
      } else if (plannedStart < departureFromHotelOrAttractionMinutes) {
        // Truncate to fit comfortably
        it.time = formatTimeRange(plannedStart, departureFromHotelOrAttractionMinutes);
        morningCursor = departureFromHotelOrAttractionMinutes;
      }
    });

    lastDay.day_cost_estimate = lastDay.items.reduce((s, it) => s + (it.cost_estimate || 0), 0);

    changeNotes.push(
      `Return day adapted: Homeward ${targetTransport.mode.toUpperCase()} departs at ${minutesToTimeString(returnDepMinutes, true)}. Final activities conclude by ${minutesToTimeString(departureFromHotelOrAttractionMinutes, true)} for terminal transit.`
    );
  }

  return { updatedDays, changeNotes };
}
