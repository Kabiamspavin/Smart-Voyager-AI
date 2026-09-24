import { DestinationGuide } from '../../src/types.js';

export const DESTINATION_KNOWLEDGE_BASE: DestinationGuide[] = [
  {
    id: 'guide_delhi',
    name: 'Delhi',
    country: 'India',
    tagline: 'The Eternal City of Empires, Gardens & Unrivaled Street Food',
    overview:
      'Delhi stands as an extraordinary living palimpsest where centuries-old Mughal fortresses, British imperial boulevards, and ultra-modern metro arteries co-exist in dynamic harmony.',
    best_time_to_visit: 'October to March (Crisp sunny afternoons and cool evenings)',
    currency: 'INR (₹)',
    language: 'Hindi, English, Punjabi, Urdu',
    cultural_tips: [
      'Cover your shoulders and head with a scarf when entering religious sanctuaries such as Gurudwara Bangla Sahib and Jama Masjid.',
      'Remove footwear at temple entrances; look for the designated shoe token counter.',
      'Use the Delhi Metro (Pink, Yellow, and Violet lines) for seamless, air-conditioned transit that completely bypasses road congestion.',
      'Bargaining is customary at roadside markets like Janpath and Sarojini Nagar, but prices in Dilli Haat and fixed-price emporiums are non-negotiable.',
    ],
    top_neighborhoods: [
      { name: 'Old Delhi (Shahjahanabad)', vibe: 'Dense, Historic, Kinetic', best_for: 'Spices, Street Food & Mughal Architecture' },
      { name: 'Lutyens Delhi', vibe: 'Spacious, Grand, Tree-lined', best_for: 'Museums, Monuments & Diplomatic Mansions' },
      { name: 'Hauz Khas Village & Mehrauli', vibe: 'Bohemian, Ancient Ruin Backdrops', best_for: 'Designer Boutiques, Rooftop Dining & Antiques' },
      { name: 'Connaught Place (CP)', vibe: 'Colonial Circular Georgian Piazza', best_for: 'Bookshops, Heritage Cafes & Metro Interchanges' },
    ],
    safety_advisory:
      'Keep your valuables secure in crowded market alleyways. Use registered app-based cabs (Uber/Ola) or prepaid airport booths during late-night arrivals. Drink bottled or filtered water.',
    image_url: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1200&q=80',
    estimated_daily_budget_inr: 4500,
    popular_attractions: [
      { name: 'Qutub Minar', category: 'Heritage', rating: 4.7, fee_inr: 50 },
      { name: 'Humayun’s Tomb', category: 'Heritage', rating: 4.7, fee_inr: 50 },
      { name: 'Red Fort', category: 'Heritage', rating: 4.5, fee_inr: 50 },
      { name: 'Lotus Temple', category: 'Spiritual', rating: 4.6, fee_inr: 0 },
      { name: 'Dilli Haat INA', category: 'Crafts', rating: 4.5, fee_inr: 100 },
    ],
  },
  {
    id: 'guide_chennai',
    name: 'Chennai',
    country: 'India',
    tagline: 'The Cultural Soul of South India, Carnatic Music & Coastal Warmth',
    overview:
      'Formerly Madras, Chennai is the capital of Tamil Nadu, renowned for its ancient Dravidian temple spires, classical arts, world-class healthcare, golden coastlines, and savory breakfast heritage.',
    best_time_to_visit: 'November to February (Pleasant maritime breezes and gentle warmth)',
    currency: 'INR (₹)',
    language: 'Tamil, English',
    cultural_tips: [
      'Early mornings (6:00 AM - 8:30 AM) are the golden hour for visiting Mylapore temples and sipping authentic degree filter coffee.',
      'Savor meals on fresh plantain leaves using your right hand for authentic local etiquette.',
      'Auto-rickshaws often run on meter or app bookings (Ola/Uber) to avoid fare disputes.',
    ],
    top_neighborhoods: [
      { name: 'Mylapore', vibe: 'Devotional, Classical, Ancient', best_for: 'Kapaleeshwarar Temple, Silk Sarees & Filter Coffee' },
      { name: 'Besant Nagar (Bessie)', vibe: 'Breezy Beachfront, Hip Cafes', best_for: 'Evening Promenade Strolls & Seafood' },
      { name: 'T. Nagar', vibe: 'Bustling Commercial Epicenter', best_for: 'Kanchipuram Silks & Gold Jewellery' },
      { name: 'East Coast Road (ECR)', vibe: 'Coastal Escapes & Heritage', best_for: 'DakshinaChitra, Beach Resorts & Surf Schools' },
    ],
    safety_advisory:
      'Strong undercurrents are present at Marina and Elliot beaches; swimming is strictly prohibited. Stay hydrated with fresh tender coconut water available on every street corner.',
    image_url: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1200&q=80',
    estimated_daily_budget_inr: 3800,
    popular_attractions: [
      { name: 'Kapaleeshwarar Temple', category: 'Heritage', rating: 4.8, fee_inr: 0 },
      { name: 'Marina Beach', category: 'Coastal', rating: 4.5, fee_inr: 0 },
      { name: 'DakshinaChitra Heritage Museum', category: 'Culture', rating: 4.6, fee_inr: 175 },
      { name: 'San Thome Basilica', category: 'Heritage', rating: 4.6, fee_inr: 0 },
    ],
  },
  {
    id: 'guide_jaipur',
    name: 'Jaipur',
    country: 'India',
    tagline: 'The Pink City of Fortresses, Royal Astrolabes & Block Prints',
    overview:
      'Part of India\'s legendary Golden Triangle, Jaipur is a city planned with ancient Vastu Shastra principles, painted terracotta pink to welcome the Prince of Wales in 1876.',
    best_time_to_visit: 'October to March (Dry, sunny, and pleasant for fort hikes)',
    currency: 'INR (₹)',
    language: 'Hindi, Rajasthani, English',
    cultural_tips: [
      'Visit Amber Fort in the morning to beat the afternoon desert heat and tour the Sheesh Mahal mirror work in good natural light.',
      'Sample Dal Baati Churma, Pyaaz Kachori, and Ghewar at traditional sweet shops.',
      'Purchase genuine block-printed textiles from verified cooperative guilds in Sanganer and Bagru.',
    ],
    top_neighborhoods: [
      { name: 'Walled Pink City', vibe: 'Regal, Historic, Vibrant', best_for: 'City Palace, Jantar Mantar & Bazaars' },
      { name: 'Amer', vibe: 'Dramatic Hilltop Fortress Foothills', best_for: 'Amber Fort, Stepwells & Sunset Vistas' },
      { name: 'C-Scheme', vibe: 'Chic, Leafy, Cosmopolitan', best_for: 'Art Cafes, Contemporary Boutiques & Fine Dining' },
    ],
    safety_advisory:
      'Politely decline aggressive touts offering unauthorized gem valuations or palace tours. Always purchase entry tickets from official Rajasthan Tourism counters or e-ticketing portals.',
    image_url: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1200&q=80',
    estimated_daily_budget_inr: 4200,
    popular_attractions: [
      { name: 'Amber Palace', category: 'Heritage', rating: 4.7, fee_inr: 100 },
      { name: 'Hawa Mahal', category: 'Heritage', rating: 4.6, fee_inr: 50 },
      { name: 'Jantar Mantar', category: 'Science & UNESCO', rating: 4.6, fee_inr: 50 },
      { name: 'Nahargarh Fort', category: 'Scenic', rating: 4.7, fee_inr: 50 },
    ],
  },
  {
    id: 'guide_kerala',
    name: 'Kerala',
    country: 'India',
    tagline: 'God\'s Own Country — Emerald Backwaters, Spice Hills & Ayurvedic Wellness',
    overview:
      'A slender coastal strip of tropical beauty, Kerala encompasses tranquil palm-rimmed backwaters, tea plantation hills in Munnar, wildlife sanctuaries, and Kathakali classical dance.',
    best_time_to_visit: 'September to March (Post-monsoon freshness and calm waterways)',
    currency: 'INR (₹)',
    language: 'Malayalam, English',
    cultural_tips: [
      'Take an eco-friendly solar or punted canoe into narrow backwater canals for an intimate look at village coir spinning and fishing.',
      'Attend a live Kathakali or Kalaripayattu martial arts demonstration in Kochi or Thekkady.',
      'Treat Ayurvedic massages and therapies as holistic healthcare; ensure therapists are licensed at accredited centers.',
    ],
    top_neighborhoods: [
      { name: 'Fort Kochi', vibe: 'Colonial Maritime, Art Biennial', best_for: 'Chinese Nets, Spice Warehouses & Cafes' },
      { name: 'Alappuzha (Alleppey)', vibe: 'Waterways & Slow Living', best_for: 'Houseboat Cruises & Village Canal Strolls' },
      { name: 'Munnar', vibe: 'Misty High-Altitude Green Valleys', best_for: 'Tea Gardens, Waterfalls & Trekking' },
    ],
    safety_advisory:
      'Always wear life jackets on public boat transfers and lake canoes. Respect conservation guidelines in Periyar Tiger Reserve.',
    image_url: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=80',
    estimated_daily_budget_inr: 4000,
    popular_attractions: [
      { name: 'Alleppey Backwaters', category: 'Nature', rating: 4.8, fee_inr: 500 },
      { name: 'Fort Kochi Heritage Area', category: 'Heritage', rating: 4.6, fee_inr: 0 },
      { name: 'Eravikulam National Park', category: 'Wildlife', rating: 4.6, fee_inr: 200 },
      { name: 'Athirappilly Falls', category: 'Nature', rating: 4.7, fee_inr: 50 },
    ],
  },
];

