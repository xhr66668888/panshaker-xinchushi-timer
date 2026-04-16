// US state-level default tax rates (avg combined sales tax + corporate income tax)
// Source: Tax Foundation / state DOR 2024 references (rounded). Editable in Settings tab.
// Used as seed for FinanceSettings.salesTaxTable if server has not been overridden.
(function (global) {
    const US_STATE_SALES_TAX = {
        AL: 0.0922, AK: 0.0176, AZ: 0.084,  AR: 0.0944, CA: 0.0882,
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

    const US_STATE_CORP_TAX = {
        AL: 0.065, AK: 0.094,  AZ: 0.049,  AR: 0.053,  CA: 0.0884,
        CO: 0.044, CT: 0.075,  DE: 0.087,  FL: 0.055,  GA: 0.0575,
        HI: 0.064, ID: 0.058,  IL: 0.095,  IN: 0.0482, IA: 0.072,
        KS: 0.07,  KY: 0.05,   LA: 0.075,  ME: 0.0893, MD: 0.0825,
        MA: 0.08,  MI: 0.06,   MN: 0.098,  MS: 0.05,   MO: 0.04,
        MT: 0.0675,NE: 0.0584, NV: 0.0,    NH: 0.075,  NJ: 0.095,
        NM: 0.059, NY: 0.0725, NC: 0.025,  ND: 0.0431, OH: 0.0,
        OK: 0.04,  OR: 0.076,  PA: 0.0899, RI: 0.07,   SC: 0.05,
        SD: 0.0,   TN: 0.065,  TX: 0.0,    UT: 0.0485, VT: 0.085,
        VA: 0.06,  WA: 0.0,    WV: 0.065,  WI: 0.079,  WY: 0.0,
        DC: 0.0825
    };

    // For display: ordered full names
    const US_STATE_NAMES = {
        AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California',
        CO:'Colorado', CT:'Connecticut', DE:'Delaware', FL:'Florida', GA:'Georgia',
        HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa',
        KS:'Kansas', KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland',
        MA:'Massachusetts', MI:'Michigan', MN:'Minnesota', MS:'Mississippi', MO:'Missouri',
        MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire', NJ:'New Jersey',
        NM:'New Mexico', NY:'New York', NC:'North Carolina', ND:'North Dakota', OH:'Ohio',
        OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina',
        SD:'South Dakota', TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont',
        VA:'Virginia', WA:'Washington', WV:'West Virginia', WI:'Wisconsin', WY:'Wyoming',
        DC:'Washington D.C.'
    };

    const US_FEDERAL_CORP_TAX = 0.21;
    const US_PAYROLL_DEFAULTS = {
        ficaEmployerPct: 0.0765,
        futaPct: 0.006,
        sutaPct: 0.018,
        benefitsPctOfSalary: 0.15
    };

    // Delaware franchise tax minimum for C-Corp (authorized shares method)
    const DE_FRANCHISE_TAX_MIN_USD = 400;

    global.USTaxDefaults = {
        salesTax: US_STATE_SALES_TAX,
        corpTax: US_STATE_CORP_TAX,
        stateNames: US_STATE_NAMES,
        federalCorpPct: US_FEDERAL_CORP_TAX,
        payroll: US_PAYROLL_DEFAULTS,
        deFranchiseMinUSD: DE_FRANCHISE_TAX_MIN_USD
    };
})(window);
