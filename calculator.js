/*
 * Intrigue Rental Property Investment Calculator: financial engine.
 *
 * Pure functions only. No DOM access, so the same file runs in the browser
 * (exposed as window.IntrigueCalc) and in Node for the test suite.
 *
 * Conventions used throughout:
 *   - Percent inputs are entered as whole numbers (6.5 means 6.5%) and are
 *     converted to decimals once, inside normalizeInputs().
 *   - "Year n" runs from the start of year n to the end of year n.
 *     Values that describe a point in time (property value, loan balance,
 *     equity) are measured at the END of the year unless the name says Start.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IntrigueCalc = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PROJECTION_YEARS = 30;
  const DEPRECIATION_YEARS = 27.5; // IRS recovery period for residential rental property
  const UTILITY_COUNT = 7;
  const MISC_COUNT = 10;

  const UTILITY_LABELS = ['Electric', 'Gas', 'Water', 'Sewer', 'Trash', 'Lawn care', 'Snow removal'];

  /*
   * Default inputs. These reproduce the assessment's check figures,
   * so the page opens on a worked example that can be verified by hand.
   */
  const DEFAULT_INPUTS = {
    // Primary inputs
    purchasePrice: 225000,
    afterRepairValue: 270000,
    renovationCost: 45000,
    downPaymentPct: 10,
    interestRatePct: 6.5,
    loanTermYears: 30,
    monthlyRent: 2650,
    monthlyTaxes: 265,
    monthlyInsurance: 150,
    monthlyHoa: 0,

    // Advanced assumptions
    vacancyPct: 10,
    maintenancePct: 5,
    managementPct: 10,
    utilities: [0, 0, 0, 0, 0, 0, 0],
    misc: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    incomeGrowthPct: 3,
    expenseGrowthPct: 3,
    buildingRatioPct: 50,
    appreciationPct: 3,
    buyClosingPct: 1.2,
    sellClosingPct: 7,
    insuranceGrowthPct: 3,
    hoaGrowthPct: 3,
  };

  /** Human-readable field names, used in warning messages. */
  const FIELD_LABELS = {
    purchasePrice: 'Purchase price',
    afterRepairValue: 'Value after renovation',
    renovationCost: 'Renovation cost',
    downPaymentPct: 'Down payment',
    monthlyRent: 'Monthly rent',
    monthlyTaxes: 'Monthly property taxes',
    monthlyInsurance: 'Monthly insurance',
    monthlyHoa: 'Monthly HOA fees',
    vacancyPct: 'Vacancy rate',
    maintenancePct: 'Maintenance reserve',
    managementPct: 'Property management fee',
    buildingRatioPct: 'Building-to-land ratio',
    buyClosingPct: 'Buying closing costs',
    sellClosingPct: 'Selling closing costs',
  };

  // ---------------------------------------------------------------------------
  // Input cleanup
  // ---------------------------------------------------------------------------

  /** Converts anything (blank string, null, "1,200") to a finite number, or the fallback. */
  function toNumber(value, fallback) {
    if (typeof value === 'string') value = value.replace(/[$,%\s]/g, '');
    if (value === '' || value === null || value === undefined) return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
  }

  /*
   * Turns raw form values into a clean, fully populated inputs object.
   *
   * Rules:
   *   - Blank or invalid fields become 0. Blank growth rates also become 0,
   *     except insurance and HOA growth, which default to 3% as required.
   *   - Money amounts cannot be negative; negatives are treated as 0.
   *   - Rates that only make sense from 0 to 100 (down payment, vacancy, ...) are clamped.
   *   - Growth rates and appreciation MAY be negative (a declining market), but
   *     not below -100%.
   *
   * Returns { inputs, warnings } where warnings is a list of plain sentences
   * the interface can show next to the results.
   */
  function normalizeInputs(raw) {
    raw = raw || {};
    const warnings = [];

    const label = (key) => FIELD_LABELS[key] || key;
    const money = (key) => {
      const n = toNumber(raw[key], 0);
      if (n < 0) warnings.push(`${label(key)} cannot be negative, so it was treated as 0.`);
      return Math.max(n, 0);
    };
    const percent = (key) => {
      const n = toNumber(raw[key], 0);
      if (n < 0 || n > 100) warnings.push(`${label(key)} must be between 0% and 100%, so it was adjusted.`);
      return clamp(n, 0, 100) / 100;
    };
    const growth = (key, fallback) => clamp(toNumber(raw[key], fallback), -100, 1000) / 100;
    const moneyList = (key, length) =>
      Array.from({ length }, (_, i) => Math.max(toNumber((raw[key] || [])[i], 0), 0));

    const inputs = {
      purchasePrice: money('purchasePrice'),
      afterRepairValue: money('afterRepairValue'),
      renovationCost: money('renovationCost'),
      downPayment: percent('downPaymentPct'),
      interestRate: clamp(toNumber(raw.interestRatePct, 0), 0, 100) / 100,
      loanTermYears: Math.round(Math.max(toNumber(raw.loanTermYears, 0), 0)),
      monthlyRent: money('monthlyRent'),
      monthlyTaxes: money('monthlyTaxes'),
      monthlyInsurance: money('monthlyInsurance'),
      monthlyHoa: money('monthlyHoa'),

      vacancy: percent('vacancyPct'),
      maintenance: percent('maintenancePct'),
      management: percent('managementPct'),
      utilities: moneyList('utilities', UTILITY_COUNT),
      misc: moneyList('misc', MISC_COUNT),
      incomeGrowth: growth('incomeGrowthPct', 0),
      expenseGrowth: growth('expenseGrowthPct', 0),
      buildingRatio: percent('buildingRatioPct'),
      appreciation: growth('appreciationPct', 0),
      buyClosing: percent('buyClosingPct'),
      sellClosing: percent('sellClosingPct'),
      insuranceGrowth: growth('insuranceGrowthPct', 3),
      hoaGrowth: growth('hoaGrowthPct', 3),
    };

    // If the value after renovation is left blank, assume the purchase price.
    if (inputs.afterRepairValue === 0 && inputs.purchasePrice > 0) {
      inputs.afterRepairValue = inputs.purchasePrice;
      warnings.push('Value after renovation was blank, so the purchase price was used.');
    }

    // A loan with no term cannot be amortized. Treat it as a cash purchase.
    const financed = inputs.purchasePrice * (1 - inputs.downPayment);
    if (financed > 0 && inputs.loanTermYears === 0) {
      inputs.downPayment = 1;
      warnings.push('Loan term was blank or 0, so the purchase was treated as all cash.');
    }

    return { inputs, warnings };
  }

  // ---------------------------------------------------------------------------
  // Mortgage
  // ---------------------------------------------------------------------------

  /** Standard fixed-rate monthly payment. Handles 0% interest as a straight-line payoff. */
  function monthlyPayment(principal, annualRate, years) {
    const n = years * 12;
    if (principal <= 0 || n <= 0) return 0;
    const r = annualRate / 12;
    if (r === 0) return principal / n;
    return (principal * r) / (1 - Math.pow(1 + r, -n));
  }

  /*
   * Builds a yearly amortization summary for the projection period.
   * Runs month by month so interest is exact, then totals each year.
   * Once the loan is paid off, every later year shows zero payments.
   */
  function amortizeByYear(principal, annualRate, termYears, years) {
    const payment = monthlyPayment(principal, annualRate, termYears);
    const r = annualRate / 12;
    let balance = principal;
    const rows = [];

    for (let year = 1; year <= years; year++) {
      let paid = 0;
      let interest = 0;
      let principalPaid = 0;

      for (let month = 0; month < 12 && balance > 0; month++) {
        const monthInterest = balance * r;
        // The final payment only covers what is left.
        const monthPrincipal = Math.min(payment - monthInterest, balance);
        balance -= monthPrincipal;
        if (balance < 0.005) balance = 0; // absorb floating point dust
        interest += monthInterest;
        principalPaid += monthPrincipal;
        paid += monthInterest + monthPrincipal;
      }

      rows.push({ year, payments: paid, interest, principal: principalPaid, endingBalance: balance });
    }

    return { monthlyPayment: payment, rows };
  }

  // ---------------------------------------------------------------------------
  // IRR
  // ---------------------------------------------------------------------------

  function npv(rate, cashflows) {
    return cashflows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);
  }

  /*
   * Internal rate of return by bisection.
   * Bisection is slower than Newton's method but never diverges, and with
   * 30 annual cash flows it is still effectively instant.
   * Returns null when no rate between -99.99% and 1000% sets NPV to zero
   * (for example when every cash flow is negative).
   */
  function irr(cashflows) {
    let low = -0.9999;
    let high = 10;
    let npvLow = npv(low, cashflows);
    const npvHigh = npv(high, cashflows);
    if (!Number.isFinite(npvLow) || !Number.isFinite(npvHigh) || npvLow * npvHigh > 0) return null;

    for (let i = 0; i < 200; i++) {
      const mid = (low + high) / 2;
      const npvMid = npv(mid, cashflows);
      if (Math.abs(npvMid) < 1e-7) return mid;
      if (npvLow * npvMid < 0) {
        high = mid;
      } else {
        low = mid;
        npvLow = npvMid;
      }
    }
    return (low + high) / 2;
  }

  // ---------------------------------------------------------------------------
  // Projection
  // ---------------------------------------------------------------------------

  /** Compounded growth factor for year n, where year 1 is the base year (factor 1). */
  function grow(rate, year) {
    return Math.pow(1 + rate, year - 1);
  }

  const sum = (list) => list.reduce((a, b) => a + b, 0);

  /*
   * Runs the full analysis.
   *
   * Takes raw inputs (as typed into the form) and returns:
   *   inputs    the cleaned inputs actually used
   *   warnings  plain sentences describing any adjustments
   *   derived   the read-only figures shown under the inputs
   *   years     one object per projection year (1 to 30)
   *   summary   the headline metrics
   */
  function analyze(rawInputs) {
    const { inputs: p, warnings } = normalizeInputs(rawInputs);

    // --- Up-front figures --------------------------------------------------
    const downPaymentAmount = p.purchasePrice * p.downPayment;
    const loanAmount = p.purchasePrice - downPaymentAmount;
    const buyClosingCosts = p.purchasePrice * p.buyClosing;
    const totalCashRequired = downPaymentAmount + buyClosingCosts + p.renovationCost;

    // Depreciation basis: building share of what was paid for the property and its improvements.
    const depreciableBasis = (p.purchasePrice + p.renovationCost) * p.buildingRatio;
    const annualDepreciation = depreciableBasis / DEPRECIATION_YEARS;

    const loan = amortizeByYear(loanAmount, p.interestRate, p.loanTermYears, PROJECTION_YEARS);

    // --- Year by year ------------------------------------------------------
    const years = [];
    const annualCashFlows = [];
    let cumulativeCashFlow = 0;
    let depreciationTaken = 0;

    for (let year = 1; year <= PROJECTION_YEARS; year++) {
      const incomeFactor = grow(p.incomeGrowth, year);
      const expenseFactor = grow(p.expenseGrowth, year);

      // Income
      const grossScheduledRent = p.monthlyRent * 12 * incomeFactor;
      const vacancyLoss = grossScheduledRent * p.vacancy;
      const rentCollected = grossScheduledRent - vacancyLoss;
      const operatingIncome = rentCollected;

      // Operating expenses
      const expenses = {
        propertyTaxes: p.monthlyTaxes * 12 * expenseFactor,
        insurance: p.monthlyInsurance * 12 * grow(p.insuranceGrowth, year),
        hoa: p.monthlyHoa * 12 * grow(p.hoaGrowth, year),
        management: rentCollected * p.management, // based on rent actually collected
        maintenance: grossScheduledRent * p.maintenance, // based on gross scheduled rent
        utilities: p.utilities.map((m) => m * 12 * expenseFactor),
        misc: p.misc.map((m) => m * 12 * expenseFactor),
      };
      const totalOperatingExpenses =
        expenses.propertyTaxes +
        expenses.insurance +
        expenses.hoa +
        expenses.management +
        expenses.maintenance +
        sum(expenses.utilities) +
        sum(expenses.misc);

      // NOI excludes mortgage payments by definition.
      const noi = operatingIncome - totalOperatingExpenses;

      // Financing
      const mortgage = loan.rows[year - 1];
      const annualCashFlow = noi - mortgage.payments;
      cumulativeCashFlow += annualCashFlow;
      annualCashFlows.push(annualCashFlow);

      // Value and equity
      const propertyValueStart = p.afterRepairValue * grow(p.appreciation, year);
      const propertyValue = propertyValueStart * (1 + p.appreciation);
      const appreciation = propertyValue - propertyValueStart;
      const equity = propertyValue - mortgage.endingBalance;
      const sellingCosts = propertyValue * p.sellClosing;
      const netSaleProceeds = equity - sellingCosts;

      // Depreciation is straight line and stops once the full basis is used up.
      const depreciation = Math.min(annualDepreciation, depreciableBasis - depreciationTaken);
      depreciationTaken += depreciation;

      // Returns
      const capRate = propertyValueStart > 0 ? noi / propertyValueStart : null;
      const cashOnCash = totalCashRequired > 0 ? annualCashFlow / totalCashRequired : null;

      // IRR if sold at the end of this year:
      // initial investment out, each year's cash flow in, sale proceeds added to the final year.
      const flows = [-totalCashRequired, ...annualCashFlows];
      flows[flows.length - 1] += netSaleProceeds;
      const irrIfSold = totalCashRequired > 0 ? irr(flows) : null;

      years.push({
        year,
        grossScheduledRent,
        vacancyLoss,
        rentCollected,
        operatingIncome,
        expenses,
        totalOperatingExpenses,
        noi,
        mortgagePayments: mortgage.payments,
        mortgageInterest: mortgage.interest,
        principalPaydown: mortgage.principal,
        annualCashFlow,
        monthlyCashFlow: annualCashFlow / 12,
        appreciation,
        effectiveNetCashFlow: annualCashFlow + mortgage.principal + appreciation,
        depreciation,
        propertyValueStart,
        propertyValue,
        loanBalance: mortgage.endingBalance,
        equity,
        sellingCosts,
        netSaleProceeds,
        cumulativeCashFlow,
        capRate,
        cashOnCash,
        irrIfSold,
      });
    }

    const derived = {
      downPaymentAmount,
      loanAmount,
      monthlyPrincipalInterest: loan.monthlyPayment,
      buyClosingCosts,
      totalCashRequired,
      depreciableBasis,
    };

    const summary = {
      capRate: years[0].capRate,
      cashOnCash: years[0].cashOnCash,
      monthlyCashFlowYear1: years[0].monthlyCashFlow,
      totalCashRequired,
      equityYear5: years[4].equity,
    };

    return { inputs: p, warnings, derived, years, summary };
  }

  return {
    PROJECTION_YEARS,
    DEPRECIATION_YEARS,
    UTILITY_COUNT,
    MISC_COUNT,
    UTILITY_LABELS,
    DEFAULT_INPUTS,
    toNumber,
    normalizeInputs,
    monthlyPayment,
    amortizeByYear,
    npv,
    irr,
    analyze,
  };
});
