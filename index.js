const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const ExcelJS = require('exceljs');
const app = express();
const port = process.env.PORT || 5000;

// Finance module: Zhipu GLM API key (per user requirement: hardcoded for out-of-box deploy)
const GLM_API_KEY = 'af5c0dee3b10490d9d6003cd4f33813d.YI88kpKxhBroZTQ7';
const GLM_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const GLM_MODEL = process.env.GLM_MODEL || 'glm-5.1';
// GLM-5.1 reasoning can cross 2 minutes on the full prompt. We stream the
// response so the TCP connection stays active (no Azure/Express idle cut)
// and only wall-clock-abort after 4 minutes as a true safety net.
const GLM_TIMEOUT_MS = 240000;
const FX_ENDPOINT = 'https://open.er-api.com/v6/latest/USD';
const ZIPPO_ENDPOINT = 'https://api.zippopotam.us/us/';

// In-memory FX cache (1 hour)
let _fxCache = { ts: 0, data: null };

app.use(express.static('public'));
app.use(express.json({ limit: '5mb' }));

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
                Department TEXT NOT NULL,
                Password TEXT NOT NULL DEFAULT '1234'
            )
        `);

        // Migration: add Password column if it doesn't exist (for existing DBs)
        db.run(`ALTER TABLE Users ADD COLUMN Password TEXT NOT NULL DEFAULT '1234'`, (err) => {
            // Ignore error if column already exists
        });

        // Create indexes for query performance (100 users x 90 records/month)
        db.run(`CREATE INDEX IF NOT EXISTS idx_records_employee ON WorkRecords(EmployeeName)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_records_month ON WorkRecords(Month)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_records_employee_month ON WorkRecords(EmployeeName, Month)`);

        // Finance module tables
        db.run(`
            CREATE TABLE IF NOT EXISTS FinanceScenarios (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL UNIQUE,
                IsDefault INTEGER NOT NULL DEFAULT 0,
                CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                DataJson TEXT NOT NULL
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS FinanceSettings (
                Key TEXT PRIMARY KEY,
                Value TEXT NOT NULL
            )
        `);

        // Seed default scenarios: "基线-Delaware" + "老版excel"
        db.get('SELECT Name FROM FinanceScenarios', [], (err, row) => {
            if (err) return;
            const insertIfMissing = (name, isDefault, data) => {
                db.get('SELECT Id FROM FinanceScenarios WHERE Name = ?', [name], (e, r) => {
                    if (e || r) return;
                    db.run(
                        'INSERT INTO FinanceScenarios (Name, IsDefault, DataJson) VALUES (?, ?, ?)',
                        [name, isDefault ? 1 : 0, JSON.stringify(data)],
                        (er) => { if (er) console.error('Seed scenario error:', er); }
                    );
                });
            };
            insertIfMissing('\u57fa\u7ebf-Delaware', 1, buildBaselineScenario());
            insertIfMissing('\u8001\u7248excel', 0, buildLegacyExcelScenario());
        });
    }
});

// ──────────────────────────────────────────────────────────────────────
// Finance module helpers
// ──────────────────────────────────────────────────────────────────────

// Default US state sales-tax table (state-level combined avg). Users can override.
const US_STATE_SALES_TAX = {
    AL: 0.0922, AK: 0.0176, AZ: 0.084, AR: 0.0944, CA: 0.0882,
    CO: 0.077,  CT: 0.0635, DE: 0.0,    FL: 0.07,   GA: 0.0738,
    HI: 0.0444, ID: 0.0602, IL: 0.0886, IN: 0.07,   IA: 0.0694,
    KS: 0.0869, KY: 0.06,   LA: 0.0955, ME: 0.055,  MD: 0.06,
    MA: 0.0625, MI: 0.06,   MN: 0.0754, MS: 0.0707, MO: 0.0841,
    MT: 0.0,    NE: 0.0694, NV: 0.0823, NH: 0.0,    NJ: 0.0663,
    NM: 0.0783, NY: 0.0852, NC: 0.0699, ND: 0.0696, OH: 0.0724,
    OK: 0.0895, OR: 0.0,    PA: 0.0634, RI: 0.07,   SC: 0.0744,
    SD: 0.0644, TN: 0.0955, TX: 0.0819, UT: 0.0719, VT: 0.0624,
    VA: 0.0577, WA: 0.0929, WV: 0.065,  WI: 0.0543, WY: 0.0534,
    DC: 0.06
};

// Default state corporate income tax
const US_STATE_CORP_TAX = {
    AL: 0.065, AK: 0.094, AZ: 0.049, AR: 0.053, CA: 0.0884,
    CO: 0.044, CT: 0.075, DE: 0.087, FL: 0.055, GA: 0.0575,
    HI: 0.064, ID: 0.058, IL: 0.095, IN: 0.0482, IA: 0.072,
    KS: 0.07,  KY: 0.05,  LA: 0.075, ME: 0.0893, MD: 0.0825,
    MA: 0.08,  MI: 0.06,  MN: 0.098, MS: 0.05,  MO: 0.04,
    MT: 0.0675, NE: 0.0584, NV: 0.0,  NH: 0.075, NJ: 0.095,
    NM: 0.059, NY: 0.0725, NC: 0.025, ND: 0.0431, OH: 0.0,
    OK: 0.04,  OR: 0.076, PA: 0.0899, RI: 0.07,  SC: 0.05,
    SD: 0.0,   TN: 0.065, TX: 0.0,   UT: 0.0485, VT: 0.085,
    VA: 0.06,  WA: 0.0,   WV: 0.065, WI: 0.079, WY: 0.0,
    DC: 0.0825
};

// Product physical metadata for the 芯厨师 X7-2001 (used by ocean freight estimator).
const X7_DIMENSIONS = {
    crated: { lengthCm: 102, widthCm: 90, heightCm: 170 },
    bare:   { lengthCm: 94,  widthCm: 78, heightCm: 154 },
    cbm: 1.56,
    weightKg: 246
};

function buildBaselineScenario() {
    const r = (n) => Math.round(n);
    const months12 = (v) => new Array(12).fill(v);
    return {
        version: 2,
        meta: {
            companyState: 'DE',
            zipCode: '19801',
            notes: ''
        },
        product: {
            name: '\u828f\u53a8\u5e08 X7-2001',
            unitCostUSD: r(27900 / 7.2),
            dimensions: X7_DIMENSIONS,
            landed: {
                oceanFreightUSD: 180,
                importDutyPct: 0.0,
                portFeesUSD: 50,
                usInlandFreightUSD: 220,
                warehouseMonthlyUSD: 15
            },
            installTrainingUSD: 200,
            warrantyUSD: 150,
            shippingToCustomerUSD: 250,
            advertisingUSD: 400,
            commissions: {
                usSalesPct: 0.03,
                chinaReferralPct: 0.02,
                chinaReferralAttachRate: 0.30,
                otherPct: 0.01
            }
        },
        buyout: { priceUSD: 15000 },
        lease: {
            monthlyRentUSD: 599,
            firstPayMonths: 2,
            depositMonths: 1,
            minMonths: 12,
            earlyTerminationFeeUSD: 2000,
            activationFeeUSD: 0
        },
        tax: {
            federalCorpPct: 0.21,
            stateCorpPct: US_STATE_CORP_TAX.DE,
            franchiseTaxAnnualUSD: 400,
            // Single combined employer payroll-tax rate. Default 9% ≈
            // FICA 7.65% + FUTA 0.6% + SUTA ~1.8%. User can fine-tune.
            employerPayrollPct: 0.09
        },
        employees: [
            { id: 'e_sales1', name: '\u9500\u552e 1', position: 'sales', monthlyPayUSD: 5000, type: 'gross' },
            { id: 'e_mgmt1',  name: '\u7ba1\u7406 1', position: 'mgmt',  monthlyPayUSD: 8000, type: 'gross' }
        ],
        opex: {
            categories: [
                { id: 'ads',        name: '\u5e7f\u544a\u8d39',              months: months12(5000) },
                { id: 'travel',     name: '\u5dee\u65c5\u8d39',              months: months12(1500) },
                { id: 'rent',       name: '\u623f\u79df',                    months: months12(3500) },
                { id: 'utilities',  name: '\u6c34\u7535\u71c3\u6c14',        months: months12(600)  },
                { id: 'office',     name: '\u529e\u516c\u8d39',              months: months12(300)  },
                { id: 'phone',      name: '\u7535\u8bdd/\u7f51\u7edc\u8d39', months: months12(200)  },
                { id: 'aftersales', name: '\u552e\u540e',                    months: months12(600)  },
                { id: 'other',      name: '\u5176\u4ed6\u8d39\u7528',        months: months12(500)  }
            ]
        },
        customCosts: [],
        forecast: {
            buyoutMonthlyUnits: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6],
            leaseMonthlyUnits:  [2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]
        }
    };
}

// Clone of the user's Chinese Excel (陈龙玉 20260407) so they get a familiar starting point.
function buildLegacyExcelScenario() {
    const months12 = (v) => new Array(12).fill(v);
    return {
        version: 2,
        meta: {
            companyState: 'DE',
            zipCode: '19801',
            notes: '\u590d\u523b\u81ea\u300a\u7f8e\u56fd\u516c\u53f8\u8d39\u7528\u9884\u7b97-\u5229\u6da6\u6a21\u578b-\u9648\u9f99\u7389\u300b Excel\uff0c\u539f\u6a21\u578b\u6570\u636e\u4ee5\u4eba\u6c11\u5e01\u8ba1\u3002'
        },
        product: {
            name: '\u828f\u53a8\u5e08 X7-2001',
            unitCostUSD: 6187.63,
            dimensions: X7_DIMENSIONS,
            landed: {
                oceanFreightUSD: 0,
                importDutyPct: 0.0,
                portFeesUSD: 0,
                usInlandFreightUSD: 0,
                warehouseMonthlyUSD: 0
            },
            installTrainingUSD: 300,
            warrantyUSD: 0,
            shippingToCustomerUSD: 0,
            advertisingUSD: 0,
            // Excel total commission 4% — split via cross-border schema, attach 50% → 3% + 2%*0.5 = 4%
            commissions: {
                usSalesPct: 0.03,
                chinaReferralPct: 0.02,
                chinaReferralAttachRate: 0.50,
                otherPct: 0.0
            }
        },
        buyout: { priceUSD: 15000 },
        lease: {
            monthlyRentUSD: 1724,
            firstPayMonths: 2,
            depositMonths: 1,
            minMonths: 2,
            earlyTerminationFeeUSD: 0,
            activationFeeUSD: 0
        },
        tax: {
            federalCorpPct: 0.21,
            stateCorpPct: US_STATE_CORP_TAX.DE,
            franchiseTaxAnnualUSD: 400,
            employerPayrollPct: 0.09
        },
        employees: [
            { id: 'e1', name: '\u9500\u552e 1', position: 'sales', monthlyPayUSD: 8000, type: 'gross' }
        ],
        opex: {
            categories: [
                { id: 'rent',   name: '\u623f\u79df\u6c34\u7535',                months: months12(0)    },
                { id: 'travel', name: '\u9500\u552e\u5dee\u65c5\u8d39',          months: months12(500)  },
                { id: 'other',  name: '\u5176\u4ed6',                            months: months12(300)  }
            ]
        },
        customCosts: [],
        forecast: {
            buyoutMonthlyUnits: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            leaseMonthlyUnits:  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
        }
    };
}

function jsonErr(res, code, msg) { return res.status(code).json({ error: msg }); }

// Register a new employee account
app.post('/api/register', (req, res) => {
    const { account, name, department, password } = req.body;

    if (!account || !name || !department || !password) {
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

        db.run('INSERT INTO Users (Account, Name, Department, Password) VALUES (?, ?, ?, ?)', [account, name, department, password], function (err) {
            if (err) {
                console.error('Register error:', err);
                return res.status(500).json({ error: '注册失败' });
            }
            res.json({ success: true, name, department });
        });
    });
});

// Login with account and password
app.post('/api/login', (req, res) => {
    const { account, password } = req.body;

    if (!account || !password) {
        return res.status(400).json({ error: '请输入账号和密码' });
    }

    if (account === '9999') {
        if (password !== '9999') {
            return res.status(401).json({ error: '密码错误' });
        }
        return res.json({ success: true, role: 'admin' });
    }

    db.get('SELECT * FROM Users WHERE Account = ?', [account], (err, row) => {
        if (err) {
            return res.status(500).json({ error: '服务器错误' });
        }
        if (!row) {
            return res.status(404).json({ error: '账号未注册' });
        }
        if (row.Password !== password) {
            return res.status(401).json({ error: '密码错误' });
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
    const name = req.query.name;
    let sql, params;

    if (name) {
        sql = `
            SELECT Id, EmployeeName, Department, TaskDescription, StartTime, EndTime, DurationHours
            FROM WorkRecords
            WHERE EmployeeName = ?
            ORDER BY Id DESC
            LIMIT 10
        `;
        params = [name];
    } else {
        sql = `
            SELECT Id, EmployeeName, Department, TaskDescription, StartTime, EndTime, DurationHours
            FROM WorkRecords
            ORDER BY Id DESC
            LIMIT 10
        `;
        params = [];
    }

    db.all(sql, params, (err, rows) => {
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

// Get single user details (for admin editing)
app.get('/api/users/:account', (req, res) => {
    const account = req.params.account;
    db.get('SELECT Account, Name, Department, Password FROM Users WHERE Account = ?', [account], (err, row) => {
        if (err) {
            return res.status(500).json({ error: '服务器错误' });
        }
        if (!row) {
            return res.status(404).json({ error: '账号不存在' });
        }
        res.json(row);
    });
});

// Update user password (admin)
app.put('/api/users/:account', (req, res) => {
    const account = req.params.account;
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: '密码不能为空' });
    }

    db.run('UPDATE Users SET Password = ? WHERE Account = ?', [password, account], function (err) {
        if (err) {
            return res.status(500).json({ error: '保存失败' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: '账号不存在' });
        }
        res.json({ success: true });
    });
});

// Get all registered users
app.get('/api/users', (req, res) => {
    const sql = `
        SELECT u.Account, u.Name, u.Department,
               IFNULL(SUM(w.DurationHours), 0) as TotalHours,
               COUNT(w.Id) as RecordCount
        FROM Users u
        LEFT JOIN WorkRecords w ON u.Name = w.EmployeeName
        GROUP BY u.Account, u.Name, u.Department
        ORDER BY u.Name
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch users' });
        }
        res.json(rows);
    });
});

