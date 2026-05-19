# 🍔 DealBite Dhaka — Food Delivery Deal Comparison

> Compare real-time delivery fees, BOGO deals & promo codes across **foodpanda**, **Pathao Food** & **Foodi** in Dhaka. Never overpay again!

![DealBite Dhaka](https://img.shields.io/badge/Platform-Dhaka%20Food%20Deals-orange?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-Express-green?style=for-the-badge&logo=node.js)
![SQLite](https://img.shields.io/badge/Database-SQLite-blue?style=for-the-badge&logo=sqlite)

---

## ✨ Features

- 🔥 **Live Deal Browser** — Filter BOGO, Flat-Off, Free Delivery & Combo deals
- 🎟️ **Promo Code Vault** — Copy verified promo codes with one click
- 🧮 **Smart Price Calculator** — Compare total cost across all 3 platforms instantly
- 📊 **Platform Comparison** — Side-by-side delivery fees, surge pricing & ratings
- 📢 **Community Deal Reports** — Submit deals you find; get them verified & listed
- 🗳️ **Community Voting** — Upvote/downvote deals to surface the best ones
- 🌙 **Dark / Light Mode** — System-aware theme toggle
- 📱 **Fully Responsive** — Mobile-first design

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/khademulhoquedipta/DhakaFoodDeals.git
cd DhakaFoodDeals

# Install dependencies
npm install

# Start the server
npm start
```

Open your browser and visit: **http://localhost:3000**

---

## 📁 Project Structure

```
DhakaFoodDeals/
├── server.js          # Express backend & REST API
├── database.js        # SQLite setup, schema & seed data
├── package.json
├── .gitignore
├── README.md
└── public/            # Static frontend (served by Express)
    ├── index.html     # Main page
    ├── style.css      # Styling (dark/light themes)
    └── app.js         # Frontend JavaScript (API-driven)
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/platforms` | Get all 3 platforms with fees & ratings |
| `GET` | `/api/deals` | Get deals (filter by type, category, platform) |
| `POST` | `/api/deals/:id/vote` | Upvote or downvote a deal |
| `GET` | `/api/promos` | Get active promo codes |
| `POST` | `/api/promos/:id/copy` | Increment copy counter |
| `POST` | `/api/calculator/compare` | Compare total price across platforms |
| `POST` | `/api/deals/report` | Submit a new community deal report |
| `GET` | `/api/stats` | Get platform-wide statistics |
| `GET` | `/api/calculator/history` | Get last 20 comparisons |

---

## 🍽️ Platforms Covered

| Platform | Delivery Fee | Rating |
|----------|-------------|--------|
| 🐼 **foodpanda** | ৳25 – ৳99 | 7.5/10 |
| 🏍️ **Pathao Food** | ৳20 – ৳79 | 8.5/10 |
| 🍕 **Foodi** | ৳15 – ৳69 | 8.0/10 |

---

## 🎟️ Active Promo Codes (May 2026)

| Code | Platform | Discount |
|------|----------|----------|
| `DEALNAO` | foodpanda | 40% off, max ৳100 |
| `PATHAO30` | Pathao Food | 30% off, max ৳120 |
| `FOODIGP` | Foodi | ৳60 off + free delivery |
| `FOODI20` | Foodi | 20% off, max ৳80 |
| `PANDAPRO` | foodpanda | Free delivery + 10% off |
| `NEWUSER50` | Pathao Food | 50% off (new users) |

---

## 🛠️ Tech Stack

- **Backend:** Node.js + Express.js
- **Database:** SQLite (via better-sqlite3)
- **Frontend:** Vanilla HTML, CSS & JavaScript
- **Fonts:** Plus Jakarta Sans + Space Grotesk (Google Fonts)

---

## 📜 License

MIT License — feel free to use and modify.

---

## 👤 Author

**Khademul Hoque Dipta**  
📧 kdipta221567@bscse.uiu.ac.bd  
🐙 [GitHub](https://github.com/khademulhoquedipta)
