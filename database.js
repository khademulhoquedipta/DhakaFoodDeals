const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'dealbite.json');

// Memory storage loaded/saved to JSON
let data = {
  platforms: [],
  deals: [],
  promos: [],
  deal_reports: [],
  calc_history: [],
  votes: []
};

// Auto-save helper
function saveDatabase() {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Auto-load helper
function loadDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
      console.error("Failed to load JSON database, resetting...", e);
      saveDatabase();
    }
  } else {
    saveDatabase();
  }
}

// Setup emulated SQLite database object
const db = {
  pragma: () => {},
  exec: () => {},
  transaction: (fn) => {
    return (...args) => {
      const res = fn(...args);
      saveDatabase();
      return res;
    };
  },
  prepare: (sql) => {
    // Normalize query whitespace for matching
    const query = sql.replace(/\s+/g, ' ').trim();

    return {
      all: (...params) => {
        loadDatabase();

        // 1. Get platforms
        if (query.startsWith('SELECT * FROM platforms ORDER BY rating DESC')) {
          return [...data.platforms].sort((a, b) => b.rating - a.rating);
        }
        if (query.startsWith('SELECT * FROM platforms ORDER BY id')) {
          return [...data.platforms].sort((a, b) => a.id - b.id);
        }

        // 2. Get deals with joins
        if (query.includes('FROM deals d JOIN platforms p ON d.platform_id = p.id')) {
          let list = data.deals.map(d => {
            const p = data.platforms.find(plat => plat.id === d.platform_id) || {};
            return {
              ...d,
              platform_name: p.name,
              platform_icon: p.icon,
              platform_color: p.color,
              platform_slug: p.slug
            };
          });

          // Apply filters matching the query construction in server.js
          // Example parameters: [type, category, platform, search, active]
          // Let's analyze the prepared statement execution. The params array will contain values in the order added.
          // In server.js, filters are added dynamically. Let's parse params by tracking query constraints:
          let paramIdx = 0;
          
          if (query.includes('AND d.type = ?')) {
            const val = params[paramIdx++];
            list = list.filter(item => item.type === val);
          }
          if (query.includes('AND d.category = ?')) {
            const val = params[paramIdx++];
            list = list.filter(item => item.category === val);
          }
          if (query.includes('AND p.slug = ?')) {
            const val = params[paramIdx++];
            list = list.filter(item => item.platform_slug === val);
          }
          if (query.includes('AND (d.title LIKE ? OR d.description LIKE ?)')) {
            const searchVal = params[paramIdx++].replace(/%/g, '').toLowerCase();
            paramIdx++; // skip duplicate search param
            list = list.filter(item => 
              (item.title && item.title.toLowerCase().includes(searchVal)) || 
              (item.description && item.description.toLowerCase().includes(searchVal))
            );
          }
          if (query.includes('AND d.is_active = 1')) {
            list = list.filter(item => item.is_active === 1);
          }

          // Order by votes desc, created_at desc
          list.sort((a, b) => {
            if ((b.votes || 0) !== (a.votes || 0)) {
              return (b.votes || 0) - (a.votes || 0);
            }
            return new Date(b.created_at) - new Date(a.created_at);
          });

          return list;
        }

        // 3. Get promos with joins
        if (query.includes('FROM promos pr JOIN platforms p ON pr.platform_id = p.id')) {
          let list = data.promos.map(pr => {
            const p = data.platforms.find(plat => plat.id === pr.platform_id) || {};
            return {
              ...pr,
              platform_name: p.name,
              platform_icon: p.icon,
              platform_color: p.color,
              platform_slug: p.slug
            };
          });

          let paramIdx = 0;
          if (query.includes('AND p.slug = ?')) {
            const val = params[paramIdx++];
            list = list.filter(item => item.platform_slug === val);
          }
          if (query.includes('pr.is_active = 1')) {
            list = list.filter(item => item.is_active === 1);
          }

          // Order by pr.votes desc, pr.times_copied desc
          list.sort((a, b) => {
            if ((b.votes || 0) !== (a.votes || 0)) {
              return (b.votes || 0) - (a.votes || 0);
            }
            return (b.times_copied || 0) - (a.times_copied || 0);
          });

          return list;
        }

        // 4. Get calculator wins group by
        if (query.includes('GROUP BY cheapest_platform ORDER BY wins DESC')) {
          const counts = {};
          data.calc_history.forEach(h => {
            counts[h.cheapest_platform] = (counts[h.cheapest_platform] || 0) + 1;
          });
          return Object.keys(counts).map(key => ({
            cheapest_platform: key,
            wins: counts[key]
          })).sort((a, b) => b.wins - a.wins);
        }

        // 5. Get recent comparisons
        if (query.includes('FROM calc_history ORDER BY created_at DESC LIMIT 20')) {
          return [...data.calc_history]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 20);
        }

        return [];
      },

      get: (...params) => {
        loadDatabase();

        // 1. Get single deal with join
        if (query.includes('FROM deals d JOIN platforms p ON d.platform_id = p.id WHERE d.id = ?')) {
          const dealId = parseInt(params[0]);
          const d = data.deals.find(item => item.id === dealId);
          if (!d) return undefined;
          const p = data.platforms.find(plat => plat.id === d.platform_id) || {};
          return {
            ...d,
            platform_name: p.name,
            platform_icon: p.icon,
            platform_color: p.color
          };
        }

        // 2. Get single vote
        if (query.includes('SELECT * FROM votes WHERE target_type = ? AND target_id = ? AND session_id = ?')) {
          const [target_type, target_id, session_id] = params;
          return data.votes.find(v => 
            v.target_type === target_type && 
            v.target_id === parseInt(target_id) && 
            v.session_id === session_id
          );
        }

        // 3. Get votes/times_copied for deal or promo
        if (query.includes('SELECT votes FROM deals WHERE id = ?')) {
          const id = parseInt(params[0]);
          const d = data.deals.find(item => item.id === id);
          return d ? { votes: d.votes || 0 } : undefined;
        }
        if (query.includes('SELECT votes FROM promos WHERE id = ?')) {
          const id = parseInt(params[0]);
          const p = data.promos.find(item => item.id === id);
          return p ? { votes: p.votes || 0 } : undefined;
        }
        if (query.includes('SELECT times_copied FROM promos WHERE id = ?')) {
          const id = parseInt(params[0]);
          const p = data.promos.find(item => item.id === id);
          return p ? { times_copied: p.times_copied || 0 } : undefined;
        }

        // 4. Counts for stats
        if (query.includes('SELECT COUNT(*) as c FROM deals WHERE is_active = 1')) {
          return { c: data.deals.filter(item => item.is_active === 1).length };
        }
        if (query.includes('SELECT COUNT(*) as c FROM promos WHERE is_active = 1')) {
          return { c: data.promos.filter(item => item.is_active === 1).length };
        }
        if (query.includes('SELECT COUNT(*) as c FROM platforms')) {
          return { c: data.platforms.length };
        }
        if (query.includes('SELECT COUNT(*) as c FROM calc_history')) {
          return { c: data.calc_history.length };
        }

        // 5. Top deal & most copied
        if (query.includes('SELECT title, votes FROM deals WHERE is_active = 1 ORDER BY votes DESC LIMIT 1')) {
          const activeDeals = data.deals.filter(item => item.is_active === 1);
          if (activeDeals.length === 0) return undefined;
          const sorted = [...activeDeals].sort((a, b) => (b.votes || 0) - (a.votes || 0));
          return { title: sorted[0].title, votes: sorted[0].votes || 0 };
        }
        if (query.includes('SELECT code, times_copied FROM promos WHERE is_active = 1 ORDER BY times_copied DESC LIMIT 1')) {
          const activePromos = data.promos.filter(item => item.is_active === 1);
          if (activePromos.length === 0) return undefined;
          const sorted = [...activePromos].sort((a, b) => (b.times_copied || 0) - (a.times_copied || 0));
          return { code: sorted[0].code, times_copied: sorted[0].times_copied || 0 };
        }

        return undefined;
      },

      run: (...params) => {
        loadDatabase();

        // 1. Delete vote
        if (query.includes('DELETE FROM votes WHERE id = ?')) {
          const id = parseInt(params[0]);
          data.votes = data.votes.filter(v => v.id !== id);
          saveDatabase();
          return { changes: 1 };
        }

        // 2. Update votes for deals/promos
        if (query.includes('UPDATE deals SET votes = votes + ? WHERE id = ?')) {
          const delta = parseInt(params[0]);
          const id = parseInt(params[1]);
          const d = data.deals.find(item => item.id === id);
          if (d) {
            d.votes = (d.votes || 0) + delta;
            saveDatabase();
          }
          return { changes: 1 };
        }
        if (query.includes('UPDATE promos SET votes = votes + ? WHERE id = ?')) {
          const delta = parseInt(params[0]);
          const id = parseInt(params[1]);
          const p = data.promos.find(item => item.id === id);
          if (p) {
            p.votes = (p.votes || 0) + delta;
            saveDatabase();
          }
          return { changes: 1 };
        }
        if (query.includes('UPDATE votes SET vote_type = ? WHERE id = ?')) {
          const vote_type = params[0];
          const id = parseInt(params[1]);
          const v = data.votes.find(item => item.id === id);
          if (v) {
            v.vote_type = vote_type;
            saveDatabase();
          }
          return { changes: 1 };
        }

        // 3. Insert vote
        if (query.includes('INSERT INTO votes (target_type, target_id, vote_type, session_id)')) {
          const [target_type, target_id, vote_type, session_id] = params;
          const newVote = {
            id: data.votes.length > 0 ? Math.max(...data.votes.map(v => v.id)) + 1 : 1,
            target_type,
            target_id: parseInt(target_id),
            vote_type,
            session_id,
            created_at: new Date().toISOString()
          };
          data.votes.push(newVote);
          saveDatabase();
          return { lastInsertRowid: newVote.id, changes: 1 };
        }

        // 4. Copy count update
        if (query.includes('UPDATE promos SET times_copied = times_copied + 1 WHERE id = ?')) {
          const id = parseInt(params[0]);
          const p = data.promos.find(item => item.id === id);
          if (p) {
            p.times_copied = (p.times_copied || 0) + 1;
            saveDatabase();
          }
          return { changes: 1 };
        }

        // 5. Insert comparison history
        if (query.includes('INSERT INTO calc_history')) {
          const [food_item, food_price, quantity, distance, promo_code, is_peak, cheapest_platform, cheapest_price, results] = params;
          const newHistory = {
            id: data.calc_history.length > 0 ? Math.max(...data.calc_history.map(h => h.id)) + 1 : 1,
            food_item,
            food_price,
            quantity,
            distance,
            promo_code,
            is_peak,
            cheapest_platform,
            cheapest_price,
            results,
            created_at: new Date().toISOString()
          };
          data.calc_history.push(newHistory);
          saveDatabase();
          return { lastInsertRowid: newHistory.id, changes: 1 };
        }

        // 6. Insert deal report
        if (query.includes('INSERT INTO deal_reports')) {
          const [reporter_name, reporter_email, platformId, deal_type, title, description, promo_code, restaurant_name, area] = params;
          const newReport = {
            id: data.deal_reports.length > 0 ? Math.max(...data.deal_reports.map(r => r.id)) + 1 : 1,
            reporter_name,
            reporter_email,
            platform_id: platformId,
            deal_type,
            title,
            description,
            promo_code,
            restaurant_name,
            area,
            status: 'pending',
            created_at: new Date().toISOString()
          };
          data.deal_reports.push(newReport);
          saveDatabase();
          return { lastInsertRowid: newReport.id, changes: 1 };
        }

        return { changes: 0 };
      }
    };
  }
};

