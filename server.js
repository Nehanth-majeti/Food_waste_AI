/**
 * SustainAI – Food Waste AI Management System
 * Server v4.1 — Node.js + Express + SQLite
 *
 * NEW in v4.1:
 *   - A* Route Optimization on request acceptance
 *   - AI Chatbot endpoint (POST /chatbot)
 *   - Delivery table extended with route_path, distance, estimated_time
 *   - Users table extended with lat, lon for geospatial features
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
if (!fs.existsSync(path.join(__dirname, 'uploads'))) fs.mkdirSync(path.join(__dirname, 'uploads'));

// Multer config for image uploads
const storage = multer.diskStorage({
    destination: (r, f, cb) => cb(null, 'uploads/'),
    filename: (r, f, cb) => cb(null, Date.now() + path.extname(f.originalname))
});
const upload = multer({ storage });

let db;

/**
 * Initialize SQLite database with all tables.
 * Extends original schema with:
 *   - Users: lat, lon columns for geospatial features
 *   - Delivery: route_path, distance, estimated_time for A* route data
 */
async function initDb() {
    db = await open({
        filename: path.join(__dirname, 'food_v4.sqlite'),
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            lat REAL DEFAULT NULL,
            lon REAL DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS Items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hotel_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            qty INTEGER NOT NULL,
            expiry DATETIME NOT NULL,
            image TEXT,
            status TEXT DEFAULT 'Available',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (hotel_id) REFERENCES Users(id)
        );

        CREATE TABLE IF NOT EXISTS Requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ngo_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            status TEXT DEFAULT 'Pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ngo_id) REFERENCES Users(id),
            FOREIGN KEY (item_id) REFERENCES Items(id)
        );

        CREATE TABLE IF NOT EXISTS Delivery (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            ngo_id INTEGER NOT NULL,
            status TEXT DEFAULT 'Pending',
            route_path TEXT DEFAULT NULL,
            distance REAL DEFAULT NULL,
            estimated_time REAL DEFAULT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES Items(id),
            FOREIGN KEY (ngo_id) REFERENCES Users(id)
        );

        CREATE TABLE IF NOT EXISTS History (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT,
            user_id INTEGER,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Ensure lat/lon columns exist (for existing databases that predate this migration)
    try { await db.exec('ALTER TABLE Users ADD COLUMN lat REAL DEFAULT NULL'); } catch (e) { /* column exists */ }
    try { await db.exec('ALTER TABLE Users ADD COLUMN lon REAL DEFAULT NULL'); } catch (e) { /* column exists */ }
    try { await db.exec('ALTER TABLE Delivery ADD COLUMN route_path TEXT DEFAULT NULL'); } catch (e) { /* column exists */ }
    try { await db.exec('ALTER TABLE Delivery ADD COLUMN distance REAL DEFAULT NULL'); } catch (e) { /* column exists */ }
    try { await db.exec('ALTER TABLE Delivery ADD COLUMN estimated_time REAL DEFAULT NULL'); } catch (e) { /* column exists */ }

    // Seed demo data on first run
    const c = await db.get('SELECT COUNT(*) as c FROM Users');
    if (c.c === 0) {
        // Admin user (no location needed)
        await db.run(
            "INSERT INTO Users (name,email,password,role,lat,lon) VALUES ('System Admin','admin@ai.com','admin123','Admin',NULL,NULL)"
        );
        // Hotel with coordinates (Connaught Place, Delhi)
        await db.run(
            "INSERT INTO Users (name,email,password,role,lat,lon) VALUES ('Grand Hotel','hotel@ai.com','hotel123','Hotel',28.6315,77.2167)"
        );
        // NGO with coordinates (Lajpat Nagar, Delhi)
        await db.run(
            "INSERT INTO Users (name,email,password,role,lat,lon) VALUES ('City NGO','ngo@ai.com','ngo123','NGO',28.5700,77.2400)"
        );

        // Seed some demo food items
        const hid = 2;
        const now = new Date();
        const h6 = new Date(now.getTime() + 6 * 3600000).toISOString();
        const h30 = new Date(now.getTime() + 30 * 3600000).toISOString();
        const h60 = new Date(now.getTime() + 60 * 3600000).toISOString();
        const h100 = new Date(now.getTime() + 100 * 3600000).toISOString();
        await db.run("INSERT INTO Items (hotel_id,name,category,qty,expiry) VALUES (?,?,?,?,?)", [hid, 'Paneer Tikka', 'Vegetarian', 25, h6]);
        await db.run("INSERT INTO Items (hotel_id,name,category,qty,expiry) VALUES (?,?,?,?,?)", [hid, 'Chicken Biryani', 'Non-Veg', 40, h30]);
        await db.run("INSERT INTO Items (hotel_id,name,category,qty,expiry) VALUES (?,?,?,?,?)", [hid, 'Fresh Salad Bowl', 'Salads', 15, h60]);
        await db.run("INSERT INTO Items (hotel_id,name,category,qty,expiry) VALUES (?,?,?,?,?)", [hid, 'Chocolate Cake', 'Bakery', 10, h100]);
    }
}

// =============================================================================
//  AI MODULE BRIDGE — Spawns Python AI process
// =============================================================================

/**
 * Call the Python AI module with a command and data payload.
 * @param {string} cmd - The AI command (predict_expiry, suggest_usage, astar_route, chatbot, etc.)
 * @param {object} data - Data payload to send as JSON
 * @returns {Promise<object>} - Parsed JSON response from the AI module
 */
function callAi(cmd, data) {
    return new Promise((resolve, reject) => {
        const py = spawn('python', [
            path.join(__dirname, 'ai', 'ai_module.py'),  // Fixed path: ./ai/ not ../ai/
            cmd,
            JSON.stringify(data)
        ]);
        let out = '';
        let errOut = '';
        py.stdout.on('data', c => out += c);
        py.stderr.on('data', e => {
            errOut += e.toString();
            console.error('AI stderr:', e.toString());
        });
        py.on('error', e => reject(e.message));
        py.on('close', (code) => {
            if (code !== 0 && !out) {
                reject(errOut || `AI process exited with code ${code}`);
                return;
            }
            try {
                resolve(JSON.parse(out));
            } catch (e) {
                reject(`AI parse error: ${out}`);
            }
        });
    });
}

// =============================================================================
//  AUTH ENDPOINTS
// =============================================================================

/** POST /login — Authenticate user */
app.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        const u = await db.get(
            'SELECT id,name,email,role,lat,lon FROM Users WHERE email=? AND password=? AND role=?',
            [email, password, role]
        );
        u ? res.json({ success: true, user: u }) : res.json({ success: false, message: 'Invalid credentials' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/** POST /register — Create new user account */
app.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, lat, lon } = req.body;
        const r = await db.run(
            'INSERT INTO Users (name,email,password,role,lat,lon) VALUES (?,?,?,?,?,?)',
            [name, email, password, role, lat || null, lon || null]
        );
        res.json({ success: true, userId: r.lastID });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// =============================================================================
//  ITEMS ENDPOINTS
// =============================================================================

/** POST /addItem — Add a new food item (with optional image upload) */
app.post('/addItem', upload.single('image'), async (req, res) => {
    try {
        const { hotel_id, name, category, qty, expiry } = req.body;
        const img = req.file ? '/uploads/' + req.file.filename : null;

        // AI: Check if item is already expired
        const ai = await callAi('predict_expiry', { expiry });
        if (ai.is_expired) {
            return res.status(400).json({ success: false, message: 'Item already expired' });
        }

        const r = await db.run(
            'INSERT INTO Items (hotel_id,name,category,qty,expiry,image) VALUES (?,?,?,?,?,?)',
            [hotel_id, name, category, qty, expiry, img]
        );
        res.json({ success: true, itemId: r.lastID, expiry_info: ai });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/** GET /getItems — List food items (all available OR filtered by hotel_id) */
app.get('/getItems', async (req, res) => {
    try {
        const hid = req.query.hotel_id;
        const rows = hid
            ? await db.all("SELECT i.*,u.name as hotel_name FROM Items i JOIN Users u ON i.hotel_id=u.id WHERE i.hotel_id=?", [hid])
            : await db.all("SELECT i.*,u.name as hotel_name FROM Items i JOIN Users u ON i.hotel_id=u.id WHERE i.status='Available'");
        res.json({ success: true, items: rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/** GET /getExpiring — List expiring items with AI enrichment */
app.get('/getExpiring', async (req, res) => {
    try {
        const rows = await db.all("SELECT i.*,u.name as hotel_name FROM Items i JOIN Users u ON i.hotel_id=u.id WHERE i.status='Available'");
        const enriched = [];
        for (const item of rows) {
            const ai = await callAi('predict_expiry', { expiry: item.expiry });
            enriched.push({ ...item, ...ai });
        }
        enriched.sort((a, b) => a.hours_left - b.hours_left);
        res.json({ success: true, items: enriched.filter(i => i.label !== 'Fresh') });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/** GET /getSuggestions — AI-powered usage suggestions */
app.get('/getSuggestions', async (req, res) => {
    try {
        const rows = await db.all("SELECT * FROM Items WHERE status='Available'");
        const ai = await callAi('suggest_usage', { items: rows });
        res.json({ success: true, suggestions: ai.suggestions || [] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// =============================================================================
//  REQUEST ENDPOINTS
// =============================================================================

/** POST /sendRequest — NGO sends a food request */
app.post('/sendRequest', async (req, res) => {
    try {
        const { ngo_id, item_id } = req.body;
        await db.run("UPDATE Items SET status='Pending' WHERE id=?", [item_id]);
        const r = await db.run('INSERT INTO Requests (ngo_id,item_id) VALUES (?,?)', [ngo_id, item_id]);
        res.json({ success: true, requestId: r.lastID });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/** GET /getRequests — List requests (all or filter by hotel_id) */
app.get('/getRequests', async (req, res) => {
    try {
        const hid = req.query.hotel_id;
        const rows = hid
            ? await db.all(
                "SELECT r.*,i.name as item_name,i.qty,u.name as ngo_name FROM Requests r JOIN Items i ON r.item_id=i.id JOIN Users u ON r.ngo_id=u.id WHERE i.hotel_id=? AND r.status='Pending'",
                [hid]
              )
            : await db.all(
                "SELECT r.*,i.name as item_name,i.qty,i.hotel_id,u.name as ngo_name FROM Requests r JOIN Items i ON r.item_id=i.id JOIN Users u ON r.ngo_id=u.id"
              );
        res.json({ success: true, requests: rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /acceptRequest — Hotel approves a request
 *
 * [UPDATED] Now triggers A* Route Optimization:
 *   1. Looks up Hotel and NGO coordinates
 *   2. Calls AI module's astar_route
 *   3. Stores route_path, distance, estimated_time in Delivery record
 */
app.post('/acceptRequest', async (req, res) => {
    try {
        const { request_id } = req.body;
        const r = await db.get("SELECT * FROM Requests WHERE id=?", [request_id]);
        if (!r) return res.status(404).json({ error: 'Request not found' });

        // Get the food item to find the hotel
        const item = await db.get("SELECT * FROM Items WHERE id=?", [r.item_id]);
        if (!item) return res.status(404).json({ error: 'Item not found' });

        // Update request and item status
        await db.run("UPDATE Requests SET status='Approved' WHERE id=?", [request_id]);
        await db.run("UPDATE Items SET status='Assigned' WHERE id=?", [r.item_id]);

        // ── A* ROUTE OPTIMIZATION ──
        // Fetch Hotel and NGO coordinates for route calculation
        const hotel = await db.get("SELECT id,name,lat,lon FROM Users WHERE id=?", [item.hotel_id]);
        const ngo = await db.get("SELECT id,name,lat,lon FROM Users WHERE id=?", [r.ngo_id]);

        let routeData = { path: [], distance: null, estimated_time: null };

        // Only compute route if both locations have coordinates
        if (hotel && ngo && hotel.lat && hotel.lon && ngo.lat && ngo.lon) {
            try {
                routeData = await callAi('astar_route', {
                    hotel_location: { lat: hotel.lat, lon: hotel.lon },
                    ngo_location: { lat: ngo.lat, lon: ngo.lon }
                });
                console.log(`✅ A* Route computed: ${routeData.distance} km, ~${routeData.estimated_time} min`);
            } catch (aiErr) {
                console.error('⚠️ A* Route calculation failed, storing without route:', aiErr);
            }
        } else {
            console.warn('⚠️ Missing coordinates for Hotel or NGO, skipping route calculation');
        }

        // Insert delivery record with route data
        const deliveryResult = await db.run(
            "INSERT INTO Delivery (item_id, ngo_id, route_path, distance, estimated_time) VALUES (?,?,?,?,?)",
            [
                r.item_id,
                r.ngo_id,
                JSON.stringify(routeData.path || []),
                routeData.distance || null,
                routeData.estimated_time || null
            ]
        );

        // Log to history
        await db.run(
            "INSERT INTO History (action, user_id, details) VALUES (?,?,?)",
            [
                'Request Approved',
                item.hotel_id,
                `Approved request #${request_id} for "${item.name}" → NGO: ${ngo ? ngo.name : 'Unknown'} | Route: ${routeData.distance || 'N/A'} km`
            ]
        );

        res.json({
            success: true,
            deliveryId: deliveryResult.lastID,
            route: routeData
        });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/** POST /rejectRequest — Hotel rejects a request */
app.post('/rejectRequest', async (req, res) => {
    try {
        const { request_id } = req.body;
        const r = await db.get("SELECT * FROM Requests WHERE id=?", [request_id]);
        if (!r) return res.status(404).json({ error: 'Not found' });
        await db.run("UPDATE Requests SET status='Rejected' WHERE id=?", [request_id]);
        await db.run("UPDATE Items SET status='Available' WHERE id=?", [r.item_id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// =============================================================================
//  ANALYTICS & DATA ENDPOINTS
// =============================================================================

/** GET /getAnalytics — Aggregate platform statistics */
app.get('/getAnalytics', async (req, res) => {
    try {
        const totalItems = (await db.get("SELECT COUNT(*) as c FROM Items")).c;
        const available = (await db.get("SELECT COUNT(*) as c FROM Items WHERE status='Available'")).c;
        const assigned = (await db.get("SELECT COUNT(*) as c FROM Items WHERE status='Assigned'")).c;
        const delivered = (await db.get("SELECT COUNT(*) as c FROM Items WHERE status='Delivered'")).c;
        const totalReq = (await db.get("SELECT COUNT(*) as c FROM Requests")).c;
        const totalDeliv = (await db.get("SELECT COUNT(*) as c FROM Delivery")).c;
        const cats = await db.all("SELECT category, SUM(qty) as total FROM Items GROUP BY category");
        res.json({
            success: true,
            analytics: {
                totalItems, available, assigned, delivered,
                totalReq, totalDeliv,
                categories: cats,
                saved: assigned + delivered,
                wasted: Math.max(0, totalItems - assigned - delivered - available)
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/** GET /getUsers — List all users */
app.get('/getUsers', async (req, res) => {
    try {
        const rows = await db.all("SELECT id,name,email,role,lat,lon,created_at FROM Users");
        res.json({ success: true, users: rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/** GET /getHistory — Activity audit log (last 50 entries) */
app.get('/getHistory', async (req, res) => {
    try {
        const rows = await db.all("SELECT * FROM History ORDER BY created_at DESC LIMIT 50");
        res.json({ success: true, history: rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/** GET /getDeliveries — All delivery records with route data */
app.get('/getDeliveries', async (req, res) => {
    try {
        const rows = await db.all(
            "SELECT d.*,i.name as item_name,u.name as ngo_name FROM Delivery d JOIN Items i ON d.item_id=i.id JOIN Users u ON d.ngo_id=u.id"
        );
        // Parse route_path JSON for each delivery
        const enriched = rows.map(d => ({
            ...d,
            route_path: d.route_path ? JSON.parse(d.route_path) : []
        }));
        res.json({ success: true, deliveries: enriched });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /updateStatus — Update delivery status
 * (Used by deliveryStatus.html)
 */
app.post('/updateStatus', async (req, res) => {
    try {
        const { delivery_id, status } = req.body;
        await db.run("UPDATE Delivery SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [status, delivery_id]);

        // If delivered, also update item status
        if (status === 'Delivered') {
            const d = await db.get("SELECT * FROM Delivery WHERE id=?", [delivery_id]);
            if (d) {
                await db.run("UPDATE Items SET status='Delivered' WHERE id=?", [d.item_id]);
            }
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// =============================================================================
//  [NEW] GET /getRouteInfo — Fetch A* route for a specific delivery
// =============================================================================

/** GET /getRouteInfo?delivery_id=N — Get route details for a delivery */
app.get('/getRouteInfo', async (req, res) => {
    try {
        const did = req.query.delivery_id;
        if (!did) return res.status(400).json({ error: 'delivery_id required' });

        const d = await db.get(
            "SELECT d.*, i.name as item_name, u.name as ngo_name FROM Delivery d JOIN Items i ON d.item_id=i.id JOIN Users u ON d.ngo_id=u.id WHERE d.id=?",
            [did]
        );
        if (!d) return res.status(404).json({ error: 'Delivery not found' });

        res.json({
            success: true,
            delivery: {
                ...d,
                route_path: d.route_path ? JSON.parse(d.route_path) : []
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// =============================================================================
//  [NEW] POST /chatbot — AI Chatbot NLP Assistant
// =============================================================================

/**
 * POST /chatbot
 * Input:  { message: string }
 * Output: { reply: string, intent: string }
 *
 * Routes the user's message through the Python AI module's rule-based NLP
 * engine, which matches keywords to intents and returns contextual responses.
 */
app.post('/chatbot', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || message.trim() === '') {
            return res.json({
                success: true,
                reply: "👋 Hi! I'm the SustainAI assistant. How can I help you today?",
                intent: "empty"
            });
        }

        // Call AI module chatbot
        const ai = await callAi('chatbot', { message: message.trim() });

        res.json({
            success: true,
            reply: ai.reply || "I'm sorry, I couldn't process that. Please try again.",
            intent: ai.intent || "unknown"
        });

    } catch (e) {
        console.error('Chatbot error:', e);
        res.json({
            success: true,
            reply: "⚠️ I'm having trouble connecting to my AI brain right now. Please try again in a moment!",
            intent: "error"
        });
    }
});

// =============================================================================
//  [NEW] GET /getRoute/:deliveryId — Full route payload for Leaflet map
// =============================================================================

/**
 * GET /getRoute/:deliveryId
 * Returns everything routeMap.html needs to render the Leaflet map:
 *   hotel:         { lat, lon }
 *   ngo:           { lat, lon }
 *   path:          [ {lat, lon}, ... ]   (A* waypoints)
 *   distance:      number (km)
 *   estimated_time: number (minutes)
 */
app.get('/getRoute/:deliveryId', async (req, res) => {
    try {
        const did = req.params.deliveryId;

        // Fetch delivery with item & NGO info
        const delivery = await db.get(`
            SELECT d.*, i.name AS item_name, i.hotel_id,
                   u.name AS ngo_name, u.lat AS ngo_lat, u.lon AS ngo_lon
            FROM Delivery d
            JOIN Items i ON d.item_id = i.id
            JOIN Users u ON d.ngo_id = u.id
            WHERE d.id = ?`, [did]);

        if (!delivery) return res.status(404).json({ success: false, error: 'Delivery not found' });

        // Fetch hotel coordinates
        const hotel = await db.get('SELECT id, name, lat, lon FROM Users WHERE id = ?', [delivery.hotel_id]);

        const path = delivery.route_path ? JSON.parse(delivery.route_path) : [];

        res.json({
            success: true,
            deliveryId: delivery.id,
            itemName: delivery.item_name,
            hotel: hotel ? { lat: hotel.lat, lon: hotel.lon, name: hotel.name } : null,
            ngo:   { lat: delivery.ngo_lat, lon: delivery.ngo_lon, name: delivery.ngo_name },
            path,
            distance: delivery.distance,
            estimated_time: delivery.estimated_time
        });

    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Catch-all route to serve home.html for SPA
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'home.html'));
});

// =============================================================================
//  START SERVER
// =============================================================================

initDb().then(() => {
    app.listen(3000, () => {
        console.log('');
        console.log('╔══════════════════════════════════════════════════╗');
        console.log('║   🌿 SustainAI Server v4.2 running on :3000    ║');
        console.log('║   ✅ A* Route Optimization — ACTIVE            ║');
        console.log('║   ✅ AI Chatbot NLP — ACTIVE                   ║');
        console.log('║   ✅ Leaflet Live Map (/getRoute) — ACTIVE     ║');
        console.log('╚══════════════════════════════════════════════════╝');
        console.log('');
    });
}).catch(console.error);
