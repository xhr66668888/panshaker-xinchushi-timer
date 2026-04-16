const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const ExcelJS = require('exceljs');
const app = express();
const port = process.env.PORT || 5000;

// Finance module: Zhipu GLM API key (per user requirement: hardcoded for out-of-box deploy)
const GLM_API_KEY = 'af5c0dee3b10490d9d6003cd4f33813d.YI88kpKxhBroZTQ7';
const GLM_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const GLM_MODEL = 'glm-4.6v';
const FX_ENDPOINT = 'https://open.er-api.com/v6/latest/USD';

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

        // Seed the default Delaware baseline scenario (only once)
        db.get('SELECT COUNT(*) as cnt FROM FinanceScenarios', [], (err, row) => {
            if (err || !row || row.cnt > 0) return;
            const baseline = buildBaselineScenario();
            db.run(
                'INSERT INTO FinanceScenarios (Name, IsDefault, DataJson) VALUES (?, 1, ?)',
                ['\u57fa\u7ebf-Delaware', JSON.stringify(baseline)],
                (e) => { if (e) console.error('Seed scenario error:', e); }
            );
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

function buildBaselineScenario() {
    const r = (n) => Math.round(n);
    return {
        version: 1,
        meta: {
            baseCurrency: 'USD',
            fxRate: 7.2,
            fxUpdatedAt: null,
            companyState: 'DE',
            destinationState: 'CA',
            cashflowMonths: 24,
            notes: ''
        },
        product: {
            name: '\u828f\u53a8\u5e08 X7',
            unitCostUSD: r(27900 / 7.2),
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
            usefulLifeMonths: 60,
            // Cross-border TOB commission split.
            //   usSalesPct: commission paid to the US closer team (always applied)
            //   chinaReferralPct: commission paid to the CN lead-gen/referral team
            //     (applied only on deals that originated from the China branch,
            //      weighted by chinaReferralAttachRate)
            //   chinaReferralAttachRate: share of US deals that originated from CN leads
            //   otherPct: other bonuses / SPIFF
            // Industry norm for US-CN cross-border TOB hardware sales:
            //   total pool 5%, split 40% CN / 60% US, attach rate 30%.
            commissions: {
                usSalesPct: 0.03,
                chinaReferralPct: 0.02,
                chinaReferralAttachRate: 0.30,
                otherPct: 0.01
            }
        },
        assumptions: {
            totalLeads: 500,
            conversionRate: 0.05,
            costPerLeadUSD: 50,
            unitsPerCustomer: 1,
            leaseRatio: 0.6
        },
        buyout: {
            priceUSD: 15000
        },
        lease: {
            firstPayUSD: 2000,
            monthlyRentUSD: 599,
            firstPayMonths: 1,
            depositMonths: 2,
            minMonths: 24,
            earlyTerminationFeeUSD: 2000
        },
        tax: {
            federalCorpPct: 0.21,
            stateCorpPct: US_STATE_CORP_TAX.DE,
            franchiseTaxAnnualUSD: 400,
            payroll: {
                ficaEmployerPct: 0.0765,
                futaPct: 0.006,
                sutaPct: 0.018,
                benefitsPctOfSalary: 0.15
            }
        },
        opex: {
            categories: [
                { id: 'salesSalary',  name: '\u9500\u552e\u4eba\u5458\u85aa\u916c',           months: new Array(12).fill(8000)  },
                { id: 'mgmtSalary',   name: '\u7ba1\u7406\u4eba\u5458\u85aa\u916c',           months: new Array(12).fill(10000) },
                { id: 'payrollTax',   name: 'Payroll Tax (FICA/FUTA/SUTA)',                    months: new Array(12).fill(1815)  },
                { id: 'benefits',     name: '\u5458\u5de5\u798f\u5229/\u4fdd\u9669',           months: new Array(12).fill(2700)  },
                { id: 'ads',          name: '\u5e7f\u544a\u8d39',                               months: new Array(12).fill(5000)  },
                { id: 'freight',      name: '\u8fd0\u8f93\u8d39(\u516c\u53f8\u7ea7)',           months: new Array(12).fill(800)   },
                { id: 'travel',       name: '\u5dee\u65c5\u8d39',                               months: new Array(12).fill(1500)  },
                { id: 'rent',         name: '\u623f\u79df',                                     months: new Array(12).fill(3500)  },
                { id: 'utilities',    name: '\u6c34\u7535\u71c3\u6c14',                         months: new Array(12).fill(600)   },
                { id: 'property',     name: '\u7269\u4e1a\u8d39',                               months: new Array(12).fill(400)   },
                { id: 'entertainment',name: '\u4e1a\u52a1\u62db\u5f85',                         months: new Array(12).fill(500)   },
                { id: 'office',       name: '\u529e\u516c\u8d39',                               months: new Array(12).fill(300)   },
                { id: 'phone',        name: '\u7535\u8bdd/\u7f51\u7edc\u8d39',                  months: new Array(12).fill(200)   },
                { id: 'depreciation', name: '\u56fa\u5b9a\u8d44\u4ea7\u6298\u65e7',             months: new Array(12).fill(400)   },
                { id: 'aftersales',   name: '\u552e\u540e',                                     months: new Array(12).fill(600)   },
                { id: 'amortization', name: '\u65e0\u5f62\u8d44\u4ea7\u644a\u9500',             months: new Array(12).fill(200)   },
                { id: 'other',        name: '\u5176\u4ed6\u8d39\u7528',                         months: new Array(12).fill(500)   }
            ]
        },
        customCosts: [],
        forecast: {
            monthlyUnits: Array.from({ length: 60 }, (_, i) => Math.min(4 + Math.round(i * 0.8), 40))
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
        '你是 Panshaker 美国分公司（Delaware C-Corp）的资深财务与定价顾问，服务于炒菜机器人 B2B 商用市场。',
        '产品：芯厨师 X7 炒菜机器人，官网 panshaker.com；中国零售价 CNY 38800–50000，中国分公司销售提成 4%；中国分公司给美国分公司的到岸前成本价 CNY 27900/台（未含美国关税、海运、美国内陆、仓储）。',
        '主要竞品：智谷天厨，美国市场报价 USD 11000，FOB 中国港口，不含任何关税与运费。',
        '目标客户：美国中小型餐饮连锁、云厨房、校园/医院食堂、食品工厂，决策周期 30–60 天。',
        '美国市场特性：销售税（Sales Tax）由目的州征收，属代收代缴，不吃公司收入；联邦企业所得税 21%；Delaware 州企业所得税 8.7% 并有 Franchise Tax。雇主负担 payroll 约 9.4%（FICA 7.65% + FUTA + SUTA）。',
        '跨境提成机制（中美 TOB 行业惯例）：当中国分公司的销售/流量团队把线索推给美国团队后由美国成交，提成需要中美双方分摊。行业典型做法是总池 5% 左右，按 40%/60% 分成给 CN 引流方 / US 成交方；若 attach rate（推荐占比）偏低可以调到 50/50；必须把 CN 端的分成作为美国 P&L 上一条独立的变动成本项，不能漏算。',
        '请基于用户给出的完整场景 JSON（含 product.commissions 里的 usSalesPct / chinaReferralPct / chinaReferralAttachRate / otherPct）：',
        '1. 单台变动成本（含设备成本、海运、关税、美国内陆、仓储、安装培训、广告、各路提成）。有效提成率 = usSalesPct + chinaReferralPct × chinaReferralAttachRate + otherPct，务必把 CN 跨境分成单独标出来。',
        '2. 买断情形：考虑目标毛利 35–50% 并参考竞品定位，给出推荐售价区间（low/high USD）与定位说明。',
        '3. 租赁情形：设计 firstPay（USD）、monthlyRent（USD）、deposit（按月数，说明"租 X 押 Y"含义）、minMonths、early-termination fee（USD）。必须证明最低租期内累计 LTV 显著 > 单台变动成本 + 设备折旧；给出 payback period（月数）。',
        '4. 基于 monthlyUnits 预测，指出何时月度现金流可能转负并给出对策。',
        '5. 建议的中美跨境分成结构（CN/US 百分比以及触发条件），评价当前 attach rate 是否合理。',
        '6. 风险点 3 条，竞品差异化定价说理 1 段（含高端定位 vs 价格战选择）。',
        '严格只输出 JSON（不要任何 markdown、不要解释文字包裹），schema：{',
        '  "buyoutPrice": {"low": number, "high": number, "reason": string},',
        '  "lease": {"firstPay": number, "monthlyRent": number, "depositMonths": number, "firstPayMonths": number, "minMonths": number, "earlyTerminationFee": number, "paybackMonths": number, "reason": string},',
        '  "commissionSplit": {"usSalesPct": number, "chinaReferralPct": number, "chinaReferralAttachRate": number, "otherPct": number, "reason": string},',
        '  "cashflowWarning": string,',
        '  "risks": [string, string, string],',
        '  "competitiveRationale": string',
        '}'
    ].join('\n');

    try {
        const resp = await fetch(GLM_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + GLM_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: GLM_MODEL,
                temperature: 0.3,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: '当前场景：\n```json\n' + JSON.stringify(scenario, null, 2) + '\n```\n请严格按照 schema 输出 JSON。' }
                ]
            }),
            signal: AbortSignal.timeout(45000)
        });
        const text = await resp.text();
        if (!resp.ok) {
            console.error('GLM error:', resp.status, text.slice(0, 500));
            return res.status(502).json({ error: 'AI 服务调用失败', status: resp.status, detail: text.slice(0, 500) });
        }
        let payload;
        try { payload = JSON.parse(text); } catch (e) {
            return res.status(502).json({ error: 'AI 返回解析失败', raw: text.slice(0, 800) });
        }
        const content = payload?.choices?.[0]?.message?.content || '';
        let suggestion = null;
        try {
            suggestion = JSON.parse(content);
        } catch (e) {
            const m = content.match(/\{[\s\S]*\}/);
            if (m) { try { suggestion = JSON.parse(m[0]); } catch (_) {} }
        }
        if (!suggestion) {
            return res.status(502).json({ error: 'AI 返回非 JSON', raw: content.slice(0, 800) });
        }
        res.json({ success: true, suggestion, raw: content });
    } catch (err) {
        console.error('GLM fetch error:', err);
        res.status(502).json({ error: 'AI 请求异常', detail: String(err.message || err) });
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
            const kv = [
                ['买断建议低价 (USD)', aiSuggestion?.buyoutPrice?.low],
                ['买断建议高价 (USD)', aiSuggestion?.buyoutPrice?.high],
                ['买断定价理由', aiSuggestion?.buyoutPrice?.reason],
                ['', ''],
                ['租赁首期 (USD)', aiSuggestion?.lease?.firstPay],
                ['租赁月租 (USD)', aiSuggestion?.lease?.monthlyRent],
                ['租赁押金月数', aiSuggestion?.lease?.depositMonths],
                ['首期月数', aiSuggestion?.lease?.firstPayMonths],
                ['最低租期 (月)', aiSuggestion?.lease?.minMonths],
                ['提前退租费 (USD)', aiSuggestion?.lease?.earlyTerminationFee],
                ['回本月份', aiSuggestion?.lease?.paybackMonths],
                ['租赁理由', aiSuggestion?.lease?.reason],
                ['', ''],
                ['[ 建议的中美跨境提成分成 ]', ''],
                ['美国成交方提成率', cs.usSalesPct],
                ['中国引流方提成率', cs.chinaReferralPct],
                ['中国引流占比', cs.chinaReferralAttachRate],
                ['其他提成', cs.otherPct],
                ['分成理由', cs.reason],
                ['', ''],
                ['现金流预警', aiSuggestion?.cashflowWarning],
                ['风险 1', (aiSuggestion?.risks || [])[0]],
                ['风险 2', (aiSuggestion?.risks || [])[1]],
                ['风险 3', (aiSuggestion?.risks || [])[2]],
                ['竞品差异化定价说理', aiSuggestion?.competitiveRationale]
            ];
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
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port} (0.0.0.0)`);
});
