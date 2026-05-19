const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, initDatabase, seedDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
initDatabase();
seedDatabase();

// ═══════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════

// ─── GET /api/platforms ───
app.get('/api/platforms', (req, res) => {
  try {
    const platforms = db.prepare('SELECT * FROM platforms ORDER BY rating DESC').all();
    platforms.forEach(p => {
      p.strengths = JSON.parse(p.strengths || '[]');
      p.weaknesses = JSON.parse(p.weaknesses || '[]');
    });
    res.json({ success: true, data: platforms });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/deals ───
app.get('/api/deals', (req, res) => {
  try {
    const { type, category, platform, search, active } = req.query;
    let query = `
      SELECT d.*, p.name as platform_name, p.icon as platform_icon, p.color as platform_color, p.slug as platform_slug
      FROM deals d JOIN platforms p ON d.platform_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (type && type !== 'all') {
      query += ' AND d.type = ?';
      params.push(type);
    }
    if (category && category !== 'all') {
      query += ' AND d.category = ?';
      params.push(category);
    }
    if (platform && platform !== 'all') {
      query += ' AND p.slug = ?';
      params.push(platform);
    }
    if (search) {
      query += ' AND (d.title LIKE ? OR d.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (active !== '0') {
      query += ' AND d.is_active = 1';
    }

    query += ' ORDER BY d.votes DESC, d.created_at DESC';

    const deals = db.prepare(query).all(...params);
    res.json({ success: true, data: deals, total: deals.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/deals/:id ───
app.get('/api/deals/:id', (req, res) => {
  try {
    const deal = db.prepare(`
      SELECT d.*, p.name as platform_name, p.icon as platform_icon, p.color as platform_color
      FROM deals d JOIN platforms p ON d.platform_id = p.id WHERE d.id = ?
    `).get(req.params.id);
    if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });
    res.json({ success: true, data: deal });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/deals/:id/vote ───
app.post('/api/deals/:id/vote', (req, res) => {
  try {
    const { vote_type, session_id } = req.body;
    if (!['up', 'down'].includes(vote_type)) {
      return res.status(400).json({ success: false, error: 'Invalid vote type' });
    }

    const sid = session_id || 'anonymous';
    const existing = db.prepare(
      'SELECT * FROM votes WHERE target_type = ? AND target_id = ? AND session_id = ?'
    ).get('deal', req.params.id, sid);

    if (existing) {
      if (existing.vote_type === vote_type) {
        // Remove vote
        db.prepare('DELETE FROM votes WHERE id = ?').run(existing.id);
        const delta = vote_type === 'up' ? -1 : 1;
        db.prepare('UPDATE deals SET votes = votes + ? WHERE id = ?').run(delta, req.params.id);
      } else {
        // Change vote
        db.prepare('UPDATE votes SET vote_type = ? WHERE id = ?').run(vote_type, existing.id);
        const delta = vote_type === 'up' ? 2 : -2;
        db.prepare('UPDATE deals SET votes = votes + ? WHERE id = ?').run(delta, req.params.id);
      }
    } else {
      db.prepare('INSERT INTO votes (target_type, target_id, vote_type, session_id) VALUES (?, ?, ?, ?)')
        .run('deal', req.params.id, vote_type, sid);
      const delta = vote_type === 'up' ? 1 : -1;
      db.prepare('UPDATE deals SET votes = votes + ? WHERE id = ?').run(delta, req.params.id);
    }

    const deal = db.prepare('SELECT votes FROM deals WHERE id = ?').get(req.params.id);
    res.json({ success: true, votes: deal.votes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/promos ───
app.get('/api/promos', (req, res) => {
  try {
    const { platform } = req.query;
    let query = `
      SELECT pr.*, p.name as platform_name, p.icon as platform_icon, p.color as platform_color, p.slug as platform_slug
      FROM promos pr JOIN platforms p ON pr.platform_id = p.id
      WHERE pr.is_active = 1
    `;
    const params = [];

    if (platform && platform !== 'all') {
      query += ' AND p.slug = ?';
      params.push(platform);
    }

    query += ' ORDER BY pr.votes DESC, pr.times_copied DESC';
    const promos = db.prepare(query).all(...params);
    res.json({ success: true, data: promos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/promos/:id/copy ───
app.post('/api/promos/:id/copy', (req, res) => {
  try {
    db.prepare('UPDATE promos SET times_copied = times_copied + 1 WHERE id = ?').run(req.params.id);
    const promo = db.prepare('SELECT times_copied FROM promos WHERE id = ?').get(req.params.id);
    res.json({ success: true, times_copied: promo.times_copied });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/promos/:id/vote ───
app.post('/api/promos/:id/vote', (req, res) => {
  try {
    const { vote_type, session_id } = req.body;
    if (!['up', 'down'].includes(vote_type)) {
      return res.status(400).json({ success: false, error: 'Invalid vote type' });
    }

    const sid = session_id || 'anonymous';
    const existing = db.prepare(
      'SELECT * FROM votes WHERE target_type = ? AND target_id = ? AND session_id = ?'
    ).get('promo', req.params.id, sid);

    if (existing) {
      if (existing.vote_type === vote_type) {
        db.prepare('DELETE FROM votes WHERE id = ?').run(existing.id);
        const delta = vote_type === 'up' ? -1 : 1;
        db.prepare('UPDATE promos SET votes = votes + ? WHERE id = ?').run(delta, req.params.id);
      } else {
        db.prepare('UPDATE votes SET vote_type = ? WHERE id = ?').run(vote_type, existing.id);
        const delta = vote_type === 'up' ? 2 : -2;
        db.prepare('UPDATE promos SET votes = votes + ? WHERE id = ?').run(delta, req.params.id);
      }
    } else {
      db.prepare('INSERT INTO votes (target_type, target_id, vote_type, session_id) VALUES (?, ?, ?, ?)')
        .run('promo', req.params.id, vote_type, sid);
      const delta = vote_type === 'up' ? 1 : -1;
      db.prepare('UPDATE promos SET votes = votes + ? WHERE id = ?').run(delta, req.params.id);
    }

    const promo = db.prepare('SELECT votes FROM promos WHERE id = ?').get(req.params.id);
    res.json({ success: true, votes: promo.votes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/calculator/compare ───
app.post('/api/calculator/compare', (req, res) => {
  try {
    const { food_item, food_price, quantity, distance, promo_code, is_peak } = req.body;

    const basePrice = parseInt(food_price) || 0;
    const qty = parseInt(quantity) || 1;
    if (basePrice <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid food price' });
    }

    const foodTotal = basePrice * qty;
    const feeData = {
      foodpanda: { near: 25, mid: 49, far: 99, surge: 50, service: 10 },
      pathao:    { near: 20, mid: 39, far: 79, surge: 30, service: 5 },
      foodi:     { near: 15, mid: 30, far: 69, surge: 20, service: 5 }
    };

    const platforms = db.prepare('SELECT * FROM platforms ORDER BY id').all();
    const results = [];

    platforms.forEach(platform => {
      const fees = feeData[platform.slug];
      let deliveryFee = fees[distance] || fees.mid;
      let serviceFee = fees.service;
      let discount = 0;
      let discountLabel = '';
      let surgeExtra = is_peak ? fees.surge : 0;

      if (promo_code === 'DEALNAO' && platform.slug === 'foodpanda') {
        discount = Math.min(foodTotal * 0.4, 100);
        discountLabel = 'DEALNAO: 40% off (max ৳100)';
      } else if (promo_code === 'FOODIGP' && platform.slug === 'foodi') {
        discount = Math.min(60, foodTotal);
        deliveryFee = 0;
        discountLabel = 'FOODIGP: ৳60 off + Free Delivery';
      } else if (promo_code === 'PATHAO30' && platform.slug === 'pathao') {
        discount = Math.min(foodTotal * 0.3, 120);
        discountLabel = 'PATHAO30: 30% off (max ৳120)';
      } else if (promo_code === 'PTPOINTS' && platform.slug === 'pathao') {
        discount = 30;
        discountLabel = 'Pathao Points: ৳30 off';
      } else if (promo_code === 'FOODI20' && platform.slug === 'foodi') {
        discount = Math.min(foodTotal * 0.2, 80);
        discountLabel = 'FOODI20: 20% off (max ৳80)';
      } else if (promo_code === 'bogo') {
        if (qty >= 2) {
          discount = basePrice * Math.floor(qty / 2);
          discountLabel = 'BOGO: ' + Math.floor(qty / 2) + ' item(s) FREE';
        }
      }

      const total = Math.max(foodTotal + deliveryFee + surgeExtra + serviceFee - discount, 0);

      results.push({
        platform_slug: platform.slug,
        platform_name: platform.name,
        platform_icon: platform.icon,
        platform_color: platform.color,
        food_total: foodTotal,
        delivery_fee: deliveryFee,
        surge_extra: surgeExtra,
        service_fee: serviceFee,
        discount: discount,
        discount_label: discountLabel,
        total: total
      });
    });

    results.sort((a, b) => a.total - b.total);

    // Save to history
    db.prepare(`
      INSERT INTO calc_history (food_item, food_price, quantity, distance, promo_code, is_peak, cheapest_platform, cheapest_price, results)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(food_item, basePrice, qty, distance, promo_code || null, is_peak ? 1 : 0,
      results[0].platform_name, results[0].total, JSON.stringify(results));

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/deals/report ───
app.post('/api/deals/report', (req, res) => {
  try {
    const { reporter_name, reporter_email, platform_slug, deal_type, title, description, promo_code, restaurant_name, area } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, error: 'Title and description are required' });
    }

    let platformId = null;
    if (platform_slug) {
      const platform = db.prepare('SELECT id FROM platforms WHERE slug = ?').get(platform_slug);
      if (platform) platformId = platform.id;
    }

    const result = db.prepare(`
      INSERT INTO deal_reports (reporter_name, reporter_email, platform_id, deal_type, title, description, promo_code, restaurant_name, area)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(reporter_name || null, reporter_email || null, platformId, deal_type || null, title, description, promo_code || null, restaurant_name || null, area || null);

    res.json({ success: true, id: result.lastInsertRowid, message: 'Deal report submitted! We will verify and add it.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/stats ───
app.get('/api/stats', (req, res) => {
  try {
    const totalDeals = db.prepare('SELECT COUNT(*) as c FROM deals WHERE is_active = 1').get().c;
    const totalPromos = db.prepare('SELECT COUNT(*) as c FROM promos WHERE is_active = 1').get().c;
    const totalPlatforms = db.prepare('SELECT COUNT(*) as c FROM platforms').get().c;
    const totalComparisons = db.prepare('SELECT COUNT(*) as c FROM calc_history').get().c;
    const topDeal = db.prepare('SELECT title, votes FROM deals WHERE is_active = 1 ORDER BY votes DESC LIMIT 1').get();
    const mostCopied = db.prepare('SELECT code, times_copied FROM promos WHERE is_active = 1 ORDER BY times_copied DESC LIMIT 1').get();
    const cheapestWins = db.prepare(`SELECT cheapest_platform, COUNT(*) as wins FROM calc_history GROUP BY cheapest_platform ORDER BY wins DESC`).all();

    res.json({
      success: true,
      data: { totalDeals, totalPromos, totalPlatforms, totalComparisons, topDeal, mostCopied, cheapestWins }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/calculator/history ───
app.get('/api/calculator/history', (req, res) => {
  try {
    const history = db.prepare('SELECT * FROM calc_history ORDER BY created_at DESC LIMIT 20').all();
    history.forEach(h => { h.results = JSON.parse(h.results || '[]'); });
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Catch-all: serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🍔 DealBite Dhaka server running at http://localhost:${PORT}\n`);
});