export class RagService {
  getDestinationGuide(destination: string): DestinationGuide | undefined {
    const dest = destination.toLowerCase().trim();
    return DESTINATION_KNOWLEDGE_BASE.find(
      (g) => g.name.toLowerCase().includes(dest) || dest.includes(g.name.toLowerCase())
    );
  }

  getAllGuides(): DestinationGuide[] {
    return DESTINATION_KNOWLEDGE_BASE;
  }

  queryKnowledge(destination: string, topic: string): string {
    const guide = this.getDestinationGuide(destination);
    if (!guide) {
      return `Destination guide for "${destination}" highlights local culinary delights, historic landmarks, and scenic outdoor spots. Always check local transit and seasonal weather before traveling.`;
    }

    const t = topic.toLowerCase();
    if (t.includes('food') || t.includes('eat') || t.includes('restaurant')) {
      return `${guide.name} Culinary Insight: Renowned for authentic regional specialties. Best neighborhood for food: ${guide.top_neighborhoods[0]?.name || 'City Center'} (${guide.top_neighborhoods[0]?.best_for || 'local cuisine'}). Daily food estimate: ₹1,000 - ₹2,000 per person.`;
    }

    if (t.includes('neighborhood') || t.includes('stay') || t.includes('area')) {
      return `${guide.name} Neighborhood Advice: ` + guide.top_neighborhoods.map((n) => `${n.name} (${n.vibe}) - Best for ${n.best_for}`).join('; ');
    }

    if (t.includes('etiquette') || t.includes('culture') || t.includes('custom')) {
      return `${guide.name} Cultural Guidance: ` + guide.cultural_tips.join(' ');
    }

    if (t.includes('safe') || t.includes('emergency') || t.includes('advice')) {
      return `${guide.name} Advisory: ${guide.safety_advisory}`;
    }

    return `${guide.name} Overview: ${guide.overview} Best time to visit: ${guide.best_time_to_visit}. Currency: ${guide.currency}.`;
  }
}

export const ragService = new RagService();
