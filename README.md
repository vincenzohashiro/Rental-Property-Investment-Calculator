# Rental Property Investment Calculator

A free, no-sign-up investment calculator for **Intrigue Real Estate & Property Management**, built for rental property investors in the Indianapolis area. Enter a property's price, financing and rent to see cap rate, cash flow, equity and a full 30-year projection, then send the deal to an Intrigue agent.

**Live site:** https://vincenzohashiro.github.io/Rental-Property-Investment-Calculator/ (GitHub Pages)

## Running it

No build step and no dependencies.

```bash
# Open directly
start index.html          # Windows
open index.html           # macOS

# Or serve locally (recommended, so the share link uses a normal URL)
python -m http.server 8000
# then visit http://localhost:8000

# Run the financial engine tests (Node 16+)
node tests/calculator.test.js
```

The test suite checks all 20 figures from the assessment's validation table, plus edge cases (blank form, negative inputs, 0% interest, a 15-year loan, all cash purchase, depreciation cap, IRR with no solution).

## Project structure

| File | Purpose |
|---|---|
| `calculator.js` | Financial engine. Pure functions, no DOM. Runs in the browser and in Node. |
| `fields.js` | One definition per input: key, label, unit and help text. |
| `app.js` | Reads the form, calls the engine, renders results, table, chart and contact form. |
| `index.html` | Page structure: hero, how it works, calculator, contact form, footer. |
| `styles.css` | Branding tokens, responsive layout, dark theme, print styles. |
| `tests/calculator.test.js` | Check figures and edge cases. |

## Implementation decisions

- **Math first, separated from the interface.** `calculator.js` exposes `analyze(inputs)`, which returns the cleaned inputs, warnings, derived figures, one object per year and the headline summary. The interface never does arithmetic beyond dividing for display, so the engine can be tested on its own.
- **Monthly amortization.** The loan is amortized month by month and totalled per year, so interest and principal are exact and payments stop as soon as the balance reaches zero (for loans shorter than 30 years).
- **IRR by bisection.** Slower than Newton's method but it cannot diverge, and it returns `n/a` when no IRR exists (for example when no cash is invested or every cash flow is negative).
- **Field config instead of repeated HTML.** There are 35 inputs (including 7 utility and 10 miscellaneous lines). Defining each once in `fields.js` keeps labels, help text and units consistent.
- **Projection table orientation.** Metrics are rows and years are columns, with the label column pinned. On phones the table defaults to key years (1 to 5, then every 5) with a switch for all 30. Utility and other-expense rows only appear when they have a value.
- **Chart.js 4.4.1 from cdnjs.** The only external script. If it fails to load, the page shows a note and the table still has every figure.
- **Contact form.** Validates name, email, phone (10 to 15 digits), address and message, with inline errors linked to each field. The live site is on GitHub Pages, which has no backend, so the form validates and shows the confirmation without sending anything (the brief makes a backend optional). The form is already marked up for Netlify Forms, so deploying the same files to Netlify would make submissions real with no code changes. The current deal numbers and a share link are attached in a hidden field.

### Bonus features included

- **Shareable links:** "Copy share link" encodes every input that differs from the example into the URL.
- **Deal numbers in contact submissions:** attached automatically.
- **PDF export:** "Save as PDF" opens the print dialog with a landscape print stylesheet showing derived figures, results, chart and the full 30-year table.
- **Dark theme:** follows the system setting, with a toggle in the header.

## Financial rules and assumptions

The written calculation rules from the brief were followed over the original spreadsheet.

| Item | Rule used |
|---|---|
| Total cash required | Down payment + buying closing costs + renovation cost |
| Buying closing costs | Percentage of purchase price |
| Rent collected | Gross scheduled rent minus vacancy |
| Management fee | Percentage of rent collected (after vacancy) |
| Maintenance reserve | Percentage of gross scheduled rent |
| NOI | Rent collected minus operating expenses (no mortgage) |
| Cap rate | NOI / property value at the start of the year. Year 1 uses the value after renovation. |
| Cash-on-cash | Annual cash flow / total cash required |
| Property value | Value after renovation, compounded annually by appreciation. Equity and sale figures use the end-of-year value. |
| Equity | End-of-year value minus loan balance |
| Net sale proceeds | Equity minus selling closing costs (percentage of end-of-year value) |
| Effective net cash flow | Annual cash flow + principal paydown + appreciation |
| Depreciation | (Purchase price + renovation) x building ratio / 27.5, capped at that basis. Year 28 gets the remaining half year. |
| IRR if sold in year N | Cash flows: minus total cash required, then each year's cash flow, with net sale proceeds added to year N |
| Growth | Rent grows at the income rate. Taxes, utilities and other expenses grow at the expense rate. Insurance and HOA have their own rates (default 3%). |

**Input handling**

- Blank or invalid fields count as 0, except insurance and HOA growth, which fall back to 3%.
- Negative money amounts are treated as 0 and a warning is shown. Percentages that must be 0 to 100 are clamped.
- Growth rates and appreciation may be negative (a declining market).
- A blank value after renovation falls back to the purchase price.
- A loan term of 0 with a loan is treated as an all cash purchase, with a warning.

**Example deal.** The page opens on a worked example that reproduces every check figure: $225,000 purchase, $45,000 renovation, $270,000 value after renovation, 10% down, 6.5% for 30 years, 1.2% buying and 7% selling closing costs, 50% building ratio, 3% growth on everything. The operating inputs ($2,650 rent, $265 taxes, $150 insurance, 10% vacancy, 10% management, 5% maintenance) were chosen to produce the stated Year 1 NOI of $19,188, because every later check figure follows from that NOI and the 3% growth rates.

## What I would improve with more time

- Real backend for the contact form (or a CRM integration) with spam protection beyond the honeypot.
- Editable names for the 10 miscellaneous expense lines.
- Side-by-side comparison of two or three deals.
- A tax view: taxable income after depreciation and interest, and estimated tax at sale (depreciation recapture).
- Automated browser tests (Playwright) running in CI alongside the engine tests.
- A server-generated PDF with Intrigue branding instead of the browser print dialog.

## AI tools used

- **Claude Code (Claude Opus):** used to plan the build from the brief, work backwards from the check figures to a consistent set of test inputs, write the engine, tests and interface, and drive Playwright for screenshots at 375px and 1440px. Every formula was checked against the written rules and the check-figure tests before the interface was built.