// Delete a user and optionally their records
app.delete('/api/users/:account', (req, res) => {
    const account = req.params.account;
    const deleteRecords = req.query.deleteRecords === 'true';

    db.get('SELECT * FROM Users WHERE Account = ?', [account], (err, user) => {
        if (err) {
            return res.status(500).json({ error: '服务器错误' });
        }
        if (!user) {
            return res.status(404).json({ error: '账号不存在' });
        }

        db.run('DELETE FROM Users WHERE Account = ?', [account], function (err) {
            if (err) {
                return res.status(500).json({ error: '删除失败' });
            }

            if (deleteRecords) {
                db.run('DELETE FROM WorkRecords WHERE EmployeeName = ?', [user.Name], function (err2) {
                    if (err2) console.error('Delete records error:', err2);
                    res.json({ success: true, deletedRecords: this.changes || 0 });
                });
            } else {
                res.json({ success: true });
            }
        });
    });
});

// ──────────────────────────────────────────────────────────────────────
// Finance module API
// ──────────────────────────────────────────────────────────────────────

// List all scenarios (metadata only)
app.get('/api/finance/scenarios', (req, res) => {
    db.all('SELECT Id, Name, IsDefault, CreatedAt, UpdatedAt FROM FinanceScenarios ORDER BY IsDefault DESC, UpdatedAt DESC', [], (err, rows) => {
        if (err) return jsonErr(res, 500, '查询场景失败');
        res.json(rows);
    });
});

