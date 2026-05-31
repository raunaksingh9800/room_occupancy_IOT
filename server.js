const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allows your web dashboard to fetch data
app.use(express.json()); // Parses incoming JSON from the ESP32
app.use(express.static('public')); // Serves your frontend dashboard

// Database Setup
const db = new sqlite3.Database('./occupancy.db', (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create table if it doesn't exist. We log every change to keep a history.
        db.run(`CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            count INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Ensure there is at least one row to start
        db.get("SELECT COUNT(*) AS total FROM logs", (err, row) => {
            if (row.total === 0) {
                db.run("INSERT INTO logs (count) VALUES (0)");
            }
        });
    }
});

// --- API ENDPOINTS ---

// ESP32 hits this endpoint to push a new count
app.post('/api/update', (req, res) => {
    const { count } = req.body;
    
    if (typeof count !== 'number' || count < 0) {
        return res.status(400).json({ error: 'Invalid count data. Must be a positive integer.' });
    }

    const query = `INSERT INTO logs (count) VALUES (?)`;
    db.run(query, [count], function(err) {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Database write failed' });
        }
        console.log(`[${new Date().toLocaleTimeString()}] Occupancy updated: ${count}`);
        res.status(200).json({ success: true, count: count, id: this.lastID });
    });
});

// Dashboard hits this endpoint to get the latest count
app.get('/api/current', (req, res) => {
    const query = `SELECT count, timestamp FROM logs ORDER BY timestamp DESC LIMIT 1`;
    db.get(query, [], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Database read failed' });
        }
        res.status(200).json(row || { count: 0 });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Ensure your ESP32 is on the same network and pointing to your computer's local IP.`);
});