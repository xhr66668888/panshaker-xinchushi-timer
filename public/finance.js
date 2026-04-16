// Panshaker Finance compute core (v2).
// Simplified:
//   - No depreciation, no leaseRatio, no lead-gen derivation.
//   - Forecast: two explicit monthly arrays (buyoutMonthlyUnits / leaseMonthlyUnits).
//   - Lease LTV = monthlyRent * minMonths - upfrontVarCost.
// All monetary values stored as USD. Currency display is a UI concern.
(function (global) {
    const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
    const num = (x, def = 0) => {
        const n = Number(x);
        return Number.isFinite(n) ? n : def;
    };

    function toUSD(amount, currency, fxRate) {
        if (currency === 'CNY') return num(amount) / num(fxRate, 7.2);
        return num(amount);
    }
    function toCNY(amountUSD, fxRate) {
        return num(amountUSD) * num(fxRate, 7.2);
    }

    function effectiveCommissionRate(scenario) {
        const c = scenario.product?.commissions || {};
        if (c.usSalesPct != null || c.chinaReferralPct != null) {
            return num(c.usSalesPct) + num(c.chinaReferralPct) * num(c.chinaReferralAttachRate) + num(c.otherPct);
        }
        return num(c.salesPct) + num(c.otherPct);
    }
    function commissionBreakdown(scenario) {
        const c = scenario.product?.commissions || {};
        const us = num(c.usSalesPct != null ? c.usSalesPct : c.salesPct);
        const cnRef = num(c.chinaReferralPct) * num(c.chinaReferralAttachRate);
        const other = num(c.otherPct);
        return { us, cnRef, other, total: us + cnRef + other };
    }

    // Per-unit landed cost (USD): base + ocean + duty + port + US inland.
    function computeLandedUnitCost(scenario) {
        const p = scenario.product || {};
        const l = p.landed || {};
        const base = num(p.unitCostUSD);
        const duty = base * num(l.importDutyPct);
        return base + num(l.oceanFreightUSD) + duty + num(l.portFeesUSD) + num(l.usInlandFreightUSD);
    }

    function customPerUnit(scenario, channel) {
        return (scenario.customCosts || [])
            .filter(c => (c.appliesTo === channel || c.appliesTo === 'both') && c.unit === 'per_unit')
            .reduce((s, c) => s + num(c.valueUSD), 0);
    }
    function customPerCustomer(scenario, channel) {
        return (scenario.customCosts || [])
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

    function monthlyFixedOpex(scenario, monthIdx) {
        const cats = scenario.opex?.categories || [];
        const idx = ((num(monthIdx) % 12) + 12) % 12;
        let sum = 0;
        for (const c of cats) sum += num((c.months || [])[idx]);
        sum += customPerMonthTotal(scenario);
        sum += num(scenario.product?.landed?.warehouseMonthlyUSD);
        return sum;
    }
    function avgMonthlyFixedOpex(scenario) {
        let total = 0;
        for (let i = 0; i < 12; i++) total += monthlyFixedOpex(scenario, i);
        return total / 12;
    }

    // ── Per-unit economics ──
    function perUnitBuyout(scenario) {
        const p = scenario.product || {};
        const price = num(scenario.buyout?.priceUSD);
        const landed = computeLandedUnitCost(scenario);
        const commission = price * effectiveCommissionRate(scenario);
        const varPerUnit = landed
            + num(p.installTrainingUSD)
            + num(p.warrantyUSD)
            + num(p.shippingToCustomerUSD)
            + num(p.advertisingUSD)
            + commission
            + customPerUnit(scenario, 'buyout')
            + customPerCustomer(scenario, 'buyout'); // one customer per unit assumption
        return {
            price,
            landed,
            commission,
            varPerUnit,
            grossPerUnit: price - varPerUnit,
            grossPct: price > 0 ? (price - varPerUnit) / price : 0
        };
    }

    function perUnitLease(scenario) {
        const p = scenario.product || {};
        const L = scenario.lease || {};
        const rent = num(L.monthlyRentUSD);
        const firstPayMonths = Math.max(0, num(L.firstPayMonths, 0));
        const depositMonths = Math.max(0, num(L.depositMonths, 0));
        const minMonths = Math.max(1, num(L.minMonths, 1));
        // Non-refundable activation / onboarding / installation fee charged at lease start.
        const activationFee = num(L.activationFeeUSD);

        // Customer pays upfront: activationFee + firstPayMonths × rent + deposit × rent
        // (deposit later refunded; activation fee kept).
        const firstPeriodCashIn = activationFee + rent * (firstPayMonths + depositMonths);
        // Revenue recognized within min-term = activationFee + rent × minMonths (deposit not revenue).
        const minTermRevenue = activationFee + rent * minMonths;

        const landed = computeLandedUnitCost(scenario);
        const commission = minTermRevenue * effectiveCommissionRate(scenario);
        const upfrontVarCost = landed
            + num(p.installTrainingUSD)
            + num(p.warrantyUSD)
            + num(p.shippingToCustomerUSD)
            + num(p.advertisingUSD)
            + commission
            + customPerUnit(scenario, 'lease')
            + customPerCustomer(scenario, 'lease');

        const ltvNet = minTermRevenue - upfrontVarCost;
        // First-month net cash per unit (how much of upfront var cost is covered by the
        // first-period cash-in). Negative means the business loses cash per new lease.
        const firstMonthNetCashPerUnit = firstPeriodCashIn - upfrontVarCost;

        // Payback months: after first period, remaining cost recovered by monthly rent.
        // rentCoverFirst = first-pay months of rent already prepaid → they aren't extra cash.
        // Remaining shortfall = max(0, upfrontVarCost - firstPeriodCashIn); each month after
        // firstPayMonths generates `rent` cash.
        let paybackMonths;
        if (firstMonthNetCashPerUnit >= 0) {
            paybackMonths = 0;
        } else if (rent > 0) {
            paybackMonths = firstPayMonths + Math.ceil((-firstMonthNetCashPerUnit) / rent);
        } else {
            paybackMonths = Infinity;
        }

        return {
            rent,
            firstPayMonths,
            depositMonths,
            minMonths,
            activationFee,
            firstPeriodCashIn,
            firstMonthNetCashPerUnit,
            minTermRevenue,
            landed,
            commission,
            upfrontVarCost,
            ltvNet,
            paybackMonths
        };
    }

    // ── Aggregate P&L from 12-month forecast ──
    function computePnl(scenario) {
        const bf = scenario.forecast?.buyoutMonthlyUnits || [];
        const lf = scenario.forecast?.leaseMonthlyUnits  || [];
        const buyoutTotal = bf.reduce((s, v) => s + num(v), 0);
        const leaseTotal  = lf.reduce((s, v) => s + num(v), 0);

        const b = perUnitBuyout(scenario);
        const l = perUnitLease(scenario);

        const buyoutRevenue = buyoutTotal * b.price;
        const buyoutVarCost = buyoutTotal * b.varPerUnit;

        // Lease: revenue recognized = min-term rent × leaseTotal cohorts
        const leaseRevenue = leaseTotal * l.minTermRevenue;
        const leaseVarCost = leaseTotal * l.upfrontVarCost;

        const annualFixed = avgMonthlyFixedOpex(scenario) * 12;
        const franchise = num(scenario.tax?.franchiseTaxAnnualUSD);
        const onceCost = customOnceTotal(scenario);

        const totalRevenue = buyoutRevenue + leaseRevenue;
        const totalVarCost = buyoutVarCost + leaseVarCost;
        const ebt = totalRevenue - totalVarCost - annualFixed - franchise - onceCost;
        const corpRate = num(scenario.tax?.federalCorpPct) + num(scenario.tax?.stateCorpPct);
        const corpTax = Math.max(0, ebt) * corpRate;
        const netProfit = ebt - corpTax;

        const varRate = totalRevenue > 0 ? totalVarCost / totalRevenue : 0;
        const contribMargin = 1 - varRate;
        const breakevenRevenue = contribMargin > 0 ? (annualFixed + franchise + onceCost) / contribMargin : Infinity;

        return {
            buyoutTotal, leaseTotal,
            buyoutRevenue, buyoutVarCost,
            leaseRevenue,  leaseVarCost,
            annualFixed, franchise, onceCost,
            totalRevenue, totalVarCost,
            ebt, corpTax, netProfit,
            varRate, contribMargin, breakevenRevenue,
            perUnit: { buyout: b, lease: l }
        };
    }

    // ── Monthly cashflow (cohort based) ──
    function computeCashflow(scenario, N) {
        const months = Math.max(1, Math.min(60, num(N, 12)));
        const bf = (scenario.forecast?.buyoutMonthlyUnits || []).slice(0, months);
        const lf = (scenario.forecast?.leaseMonthlyUnits  || []).slice(0, months);
        while (bf.length < months) bf.push(0);
        while (lf.length < months) lf.push(0);

        const b = perUnitBuyout(scenario);
        const l = perUnitLease(scenario);
        const L = scenario.lease || {};
        const tax = scenario.tax || {};
        const corpRate = num(tax.federalCorpPct) + num(tax.stateCorpPct);
        const franchiseMonthly = num(tax.franchiseTaxAnnualUSD) / 12;
        const onceTotal = customOnceTotal(scenario);

        const result = [];
        let cum = 0;
        for (let m = 1; m <= months; m++) {
            const idx = m - 1;
            const newBuyout = num(bf[idx]);
            const newLease  = num(lf[idx]);

            // Lease recurring rent from prior cohorts (after their firstPay block ends)
            let leaseRecurringRev = 0;
            let leaseDepositRefund = 0;
            for (let k = 0; k < m; k++) {
                const started = num(lf[k]);
                if (started <= 0) continue;
                const age = idx - k;
                if (age >= l.firstPayMonths && age < l.minMonths) {
                    leaseRecurringRev += started * l.rent;
                }
                if (age === l.minMonths) {
                    leaseDepositRefund += started * l.rent * l.depositMonths;
                }
            }

            // New cohort cash: activation fee (kept) + prepaid rent + deposit (liability cash in)
            const leaseActivationIn = newLease * l.activationFee;
            const leaseFirstPayIn = newLease * l.rent * l.firstPayMonths;
            const leaseDepositIn  = newLease * l.rent * l.depositMonths;
            const leaseUpfrontCost = newLease * l.upfrontVarCost;

            const buyoutRev     = newBuyout * b.price;
            const buyoutVarCost = newBuyout * b.varPerUnit;

            const fixedMonthly = monthlyFixedOpex(scenario, idx);
            const onceCost = m === 1 ? onceTotal : 0;

            const revenueThisMonth = buyoutRev + leaseActivationIn + leaseFirstPayIn + leaseRecurringRev;
            const varThisMonth = buyoutVarCost + leaseUpfrontCost;

            const ebtMonth = revenueThisMonth - varThisMonth - fixedMonthly - franchiseMonthly - onceCost;
            const taxMonth = Math.max(0, ebtMonth) * corpRate;

            const netCash = revenueThisMonth - varThisMonth - fixedMonthly - franchiseMonthly - onceCost - taxMonth
                + leaseDepositIn - leaseDepositRefund;

            cum += netCash;
            result.push({
                m,
                buyoutUnits: newBuyout,
                leaseUnits: newLease,
                bRev: r2(buyoutRev),
                lRev: r2(leaseActivationIn + leaseFirstPayIn + leaseRecurringRev),
                varC: r2(varThisMonth),
                fixedC: r2(fixedMonthly + franchiseMonthly + onceCost),
                tax: r2(taxMonth),
                net: r2(netCash),
                cum: r2(cum),
                activationIn: r2(leaseActivationIn),
                depositIn: r2(leaseDepositIn),
                depositOut: r2(leaseDepositRefund),
                ebt: r2(ebtMonth)
            });
        }
        return result;
    }

    // ── KPI panel summary ──
    function computeKPIs(scenario, pnl, cashflow) {
        const firstNeg = cashflow.find(r => r.net < 0);
        const maxDeficit = cashflow.reduce((mn, r) => Math.min(mn, r.net), 0);
        const minCum = cashflow.reduce((mn, r) => Math.min(mn, r.cum), 0);
        const b = pnl.perUnit.buyout;
        const l = pnl.perUnit.lease;

        return {
            buyoutPrice: r2(b.price),
            buyoutVarCost: r2(b.varPerUnit),
            buyoutGrossPerUnit: r2(b.grossPerUnit),
            buyoutGrossPct: r2(b.grossPct * 100) / 100,
            leaseActivationFee: r2(l.activationFee),
            leaseMonthlyRent: r2(l.rent),
            leaseFirstPayMonths: l.firstPayMonths,
            leaseDepositMonths: l.depositMonths,
            leaseMinMonths: l.minMonths,
            leaseFirstPeriodCashIn: r2(l.firstPeriodCashIn),
            leaseFirstMonthNetCashPerUnit: r2(l.firstMonthNetCashPerUnit),
            leaseMinRevenue: r2(l.minTermRevenue),
            leaseUpfrontVarCost: r2(l.upfrontVarCost),
            leaseLtvNet: r2(l.ltvNet),
            leasePaybackMonths: l.paybackMonths === Infinity ? '∞' : l.paybackMonths,
            monthlyFixedCost: r2(avgMonthlyFixedOpex(scenario)),
            totalBuyoutUnits: pnl.buyoutTotal,
            totalLeaseUnits: pnl.leaseTotal,
            annualRevenue: r2(pnl.totalRevenue),
            annualNetProfit: r2(pnl.netProfit),
            netMargin: pnl.totalRevenue > 0 ? r2((pnl.netProfit / pnl.totalRevenue) * 100) / 100 : 0,
            firstNegativeMonth: firstNeg ? firstNeg.m : null,
            maxNegativeCashflow: r2(maxDeficit),
            minCumulative: r2(minCum)
        };
    }

    // ── Detail row builders ──
    function buildBuyoutRows(scenario, pnl) {
        const b = pnl.perUnit.buyout;
        const p = scenario.product || {};
        const cb = commissionBreakdown(scenario);
        const rows = [];
        const push = (g, n, v, isPct, isTotal) => rows.push({ group: g, name: n, value: v, isPct, isTotal });

        push('假设-政策', '买断售价 (USD)', num(scenario.buyout?.priceUSD));
        push('假设-成本', '单台基础成本 (USD)', num(p.unitCostUSD));
        push('假设-成本', '海运 USD/台', num(p.landed?.oceanFreightUSD));
        push('假设-成本', '进口关税率', num(p.landed?.importDutyPct), true);
        push('假设-成本', '港口杂费 USD/台', num(p.landed?.portFeesUSD));
        push('假设-成本', '美国内陆 USD/台', num(p.landed?.usInlandFreightUSD));
        push('假设-成本', '单台到岸成本合计 (USD)', b.landed);
        push('假设-成本', '上门培训 USD/客户', num(p.installTrainingUSD));
        push('假设-成本', '质保 USD/台', num(p.warrantyUSD));
        push('假设-成本', '客户运输 USD/台', num(p.shippingToCustomerUSD));
        push('假设-成本', '广告 USD/台', num(p.advertisingUSD));
        push('假设-提成', '美国成交方 %', cb.us, true);
        push('假设-提成', '中国引流方 % × 占比', cb.cnRef, true);
        push('假设-提成', '其他提成 %', cb.other, true);
        push('假设-提成', '有效综合提成率', cb.total, true);
        push('假设-提成', '单台提成金额 (USD)', b.commission);
        push('假设-税率', '联邦企业所得税', num(scenario.tax?.federalCorpPct), true);
        push('假设-税率', '州企业所得税', num(scenario.tax?.stateCorpPct), true);
        push('结论', '单台变动成本合计 (USD)', b.varPerUnit, false, true);
        push('结论', '单台毛利 (USD)', b.grossPerUnit);
        push('结论', '毛利率', b.grossPct, true);
        push('结论', '12 月买断总销量 (台)', pnl.buyoutTotal);
        push('结论', '12 月买断收入 (USD)', pnl.buyoutRevenue);
        push('结论', '12 月买断变动成本 (USD)', pnl.buyoutVarCost);
        return rows;
    }

    function buildLeaseRows(scenario, pnl) {
        const l = pnl.perUnit.lease;
        const p = scenario.product || {};
        const cb = commissionBreakdown(scenario);
        const rows = [];
        const push = (g, n, v, isPct, isTotal) => rows.push({ group: g, name: n, value: v, isPct, isTotal });

        push('假设-政策', '激活费 Activation (USD, 不退)', l.activationFee);
        push('假设-政策', '月租金 (USD)', l.rent);
        push('假设-政策', '首期月数', l.firstPayMonths);
        push('假设-政策', '押金月数', l.depositMonths);
        push('假设-政策', '最低租期 (月)', l.minMonths);
        push('假设-政策', '提前退租费 (USD)', num(scenario.lease?.earlyTerminationFeeUSD));
        push('假设-政策', '首期现金流入 (USD)', l.firstPeriodCashIn);
        push('假设-政策', '每台首月净现金 (USD)', l.firstMonthNetCashPerUnit);
        push('假设-成本', '单台到岸成本 (USD)', l.landed);
        push('假设-成本', '上门培训 USD/客户', num(p.installTrainingUSD));
        push('假设-成本', '质保 USD/台', num(p.warrantyUSD));
        push('假设-成本', '客户运输 USD/台', num(p.shippingToCustomerUSD));
        push('假设-成本', '广告 USD/台', num(p.advertisingUSD));
        push('假设-提成', '美国成交方 %', cb.us, true);
        push('假设-提成', '中国引流方 % × 占比', cb.cnRef, true);
        push('假设-提成', '其他提成 %', cb.other, true);
        push('假设-提成', '有效综合提成率', cb.total, true);
        push('假设-提成', '单台提成金额 (USD, 基于 LTV)', l.commission);
        push('结论', '单台最低租期收入 LTV (USD)', l.minTermRevenue, false, true);
        push('结论', '单台前期变动成本 (USD)', l.upfrontVarCost);
        push('结论', '单台 LTV 净收益 (USD)', l.ltvNet);
        push('结论', '回本月数', l.paybackMonths);
        push('结论', '12 月租赁新增 (台)', pnl.leaseTotal);
        push('结论', '12 月租赁收入 (USD)', pnl.leaseRevenue);
        push('结论', '12 月租赁变动成本 (USD)', pnl.leaseVarCost);
        return rows;
    }

    function computeAll(scenario, cashflowMonths) {
        const months = Math.max(1, Math.min(60, num(cashflowMonths, 12)));
        const pnl = computePnl(scenario);
        const cashflow = computeCashflow(scenario, months);
        const kpi = computeKPIs(scenario, pnl, cashflow);
        return {
            kpi,
            pnl,
            cashflow,
            buyoutRows: buildBuyoutRows(scenario, pnl),
            leaseRows:  buildLeaseRows(scenario, pnl),
            // Legacy aliases (for Excel export compatibility)
            buyout: pnl.perUnit.buyout,
            lease:  pnl.perUnit.lease
        };
    }

    // ── Formatters ──
    function fmtUSD(x) {
        const n = num(x);
        return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    function fmtCNY(x) {
        const n = num(x);
        return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    function fmt(x, cur, fxRate) {
        return cur === 'CNY' ? fmtCNY(toCNY(x, fxRate)) : fmtUSD(x);
    }
    function fmtPct(x) { return (num(x) * 100).toFixed(2) + '%'; }
    function fmtInt(x) { return Math.round(num(x)).toLocaleString(); }

    global.PsFinance = {
        toUSD, toCNY,
        computeLandedUnitCost,
        perUnitBuyout, perUnitLease,
        computePnl, computeCashflow, computeKPIs, computeAll,
        buildBuyoutRows, buildLeaseRows,
        effectiveCommissionRate, commissionBreakdown,
        avgMonthlyFixedOpex, monthlyFixedOpex,
        fmtUSD, fmtCNY, fmt, fmtPct, fmtInt, r2, num
    };
})(window);
