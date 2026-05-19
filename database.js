const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'dealbite.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

function initDatabase() {
  // ─── Platforms Table ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS platforms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      tag TEXT,
      delivery_fee_min INTEGER,
      delivery_fee_max INTEGER,
      surge_max INTEGER,
      service_fee_min INTEGER,
      service_fee_max INTEGER,
      min_order_min INTEGER,
      min_order_max INTEGER,
      free_delivery_info TEXT,
      rating REAL DEFAULT 0,
      strengths TEXT,
      weaknesses TEXT,
      website TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── Deals Table ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('bogo', 'flat', 'combo', 'freedelivery')),
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      savings TEXT,
      original_price INTEGER,
      deal_price INTEGER,
      discount_percent INTEGER,
      max_discount INTEGER,
      min_order INTEGER,
      expires TEXT,
      is_active INTEGER DEFAULT 1,
      is_verified INTEGER DEFAULT 1,
      is_user_submitted INTEGER DEFAULT 0,
      votes INTEGER DEFAULT 0,
      submitted_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (platform_id) REFERENCES platforms(id)
    )
  `);

  // ─── Promo Codes Table ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS promos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      description TEXT NOT NULL,
      discount_type TEXT CHECK(discount_type IN ('percentage', 'flat', 'freedelivery', 'cashback')),
      discount_value INTEGER,
      max_discount INTEGER,
      min_order INTEGER,
      validity TEXT,
      usage_limit TEXT,
      is_active INTEGER DEFAULT 1,
      is_verified INTEGER DEFAULT 1,
      is_user_submitted INTEGER DEFAULT 0,
      votes INTEGER DEFAULT 0,
      times_copied INTEGER DEFAULT 0,
      submitted_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (platform_id) REFERENCES platforms(id)
    )
  `);

  // ─── User Deal Reports ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS deal_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_name TEXT,
      reporter_email TEXT,
      platform_id INTEGER,
      deal_type TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      promo_code TEXT,
      restaurant_name TEXT,
      area TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (platform_id) REFERENCES platforms(id)
    )
  `);

  // ─── Calculator History ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS calc_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_item TEXT,
      food_price INTEGER,
      quantity INTEGER,
      distance TEXT,
      promo_code TEXT,
      is_peak INTEGER DEFAULT 0,
      cheapest_platform TEXT,
      cheapest_price INTEGER,
      results TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── Votes Table ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL CHECK(target_type IN ('deal', 'promo')),
      target_id INTEGER NOT NULL,
      vote_type TEXT NOT NULL CHECK(vote_type IN ('up', 'down')),
      session_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(target_type, target_id, session_id)
    )
  `);

  console.log('✅ Database tables created');
}

