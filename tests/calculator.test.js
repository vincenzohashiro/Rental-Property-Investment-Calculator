/*
 * Tests for the financial engine. No dependencies:
 *
 *   node tests/calculator.test.js
 *
 * Part 1 checks every figure from the assessment's validation table.
 * Part 2 checks edge cases the calculator must handle.
 */
'use strict';

const calc = require('../calculator.js');

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  const ok = actual === expected;
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(36)} expected ${expected}, got ${actual}`);
}

// Format the same way the check-figure table does.
const dollars = (n) => Math.round(n);
const cents = (n) => Math.round(n * 100) / 100;
const pct = (n) => Math.round(n * 10000) / 100; // 0.07107 -> 7.11

// ---------------------------------------------------------------------------
console.log('\nPart 1: assessment check figures\n');
// ---------------------------------------------------------------------------

const { derived, years } = calc.analyze(calc.DEFAULT_INPUTS);
const y = (n) => years[n - 1];

check('Loan amount', dollars(derived.loanAmount), 202500);
check('Monthly principal and interest', cents(derived.monthlyPrincipalInterest), 1279.94);
check('Total cash required', dollars(derived.totalCashRequired), 70200);
check('Year 1 NOI', dollars(y(1).noi), 19188);
check('Year 1 mortgage payments', dollars(y(1).mortgagePayments), 15359);
check('Year 1 annual cash flow', dollars(y(1).annualCashFlow), 3829);
check('Year 1 monthly cash flow', dollars(y(1).monthlyCashFlow), 319);
check('Year 1 cap rate (%)', pct(y(1).capRate), 7.11);
check('Year 1 cash-on-cash return (%)', pct(y(1).cashOnCash), 5.45);
check('Year 1 principal paydown', dollars(y(1).principalPaydown), 2263);
check('Year 1 appreciation', dollars(y(1).appreciation), 8100);
check('Year 1 depreciation', dollars(y(1).depreciation), 4909);
check('Year 1 IRR if sold (%)', pct(y(1).irrIfSold), -11.36);
check('Year 5 annual cash flow', dollars(y(5).annualCashFlow), 6237);
check('Year 5 equity', dollars(y(5).equity), 123442);
check('Year 10 annual cash flow', dollars(y(10).annualCashFlow), 9677);
check('Year 10 IRR if sold (%)', pct(y(10).irrIfSold), 15.1);
check('Year 30 insurance', dollars(y(30).expenses.insurance), 4242);
check('Year 30 cumulative cash flow', dollars(y(30).cumulativeCashFlow), 452099);
check('Year 30 IRR if sold (%)', pct(y(30).irrIfSold), 14.04);

// ---------------------------------------------------------------------------
console.log('\nPart 2: edge cases\n');
// ---------------------------------------------------------------------------

const withInputs = (changes) => calc.analyze({ ...calc.DEFAULT_INPUTS, ...changes });

// Blank form: nothing should crash or produce NaN.
{
  const r = calc.analyze({});
  const allFinite = r.years.every((row) => Number.isFinite(row.noi) && Number.isFinite(row.equity));
  check('Blank form gives finite numbers', allFinite, true);
  check('Blank form cash-on-cash is n/a', r.summary.cashOnCash, null);
  check('Blank form IRR is n/a', r.years[0].irrIfSold, null);
}

// Blank strings and formatted strings from the form.
{
  const r = withInputs({ monthlyHoa: '', purchasePrice: '$225,000' });
  check('Formatted "$225,000" is parsed', dollars(r.derived.loanAmount), 202500);
}

// Insurance and HOA growth default to 3% when left blank.
{
  const r = withInputs({ insuranceGrowthPct: '', hoaGrowthPct: '', monthlyHoa: 100 });
  check('Blank insurance growth uses 3%', dollars(r.years[29].expenses.insurance), 4242);
  check('Blank HOA growth uses 3%', dollars(r.years[1].expenses.hoa), 1236);
}

// Negative money is treated as 0 and reported.
{
  const r = withInputs({ renovationCost: -5000 });
  check('Negative renovation becomes 0', r.inputs.renovationCost, 0);
  check('Negative input adds a warning', r.warnings.length > 0, true);
}

// Negative appreciation is allowed (declining market).
{
  const r = withInputs({ appreciationPct: -2 });
  check('Negative appreciation lowers value', dollars(r.years[0].propertyValue), 264600);
}

// 0% interest: payment is a straight-line payoff, no interest.
{
  const r = withInputs({ interestRatePct: 0 });
  check('0% interest monthly payment', cents(r.derived.monthlyPrincipalInterest), 562.5);
  check('0% interest has no interest', r.years[0].mortgageInterest, 0);
  check('0% loan paid off at year 30', dollars(r.years[29].loanBalance), 0);
}

// 15-year loan: payments stop after year 15.
{
  const r = withInputs({ loanTermYears: 15 });
  check('15-yr loan balance after year 15', dollars(r.years[14].loanBalance), 0);
  check('15-yr loan year 15 still has payments', r.years[14].mortgagePayments > 0, true);
  check('15-yr loan year 16 payments stop', r.years[15].mortgagePayments, 0);
  check('15-yr loan year 16 cash flow = NOI', r.years[15].annualCashFlow, r.years[15].noi);
}

// All cash purchase.
{
  const r = withInputs({ downPaymentPct: 100 });
  check('100% down has no loan', r.derived.loanAmount, 0);
  check('100% down has no payments', r.years[0].mortgagePayments, 0);
}

// Loan term of 0 with a loan is treated as cash, with a warning.
{
  const r = withInputs({ loanTermYears: 0 });
  check('0-year term becomes all cash', r.derived.loanAmount, 0);
}

// Depreciation stops once the basis is used up: 27.5 years means year 28 gets half.
{
  const r = withInputs({});
  const total = r.years.reduce((s, row) => s + row.depreciation, 0);
  check('Year 28 depreciation is a half year', dollars(r.years[27].depreciation), dollars(4909.09 / 2));
  check('Year 29 depreciation is 0', r.years[28].depreciation, 0);
  check('Total depreciation equals basis', dollars(total), dollars(r.derived.depreciableBasis));
}

// IRR helper on a known case: -100 now, 110 in a year is 10%.
check('IRR of [-100, 110] is 10%', pct(calc.irr([-100, 110])), 10);
check('IRR with no sign change is null', calc.irr([-100, -10]), null);

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