// Get one scenario (full DataJson)
app.get('/api/finance/scenarios/:id', (req, res) => {
    db.get('SELECT * FROM FinanceScenarios WHERE Id = ?', [req.params.id], (err, row) => {
        if (err) return jsonErr(res, 500, '查询失败');
        if (!row) return jsonErr(res, 404, '场景不存在');
        try {
            row.Data = JSON.parse(row.DataJson);
            delete row.DataJson;
            res.json(row);
        } catch (e) {
            jsonErr(res, 500, 'JSON 解析失败');
        }
    });
});

// Create new scenario
app.post('/api/finance/scenarios', (req, res) => {
    const { name, data } = req.body || {};
    if (!name || !data) return jsonErr(res, 400, 'name 和 data 必填');
    const json = JSON.stringify(data);
    db.run(
        'INSERT INTO FinanceScenarios (Name, IsDefault, DataJson) VALUES (?, 0, ?)',
        [name, json],
        function (err) {
            if (err) {
                if (String(err.message).includes('UNIQUE')) return jsonErr(res, 400, '场景名已存在');
                return jsonErr(res, 500, '保存失败');
            }
            res.json({ success: true, id: this.lastID });
        }
    );
});

// Update scenario
app.put('/api/finance/scenarios/:id', (req, res) => {
    const { name, data } = req.body || {};
    if (!data) return jsonErr(res, 400, 'data 必填');
    const json = JSON.stringify(data);
    const sql = name
        ? 'UPDATE FinanceScenarios SET Name=?, DataJson=?, UpdatedAt=CURRENT_TIMESTAMP WHERE Id=?'
        : 'UPDATE FinanceScenarios SET DataJson=?, UpdatedAt=CURRENT_TIMESTAMP WHERE Id=?';
    const params = name ? [name, json, req.params.id] : [json, req.params.id];
    db.run(sql, params, function (err) {
        if (err) return jsonErr(res, 500, '保存失败');
        if (this.changes === 0) return jsonErr(res, 404, '场景不存在');
        res.json({ success: true });
    });
});

// Delete scenario (but protect IsDefault=1 baseline)
app.delete('/api/finance/scenarios/:id', (req, res) => {
    db.get('SELECT IsDefault FROM FinanceScenarios WHERE Id = ?', [req.params.id], (err, row) => {
        if (err) return jsonErr(res, 500, '查询失败');
        if (!row) return jsonErr(res, 404, '场景不存在');
        if (row.IsDefault) return jsonErr(res, 400, '基线场景不可删除');
        db.run('DELETE FROM FinanceScenarios WHERE Id = ?', [req.params.id], function (e2) {
            if (e2) return jsonErr(res, 500, '删除失败');
            res.json({ success: true });
        });
    });
});