function seedDatabase() {
  // Check if already seeded
  const count = db.prepare('SELECT COUNT(*) as c FROM platforms').get();
  if (count.c > 0) {
    console.log('📦 Database already seeded');
    return;
  }

  // ─── Seed Platforms ───
  const insertPlatform = db.prepare(`
    INSERT INTO platforms (slug, name, icon, color, tag, delivery_fee_min, delivery_fee_max, surge_max, 
      service_fee_min, service_fee_max, min_order_min, min_order_max, free_delivery_info, rating, 
      strengths, weaknesses, website)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const platforms = [
    ['foodpanda', 'foodpanda', '🐼', '#d70f64', 'Market Leader', 25, 99, 149, 5, 15, 100, 200,
      'Via vouchers & pandapro', 7.5,
      JSON.stringify(['Largest restaurant network in Dhaka', 'Frequent promo codes & flash sales', 'Reliable live tracking', 'BOGO deals on popular items', 'pandapro subscription for free delivery']),
      JSON.stringify(['Higher base menu prices', 'Surge pricing during rain/peak', 'Service fees add up']),
      'https://www.foodpanda.com.bd'],
    ['pathao', 'Pathao Food', '🏍️', '#00b14f', 'Best Value', 20, 79, 99, 0, 10, 80, 150,
      'Frequent promos & Pathao Points', 8.5,
      JSON.stringify(['Lowest combined cost overall', 'Pathao Points rewards system', 'Bank partner discounts (BRAC, EBL)', 'GP STAR exclusive offers', 'Integrated with Pathao ride ecosystem']),
      JSON.stringify(['Smaller restaurant selection', 'Limited late-night delivery coverage']),
      'https://pathao.com'],
    ['foodi', 'Foodi', '🍕', '#ff6b35', 'Budget Pick', 15, 69, 50, 0, 10, 60, 100,
      'FOODIGP code + GP STAR perks', 8.0,
      JSON.stringify(['Lowest base delivery fees', 'GP STAR: free delivery 5x/month', '৳60 off on ৳299+ orders', 'Great for budget meals', 'Growing restaurant network']),
      JSON.stringify(['Smaller restaurant network', 'Customer support can be slow', 'Limited payment options']),
      'https://foodi.com.bd']
  ];

  const insertPlatforms = db.transaction(() => {
    platforms.forEach(p => insertPlatform.run(...p));
  });
  insertPlatforms();

  // ─── Seed Deals ───
  const insertDeal = db.prepare(`
    INSERT INTO deals (platform_id, type, category, title, description, savings, original_price, deal_price, 
      discount_percent, max_discount, min_order, expires, is_active, is_verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
  `);

  const deals = [
    [1, 'bogo', 'kacchi', 'BOGO Kacchi Biryani', 'Buy 1 Kacchi Biryani, get 1 FREE at Star Kabab, Kacchi Bhai, Sultan\'s Dine & more top restaurants.', 'Save ৳350+', 350, 350, null, null, null, 'Limited Time'],
    [1, 'bogo', 'burger', 'Buy 1 Get 1 Premium Burgers', 'BOGO on premium burgers from BFC, Takeout, Chillox, Burger King & other popular chains.', 'Save ৳250+', 250, 250, null, null, null, 'Weekends Only'],
    [1, 'flat', 'burger', '40% Off Burger Combos', 'Use code DEALNAO for 40% off on burger combo meals. Max discount ৳100.', 'Up to ৳100 off', null, null, 40, 100, 249, 'May 2026'],
    [1, 'flat', 'pizza', '30% Off Pizza Orders', 'Flat 30% off on large pizzas from Pizza Hut, Domino\'s & local favorites.', 'Up to ৳150 off', null, null, 30, 150, 399, 'May 2026'],
    [1, 'freedelivery', 'all', 'pandapro Free Delivery', 'Subscribe to pandapro for unlimited free delivery + 10% off every order.', 'Save ৳50-99/order', null, null, 10, null, null, 'Subscription'],
    [2, 'flat', 'kacchi', '30% Off Kacchi Orders', 'Get 30% off on Kacchi Biryani from all partner restaurants. Max discount ৳120.', 'Up to ৳120 off', null, null, 30, 120, 299, 'May 2026'],
    [2, 'bogo', 'burger', 'BOGO Burger Tuesday', 'Every Tuesday — buy any burger, get one free at all partner restaurants across Dhaka.', 'Save ৳200+', 200, 200, null, null, null, 'Every Tuesday'],
    [2, 'flat', 'kacchi', 'Free Delivery on Kacchi', 'Free delivery on all Kacchi Biryani orders above ৳399. Stack with bank card discounts.', 'Save ৳50-79', null, null, null, null, 399, 'Ongoing'],
    [2, 'flat', 'all', 'BRAC Bank 15% Cashback', 'Pay with BRAC Bank card for 15% instant cashback. Max ৳100.', 'Up to ৳100 cashback', null, null, 15, 100, 200, 'May 2026'],
    [2, 'combo', 'chicken', 'Chicken Feast Combo', 'Get 8pc fried chicken + 2 drinks + fries for just ৳499 (usually ৳750).', 'Save ৳251', 750, 499, null, null, null, 'Limited Stock'],
    [3, 'flat', 'kacchi', '৳60 Off Kacchi Orders', 'Flat ৳60 off on orders ৳299+ at all Kacchi Biryani restaurants. Code: FOODIGP.', 'Save ৳60', null, null, null, 60, 299, 'Ongoing'],
    [3, 'bogo', 'burger', 'BOGO Double Burger', 'Buy 1 Double Burger, get 1 FREE at select fast food chains. GP STAR bonus: free delivery.', 'Save ৳300+', 300, 300, null, null, null, 'Limited Offer'],
    [3, 'bogo', 'kacchi', 'BOGO Family Kacchi', 'Buy 1 Family Kacchi platter (serves 4), get 1 single Kacchi Biryani absolutely FREE.', 'Save ৳350+', 900, 900, null, null, null, 'Fri-Sun'],
    [3, 'freedelivery', 'all', 'GP STAR Free Delivery', 'Grameenphone STAR users get free delivery 5 times per month on any order.', 'Save ৳60-70/order', null, null, null, null, null, 'Monthly Reset'],
    [3, 'flat', 'all', '20% Off Everything', 'Use code FOODI20 for 20% off on any order. Max ৳80 discount.', 'Up to ৳80 off', null, null, 20, 80, 199, 'May 2026']
  ];

  const insertDeals = db.transaction(() => {
    deals.forEach(d => insertDeal.run(...d));
  });
  insertDeals();

  // ─── Seed Promos ───
  const insertPromo = db.prepare(`
    INSERT INTO promos (platform_id, code, description, discount_type, discount_value, max_discount, 
      min_order, validity, usage_limit, is_active, is_verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
  `);

  const promos = [
    [1, 'DEALNAO', 'Up to 40% off on your order', 'percentage', 40, 100, 249, 'Valid through May 2026', '3x per user'],
    [1, 'PANDAPRO', 'Free delivery + 10% off every order', 'freedelivery', 10, null, null, 'Subscription-based', 'Unlimited'],
    [1, 'BOGOFP', 'Unlock BOGO section — Buy 1 Get 1 on select items', 'flat', null, null, null, 'Auto-applied on eligible items', 'Unlimited'],
    [1, 'NEWPANDA', '50% off your first 2 orders', 'percentage', 50, 150, 199, 'New users only', '2x per account'],
    [1, 'FPWEEKEND', '25% off weekend orders', 'percentage', 25, 120, 299, 'Sat-Sun only', '1x per weekend'],
    [2, 'PATHAO30', '30% off on your order', 'percentage', 30, 120, 299, 'Valid through May 2026', '5x per user'],
    [2, 'NEWUSER50', '50% off first 3 orders for new users', 'percentage', 50, 150, null, 'New accounts only', '3x per account'],
    [2, 'PTPOINTS', 'Redeem 300 Pathao Points for ৳30 off', 'flat', 30, 30, null, 'Ongoing — earn points per ride/order', 'Unlimited'],
    [2, 'BRACBANK', '15% cashback with BRAC Bank cards', 'cashback', 15, 100, 200, 'May 2026', '2x per month'],
    [2, 'FREERIDE', 'Free delivery on orders ৳399+', 'freedelivery', null, null, 399, 'Ongoing', '3x per week'],
    [3, 'FOODIGP', 'GP STAR: Free delivery + ৳60 off on ৳299+', 'flat', 60, 60, 299, 'Ongoing for GP STAR', '5x per month'],
    [3, 'FOODI20', '20% off on all orders', 'percentage', 20, 80, 199, 'Valid through May 2026', '3x per user'],
    [3, 'GPSTAR', 'Free delivery 5x per month for GP STAR users', 'freedelivery', null, null, null, 'Monthly reset', '5x per month'],
    [3, 'FOODI100', '৳100 off on orders above ৳599', 'flat', 100, 100, 599, 'May 2026', '1x per user']
  ];

  const insertPromos = db.transaction(() => {
    promos.forEach(p => insertPromo.run(...p));
  });
  insertPromos();

  console.log('🌱 Database seeded with sample data');
}

module.exports = { db, initDatabase, seedDatabase };