function initDatabase() {
  loadDatabase();
  console.log('✅ Database loaded/initialized from JSON file');
}

function seedDatabase() {
  if (data.platforms && data.platforms.length > 0) {
    console.log('📦 Database already seeded');
    return;
  }

  // Seed Platforms
  data.platforms = [
    {
      id: 1,
      slug: 'foodpanda',
      name: 'foodpanda',
      icon: '🐼',
      color: '#d70f64',
      tag: 'Market Leader',
      delivery_fee_min: 25,
      delivery_fee_max: 99,
      surge_max: 149,
      service_fee_min: 5,
      service_fee_max: 15,
      min_order_min: 100,
      min_order_max: 200,
      free_delivery_info: 'Via vouchers & pandapro',
      rating: 7.5,
      strengths: ['Largest restaurant network in Dhaka', 'Frequent promo codes & flash sales', 'Reliable live tracking', 'BOGO deals on popular items', 'pandapro subscription for free delivery'],
      weaknesses: ['Higher base menu prices', 'Surge pricing during rain/peak', 'Service fees add up'],
      website: 'https://www.foodpanda.com.bd'
    },
    {
      id: 2,
      slug: 'pathao',
      name: 'Pathao Food',
      icon: '🏍️',
      color: '#00b14f',
      tag: 'Best Value',
      delivery_fee_min: 20,
      delivery_fee_max: 79,
      surge_max: 99,
      service_fee_min: 0,
      service_fee_max: 10,
      min_order_min: 80,
      min_order_max: 150,
      free_delivery_info: 'Frequent promos & Pathao Points',
      rating: 8.5,
      strengths: ['Lowest combined cost overall', 'Pathao Points rewards system', 'Bank partner discounts (BRAC, EBL)', 'GP STAR exclusive offers', 'Integrated with Pathao ride ecosystem'],
      weaknesses: ['Smaller restaurant selection', 'Limited late-night delivery coverage'],
      website: 'https://pathao.com'
    },
    {
      id: 3,
      slug: 'foodi',
      name: 'Foodi',
      icon: '🍕',
      color: '#ff6b35',
      tag: 'Budget Pick',
      delivery_fee_min: 15,
      delivery_fee_max: 69,
      surge_max: 50,
      service_fee_min: 0,
      service_fee_max: 10,
      min_order_min: 60,
      min_order_max: 100,
      free_delivery_info: 'FOODIGP code + GP STAR perks',
      rating: 8.0,
      strengths: ['Lowest base delivery fees', 'GP STAR: free delivery 5x/month', '৳60 off on ৳299+ orders', 'Great for budget meals', 'Growing restaurant network'],
      weaknesses: ['Smaller restaurant network', 'Customer support can be slow', 'Limited payment options'],
      website: 'https://foodi.com.bd'
    }
  ];

  // Seed Deals
  data.deals = [
    { id: 1, platform_id: 1, type: 'bogo', category: 'kacchi', title: 'BOGO Kacchi Biryani', description: 'Buy 1 Kacchi Biryani, get 1 FREE at Star Kabab, Kacchi Bhai, Sultan\'s Dine & more top restaurants.', savings: 'Save ৳350+', original_price: 350, deal_price: 350, discount_percent: null, max_discount: null, min_order: null, expires: 'Limited Time', is_active: 1, votes: 12 },
    { id: 2, platform_id: 1, type: 'bogo', category: 'burger', title: 'Buy 1 Get 1 Premium Burgers', description: 'BOGO on premium burgers from BFC, Takeout, Chillox, Burger King & other popular chains.', savings: 'Save ৳250+', original_price: 250, deal_price: 250, discount_percent: null, max_discount: null, min_order: null, expires: 'Weekends Only', is_active: 1, votes: 9 },
    { id: 3, platform_id: 1, type: 'flat', category: 'burger', title: '40% Off Burger Combos', description: 'Use code DEALNAO for 40% off on burger combo meals. Max discount ৳100.', savings: 'Up to ৳100 off', original_price: null, deal_price: null, discount_percent: 40, max_discount: 100, min_order: 249, expires: 'May 2026', is_active: 1, votes: 8 },
    { id: 4, platform_id: 1, type: 'flat', category: 'pizza', title: '30% Off Pizza Orders', description: 'Flat 30% off on large pizzas from Pizza Hut, Domino\'s & local favorites.', savings: 'Up to ৳150 off', original_price: null, deal_price: null, discount_percent: 30, max_discount: 150, min_order: 399, expires: 'May 2026', is_active: 1, votes: 5 },
    { id: 5, platform_id: 1, type: 'freedelivery', category: 'all', title: 'pandapro Free Delivery', description: 'Subscribe to pandapro for unlimited free delivery + 10% off every order.', savings: 'Save ৳50-99/order', original_price: null, deal_price: null, discount_percent: 10, max_discount: null, min_order: null, expires: 'Subscription', is_active: 1, votes: 14 },
    { id: 6, platform_id: 2, type: 'flat', category: 'kacchi', title: '30% Off Kacchi Orders', description: 'Get 30% off on Kacchi Biryani from all partner restaurants. Max discount ৳120.', savings: 'Up to ৳120 off', original_price: null, deal_price: null, discount_percent: 30, max_discount: 120, min_order: 299, expires: 'May 2026', is_active: 1, votes: 18 },
    { id: 7, platform_id: 2, type: 'bogo', category: 'burger', title: 'BOGO Burger Tuesday', description: 'Every Tuesday — buy any burger, get one free at all partner restaurants across Dhaka.', savings: 'Save ৳200+', original_price: 200, deal_price: 200, discount_percent: null, max_discount: null, min_order: null, expires: 'Every Tuesday', is_active: 1, votes: 15 },
    { id: 8, platform_id: 2, type: 'flat', category: 'kacchi', title: 'Free Delivery on Kacchi', description: 'Free delivery on all Kacchi Biryani orders above ৳399. Stack with bank card discounts.', savings: 'Save ৳50-79', original_price: null, deal_price: null, discount_percent: null, max_discount: null, min_order: 399, expires: 'Ongoing', is_active: 1, votes: 10 },
    { id: 9, platform_id: 2, type: 'flat', category: 'all', title: 'BRAC Bank 15% Cashback', description: 'Pay with BRAC Bank card for 15% instant cashback. Max ৳100.', savings: 'Up to ৳100 cashback', original_price: null, deal_price: null, discount_percent: 15, max_discount: 100, min_order: 200, expires: 'May 2026', is_active: 1, votes: 7 },
    { id: 10, platform_id: 2, type: 'combo', category: 'chicken', title: 'Chicken Feast Combo', description: 'Get 8pc fried chicken + 2 drinks + fries for just ৳499 (usually ৳750).', savings: 'Save ৳251', original_price: 750, deal_price: 499, discount_percent: null, max_discount: null, min_order: null, expires: 'Limited Stock', is_active: 1, votes: 11 },
    { id: 11, platform_id: 3, type: 'flat', category: 'kacchi', title: '৳60 Off Kacchi Orders', description: 'Flat ৳60 off on orders ৳299+ at all Kacchi Biryani restaurants. Code: FOODIGP.', savings: 'Save ৳60', original_price: null, deal_price: null, discount_percent: null, max_discount: 60, min_order: 299, expires: 'Ongoing', is_active: 1, votes: 16 },
    { id: 12, platform_id: 3, type: 'bogo', category: 'burger', title: 'BOGO Double Burger', description: 'Buy 1 Double Burger, get 1 FREE at select fast food chains. GP STAR bonus: free delivery.', savings: 'Save ৳300+', original_price: 300, deal_price: 300, discount_percent: null, max_discount: null, min_order: null, expires: 'Limited Offer', is_active: 1, votes: 13 },
    { id: 13, platform_id: 3, type: 'bogo', category: 'kacchi', title: 'BOGO Family Kacchi', description: 'Buy 1 Family Kacchi platter (serves 4), get 1 single Kacchi Biryani absolutely FREE.', savings: 'Save ৳350+', original_price: 900, deal_price: 900, discount_percent: null, max_discount: null, min_order: null, expires: 'Fri-Sun', is_active: 1, votes: 8 },
    { id: 14, platform_id: 3, type: 'freedelivery', category: 'all', title: 'GP STAR Free Delivery', description: 'Grameenphone STAR users get free delivery 5 times per month on any order.', savings: 'Save ৳60-70/order', original_price: null, deal_price: null, discount_percent: null, max_discount: null, min_order: null, expires: 'Monthly Reset', is_active: 1, votes: 20 },
    { id: 15, platform_id: 3, type: 'flat', category: 'all', title: '20% Off Everything', description: 'Use code FOODI20 for 20% off on any order. Max ৳80 discount.', savings: 'Up to ৳80 off', original_price: null, deal_price: null, discount_percent: 20, max_discount: 80, min_order: 199, expires: 'May 2026', is_active: 1, votes: 9 }
  ];

  // Seed Promos
  data.promos = [
    { id: 1, platform_id: 1, code: 'DEALNAO', description: 'Up to 40% off on your order', discount_type: 'percentage', discount_value: 40, max_discount: 100, min_order: 249, validity: 'Valid through May 2026', usage_limit: '3x per user', is_active: 1, votes: 15, times_copied: 120 },
    { id: 2, platform_id: 1, code: 'PANDAPRO', description: 'Free delivery + 10% off every order', discount_type: 'freedelivery', discount_value: 10, max_discount: null, min_order: null, validity: 'Subscription-based', usage_limit: 'Unlimited', is_active: 1, votes: 9, times_copied: 85 },
    { id: 3, platform_id: 1, code: 'BOGOFP', description: 'Unlock BOGO section — Buy 1 Get 1 on select items', discount_type: 'flat', discount_value: null, max_discount: null, min_order: null, validity: 'Auto-applied on eligible items', usage_limit: 'Unlimited', is_active: 1, votes: 4, times_copied: 64 },
    { id: 4, platform_id: 1, code: 'NEWPANDA', description: '50% off your first 2 orders', discount_type: 'percentage', discount_value: 50, max_discount: 150, min_order: 199, validity: 'New users only', usage_limit: '2x per account', is_active: 1, votes: 12, times_copied: 142 },
    { id: 5, platform_id: 1, code: 'FPWEEKEND', description: '25% off weekend orders', discount_type: 'percentage', discount_value: 25, max_discount: 120, min_order: 299, validity: 'Sat-Sun only', usage_limit: '1x per weekend', is_active: 1, votes: 6, times_copied: 40 },
    { id: 6, platform_id: 2, code: 'PATHAO30', description: '30% off on your order', discount_type: 'percentage', discount_value: 30, max_discount: 120, min_order: 299, validity: 'Valid through May 2026', usage_limit: '5x per user', is_active: 1, votes: 24, times_copied: 195 },
    { id: 7, platform_id: 2, code: 'NEWUSER50', description: '50% off first 3 orders for new users', discount_type: 'percentage', discount_value: 50, max_discount: 150, min_order: null, validity: 'New accounts only', usage_limit: '3x per account', is_active: 1, votes: 19, times_copied: 160 },
    { id: 8, platform_id: 2, code: 'PTPOINTS', description: 'Redeem 300 Pathao Points for ৳30 off', discount_type: 'flat', discount_value: 30, max_discount: 30, min_order: null, validity: 'Ongoing — earn points per ride/order', usage_limit: 'Unlimited', is_active: 1, votes: 11, times_copied: 78 },
    { id: 9, platform_id: 2, code: 'BRACBANK', description: '15% cashback with BRAC Bank cards', discount_type: 'cashback', discount_value: 15, max_discount: 100, min_order: 200, validity: 'May 2026', usage_limit: '2x per month', is_active: 1, votes: 8, times_copied: 35 },
    { id: 10, platform_id: 2, code: 'FREERIDE', description: 'Free delivery on orders ৳399+', discount_type: 'freedelivery', discount_value: null, max_discount: null, min_order: 399, validity: 'Ongoing', usage_limit: '3x per week', is_active: 1, votes: 13, times_copied: 92 },
    { id: 11, platform_id: 3, code: 'FOODIGP', description: 'GP STAR: Free delivery + ৳60 off on ৳299+', discount_type: 'flat', discount_value: 60, max_discount: 60, min_order: 299, validity: 'Ongoing for GP STAR', usage_limit: '5x per month', is_active: 1, votes: 28, times_copied: 210 },
    { id: 12, platform_id: 3, code: 'FOODI20', description: '20% off on all orders', discount_type: 'percentage', discount_value: 20, max_discount: 80, min_order: 199, validity: 'Valid through May 2026', usage_limit: '3x per user', is_active: 1, votes: 14, times_copied: 105 },
    { id: 13, platform_id: 3, code: 'GPSTAR', description: 'Free delivery 5x per month for GP STAR users', discount_type: 'freedelivery', discount_value: null, max_discount: null, min_order: null, validity: 'Monthly reset', usage_limit: '5x per month', is_active: 1, votes: 17, times_copied: 115 },
    { id: 14, platform_id: 3, code: 'FOODI100', description: '৳100 off on orders above ৳599', discount_type: 'flat', discount_value: 100, max_discount: 100, min_order: 599, validity: 'May 2026', usage_limit: '1x per user', is_active: 1, votes: 5, times_copied: 22 }
  ];

  saveDatabase();
  console.log('🌱 Database seeded with default values successfully');
}

module.exports = { db, initDatabase, seedDatabase };