// FX proxy with in-memory 1h cache
app.get('/api/finance/fx', async (req, res) => {
    const now = Date.now();
    if (_fxCache.data && now - _fxCache.ts < 3600 * 1000) {
        return res.json({ cached: true, ..._fxCache.data });
    }
    try {
        const r = await fetch(FX_ENDPOINT, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error('FX HTTP ' + r.status);
        const raw = await r.json();
        if (raw.result !== 'success' || !raw.rates) throw new Error('FX payload error');
        const out = {
            base: raw.base_code || 'USD',
            usdToCny: raw.rates.CNY,
            rates: { CNY: raw.rates.CNY, EUR: raw.rates.EUR, GBP: raw.rates.GBP, JPY: raw.rates.JPY, HKD: raw.rates.HKD },
            fetchedAt: new Date().toISOString()
        };
        _fxCache = { ts: now, data: out };
        res.json({ cached: false, ...out });
    } catch (err) {
        console.error('FX fetch error:', err);
        if (_fxCache.data) return res.json({ cached: true, stale: true, ..._fxCache.data });
        res.status(502).json({ error: '汇率获取失败', detail: String(err.message || err) });
    }
});

// Sales tax table read/write
app.get('/api/finance/tax-table', (req, res) => {
    db.get('SELECT Value FROM FinanceSettings WHERE Key = ?', ['salesTaxTable'], (err, row) => {
        if (err) return jsonErr(res, 500, '查询失败');
        let table = US_STATE_SALES_TAX;
        let corp = US_STATE_CORP_TAX;
        if (row) {
            try {
                const parsed = JSON.parse(row.Value);
                if (parsed.salesTax) table = parsed.salesTax;
                if (parsed.corpTax) corp = parsed.corpTax;
            } catch (_) {}
        }
        res.json({ salesTax: table, corpTax: corp });
    });
});

app.put('/api/finance/tax-table', (req, res) => {
    const body = req.body || {};
    if (!body.salesTax && !body.corpTax) return jsonErr(res, 400, '需要 salesTax 或 corpTax 字段');
    db.get('SELECT Value FROM FinanceSettings WHERE Key = ?', ['salesTaxTable'], (err, row) => {
        let merged = { salesTax: US_STATE_SALES_TAX, corpTax: US_STATE_CORP_TAX };
        if (row) {
            try { merged = { ...merged, ...JSON.parse(row.Value) }; } catch (_) {}
        }
        if (body.salesTax) merged.salesTax = body.salesTax;
        if (body.corpTax) merged.corpTax = body.corpTax;
        const v = JSON.stringify(merged);
        db.run(
            'INSERT INTO FinanceSettings (Key, Value) VALUES (?, ?) ON CONFLICT(Key) DO UPDATE SET Value=excluded.Value',
            ['salesTaxTable', v],
            (e2) => {
                if (e2) return jsonErr(res, 500, '保存失败');
                res.json({ success: true, ...merged });
            }
        );
    });
});

// AI pricing suggestion via Zhipu GLM
app.post('/api/finance/ai-suggest', async (req, res) => {
    const scenario = req.body || {};
    if (!scenario || typeof scenario !== 'object') return jsonErr(res, 400, '需要提交 scenario JSON');

    const systemPrompt = [
        '你是 Panshaker 美国分公司（Delaware C-Corp，炒菜机器人 B2B）资深定价与租赁政策顾问。',
        '产品：芯厨师 X7-2001，中国零售 CNY 38800-50000，中国销售提成 4%；到岸前成本 CNY 27900/台（未含美国关税/海运/内陆/仓储）。',
        '',
        '【竞品真实 TCO 解读 - 必须严格按照下面的框架评估，不要简单拿 $11000 做参考】',
        '竞品：智谷天厨。标价 USD 11000 是 FOB 中国港口的**裸价**，不包含：',
        '  - 美国关税（HTS 8516.60 约 0-3.7%）、港口杂费',
        '  - 深圳→美国港口海运（LCL 约 $150-200/台）',
        '  - 美国内陆 LTL（$250-600/台视距离）',
        '  - 美国 Sales Tax（由客户承担，不含在标价里）',
        '  - 上门安装（智谷无此服务）',
        '  - 本地培训（智谷无此服务）',
        '  - 售后/质保（智谷无美国本地支持）',
        '  - SaaS/升级/菜单库（智谷无）',
        '智谷天厨客户实际到手 TCO ≈ $11000 + $500 运费关税 + $800 自行安装/学习成本 + $0 售后 ≈ $12300 但无服务保障。',
        'Panshaker 的差异化：美国本地库存、上门安装、培训、12 月质保、持续 SaaS 菜单升级、中美联合售后。',
        '因此 Panshaker 可合理定位为高端 "turnkey solution"，**建议定价比智谷有效 TCO 高 20-40%**（即 $14000-$17000 区间），理由是 B2B 餐饮客户最痛的是机器停摆一天损失几千美元营业额，服务价值远高于差价。',
        '',
        '【美国市场特性】',
        'Sales Tax 由目的州代收代缴不吃收入；联邦企业税 21%；DE 州 8.7% + Franchise Tax；雇主 payroll 约 9.4%。',
        '目标客户：美国中小餐饮连锁、云厨房、校园/医院食堂、食品工厂。',
        '',
        '【跨境提成机制】',
        '中国团队推荐线索→美国成交，提成中美分成。行业惯例总池 ~5%，CN 引流方 40% / US 成交方 60%；必须把 CN 分成作为美国 P&L 独立变动成本，有效提成率 = usSalesPct + chinaReferralPct × chinaReferralAttachRate + otherPct。',
        '',
        '【重点 - 租赁现金流问题】',
        '用户当前痛点：租出去一台，长期 LTV > 变动成本（盈利），但**早期月度现金流为负**（亏现金）——因为设备成本、培训、运输、广告、提成全部在第 1 月 upfront，而月租金要慢慢收。',
        '典型化解手段（你必须在 leaseOptimization.plans 里给出三套具体方案，每套方案前置现金流足以覆盖单台前期变动成本）：',
        '  (a) Activation Fee 一次性激活费/安装部署费（**不退**），行业常见 $1000-3000，放进首月现金流',
        '  (b) firstPayMonths 首期多预收几个月租金（2-6 月）',
        '  (c) depositMonths 押金月数（2-3 月，暂时占用客户现金）',
        '  (d) monthlyRentUSD 上调月租金',
        '  (e) minMonths 拉长最低租期让回本周期稳',
        '当前变动成本 = 单台到岸成本 + 安装培训 + 质保 + 运输 + 广告 + 提成×min-term revenue。首期现金流入 = activationFee + (firstPayMonths + depositMonths) × monthlyRent。**必须做到首期现金流入 ≥ 单台前期变动成本**。',
        '',
        '【任务输出】',
        '基于精简场景 JSON，生成：(1) 买断售价区间 low/high（参考上面的 $14000-17000 区间说理）；(2) 主方案 lease；(3) **三套 leaseOptimization.plans（激进/平衡/保守，各自列出 activationFee + firstPayMonths + depositMonths + monthlyRent + minMonths + earlyTerminationFee 以及预期每台首月净现金流和回本月份）**；(4) 建议的中美提成分成；(5) 竞品对比调整后 TCO；(6) 3 条风险；(7) 竞品差异化说理。',
        '',
        '*** 关键格式约定 ***',
        '- 所有"率/占比/百分比"字段（usSalesPct, chinaReferralPct, chinaReferralAttachRate, otherPct）必须使用小数 [0, 1]，例如 3% 写作 0.03。禁止写成 3 或 30。',
        '- 所有金额字段使用美元数值（无货币符号、无千分位）。月数字段为整数。',
        '',
        '严格只输出 1 个 JSON 对象，不要 markdown、不要代码围栏、不要解释文字。Schema：',
        '{',
        '"buyoutPrice":{"low":number,"high":number,"reason":string},',
        '"competitorAdjustedTCO":{"bareUSD":11000,"totalLandedUSD":number,"servicePenaltyUSD":number,"reason":string},',
        '"lease":{"monthlyRent":number,"firstPayMonths":number,"depositMonths":number,"minMonths":number,"earlyTerminationFee":number,"activationFee":number,"paybackMonths":number,"reason":string},',
        '"leaseOptimization":{"problemDiagnosis":string,"recommendedPlanIndex":number,"plans":[',
        '  {"name":"激进 - 低门槛快速获客","activationFee":number,"firstPayMonths":number,"depositMonths":number,"monthlyRent":number,"minMonths":number,"earlyTerminationFee":number,"expectedFirstMonthCashPerUnit":number,"breakevenMonthPerUnit":number,"rationale":string},',
        '  {"name":"平衡 - 现金流与增长兼顾","activationFee":number,"firstPayMonths":number,"depositMonths":number,"monthlyRent":number,"minMonths":number,"earlyTerminationFee":number,"expectedFirstMonthCashPerUnit":number,"breakevenMonthPerUnit":number,"rationale":string},',
        '  {"name":"保守 - 首月现金流必须转正","activationFee":number,"firstPayMonths":number,"depositMonths":number,"monthlyRent":number,"minMonths":number,"earlyTerminationFee":number,"expectedFirstMonthCashPerUnit":number,"breakevenMonthPerUnit":number,"rationale":string}',
        ']},',
        '"commissionSplit":{"usSalesPct":number,"chinaReferralPct":number,"chinaReferralAttachRate":number,"otherPct":number,"reason":string},',
        '"cashflowWarning":string,"risks":[string,string,string],"competitiveRationale":string',
        '}'
    ].join('\n');

    // Strip non-essential fields from scenario to reduce prompt tokens and latency.
    const lean = {
        meta: scenario.meta,
        product: scenario.product,
        buyout: scenario.buyout,
        lease: scenario.lease,
        tax: scenario.tax,
        customCosts: scenario.customCosts,
        opexMonthlyAvgUSD: (() => {
            const cats = scenario.opex?.categories || [];
            let total = 0;
            for (const c of cats) {
                const arr = c.months || [];
                for (const v of arr) total += Number(v) || 0;
            }
            return Math.round(total / 12);
        })(),
        forecast: {
            buyoutMonthlyUnits: (scenario.forecast?.buyoutMonthlyUnits || []).slice(0, 12),
            leaseMonthlyUnits:  (scenario.forecast?.leaseMonthlyUnits  || []).slice(0, 12)
        }
    };

    // Azure App Service has a 230s front-end idle timeout; we proactively flush
    // a single space byte every ~15s while waiting on GLM. The browser's fetch
    // still buffers the whole response, and JSON.parse handles leading
    // whitespace gracefully, so the final payload round-trips cleanly.
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const heartbeat = setInterval(() => {
        try { res.write(' '); if (res.flush) res.flush(); } catch (_) {}
    }, 15000);
    req.on('close', () => clearInterval(heartbeat));
    const finish = (code, body) => {
        clearInterval(heartbeat);
        if (code !== 200) res.statusCode = code;
        try { res.end(JSON.stringify(body)); } catch (_) {}
    };

    try {
        const started = Date.now();
        const resp = await fetch(GLM_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + GLM_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({
                model: GLM_MODEL,
                temperature: 0.2,
                max_tokens: 8192,
                // Streaming: tokens flow as soon as they're ready. Keeps the TCP
                // connection active (no Azure/Express idle cut) and lets very
                // long reasoning runs finish naturally without an artificial cap.
                stream: true,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: '当前场景(精简): ' + JSON.stringify(lean) + '\n严格按 schema 输出 JSON，不要任何额外文字，不要 markdown 围栏。' }
                ]
            }),
            signal: AbortSignal.timeout(GLM_TIMEOUT_MS)
        });

        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            const elapsed = Date.now() - started;
            console.error('GLM error:', resp.status, text.slice(0, 500));
            return finish(502, { error: 'AI 服务调用失败', status: resp.status, elapsedMs: elapsed, detail: text.slice(0, 500) });
        }

        // Parse SSE stream: each data line is a JSON chunk with delta content.
        let content = '';
        let finishReason = null;
        let usage = null;
        const decoder = new TextDecoder();
        let buffer = '';
        try {
            for await (const chunk of resp.body) {
                buffer += decoder.decode(chunk, { stream: true });
                let nl;
                while ((nl = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.slice(0, nl).trim();
                    buffer = buffer.slice(nl + 1);
                    if (!line.startsWith('data:')) continue;
                    const data = line.slice(5).trim();
                    if (!data || data === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta;
                        if (delta?.content) content += delta.content;
                        if (parsed.choices?.[0]?.finish_reason) finishReason = parsed.choices[0].finish_reason;
                        if (parsed.usage) usage = parsed.usage;
                    } catch (_) { /* skip malformed SSE chunk */ }
                }
            }
        } catch (streamErr) {
            const elapsed = Date.now() - started;
            console.error('GLM stream error:', streamErr);
            const partial = content.slice(0, 800);
            return finish(502, {
                error: 'AI 流式读取异常 (可能超时)',
                elapsedMs: elapsed,
                detail: String(streamErr?.message || streamErr),
                raw: partial
            });
        }

        const elapsed = Date.now() - started;
        // Reasoning models sometimes wrap JSON in ```json ... ``` even when told not to.
        content = content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
        let suggestion = null;
        try {
            suggestion = JSON.parse(content);
        } catch (e) {
            const m = content.match(/\{[\s\S]*\}/);
            if (m) { try { suggestion = JSON.parse(m[0]); } catch (_) {} }
        }
        if (!suggestion) {
            const hint = finishReason === 'length'
                ? '（AI 输出被 max_tokens 截断，请稍后重试或缩小场景复杂度）'
                : (content ? '（AI 返回了内容但不是合法 JSON，见下方原文）' : '（AI 返回为空）');
            return finish(502, {
                error: 'AI 返回非 JSON ' + hint,
                elapsedMs: elapsed,
                finishReason,
                usage,
                raw: content.slice(0, 2000)
            });
        }
        // Normalize percentage fields: if AI returns integer 3 instead of 0.03 for a rate, auto-fix.
        const normRate = (v) => {
            const n = Number(v);
            if (!Number.isFinite(n)) return 0;
            return n > 1 ? n / 100 : n;
        };
        if (suggestion.commissionSplit) {
            ['usSalesPct', 'chinaReferralPct', 'chinaReferralAttachRate', 'otherPct'].forEach(k => {
                if (suggestion.commissionSplit[k] != null) suggestion.commissionSplit[k] = normRate(suggestion.commissionSplit[k]);
            });
        }
        // Ensure plans array is always present so UI can render 3 cards even if AI drops some fields
        if (suggestion.leaseOptimization && Array.isArray(suggestion.leaseOptimization.plans)) {
            suggestion.leaseOptimization.plans = suggestion.leaseOptimization.plans.map(p => {
                p = p || {};
                ['activationFee', 'firstPayMonths', 'depositMonths', 'monthlyRent', 'minMonths', 'earlyTerminationFee', 'expectedFirstMonthCashPerUnit', 'breakevenMonthPerUnit'].forEach(k => {
                    if (p[k] != null) p[k] = Number(p[k]) || 0;
                });
                if (!p.name) p.name = '方案';
                if (!p.rationale) p.rationale = '';
                return p;
            });
        }
        finish(200, { success: true, elapsedMs: elapsed, model: GLM_MODEL, usage, finishReason, suggestion, raw: content });
    } catch (err) {
        console.error('GLM fetch error:', err);
        const msg = String(err?.name === 'TimeoutError' || /abort|timeout/i.test(String(err?.message)) ? 'AI 推理超时，请重试或减少场景复杂度' : (err?.message || err));
        finish(502, { error: 'AI 请求异常', detail: msg });
    }
});

