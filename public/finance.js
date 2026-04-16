// Panshaker Finance Module - compute core
// All monetary values in USD unless suffix "CNY" used.
// The scenario JSON structure follows index.js::buildBaselineScenario().

(function (global) {
    // ── Generic helpers ──
    const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
    const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
    const num = (x, def = 0) => {
        const n = Number(x);
        return Number.isFinite(n) ? n : def;
    };

    // FX helpers: toUSD / toCNY
    function toUSD(amount, currency, fxRate) {
        if (currency === 'CNY') return num(amount) / num(fxRate, 7.2);
        return num(amount);
    }
    function toCNY(amountUSD, fxRate) {
        return num(amountUSD) * num(fxRate, 7.2);
    }

    // Effective commission rate, supporting both new cross-border schema and legacy field.
    //   newSchema: usSalesPct + chinaReferralPct * chinaReferralAttachRate + otherPct
    //   legacy:    salesPct + otherPct
    function effectiveCommissionRate(scenario) {
        const c = scenario.product?.commissions || {};
        if (c.usSalesPct != null || c.chinaReferralPct != null) {
            return num(c.usSalesPct) + num(c.chinaReferralPct) * num(c.chinaReferralAttachRate) + num(c.otherPct);
        }
        return num(c.salesPct) + num(c.otherPct);
    }

    // Split of the effective commission rate for display purposes.
    function commissionBreakdown(scenario) {
        const c = scenario.product?.commissions || {};
        const us = num(c.usSalesPct != null ? c.usSalesPct : c.salesPct);
        const cnRef = num(c.chinaReferralPct) * num(c.chinaReferralAttachRate);
        const other = num(c.otherPct);
        return { us, cnRef, other, total: us + cnRef + other };
    }

    // ── Derive per-unit landed cost (USD) ──
    // unitCostUSD already is the FOB/ex-works cost delivered to China port (or similar base).
    function computeLandedUnitCost(scenario) {
        const p = scenario.product || {};
        const l = p.landed || {};
        const base = num(p.unitCostUSD);
        const duty = base * num(l.importDutyPct);
        return base
            + num(l.oceanFreightUSD)
            + duty
            + num(l.portFeesUSD)
            + num(l.usInlandFreightUSD);
        // warehouseMonthly is allocated as monthly fixed, not per-unit landed.
    }

    // ── Custom cost aggregation ──
    // Custom cost items have: { id, name, unit: 'per_unit'|'per_customer'|'per_month'|'once',
    //                           valueUSD, appliesTo: 'buyout'|'lease'|'both' }
    function customPerUnit(scenario, channel) {
        const items = scenario.customCosts || [];
        return items
            .filter(c => (c.appliesTo === channel || c.appliesTo === 'both') && c.unit === 'per_unit')
            .reduce((s, c) => s + num(c.valueUSD), 0);
    }
    function customPerCustomer(scenario, channel) {
        const items = scenario.customCosts || [];
        return items
            .filter(c => (c.appliesTo === channel || c.appliesTo === 'both') && c.unit === 'per_customer')
            .reduce((s, c) => s + num(c.valueUSD), 0);
    }
    function customPerMonthTotal(scenario) {
        return (scenario.customCosts || [])
            .filter(c => c.unit === 'per_month')
            .reduce((s, c) => s + num(c.valueUSD), 0);
    }
    function customOnceTotal(scenario) {
        return (scenario.customCosts || [])
            .filter(c => c.unit === 'once')
            .reduce((s, c) => s + num(c.valueUSD), 0);
    }

    // ── Monthly fixed opex ──
    function monthlyFixedOpex(scenario, monthIdx /* 0..11 or >=12 (loops) */) {
        const cats = (scenario.opex?.categories || []);
        const idx = ((num(monthIdx) % 12) + 12) % 12;
        let sum = 0;
        for (const c of cats) {
            const arr = c.months || [];
            sum += num(arr[idx]);
        }
        // custom per_month items added uniformly
        sum += customPerMonthTotal(scenario);
        // warehouse monthly from product.landed
        sum += num(scenario.product?.landed?.warehouseMonthlyUSD);
        return sum;
    }

    function avgMonthlyFixedOpex(scenario) {
        let total = 0;
        for (let i = 0; i < 12; i++) total += monthlyFixedOpex(scenario, i);
        return total / 12;
    }

    // ── BUYOUT model ──
    function computeBuyout(scenario) {
        const a = scenario.assumptions || {};
        const b = scenario.buyout || {};
        const p = scenario.product || {};
        const tax = scenario.tax || {};

        const customers = num(a.totalLeads) * num(a.conversionRate);
        const units = customers * num(a.unitsPerCustomer);
        const price = num(b.priceUSD);

        const landed = computeLandedUnitCost(scenario);
        const perUnitCustom = customPerUnit(scenario, 'buyout');
        const perCustomerCustom = customPerCustomer(scenario, 'buyout');

        // Variable per-unit cost (includes US closer + CN referral * attach rate + other)
        const commissionRate = effectiveCommissionRate(scenario);
        const commissionPerUnit = price * commissionRate;

        const varPerUnit =
            landed +
            num(p.installTrainingUSD) +
            num(p.warrantyUSD) +
            num(p.shippingToCustomerUSD) +
            num(p.advertisingUSD) +
            commissionPerUnit +
            perUnitCustom +
            perCustomerCustom / Math.max(1, num(a.unitsPerCustomer, 1)); // per-customer pro-rated per unit

        const revenue = units * price;
        const varCost = units * varPerUnit;

        // Annual fixed
        const annualFixed = avgMonthlyFixedOpex(scenario) * 12;
        const franchise = num(tax.franchiseTaxAnnualUSD);

        const ebt = revenue - varCost - annualFixed - franchise;
        const corpTaxRate = num(tax.federalCorpPct) + num(tax.stateCorpPct);
        const corpTax = Math.max(0, ebt) * corpTaxRate;
        const netProfit = ebt - corpTax;

        const grossPerUnit = price - varPerUnit;
        const grossPct = price > 0 ? grossPerUnit / price : 0;
        const varCostRate = revenue > 0 ? varCost / revenue : 0;
        const contributionMargin = 1 - varCostRate;
        const breakevenRevenue = contributionMargin > 0 ? (annualFixed + franchise) / contributionMargin : Infinity;
        const breakevenUnits = price > 0 ? breakevenRevenue / price : Infinity;

        return {
            customers, units, price, varPerUnit, grossPerUnit, grossPct,
            revenue, varCost, annualFixed, franchise, ebt, corpTax, netProfit,
            varCostRate, contributionMargin, breakevenRevenue, breakevenUnits,
            landed
        };
    }

    function buildBuyoutRows(scenario, r) {
        // Mirrors Excel "1买断-利润模型" sheet structure
        const a = scenario.assumptions || {};
        const p = scenario.product || {};
        const b = scenario.buyout || {};
        const rows = [];
        const push = (group, name, value, isPct, isTotal) => rows.push({ group, name, value, isPct, isTotal });

        push('假设-业绩', '总线索数', num(a.totalLeads));
        push('假设-业绩', '线索成交率', num(a.conversionRate), true);
        push('假设-业绩', '单线索成本 (USD)', num(a.costPerLeadUSD));
        push('假设-业绩', '成交客户数', r.customers);
        push('假设-业绩', '每客户平均首单购买数量', num(a.unitsPerCustomer));
        push('假设-业绩', '销量 (台)', r.units);
        push('假设-政策', '买断售价 (USD)', num(b.priceUSD));
        push('假设-成本', '每台到岸成本 (USD)', r.landed);
        push('假设-成本', '每客户上门培训成本 (USD)', num(p.installTrainingUSD));
        push('假设-成本', '每台设备运输费 (USD)', num(p.shippingToCustomerUSD));
        push('假设-成本', '每台设备质保费 (USD)', num(p.warrantyUSD));
        push('假设-成本', '每台设备广告费 (USD)', num(p.advertisingUSD));
        const cb = commissionBreakdown(scenario);
        push('假设-成本', '美国成交方提成率', num(p.commissions?.usSalesPct != null ? p.commissions.usSalesPct : p.commissions?.salesPct), true);
        push('假设-成本', '中国引流方提成率', num(p.commissions?.chinaReferralPct), true);
        push('假设-成本', '中国引流占比 (attach rate)', num(p.commissions?.chinaReferralAttachRate), true);
        push('假设-成本', '其他提成/奖励', num(p.commissions?.otherPct), true);
        push('假设-成本', '有效综合提成率', cb.total, true);
        push('假设-税率', '联邦企业所得税', num(scenario.tax?.federalCorpPct), true);
        push('假设-税率', '州企业所得税', num(scenario.tax?.stateCorpPct), true);
        push('结论-利润', '销售总额 (USD)', r.revenue, false, true);
        push('结论-利润', '变动成本合计 (USD)', r.varCost);
        push('结论-利润', '固定成本合计 (USD)', r.annualFixed);
        push('结论-利润', 'Franchise Tax (USD)', r.franchise);
        push('结论-利润', '税前利润 EBT (USD)', r.ebt);
        push('结论-利润', '企业所得税 (USD)', r.corpTax);
        push('结论-利润', '净利润 (USD)', r.netProfit, false, true);
        push('结论-利润', '净利率', r.revenue > 0 ? r.netProfit / r.revenue : 0, true);
        push('结论-质量', '单台变动成本 (USD)', r.varPerUnit);
        push('结论-质量', '单台毛利 (USD)', r.grossPerUnit);
        push('结论-质量', '毛利率', r.grossPct, true);
        push('结论-质量', '变动成本率', r.varCostRate, true);
        push('结论-质量', '边际贡献率', r.contributionMargin, true);
        push('结论-质量', '盈亏平衡销售额 (USD)', r.breakevenRevenue);
        push('结论-质量', '盈亏平衡销售量 (台)', r.breakevenUnits);
        return rows;
    }

    // ── LEASE model ──
    function computeLease(scenario) {
        const a = scenario.assumptions || {};
        const L = scenario.lease || {};
        const p = scenario.product || {};
        const tax = scenario.tax || {};

        const customers = num(a.totalLeads) * num(a.conversionRate);
        const units = customers * num(a.unitsPerCustomer);
        const firstPay = num(L.firstPayUSD);
        const rent = num(L.monthlyRentUSD);
        const minMonths = Math.max(1, num(L.minMonths, 24));
        const firstPayMonths = Math.max(0, num(L.firstPayMonths, 1));
        const depositMonths = Math.max(0, num(L.depositMonths, 2));
        const etFee = num(L.earlyTerminationFeeUSD);

        const landed = computeLandedUnitCost(scenario);
        const usefulLifeMonths = Math.max(1, num(p.usefulLifeMonths, 60));
        const monthlyDep = landed / usefulLifeMonths;

        // LTV within the minimum lease window
        const revPerUnitMinTerm = firstPay + rent * minMonths; // deposit excluded (refundable)
        const commissionRate = effectiveCommissionRate(scenario);
        const commissionPerUnit = revPerUnitMinTerm * commissionRate;

        const perUnitCustom = customPerUnit(scenario, 'lease');
        const perCustomerCustom = customPerCustomer(scenario, 'lease');

        // Upfront variable cost per unit (the "cost of putting device into the field")
        const varPerUnitOneTime =
            landed +
            num(p.installTrainingUSD) +
            num(p.warrantyUSD) +
            num(p.shippingToCustomerUSD) +
            num(p.advertisingUSD) +
            commissionPerUnit +
            perUnitCustom +
            perCustomerCustom / Math.max(1, num(a.unitsPerCustomer, 1));

        // Unit-cost within minimum term (include monthly depreciation over minMonths)
        const varPerUnitLTV = varPerUnitOneTime + monthlyDep * minMonths;
        const ltvNet = revPerUnitMinTerm - varPerUnitLTV;

        // Payback months: firstPay + rent * n >= varPerUnitOneTime + monthlyDep * n
        // => n * (rent - monthlyDep) >= varPerUnitOneTime - firstPay
        const margin = rent - monthlyDep;
        let paybackMonths = Infinity;
        if (margin > 0) {
            paybackMonths = Math.max(0, Math.ceil((varPerUnitOneTime - firstPay) / margin));
            if (firstPay >= varPerUnitOneTime) paybackMonths = 0;
        }

        // Totals using all forecast units (for P&L table)
        const totalRevenueMinTerm = units * revPerUnitMinTerm;
        const totalVarCostMinTerm = units * varPerUnitLTV;
        const annualFixed = avgMonthlyFixedOpex(scenario) * 12;
        const franchise = num(tax.franchiseTaxAnnualUSD);
        const ebt = totalRevenueMinTerm - totalVarCostMinTerm - annualFixed - franchise;
        const corpRate = num(tax.federalCorpPct) + num(tax.stateCorpPct);
        const corpTax = Math.max(0, ebt) * corpRate;
        const netProfit = ebt - corpTax;

        const varRate = totalRevenueMinTerm > 0 ? totalVarCostMinTerm / totalRevenueMinTerm : 0;
        const contribMargin = 1 - varRate;
        const breakevenRevenue = contribMargin > 0 ? (annualFixed + franchise) / contribMargin : Infinity;
        const breakevenUnits = revPerUnitMinTerm > 0 ? breakevenRevenue / revPerUnitMinTerm : Infinity;

        return {
            customers, units, firstPay, rent, minMonths, firstPayMonths, depositMonths, etFee,
            landed, monthlyDep, revPerUnitMinTerm, varPerUnitOneTime, varPerUnitLTV, ltvNet,
            paybackMonths, totalRevenueMinTerm, totalVarCostMinTerm,
            annualFixed, franchise, ebt, corpTax, netProfit,
            varCostRate: varRate, contributionMargin: contribMargin,
            breakevenRevenue, breakevenUnits, commissionPerUnit
        };
    }

    function buildLeaseRows(scenario, r) {
        const a = scenario.assumptions || {};
        const L = scenario.lease || {};
        const p = scenario.product || {};
        const rows = [];
        const push = (group, name, value, isPct, isTotal) => rows.push({ group, name, value, isPct, isTotal });

        push('假设-业绩', '总线索数', num(a.totalLeads));
        push('假设-业绩', '线索成交率', num(a.conversionRate), true);
        push('假设-业绩', '单线索成本 (USD)', num(a.costPerLeadUSD));
        push('假设-业绩', '成交客户数', r.customers);
        push('假设-业绩', '每客户平均首单租赁数量', num(a.unitsPerCustomer));
        push('假设-业绩', '首期投放量 (台)', r.units);
        push('假设-政策', '每台首单价格 (USD)', r.firstPay);
        push('假设-政策', '每台月租金 (USD)', r.rent);
        push('假设-政策', `首期月数 / 押金月数 (租${r.firstPayMonths}押${r.depositMonths})`, r.firstPayMonths + '/' + r.depositMonths);
        push('假设-政策', '最低租期 (月)', r.minMonths);
        push('假设-政策', '提前退租费 (USD)', r.etFee);
        push('假设-成本', '每台到岸成本 (USD)', r.landed);
        push('假设-成本', '每月折旧成本 (USD)', r.monthlyDep);
        push('假设-成本', '每客户上门培训成本 (USD)', num(p.installTrainingUSD));
        push('假设-成本', '每台设备运输费 (USD)', num(p.shippingToCustomerUSD));
        push('假设-成本', '每台设备质保费 (USD)', num(p.warrantyUSD));
        push('假设-成本', '每台设备广告费 (USD)', num(p.advertisingUSD));
        const lcb = commissionBreakdown(scenario);
        push('假设-成本', '美国成交方提成率', num(p.commissions?.usSalesPct != null ? p.commissions.usSalesPct : p.commissions?.salesPct), true);
        push('假设-成本', '中国引流方提成率', num(p.commissions?.chinaReferralPct), true);
        push('假设-成本', '中国引流占比 (attach rate)', num(p.commissions?.chinaReferralAttachRate), true);
        push('假设-成本', '其他提成/奖励', num(p.commissions?.otherPct), true);
        push('假设-成本', '有效综合提成率', lcb.total, true);
        push('结论-利润', '最低租期租金总收入 (USD)', r.totalRevenueMinTerm, false, true);
        push('结论-利润', '最低租期变动成本合计 (USD)', r.totalVarCostMinTerm);
        push('结论-利润', '固定成本合计 (USD)', r.annualFixed);
        push('结论-利润', 'Franchise Tax (USD)', r.franchise);
        push('结论-利润', '税前利润 EBT (USD)', r.ebt);
        push('结论-利润', '企业所得税 (USD)', r.corpTax);
        push('结论-利润', '净利润 (USD)', r.netProfit, false, true);
        push('结论-利润', '净利率', r.totalRevenueMinTerm > 0 ? r.netProfit / r.totalRevenueMinTerm : 0, true);
        push('结论-质量', '单台最低租期收入 LTV (USD)', r.revPerUnitMinTerm);
        push('结论-质量', '单台前期变动成本 (USD)', r.varPerUnitOneTime);
        push('结论-质量', '单台 LTV 成本 (含折旧) (USD)', r.varPerUnitLTV);
        push('结论-质量', '单台 LTV 净收益 (USD)', r.ltvNet);
        push('结论-质量', '回本月数', r.paybackMonths);
        push('结论-质量', '变动成本率', r.varCostRate, true);
        push('结论-质量', '边际贡献率', r.contributionMargin, true);
        push('结论-质量', '盈亏平衡租金总额 (USD)', r.breakevenRevenue);
        return rows;
    }

    // ── MONTHLY cash-flow projection (cohort model) ──
    // For each month m (1..N):
    //   - New customers this month (buyoutCohort[m], leaseCohort[m])
    //   - Revenue/cost events for ALL active cohorts in month m
    //
    // Assumptions:
    //   - Lease cohort lasts exactly minMonths, then deposit refunds on month end of (start+minMonths-1).
    //   - Buyout: full revenue + variable cost incurred at cohort start month.
    //   - Fixed opex: applied every month.
    //   - Depreciation: applied every month for every active leased unit.
    //   - Taxes: applied monthly on positive EBT (simple linearization).
    function computeCashflow(scenario, N) {
        const months = Math.max(1, Math.min(120, num(N, scenario.meta?.cashflowMonths || 24)));
        const forecast = (scenario.forecast?.monthlyUnits || []).slice(0, months);
        while (forecast.length < months) forecast.push(0);

        const leaseRatio = clamp(num(scenario.assumptions?.leaseRatio, 0.6), 0, 1);
        const price = num(scenario.buyout?.priceUSD);
        const p = scenario.product || {};
        const L = scenario.lease || {};
        const tax = scenario.tax || {};
        const landed = computeLandedUnitCost(scenario);
        const usefulLife = Math.max(1, num(p.usefulLifeMonths, 60));
        const monthlyDep = landed / usefulLife;

        // Per-unit variable cost (upfront)
        const commissionRate = effectiveCommissionRate(scenario);
        const perUnitCustomBuyout = customPerUnit(scenario, 'buyout');
        const perUnitCustomLease  = customPerUnit(scenario, 'lease');
        const perCustomerCustomBuyout = customPerCustomer(scenario, 'buyout');
        const perCustomerCustomLease  = customPerCustomer(scenario, 'lease');
        const upc = Math.max(1, num(scenario.assumptions?.unitsPerCustomer, 1));

        const buyoutVarPerUnit =
            landed +
            num(p.installTrainingUSD) +
            num(p.warrantyUSD) +
            num(p.shippingToCustomerUSD) +
            num(p.advertisingUSD) +
            price * commissionRate +
            perUnitCustomBuyout + perCustomerCustomBuyout / upc;

        const leaseVarPerUnit =
            landed +
            num(p.installTrainingUSD) +
            num(p.warrantyUSD) +
            num(p.shippingToCustomerUSD) +
            num(p.advertisingUSD) +
            (num(L.firstPayUSD) + num(L.monthlyRentUSD) * Math.max(1, num(L.minMonths, 24))) * commissionRate +
            perUnitCustomLease + perCustomerCustomLease / upc;

        // Lease cohort counts
        const leaseStart = forecast.map(u => num(u) * leaseRatio);
        const buyoutStart = forecast.map(u => num(u) * (1 - leaseRatio));

        const firstPayM = Math.max(0, num(L.firstPayMonths, 1));
        const depositM  = Math.max(0, num(L.depositMonths, 2));
        const minM      = Math.max(1, num(L.minMonths, 24));

        const onceTotal = customOnceTotal(scenario); // applied at month 1
        const corpRate = num(tax.federalCorpPct) + num(tax.stateCorpPct);
        const franchiseMonthly = num(tax.franchiseTaxAnnualUSD) / 12;

        const result = [];
        let cum = 0;

        for (let m = 1; m <= months; m++) {
            const idx = m - 1;
            const newBuyoutUnits = buyoutStart[idx];
            const newLeaseUnits = leaseStart[idx];

            // --- Lease recurring revenue: each cohort k pays monthlyRent every month
            //     from month (k + firstPayMonths) up through month (k + minMonths - 1) UNLESS firstPayMonths already covered the early months.
            // For simplicity: lease cohort k contributes monthlyRent at months k+1 .. k+minMonths - 1 (the first month k already receives prepaid rent).
            let leaseRecurringRev = 0;
            let leaseRecurringDep = 0; // monthly depreciation for every active unit
            let depositRefund = 0;
            for (let k = 0; k < m; k++) {
                const age = idx - k; // 0 = just started this month
                const started = leaseStart[k];
                if (started <= 0) continue;

                // Active if age < minM
                if (age < minM) {
                    // Monthly rent stream (after the first-pay block)
                    if (age >= firstPayM) {
                        leaseRecurringRev += started * num(L.monthlyRentUSD);
                    }
                    // Monthly depreciation charges
                    leaseRecurringDep += started * monthlyDep;
                }
                // Deposit refund in the month AFTER lease ends (age == minM)
                if (age === minM) {
                    depositRefund += started * num(L.monthlyRentUSD) * depositM;
                }
            }

            // --- Cohort-start cash (this month m only)
            const leaseCohortUpfrontRev  = newLeaseUnits * (num(L.firstPayUSD) + num(L.monthlyRentUSD) * firstPayM);
            const leaseCohortDepositIn   = newLeaseUnits * num(L.monthlyRentUSD) * depositM; // cash in, liability
            const leaseCohortVarCost     = newLeaseUnits * leaseVarPerUnit;

            const buyoutRev     = newBuyoutUnits * price;
            const buyoutVarCost = newBuyoutUnits * buyoutVarPerUnit;

            // --- Monthly fixed opex (incl. warehouse + custom per_month)
            const fixedMonthly = monthlyFixedOpex(scenario, idx);

            // --- Once-only customCosts charged on month 1
            const onceCost = m === 1 ? onceTotal : 0;

            // --- Revenue/cost aggregation for P&L style
            const revenueThisMonth = buyoutRev + leaseCohortUpfrontRev + leaseRecurringRev;
            const varThisMonth = buyoutVarCost + leaseCohortVarCost;
            const nonCashDep = leaseRecurringDep;

            const ebtMonth = revenueThisMonth - varThisMonth - fixedMonthly - nonCashDep - franchiseMonthly - onceCost;
            const taxMonth = Math.max(0, ebtMonth) * corpRate;

            // Cash flow (exclude non-cash depreciation, include deposit cash movements)
            const netCash = revenueThisMonth - varThisMonth - fixedMonthly - franchiseMonthly - onceCost - taxMonth
                          + leaseCohortDepositIn - depositRefund;

            cum += netCash;

            result.push({
                m,
                units: forecast[idx],
                bRev: r2(buyoutRev),
                lRev: r2(leaseCohortUpfrontRev + leaseRecurringRev),
                varC: r2(varThisMonth),
                fixedC: r2(fixedMonthly + franchiseMonthly + onceCost),
                tax: r2(taxMonth),
                net: r2(netCash),
                cum: r2(cum),
                depositIn: r2(leaseCohortDepositIn),
                depositOut: r2(depositRefund),
                dep: r2(nonCashDep),
                ebt: r2(ebtMonth)
            });
        }
        return result;
    }

    // ── KPIs for Dashboard ──
    function computeKPIs(scenario, buy, lease, cashflow) {
        const minM = Math.max(1, num(scenario.lease?.minMonths, 24));
        const firstNeg = cashflow.find(r => r.net < 0);
        const maxDeficit = cashflow.reduce((mn, r) => Math.min(mn, r.net), 0);
        const minCum = cashflow.reduce((mn, r) => Math.min(mn, r.cum), 0);

        return {
            buyoutPrice: r2(buy.price),
            buyoutVarCost: r2(buy.varPerUnit),
            buyoutGrossPerUnit: r2(buy.grossPerUnit),
            buyoutGrossPct: r2(buy.grossPct * 100) / 100,
            leaseFirstPay: r2(lease.firstPay),
            leaseMonthlyRent: r2(lease.rent),
            leaseDepositAmt: r2(lease.rent * lease.depositMonths),
            leaseMinMonths: lease.minMonths,
            leaseMinRevenue: r2(lease.revPerUnitMinTerm),
            leaseUnitCostLTV: r2(lease.varPerUnitLTV),
            leaseLtvNet: r2(lease.ltvNet),
            leasePaybackMonths: lease.paybackMonths === Infinity ? '∞' : lease.paybackMonths,
            monthlyFixedCost: r2(avgMonthlyFixedOpex(scenario)),
            buyoutBreakevenUnits: buy.breakevenUnits === Infinity ? '∞' : r2(buy.breakevenUnits / 12),
            leaseBreakevenUnits: lease.breakevenUnits === Infinity ? '∞' : r2(lease.breakevenUnits / 12),
            firstNegativeMonth: firstNeg ? firstNeg.m : null,
            maxNegativeCashflow: r2(maxDeficit),
            minCumulative: r2(minCum)
        };
    }

    // ── Top-level compute: returns everything the UI needs ──
    function computeAll(scenario) {
        const months = scenario.meta?.cashflowMonths || 24;
        const buy = computeBuyout(scenario);
        const lease = computeLease(scenario);
        const cashflow = computeCashflow(scenario, months);
        const kpi = computeKPIs(scenario, buy, lease, cashflow);
        return {
            kpi,
            buyout: buy,
            lease,
            cashflow,
            buyoutRows: buildBuyoutRows(scenario, buy),
            leaseRows: buildLeaseRows(scenario, lease)
        };
    }

    // ── Utilities for UI number formatting ──
    function fmtUSD(x) {
        const n = num(x);
        return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    function fmtCNY(x) {
        const n = num(x);
        return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    function fmtPct(x) { return (num(x) * 100).toFixed(2) + '%'; }
    function fmtInt(x) { return Math.round(num(x)).toLocaleString(); }

    global.PsFinance = {
        toUSD, toCNY,
        computeLandedUnitCost,
        computeBuyout, computeLease, computeCashflow, computeKPIs, computeAll,
        buildBuyoutRows, buildLeaseRows,
        avgMonthlyFixedOpex, monthlyFixedOpex,
        effectiveCommissionRate, commissionBreakdown,
        fmtUSD, fmtCNY, fmtPct, fmtInt, r2, num
    };
})(window);
