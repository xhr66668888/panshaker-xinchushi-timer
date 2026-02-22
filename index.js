const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const ExcelJS = require('exceljs');
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
        db.run(`
            CREATE TABLE IF NOT EXISTS Users (
                Account TEXT PRIMARY KEY,
                Name TEXT NOT NULL,
                Department TEXT NOT NULL
            )
        `);
    }
});

// Register a new employee account
app.post('/api/register', (req, res) => {
    const { account, name, department } = req.body;

    if (!account || !name || !department) {
        return res.status(400).json({ error: '请填写所有字段' });
    }

    if (account === '9999') {
        return res.status(400).json({ error: '该账号为管理员专用' });
    }

    db.get('SELECT Account FROM Users WHERE Account = ?', [account], (err, row) => {
        if (err) {
            return res.status(500).json({ error: '服务器错误' });
        }
        if (row) {
            return res.status(400).json({ error: '该账号已被注册' });
        }

        db.run('INSERT INTO Users (Account, Name, Department) VALUES (?, ?, ?)', [account, name, department], function (err) {
            if (err) {
                console.error('Register error:', err);
                return res.status(500).json({ error: '注册失败' });
            }
            res.json({ success: true, name, department });
        });
    });
});

// Login with account code
app.post('/api/login', (req, res) => {
    const { account } = req.body;

    if (!account) {
        return res.status(400).json({ error: '请输入账号' });
    }

    if (account === '9999') {
        return res.json({ success: true, role: 'admin' });
    }

    db.get('SELECT * FROM Users WHERE Account = ?', [account], (err, row) => {
        if (err) {
            return res.status(500).json({ error: '服务器错误' });
        }
        if (!row) {
            return res.status(404).json({ error: '账号未注册' });
        }
        res.json({ success: true, role: 'employee', name: row.Name, department: row.Department });
    });
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

// Export monthly records to Excel
app.get('/api/export', async (req, res) => {
    let month = req.query.month;
    if (!month) {
        month = new Date().toISOString().slice(0, 7);
    }

    const summarySQL = `
        SELECT EmployeeName, Department, SUM(DurationHours) as TotalHours
        FROM WorkRecords
        WHERE Month = ?
        GROUP BY EmployeeName, Department
        ORDER BY EmployeeName
    `;
    const detailSQL = `
        SELECT EmployeeName, Department, StartTime, EndTime, DurationHours, TaskDescription
        FROM WorkRecords
        WHERE Month = ?
        ORDER BY EmployeeName, StartTime
    `;

    try {
        const summaryRows = await new Promise((resolve, reject) => {
            db.all(summarySQL, [month], (err, rows) => err ? reject(err) : resolve(rows));
        });
        const detailRows = await new Promise((resolve, reject) => {
            db.all(detailSQL, [month], (err, rows) => err ? reject(err) : resolve(rows));
        });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Panshaker';
        workbook.created = new Date();

        // ── Sheet 1: 汇总 ──
        const summarySheet = workbook.addWorksheet('汇总');

        const [year, mon] = month.split('-');
        const titleText = `Panshaker 海外项目国内工时统计报表 ${year}年${mon}月`;
        summarySheet.mergeCells('A1:C1');
        const titleCell = summarySheet.getCell('A1');
        titleCell.value = titleText;
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { horizontal: 'center' };

        summarySheet.getRow(2).values = ['姓名', '部门', '累计投入工时 (小时)'];
        summarySheet.getRow(2).font = { bold: true };
        summarySheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        summarySheet.columns = [
            { key: 'name', width: 16 },
            { key: 'dept', width: 16 },
            { key: 'hours', width: 22 },
        ];

        let grandTotal = 0;
        summaryRows.forEach(row => {
            grandTotal += row.TotalHours;
            const r = summarySheet.addRow([row.EmployeeName, row.Department, parseFloat(row.TotalHours.toFixed(2))]);
            r.getCell(3).numFmt = '0.00';
        });

        const totalRow = summarySheet.addRow(['总计', '', parseFloat(grandTotal.toFixed(2))]);
        totalRow.font = { bold: true };
        totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } };
        totalRow.getCell(3).numFmt = '0.00';

        // ── Sheet 2: 明细 ──
        const detailSheet = workbook.addWorksheet('明细');
        detailSheet.getRow(1).values = ['姓名', '部门', '日期', '开始时间', '结束时间', '工时 (小时)', '工作内容'];
        detailSheet.getRow(1).font = { bold: true };
        detailSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        detailSheet.columns = [
            { key: 'name', width: 16 },
            { key: 'dept', width: 16 },
            { key: 'date', width: 13 },
            { key: 'start', width: 18 },
            { key: 'end', width: 18 },
            { key: 'hours', width: 14 },
            { key: 'task', width: 40 },
        ];

        detailRows.forEach(row => {
            const start = new Date(row.StartTime);
            const end = new Date(row.EndTime);
            const fmt = d => d.toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' });
            const dateFmt = d => d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
            const r = detailSheet.addRow([
                row.EmployeeName,
                row.Department,
                dateFmt(start),
                fmt(start).slice(11, 16),
                fmt(end).slice(11, 16),
                parseFloat(row.DurationHours.toFixed(2)),
                row.TaskDescription,
            ]);
            r.getCell(6).numFmt = '0.00';
        });

        const filename = `panshaker_worklog_${month}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Export error:', err);
        res.status(500).json({ error: '导出失败，请稍后重试' });
    }
});

// Start Server for Cloud Environments (0.0.0.0)
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port} (0.0.0.0)`);
});
