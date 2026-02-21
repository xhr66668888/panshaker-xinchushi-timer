const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const port = process.env.PORT || 5000;

app.use(express.static('public'));
app.use(express.json());

// Initialize SQLite Database
const db = new sqlite3.Database('work_records.db', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        db.run(`
            CREATE TABLE IF NOT EXISTS WorkRecords (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                EmployeeName TEXT NOT NULL,
                Department TEXT NOT NULL,
                StartTime DATETIME NOT NULL,
                EndTime DATETIME NOT NULL,
                DurationHours REAL NOT NULL,
                TaskDescription TEXT NOT NULL,
                Month TEXT NOT NULL
            )
        `);
    }
});

// Submit a new record
app.post('/api/records', (req, res) => {
    const { EmployeeName, Department, StartTime, EndTime, TaskDescription } = req.body;

    if (!EmployeeName || !Department || !StartTime || !EndTime || !TaskDescription) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const start = new Date(StartTime);
    const end = new Date(EndTime);

    if (end <= start) {
        return res.status(400).json({ error: 'End time must be after start time' });
    }

    const durationHours = (end - start) / (1000 * 60 * 60);
    const month = start.toISOString().slice(0, 7); // Format: YYYY-MM

    const sql = `
        INSERT INTO WorkRecords 
        (EmployeeName, Department, StartTime, EndTime, DurationHours, TaskDescription, Month)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [EmployeeName, Department, start.toISOString(), end.toISOString(), durationHours, TaskDescription, month], function (err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to insert record' });
        }
        res.json({ success: true, message: 'Record saved.', id: this.lastID });
    });
});

// Delete a record by ID (Undo)
app.delete('/api/records/:id', (req, res) => {
    const id = req.params.id;
    db.run('DELETE FROM WorkRecords WHERE Id = ?', [id], function (err) {
        if (err) {
            console.error('Delete error:', err);
            return res.status(500).json({ error: 'Failed to delete record' });
        }
        res.json({ success: true, changes: this.changes });
    });
});

// Get recent 10 records for the undo view
app.get('/api/records/recent', (req, res) => {
    const sql = `
        SELECT Id, EmployeeName, Department, TaskDescription, StartTime, EndTime, DurationHours
        FROM WorkRecords
        ORDER BY Id DESC
        LIMIT 10
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch recent records' });
        }
        res.json(rows);
    });
});

// Get monthly statistics
app.get('/api/stats', (req, res) => {
    let month = req.query.month;
    if (!month) {
        month = new Date().toISOString().slice(0, 7);
    }

    const sql = `
        SELECT EmployeeName, Department, SUM(DurationHours) as TotalHours
        FROM WorkRecords
        WHERE Month = ?
        GROUP BY EmployeeName, Department
        ORDER BY TotalHours DESC
    `;

    db.all(sql, [month], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to retrieve stats' });
        }

        // Map keys to camelCase to match frontend expectations
        const mappedRows = rows.map(row => ({
            employeeName: row.EmployeeName,
            department: row.Department,
            totalHours: row.TotalHours
        }));

        res.json(mappedRows);
    });
});

// Get detailed records for a specific employee in a specific month
app.get('/api/records/employee/:name', (req, res) => {
    const employeeName = req.params.name;
    const month = req.query.month;

    if (!month || !employeeName) {
        return res.status(400).json({ error: 'Missing employee name or month' });
    }

    const sql = `
        SELECT Id, TaskDescription, StartTime, EndTime, DurationHours
        FROM WorkRecords
        WHERE EmployeeName = ? AND Month = ?
        ORDER BY StartTime DESC
    `;

    db.all(sql, [employeeName, month], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch employee details' });
        }
        res.json(rows);
    });
});

// Start Server for Cloud Environments (0.0.0.0)
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port} (0.0.0.0)`);
});