// ZIP → state/city lookup via zippopotam.us + auto-pick default sales tax
app.get('/api/finance/zip/:zip', async (req, res) => {
    const zip = String(req.params.zip || '').replace(/\D/g, '');
    if (!/^\d{5}$/.test(zip)) return jsonErr(res, 400, 'ZIP 必须为 5 位数字');
    try {
        const r = await fetch(ZIPPO_ENDPOINT + zip, { signal: AbortSignal.timeout(6000) });
        if (!r.ok) return jsonErr(res, 404, 'ZIP 未找到');
        const raw = await r.json();
        const place = raw.places && raw.places[0];
        if (!place) return jsonErr(res, 404, 'ZIP 未匹配到城市');
        const stateAbbr = place['state abbreviation'];
        // Load effective tax table (persisted overrides or defaults)
        db.get('SELECT Value FROM FinanceSettings WHERE Key = ?', ['salesTaxTable'], (dbErr, row) => {
            let salesTax = US_STATE_SALES_TAX;
            let corpTax = US_STATE_CORP_TAX;
            if (row) {
                try { const p = JSON.parse(row.Value); if (p.salesTax) salesTax = p.salesTax; if (p.corpTax) corpTax = p.corpTax; } catch (_) {}
            }
            res.json({
                zip,
                state: stateAbbr,
                stateName: place.state,
                city: place['place name'],
                latitude: Number(place.latitude),
                longitude: Number(place.longitude),
                salesTax: salesTax[stateAbbr] ?? 0,
                corpTax:  corpTax[stateAbbr]  ?? 0
            });
        });
    } catch (err) {
        console.error('ZIP lookup error:', err);
        res.status(502).json({ error: 'ZIP 查询失败', detail: String(err.message || err) });
    }
});

