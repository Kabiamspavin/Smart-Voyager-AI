import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '@/firebase-applet-config.json';
import { Trip, User, TripReview } from '../types.js';

// Initialize Firebase App singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore (supporting named database if configured)
export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

// Initialize Authentication
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Helper: detect friendly device/platform info
export function getClientDeviceInfo(): string {
  if (typeof window === 'undefined') return 'Server';
  const ua = navigator.userAgent;
  let device = 'Desktop';
  if (/mobile/i.test(ua)) device = 'Mobile';
  else if (/tablet|ipad/i.test(ua)) device = 'Tablet';

  let browser = 'Web Browser';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edge')) browser = 'Edge';

  let os = 'Unknown OS';
  if (ua.includes('Macintosh')) os = 'macOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return `${device} (${os} · ${browser})`;
}

// Helper: Sync authenticated user profile to Firestore
export async function syncUserProfile(fbUser: FirebaseUser, extra?: { role?: string }): Promise<User> {
  const userRef = doc(db, 'users', fbUser.uid);
  const now = new Date().toISOString();

  let existingData: any = {};
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      existingData = snap.data();
    }
  } catch (err) {
    console.warn('Firestore read user profile warning:', err);
  }

  const role = extra?.role || existingData.role || (fbUser.email?.includes('admin') ? 'Admin' : 'Organizer');

  const userData: User = {
    id: fbUser.uid,
    name: fbUser.displayName || existingData.name || fbUser.email?.split('@')[0] || 'Traveler',
    email: fbUser.email || existingData.email || 'traveler@example.com',
    photo_url: fbUser.photoURL || existingData.photo_url || undefined,
    role,
    provider: fbUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'password',
    preferences: existingData.preferences || {
      home_city: 'Chennai',
      preferred_currency: 'INR',
      travel_style: 'family',
      interests: ['Heritage', 'Food', 'Shopping', 'Nature'],
      food_preference: 'all',
      accommodation_preference: 'boutique',
      transport_preference: 'flight',
    },
    created_at: existingData.created_at || now,
    last_login_at: now,
  };

  try {
    await setDoc(
      userRef,
      {
        ...userData,
        last_device: getClientDeviceInfo(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore write user profile warning:', err);
  }

  return userData;
}

// Debounced Firestore Trip Persistence to prevent exceeding queued writes limit
const pendingTripWrites = new Map<string, { timeoutId: any; trip: Trip }>();
const inFlightTripWrites = new Set<string>();

export async function saveTripToFirestore(userId: string, trip: Trip, immediate = false): Promise<void> {
  if (!userId || !trip?.id) return;
  const key = `${userId}_${trip.id}`;

  const existing = pendingTripWrites.get(key);
  if (existing) {
    clearTimeout(existing.timeoutId);
    pendingTripWrites.delete(key);
  }

  const executeWrite = async (tripToWrite: Trip) => {
    if (inFlightTripWrites.has(key)) {
      // Re-queue write if another write for this trip is currently in flight
      saveTripToFirestore(userId, tripToWrite, false);
      return;
    }

    inFlightTripWrites.add(key);
    try {
      const tripRef = doc(db, 'users', userId, 'trips', tripToWrite.id);
      await setDoc(
        tripRef,
        {
          ...tripToWrite,
          userId,
          last_synced_at: new Date().toISOString(),
          last_synced_device: getClientDeviceInfo(),
        },
        { merge: true }
      );
    } catch (err: any) {
      console.warn('Firestore save trip warning:', err?.message || err);
    } finally {
      inFlightTripWrites.delete(key);
    }
  };

  if (immediate) {
    await executeWrite(trip);
  } else {
    // Coalesce rapid sequential updates into a single write (1.5s debounce)
    const timeoutId = setTimeout(() => {
      pendingTripWrites.delete(key);
      executeWrite(trip);
    }, 1500);
    pendingTripWrites.set(key, { timeoutId, trip });
  }
}

export async function deleteTripFromFirestore(userId: string, tripId: string): Promise<void> {
  if (!userId || !tripId) return;
  try {
    const key = `${userId}_${tripId}`;
    const existing = pendingTripWrites.get(key);
    if (existing) {
      clearTimeout(existing.timeoutId);
      pendingTripWrites.delete(key);
    }
    const tripRef = doc(db, 'users', userId, 'trips', tripId);
    await deleteDoc(tripRef);
  } catch (err) {
    console.error('Error deleting trip from Firestore:', err);
  }
}

// Real-time listener for user's trips across all devices
export function subscribeToUserTrips(userId: string, onTripsChanged: (trips: Trip[]) => void): () => void {
  if (!userId) return () => {};

  try {
    const tripsColl = collection(db, 'users', userId, 'trips');
    return onSnapshot(
      tripsColl,
      { includeMetadataChanges: true },
      (snapshot) => {
        // Skip latency-compensated local writes to avoid re-triggering circular updates
        if (snapshot.metadata.hasPendingWrites) {
          return;
        }
        const trips: Trip[] = [];
        snapshot.forEach((d) => {
          trips.push(d.data() as Trip);
        });
        // Sort trips by updated_at or created_at descending
        trips.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
        onTripsChanged(trips);
      },
      (error) => {
        console.warn('Firestore subscription warning (trips):', error);
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to trips:', err);
    return () => {};
  }
}

// Save Trip Review to Firebase Firestore and update trip state
export async function saveTripReviewToFirestore(userId: string, review: TripReview): Promise<void> {
  const localKey = `voyager_reviews_${userId || 'guest'}`;
  try {
    // 1. Cache to local storage for instant access across sessions
    const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
    const filtered = existing.filter((r: TripReview) => r.id !== review.id && r.trip_id !== review.trip_id);
    filtered.unshift(review);
    localStorage.setItem(localKey, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Local review cache warning:', e);
  }

  if (!userId) return;

  try {
    // 2. Persist review document in /users/{userId}/reviews/{reviewId}
    const reviewRef = doc(db, 'users', userId, 'reviews', review.id);
    await setDoc(
      reviewRef,
      {
        ...review,
        last_synced_at: new Date().toISOString(),
        last_synced_device: getClientDeviceInfo(),
      },
      { merge: true }
    );

    // 3. Mark trip as COMPLETED and attach review to trip document in Firestore
    if (review.trip_id) {
      const tripRef = doc(db, 'users', userId, 'trips', review.trip_id);
      await setDoc(
        tripRef,
        {
          status: 'COMPLETED' as const,
          review: review,
          updated_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.error('Error saving trip review to Firestore:', err);
    throw err;
  }
}

// Fetch all reviews written by user from Firestore
export async function fetchUserReviewsFromFirestore(userId: string): Promise<TripReview[]> {
  const localKey = `voyager_reviews_${userId || 'guest'}`;
  const localFallback: TripReview[] = JSON.parse(localStorage.getItem(localKey) || '[]');

  if (!userId) return localFallback;

  try {
    const reviewsColl = collection(db, 'users', userId, 'reviews');
    const snapshot = await getDocs(reviewsColl);
    const reviews: TripReview[] = [];
    snapshot.forEach((d) => {
      reviews.push(d.data() as TripReview);
    });

    if (reviews.length > 0) {
      reviews.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      localStorage.setItem(localKey, JSON.stringify(reviews));
      return reviews;
    }
  } catch (err) {
    console.warn('Firestore fetch reviews error, using local fallback:', err);
  }

  return localFallback;
}

// Real-time listener for user's reviews
export function subscribeToUserReviews(
  userId: string,
  onReviewsChanged: (reviews: TripReview[]) => void
): () => void {
  const localKey = `voyager_reviews_${userId || 'guest'}`;
  const localFallback: TripReview[] = JSON.parse(localStorage.getItem(localKey) || '[]');
  onReviewsChanged(localFallback);

  if (!userId) return () => {};

  try {
    const reviewsColl = collection(db, 'users', userId, 'reviews');
    return onSnapshot(
      reviewsColl,
      (snapshot) => {
        const reviews: TripReview[] = [];
        snapshot.forEach((d) => {
          reviews.push(d.data() as TripReview);
        });
        reviews.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        localStorage.setItem(localKey, JSON.stringify(reviews));
        onReviewsChanged(reviews);
      },
      (error) => {
        console.warn('Firestore subscription warning (reviews):', error);
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to reviews:', err);
    return () => {};
  }
}

export {
  signInWithPopup,
  firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
};