// Ocean-freight estimator, default Shenzhen (SZX) → Los Angeles (LAX).
// Inputs: cbm, weightKg, pricePerCbmUSD (mode), unitsPerShipment, extraFeesUSD
// Returns a per-unit landed ocean-freight cost estimate.
// Rates are market averages updated manually; caller can override.
app.post('/api/finance/ocean-freight', (req, res) => {
    const b = req.body || {};
    const cbm = Number(b.cbm) || 1.56;
    const weightKg = Number(b.weightKg) || 246;
    const unitsPerShipment = Math.max(1, Number(b.unitsPerShipment) || 1);
    const mode = b.mode || 'auto'; // 'LCL' | 'FCL40HQ' | 'auto'

    // Chargeable weight rule: 1 CBM ≈ 1000 kg volumetric equivalent for ocean
    // So for our X7: actual 246 kg vs 1.56 CBM × 1000 = 1560 kg → CBM dominates.
    const totalCbm = cbm * unitsPerShipment;
    const totalKg  = weightKg * unitsPerShipment;
    const chargeableTons = Math.max(totalCbm, totalKg / 1000);

    // Rough market rates (Shenzhen → LA, 2025 baseline; overrideable)
    const LCL_USD_PER_CBM = Number(b.lclRatePerCbmUSD) || 120;  // port-to-port LCL
    const FCL40HQ_TOTAL_USD = Number(b.fcl40hqUSD) || 4500;    // end-to-end 40'HQ (~76 CBM capacity)
    const FCL40HQ_CAPACITY_CBM = 76;

    const lclCost = totalCbm * LCL_USD_PER_CBM;
    const fclFullCost = FCL40HQ_TOTAL_USD;
    const fclPerUnitFull = fclFullCost / (FCL40HQ_CAPACITY_CBM / cbm); // cost assuming container is filled

    let chosen, chosenTotalCost, note;
    if (mode === 'LCL') {
        chosen = 'LCL';
        chosenTotalCost = lclCost;
        note = 'LCL 散货拼箱估价';
    } else if (mode === 'FCL40HQ') {
        chosen = 'FCL40HQ';
        chosenTotalCost = fclFullCost;
        note = `40'HQ 整柜总价（容量约 ${FCL40HQ_CAPACITY_CBM} CBM，本批 ${totalCbm.toFixed(2)} CBM）`;
    } else {
        // auto: pick the cheaper one given current shipment volume
        if (totalCbm >= 45 || lclCost > fclFullCost) {
            chosen = 'FCL40HQ';
            chosenTotalCost = fclFullCost;
            note = `体积或总价超过 40'HQ 阈值，自动切整柜`;
        } else {
            chosen = 'LCL';
            chosenTotalCost = lclCost;
            note = `货量较少自动选 LCL`;
        }
    }

    const extraFeesUSD = Number(b.extraFeesUSD) || 0; // port handling / docs / trucking to port
    const perUnitUSD = (chosenTotalCost + extraFeesUSD) / unitsPerShipment;

    res.json({
        ok: true,
        mode: chosen,
        note,
        totalCbm: Number(totalCbm.toFixed(3)),
        totalKg,
        chargeableTons: Number(chargeableTons.toFixed(3)),
        lclCostUSD: Number(lclCost.toFixed(2)),
        fcl40hqCostUSD: fclFullCost,
        fcl40hqPerUnitUSDIfFull: Number(fclPerUnitFull.toFixed(2)),
        extraFeesUSD,
        perUnitUSD: Number(perUnitUSD.toFixed(2)),
        assumptions: { lclRatePerCbmUSD: LCL_USD_PER_CBM, fcl40hqUSD: FCL40HQ_TOTAL_USD, fcl40hqCapacityCbm: FCL40HQ_CAPACITY_CBM }
    });
});

// US inland LTL estimator based on ZIP-to-ZIP distance (haversine).
// Rough LTL commercial rate model for a ~250 kg crated robot shipment:
//   fixedBase (~$120) + $1.6/mile for first 500 mi then $0.9/mile thereafter
// This is a ballpark; for true quotes the user should use a real rate engine.
app.post('/api/finance/us-inland', async (req, res) => {
    const b = req.body || {};
    const fromZip = String(b.fromZip || '90001').replace(/\D/g, '');
    const toZip   = String(b.toZip   || '').replace(/\D/g, '');
    if (!/^\d{5}$/.test(fromZip) || !/^\d{5}$/.test(toZip)) {
        return jsonErr(res, 400, 'fromZip 与 toZip 均需 5 位数字');
    }
    const weightKg = Number(b.weightKg) || 246;
    const pieces = Math.max(1, Number(b.pieces) || 1);

    async function lookup(zip) {
        const r = await fetch(ZIPPO_ENDPOINT + zip, { signal: AbortSignal.timeout(6000) });
        if (!r.ok) throw new Error('ZIP ' + zip + ' not found');
        const raw = await r.json();
        const p = raw.places && raw.places[0];
        if (!p) throw new Error('ZIP ' + zip + ' 未匹配城市');
        return { lat: Number(p.latitude), lon: Number(p.longitude), state: p['state abbreviation'], city: p['place name'] };
    }

    try {
        const [from, to] = await Promise.all([lookup(fromZip), lookup(toZip)]);
        // Haversine distance (miles)
        const toRad = (d) => d * Math.PI / 180;
        const R = 3958.8;
        const dLat = toRad(to.lat - from.lat);
        const dLon = toRad(to.lon - from.lon);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon/2)**2;
        const distMi = 2 * R * Math.asin(Math.sqrt(a));

        const base = 120;
        const tier1 = Math.min(distMi, 500) * 1.6;
        const tier2 = Math.max(0, distMi - 500) * 0.9;
        // Pieces/weight surcharge: for multi-unit shipments (each 246 kg)
        const weightSurcharge = Math.max(0, (weightKg * pieces - 250) * 0.35);
        const totalUSD = base + tier1 + tier2 + weightSurcharge;
        const perUnitUSD = totalUSD / pieces;

        res.json({
            ok: true,
            from: { zip: fromZip, city: from.city, state: from.state },
            to:   { zip: toZip,   city: to.city,   state: to.state },
            distanceMiles: Number(distMi.toFixed(1)),
            totalUSD: Number(totalUSD.toFixed(2)),
            perUnitUSD: Number(perUnitUSD.toFixed(2)),
            breakdown: {
                base: base,
                tier1_first500mi: Number(tier1.toFixed(2)),
                tier2_beyond500mi: Number(tier2.toFixed(2)),
                weightSurcharge: Number(weightSurcharge.toFixed(2))
            },
            note: '基于 ZIP 大圆距离的粗估 LTL 报价；精确报价请接入 Shippo/EasyPost/Freightos 付费 API。'
        });
    } catch (err) {
        console.error('US inland error:', err);
        res.status(502).json({ error: '内陆运费估算失败', detail: String(err.message || err) });
    }
});

// Excel export: 6-sheet workbook
app.post('/api/finance/export', async (req, res) => {
    const { scenario, computed, aiSuggestion, scenarioName } = req.body || {};
    if (!scenario || !computed) return jsonErr(res, 400, '需要 scenario 与 computed 字段');

    try {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Panshaker Finance';
        wb.created = new Date();

        const title = (t) => ({ font: { bold: true, size: 13 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } }, alignment: { horizontal: 'center' }, color: { argb: 'FFFFFFFF' } });
        const headFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        const redFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
        const moneyFmt = '"$"#,##0.00';
        const pctFmt = '0.00%';

        // ── Sheet 1: Dashboard 汇总 ──
        const s1 = wb.addWorksheet('Dashboard 汇总');
        s1.mergeCells('A1:D1');
        const t1 = s1.getCell('A1');
        t1.value = `Panshaker 美国分公司 财务测算 · ${scenarioName || '未命名场景'}`;
        t1.font = { bold: true, size: 14 };
        t1.alignment = { horizontal: 'center' };
        t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } };
        s1.columns = [{ width: 28 }, { width: 22 }, { width: 22 }, { width: 40 }];

        const kpis = computed.kpi || {};
        const rows1 = [
            ['生成时间', new Date().toLocaleString('zh-CN'), '', ''],
            ['汇率 (USD->CNY)', scenario.meta?.fxRate, '', scenario.meta?.fxUpdatedAt || ''],
            ['公司州 / 目的州', `${scenario.meta?.companyState} / ${scenario.meta?.destinationState}`, '', ''],
            ['', '', '', ''],
            ['[ 单台买断 ]', '', '', ''],
            ['买断售价 (USD)', kpis.buyoutPrice, '', ''],
            ['单台变动成本 (USD)', kpis.buyoutVarCost, '', ''],
            ['单台毛利 (USD)', kpis.buyoutGrossPerUnit, '', ''],
            ['毛利率', kpis.buyoutGrossPct, '', ''],
            ['', '', '', ''],
            ['[ 单台租赁 (最低租期 LTV) ]', '', '', ''],
            ['首期 (USD)', kpis.leaseFirstPay, '', ''],
            ['月租 (USD)', kpis.leaseMonthlyRent, '', ''],
            ['押金 (USD)', kpis.leaseDepositAmt, '', `租${scenario.lease?.firstPayMonths}押${scenario.lease?.depositMonths}`],
            ['最低租期 (月)', kpis.leaseMinMonths, '', ''],
            ['最低租期内收入 (USD)', kpis.leaseMinRevenue, '', ''],
            ['单台变动成本+折旧 (USD)', kpis.leaseUnitCostLTV, '', ''],
            ['LTV 净收益 (USD)', kpis.leaseLtvNet, '', kpis.leaseLtvNet >= 0 ? '盈利' : '亏损'],
            ['回本月份', kpis.leasePaybackMonths, '', ''],
            ['', '', '', ''],
            ['[ 跨境销售提成 ]', '', '', ''],
            ['美国成交方提成率', scenario.product?.commissions?.usSalesPct, '', ''],
            ['中国引流方提成率', scenario.product?.commissions?.chinaReferralPct, '', ''],
            ['中国引流占比', scenario.product?.commissions?.chinaReferralAttachRate, '', ''],
            ['其他提成/奖励', scenario.product?.commissions?.otherPct, '', ''],
            ['', '', '', ''],
            ['[ 盈亏平衡 ]', '', '', ''],
            ['月度固定成本 (USD)', kpis.monthlyFixedCost, '', ''],
            ['买断盈亏平衡台数/月', kpis.buyoutBreakevenUnits, '', ''],
            ['租赁盈亏平衡台数/月', kpis.leaseBreakevenUnits, '', ''],
            ['', '', '', ''],
            ['[ 现金流预警 ]', '', '', ''],
            ['首次现金流转负月', kpis.firstNegativeMonth || '无', '', ''],
            ['最深现金流缺口 (USD)', kpis.maxNegativeCashflow, '', '']
        ];
        s1.addRow(['指标', '数值', '', '备注']).eachCell((c) => { c.fill = headFill; c.font = { bold: true }; });
        rows1.forEach(r => {
            const row = s1.addRow(r);
            const vc = row.getCell(2);
            if (typeof vc.value === 'number') {
                const nm = String(r[0] || '');
                if (nm.includes('率') || nm.includes('占比') || nm.includes('提成') || nm.includes('%')) vc.numFmt = pctFmt;
                else if (nm.includes('USD')) vc.numFmt = moneyFmt;
            }
        });

        // ── Sheet 2: 买断明细 ──
        const s2 = wb.addWorksheet('买断明细');
        s2.columns = [{ width: 18 }, { width: 32 }, { width: 18 }];
        s2.addRow(['类别', '项目', '数值']).eachCell(c => { c.fill = headFill; c.font = { bold: true }; });
        (computed.buyoutRows || []).forEach(r => {
            const row = s2.addRow([r.group, r.name, r.value]);
            if (r.isPct) row.getCell(3).numFmt = pctFmt;
            else if (typeof r.value === 'number') row.getCell(3).numFmt = moneyFmt;
            if (r.isTotal) { row.font = { bold: true }; row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } }; }
        });

        // ── Sheet 3: 租赁明细 ──
        const s3 = wb.addWorksheet('租赁明细');
        s3.columns = [{ width: 18 }, { width: 32 }, { width: 18 }];
        s3.addRow(['类别', '项目', '数值']).eachCell(c => { c.fill = headFill; c.font = { bold: true }; });
        (computed.leaseRows || []).forEach(r => {
            const row = s3.addRow([r.group, r.name, r.value]);
            if (r.isPct) row.getCell(3).numFmt = pctFmt;
            else if (typeof r.value === 'number') row.getCell(3).numFmt = moneyFmt;
            if (r.isTotal) { row.font = { bold: true }; row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } }; }
        });

        // ── Sheet 4: 月度现金流 ──
        const s4 = wb.addWorksheet('月度现金流');
        s4.columns = [
            { header: '月份', key: 'm', width: 6 },
            { header: '预测销量(台)', key: 'units', width: 12 },
            { header: '买断收入', key: 'bRev', width: 14 },
            { header: '租赁收入', key: 'lRev', width: 14 },
            { header: '变动成本', key: 'varC', width: 14 },
            { header: '固定成本', key: 'fixedC', width: 14 },
            { header: '税费', key: 'tax', width: 14 },
            { header: '净现金流', key: 'net', width: 14 },
            { header: '累计现金流', key: 'cum', width: 14 }
        ];
        s4.getRow(1).font = { bold: true };
        s4.getRow(1).fill = headFill;
        (computed.cashflow || []).forEach(m => {
            const r = s4.addRow(m);
            ['bRev','lRev','varC','fixedC','tax','net','cum'].forEach(k => {
                const c = r.getCell(k); c.numFmt = moneyFmt;
            });
            if (m.net < 0) r.eachCell(c => { c.fill = redFill; });
        });

        // ── Sheet 5: 月度费用预算 ──
        const s5 = wb.addWorksheet('月度费用预算');
        const opexHeader = ['科目', ...Array.from({ length: 12 }, (_, i) => `${i + 1}月`), '全年合计'];
        s5.addRow(opexHeader).eachCell(c => { c.fill = headFill; c.font = { bold: true }; });
        s5.getColumn(1).width = 28;
        for (let i = 2; i <= 14; i++) s5.getColumn(i).width = 11;
        const cats = (scenario.opex?.categories || []).concat(scenario.customCosts?.filter(c => c.unit === 'per_month') || []);
        const colTotals = new Array(12).fill(0);
        cats.forEach(cat => {
            const months = cat.months || new Array(12).fill(cat.valueUSD || 0);
            const sum = months.reduce((a, b) => a + (Number(b) || 0), 0);
            months.forEach((v, i) => { colTotals[i] += Number(v) || 0; });
            const r = s5.addRow([cat.name, ...months, sum]);
            for (let i = 2; i <= 14; i++) r.getCell(i).numFmt = moneyFmt;
        });
        const totalRow = s5.addRow(['月度小计', ...colTotals, colTotals.reduce((a,b)=>a+b,0)]);
        totalRow.font = { bold: true };
        totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } };
        for (let i = 2; i <= 14; i++) totalRow.getCell(i).numFmt = moneyFmt;

        // ── Sheet 6: AI 报告 ──
        const s6 = wb.addWorksheet('AI 建议');
        s6.columns = [{ width: 24 }, { width: 80 }];
        if (aiSuggestion) {
            const cs = aiSuggestion?.commissionSplit || {};
            const ctco = aiSuggestion?.competitorAdjustedTCO || {};
            const lo = aiSuggestion?.leaseOptimization || {};
            const plans = Array.isArray(lo.plans) ? lo.plans : [];
            const kv = [
                ['买断建议低价 (USD)', aiSuggestion?.buyoutPrice?.low],
                ['买断建议高价 (USD)', aiSuggestion?.buyoutPrice?.high],
                ['买断定价理由', aiSuggestion?.buyoutPrice?.reason],
                ['', ''],
                ['[ 竞品调整后 TCO ]', ''],
                ['智谷天厨 FOB 裸价 (USD)', ctco.bareUSD],
                ['到岸+服务调整后 (USD)', ctco.totalLandedUSD],
                ['缺失服务折价 (USD)', ctco.servicePenaltyUSD],
                ['说明', ctco.reason],
                ['', ''],
                ['[ 租赁主方案 ]', ''],
                ['激活费 Activation (USD)', aiSuggestion?.lease?.activationFee],
                ['月租金 (USD)', aiSuggestion?.lease?.monthlyRent],
                ['首期月数', aiSuggestion?.lease?.firstPayMonths],
                ['押金月数', aiSuggestion?.lease?.depositMonths],
                ['最低租期 (月)', aiSuggestion?.lease?.minMonths],
                ['提前退租费 (USD)', aiSuggestion?.lease?.earlyTerminationFee],
                ['回本月份', aiSuggestion?.lease?.paybackMonths],
                ['租赁理由', aiSuggestion?.lease?.reason],
                ['', ''],
                ['[ 租赁现金流优化 - 诊断 ]', lo.problemDiagnosis || '']
            ];
            plans.forEach((p, idx) => {
                kv.push(['', '']);
                const isReco = (lo.recommendedPlanIndex === idx) ? ' [推荐]' : '';
                kv.push([`[ 方案 ${idx + 1}: ${p.name || ''}${isReco} ]`, '']);
                kv.push(['  激活费 (USD)', p.activationFee]);
                kv.push(['  月租金 (USD)', p.monthlyRent]);
                kv.push(['  首期月数', p.firstPayMonths]);
                kv.push(['  押金月数', p.depositMonths]);
                kv.push(['  最低租期 (月)', p.minMonths]);
                kv.push(['  提前退租费 (USD)', p.earlyTerminationFee]);
                kv.push(['  预期每台首月净现金流 (USD)', p.expectedFirstMonthCashPerUnit]);
                kv.push(['  回本月份', p.breakevenMonthPerUnit]);
                kv.push(['  说明', p.rationale]);
            });
            kv.push(['', '']);
            kv.push(['[ 跨境提成分成 ]', '']);
            kv.push(['美国成交方提成率', cs.usSalesPct]);
            kv.push(['中国引流方提成率', cs.chinaReferralPct]);
            kv.push(['中国引流占比', cs.chinaReferralAttachRate]);
            kv.push(['其他提成', cs.otherPct]);
            kv.push(['分成理由', cs.reason]);
            kv.push(['', '']);
            kv.push(['现金流预警', aiSuggestion?.cashflowWarning]);
            kv.push(['风险 1', (aiSuggestion?.risks || [])[0]]);
            kv.push(['风险 2', (aiSuggestion?.risks || [])[1]]);
            kv.push(['风险 3', (aiSuggestion?.risks || [])[2]]);
            kv.push(['竞品差异化定价说理', aiSuggestion?.competitiveRationale]);
            s6.addRow(['字段', '内容']).eachCell(c => { c.fill = headFill; c.font = { bold: true }; });
            kv.forEach(([k, v]) => {
                const r = s6.addRow([k, v == null ? '' : v]);
                r.getCell(2).alignment = { wrapText: true, vertical: 'top' };
            });
        } else {
            s6.addRow(['AI 建议', '本次导出未包含 AI 建议（请先在页面上点击「AI 建议售价」）']);
        }

        const filename = `panshaker_finance_${(scenarioName||'scenario').replace(/[^a-zA-Z0-9_\-]/g,'_')}_${Date.now()}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Finance export error:', err);
        res.status(500).json({ error: '导出失败', detail: String(err.message || err) });
    }
});

// Start Server for Cloud Environments (0.0.0.0)
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port} (0.0.0.0)`);
});
// Allow long-running AI streaming responses without tripping Node's default
// request timeout (5 min). Azure default front-end idle timeout is 230s,
// but because GLM is streaming data the TCP keep-alive keeps the connection
// live across the full 4-minute budget.
server.requestTimeout = 0;
server.headersTimeout = 305000;
server.keepAliveTimeout = 305000;
