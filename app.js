/*
 * Intrigue Rental Property Investment Calculator: interface.
 *
 * Reads the form, runs IntrigueCalc.analyze(), and renders the results.
 * All math lives in calculator.js; this file only moves numbers on and off the page.
 */
(function () {
  'use strict';

  const calc = window.IntrigueCalc;
  const { PRIMARY_FIELDS, ADVANCED_GROUPS } = window.IntrigueFields;
  const ALL_FIELDS = PRIMARY_FIELDS.concat(...ADVANCED_GROUPS.map((g) => g.fields));
  const KEY_YEARS = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30];

  const $ = (selector) => document.querySelector(selector);

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------

  const moneyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const centsFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  /** Avoids "-$0" when a value rounds to zero. */
  const tidy = (n) => (Math.abs(n) < 0.5 ? 0 : n);

  const fmt = {
    money: (n) => (n === null ? 'n/a' : moneyFormat.format(tidy(n))),
    cents: (n) => (n === null ? 'n/a' : centsFormat.format(n)),
    percent: (n) => (n === null || !Number.isFinite(n) ? 'n/a' : `${(n * 100).toFixed(2)}%`),
  };

  /** Escapes text before it goes into innerHTML. */
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  const icon = (name, extraClass = '') =>
    `<svg class="icon ${extraClass}" aria-hidden="true"><use href="#icon-${name}"/></svg>`;

  // ---------------------------------------------------------------------------
  // Building the input fields
  // ---------------------------------------------------------------------------

  // "utilities.0" -> "f-utilities-0" so it is a valid, readable element id.
  const fieldId = (key) => `f-${key.replace('.', '-')}`;

  function fieldHtml(field) {
    const id = fieldId(field.key);
    const prefix = field.unit === 'money' ? '<span class="input-affix input-affix--prefix" aria-hidden="true">$</span>' : '';
    const suffixText = { percent: '%', years: 'yrs' }[field.unit];
    const suffix = suffixText ? `<span class="input-affix input-affix--suffix" aria-hidden="true">${suffixText}</span>` : '';
    const min = field.min !== undefined ? field.min : 0;
    const step = field.step || (field.unit === 'money' ? 1 : 0.01);

    return `
      <div class="field">
        <label for="${id}">${escapeHtml(field.label)}</label>
        <div class="input-wrap input-wrap--${field.unit}">
          ${prefix}
          <input id="${id}" name="${field.key}" type="number" inputmode="decimal"
                 min="${min}" step="${step}" aria-describedby="${id}-help">
          ${suffix}
        </div>
        <p class="field__help" id="${id}-help">${escapeHtml(field.help)}</p>
      </div>`;
  }

  function renderFields() {
    $('#primary-fields').innerHTML = PRIMARY_FIELDS.map(fieldHtml).join('');
    $('#advanced-fields').innerHTML = ADVANCED_GROUPS.map(
      (group) => `
        <fieldset class="advanced__group">
          <legend>${escapeHtml(group.title)}</legend>
          <div class="field-grid">${group.fields.map(fieldHtml).join('')}</div>
        </fieldset>`
    ).join('');
  }

  // ---------------------------------------------------------------------------
  // Moving values between the form and an inputs object
  // ---------------------------------------------------------------------------

  /** Reads every field into the shape calculator.js expects (arrays for utilities and misc). */
  function readForm() {
    const raw = { utilities: [], misc: [] };
    ALL_FIELDS.forEach((field) => {
      const value = document.getElementById(fieldId(field.key)).value;
      const [key, index] = field.key.split('.');
      if (index === undefined) raw[key] = value;
      else raw[key][Number(index)] = value;
    });
    return raw;
  }

  function getDefault(key) {
    const [name, index] = key.split('.');
    const value = calc.DEFAULT_INPUTS[name];
    return index === undefined ? value : value[Number(index)];
  }

  /** Fills the form from a lookup function, e.g. defaults or URL parameters. */
  function fillForm(valueFor) {
    ALL_FIELDS.forEach((field) => {
      const value = valueFor(field.key);
      document.getElementById(fieldId(field.key)).value = value === undefined || value === null ? '' : value;
    });
  }

  // ---------------------------------------------------------------------------
  // Rendering results
  // ---------------------------------------------------------------------------

  function renderDerived(derived) {
    const items = [
      ['Down payment', fmt.money(derived.downPaymentAmount)],
      ['Loan amount', fmt.money(derived.loanAmount)],
      ['Monthly principal and interest', fmt.cents(derived.monthlyPrincipalInterest)],
      ['Buying closing costs', fmt.money(derived.buyClosingCosts)],
      ['Total cash required', fmt.money(derived.totalCashRequired)],
    ];
    $('#derived').innerHTML = items
      .map(([label, value]) => `<div class="derived__item"><dt>${label}</dt><dd>${value}</dd></div>`)
      .join('');
  }

  function renderMetrics(summary) {
    const cards = [
      { label: 'Cap rate', value: fmt.percent(summary.capRate), hint: 'Year 1 NOI / value after renovation', raw: summary.capRate },
      { label: 'Cash-on-cash return', value: fmt.percent(summary.cashOnCash), hint: 'Year 1 cash flow / cash invested', raw: summary.cashOnCash },
      { label: 'Monthly cash flow', value: fmt.money(summary.monthlyCashFlowYear1), hint: 'Year 1, after the mortgage', raw: summary.monthlyCashFlowYear1 },
      { label: 'Total cash required', value: fmt.money(summary.totalCashRequired), hint: 'Down payment + closing + renovation', raw: 0 },
      { label: 'Equity at Year 5', value: fmt.money(summary.equityYear5), hint: 'Property value minus loan balance', raw: summary.equityYear5 },
    ];
    $('#metrics').innerHTML = cards
      .map(
        (c) => `
        <div class="metric${c.raw !== null && c.raw < 0 ? ' metric--negative' : ''}">
          <p class="metric__label">${c.label}</p>
          <p class="metric__value">${c.value}</p>
          <p class="metric__hint">${c.hint}</p>
        </div>`
      )
      .join('');
  }

  function renderSnapshot(year1) {
    const rows = [
      ['Rent collected', year1.rentCollected / 12],
      ['Operating expenses', -year1.totalOperatingExpenses / 12],
      ['Net operating income', year1.noi / 12],
      ['Mortgage payment', -year1.mortgagePayments / 12],
      ['Cash flow', year1.monthlyCashFlow],
    ];
    $('#snapshot').innerHTML = rows
      .map(
        ([label, value], i) => `
        <div class="snapshot__row${i === rows.length - 1 ? ' snapshot__row--total' : ''}">
          <dt>${label}</dt><dd class="${value < -0.5 ? 'is-negative' : ''}">${fmt.money(value)}</dd>
        </div>`
      )
      .join('');
  }

  function renderWarnings(warnings) {
    $('#warnings').innerHTML = warnings.map((w) => `<li>${icon('alert')}<span>${escapeHtml(w)}</span></li>`).join('');
  }

  // ---------------------------------------------------------------------------
  // 30-year projection table
  // ---------------------------------------------------------------------------

  /*
   * Table layout: one row per metric, one column per year.
   * Each entry is either a group heading ({ group }) or a row
   * ({ label, value(year), format, strong }).
   * Utility and other-expense lines only appear when they have a value,
   * so the table stays readable for simple deals.
   */
  function projectionRows(result) {
    const any = (pick) => result.years.some((y) => Math.abs(pick(y)) > 0.005);
    const utilityRows = calc.UTILITY_LABELS.map((name, i) => ({
      label: name,
      value: (y) => y.expenses.utilities[i],
      format: 'money',
    })).filter((row) => any(row.value));
    const miscRows = Array.from({ length: calc.MISC_COUNT }, (_, i) => ({
      label: `Other expense ${i + 1}`,
      value: (y) => y.expenses.misc[i],
      format: 'money',
    })).filter((row) => any(row.value));

    return [
      { group: 'Income' },
      { label: 'Gross scheduled rent', value: (y) => y.grossScheduledRent, format: 'money' },
      { label: 'Vacancy', value: (y) => -y.vacancyLoss, format: 'money' },
      { label: 'Rent collected', value: (y) => y.rentCollected, format: 'money', strong: true },

      { group: 'Operating expenses' },
      { label: 'Property taxes', value: (y) => y.expenses.propertyTaxes, format: 'money' },
      { label: 'Insurance', value: (y) => y.expenses.insurance, format: 'money' },
      { label: 'HOA fees', value: (y) => y.expenses.hoa, format: 'money' },
      { label: 'Property management', value: (y) => y.expenses.management, format: 'money' },
      { label: 'Maintenance reserve', value: (y) => y.expenses.maintenance, format: 'money' },
      ...utilityRows,
      ...miscRows,
      { label: 'Total operating expenses', value: (y) => y.totalOperatingExpenses, format: 'money', strong: true },

      { group: 'Cash flow' },
      { label: 'Net operating income (NOI)', value: (y) => y.noi, format: 'money', strong: true },
      { label: 'Mortgage payments', value: (y) => y.mortgagePayments, format: 'money' },
      { label: 'Annual cash flow', value: (y) => y.annualCashFlow, format: 'money', strong: true },
      { label: 'Monthly cash flow', value: (y) => y.monthlyCashFlow, format: 'money' },
      { label: 'Cumulative cash flow', value: (y) => y.cumulativeCashFlow, format: 'money' },

      { group: 'Wealth building' },
      { label: 'Principal paydown', value: (y) => y.principalPaydown, format: 'money' },
      { label: 'Appreciation', value: (y) => y.appreciation, format: 'money' },
      { label: 'Effective net cash flow', value: (y) => y.effectiveNetCashFlow, format: 'money', strong: true },

      { group: 'Tax figures' },
      { label: 'Depreciation', value: (y) => y.depreciation, format: 'money' },
      { label: 'Mortgage interest', value: (y) => y.mortgageInterest, format: 'money' },

      { group: 'Value and equity (end of year)' },
      { label: 'Property value', value: (y) => y.propertyValue, format: 'money' },
      { label: 'Loan balance', value: (y) => y.loanBalance, format: 'money' },
      { label: 'Equity', value: (y) => y.equity, format: 'money', strong: true },
      { label: 'Selling costs', value: (y) => -y.sellingCosts, format: 'money' },
      { label: 'Net sale proceeds', value: (y) => y.netSaleProceeds, format: 'money', strong: true },

      { group: 'Returns' },
      { label: 'Cap rate', value: (y) => y.capRate, format: 'percent' },
      { label: 'Cash-on-cash return', value: (y) => y.cashOnCash, format: 'percent' },
      { label: 'IRR if sold this year', value: (y) => y.irrIfSold, format: 'percent', strong: true },
    ];
  }

  function renderTable(result, yearFilter) {
    const years = yearFilter === 'key' ? result.years.filter((y) => KEY_YEARS.includes(y.year)) : result.years;
    const columnCount = years.length + 1;

    const head = `
      <thead>
        <tr>
          <th scope="col" class="sticky-col">Year</th>
          ${years.map((y) => `<th scope="col">${y.year}</th>`).join('')}
        </tr>
      </thead>`;

    const body = projectionRows(result)
      .map((row) => {
        if (row.group) {
          return `<tr class="group-row"><th scope="colgroup" colspan="${columnCount}"><span>${row.group}</span></th></tr>`;
        }
        const cells = years
          .map((y) => {
            const value = row.value(y);
            const negative = value !== null && value < -0.005;
            return `<td class="${negative ? 'is-negative' : ''}">${fmt[row.format](value)}</td>`;
          })
          .join('');
        return `<tr class="${row.strong ? 'is-strong' : ''}"><th scope="row" class="sticky-col">${row.label}</th>${cells}</tr>`;
      })
      .join('');

    $('#projection-table').innerHTML = `${head}<tbody>${body}</tbody>`;
  }

  // ---------------------------------------------------------------------------
  // Chart (Chart.js from CDN; the page still works if it fails to load)
  // ---------------------------------------------------------------------------

  let chart = null;

  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function renderChart(result) {
    if (!window.Chart) {
      $('#chart-fallback').hidden = false;
      return;
    }

    const labels = result.years.map((y) => `Year ${y.year}`);
    const equity = result.years.map((y) => Math.round(y.equity));
    const cumulative = result.years.map((y) => Math.round(y.cumulativeCashFlow));
    const colors = {
      equity: cssVar('--chart-equity'),
      cash: cssVar('--chart-cash'),
      grid: cssVar('--chart-grid'),
      text: cssVar('--text-muted'),
    };

    if (chart) {
      chart.data.datasets[0].data = equity;
      chart.data.datasets[1].data = cumulative;
      chart.update('none');
      return;
    }

    Chart.defaults.font.family = 'Raleway, system-ui, sans-serif';
    chart = new Chart($('#projection-chart'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Equity', data: equity, borderColor: colors.equity, backgroundColor: colors.equity, borderWidth: 2, pointRadius: 0, tension: 0.2 },
          { label: 'Cumulative cash flow', data: cumulative, borderColor: colors.cash, backgroundColor: colors.cash, borderWidth: 2, pointRadius: 0, tension: 0.2 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', align: 'start', labels: { color: colors.text, usePointStyle: true, pointStyle: 'line' } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt.money(ctx.parsed.y)}` } },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text, maxRotation: 0, autoSkip: true, maxTicksLimit: 7, callback: (_, i) => i + 1 },
          },
          y: {
            grid: { color: colors.grid },
            ticks: { color: colors.text, callback: (v) => (Math.abs(v) >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`) },
          },
        },
      },
    });
  }

  /** Rebuilds the chart so it picks up the new theme colours. */
  function resetChart() {
    if (chart) {
      chart.destroy();
      chart = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Main update loop
  // ---------------------------------------------------------------------------

  let latestResult = null;

  function update() {
    latestResult = calc.analyze(readForm());
    renderDerived(latestResult.derived);
    renderMetrics(latestResult.summary);
    renderSnapshot(latestResult.years[0]);
    renderWarnings(latestResult.warnings);
    renderTable(latestResult, $('#year-filter').value);
    renderChart(latestResult);
    $('#deal-summary').value = dealSummary(latestResult);
  }

  let updateTimer = null;
  function scheduleUpdate() {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(update, 120);
  }

  // ---------------------------------------------------------------------------
  // Toolbar: share link, PDF, reset
  // ---------------------------------------------------------------------------

  function setStatus(message) {
    const status = $('#toolbar-status');
    status.textContent = message;
    clearTimeout(setStatus.timer);
    setStatus.timer = setTimeout(() => (status.textContent = ''), 4000);
  }

  /** Builds a link containing only the inputs that differ from the example deal. */
  function shareUrl() {
    const params = new URLSearchParams();
    ALL_FIELDS.forEach((field) => {
      const value = document.getElementById(fieldId(field.key)).value;
      if (String(value) !== String(getDefault(field.key))) params.set(field.key, value);
    });
    const query = params.toString();
    return `${location.origin}${location.pathname}${query ? `?${query}` : ''}#calculator`;
  }

  async function copyShareLink() {
    const url = shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied. Anyone who opens it will see these exact numbers.');
    } catch (e) {
      window.prompt('Copy this link:', url);
    }
  }

  /** Values from ?purchasePrice=...; anything missing falls back to the example deal. */
  function valuesFromUrl() {
    const params = new URLSearchParams(location.search);
    return (key) => (params.has(key) ? params.get(key) : getDefault(key));
  }

  // The printed report always shows all 30 years, whatever the on-screen filter.
  window.addEventListener('beforeprint', () => latestResult && renderTable(latestResult, 'all'));
  window.addEventListener('afterprint', () => latestResult && renderTable(latestResult, $('#year-filter').value));

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------

  function currentTheme() {
    const explicit = document.documentElement.getAttribute('data-theme');
    if (explicit) return explicit;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function syncThemeButton() {
    const dark = currentTheme() === 'dark';
    const button = $('#theme-toggle');
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }

  function toggleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('intrigue-theme', next);
    } catch (e) {
      /* storage unavailable: theme still applies for this visit */
    }
    syncThemeButton();
    resetChart();
    if (latestResult) renderChart(latestResult);
  }

  // ---------------------------------------------------------------------------
  // Contact form
  // ---------------------------------------------------------------------------

  /** Plain-text summary of the deal, sent with the contact form. */
  function dealSummary(result) {
    const p = result.inputs;
    const s = result.summary;
    return [
      `Purchase price: ${fmt.money(p.purchasePrice)}`,
      `Value after renovation: ${fmt.money(p.afterRepairValue)}`,
      `Renovation cost: ${fmt.money(p.renovationCost)}`,
      `Down payment: ${(p.downPayment * 100).toFixed(1)}%`,
      `Interest rate: ${(p.interestRate * 100).toFixed(3)}%, ${p.loanTermYears} years`,
      `Monthly rent: ${fmt.money(p.monthlyRent)}`,
      `Total cash required: ${fmt.money(s.totalCashRequired)}`,
      `Cap rate: ${fmt.percent(s.capRate)}`,
      `Cash-on-cash return: ${fmt.percent(s.cashOnCash)}`,
      `Year 1 monthly cash flow: ${fmt.money(s.monthlyCashFlowYear1)}`,
      `Equity at Year 5: ${fmt.money(s.equityYear5)}`,
      `Share link: ${shareUrl()}`,
    ].join('\n');
  }

  const CONTACT_RULES = {
    name: (v) => (v.trim().length >= 2 ? '' : 'Please enter your name.'),
    email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Please enter a valid email address, like name@example.com.'),
    phone: (v) => {
      const digits = v.replace(/\D/g, '').length;
      return digits >= 10 && digits <= 15 ? '' : 'Please enter a phone number with at least 10 digits.';
    },
    address: (v) => (v.trim().length >= 5 ? '' : 'Please enter the property address.'),
    message: (v) => (v.trim().length >= 5 ? '' : 'Please add a short message about your deal.'),
  };

  /** Validates one field, shows or clears its error, and returns true if it is valid. */
  function validateContactField(input) {
    const error = CONTACT_RULES[input.name](input.value);
    const errorEl = document.getElementById(`${input.id}-error`);
    errorEl.textContent = error;
    input.setAttribute('aria-invalid', String(Boolean(error)));
    return !error;
  }

  async function submitContact(event) {
    event.preventDefault();
    const form = event.target;
    const inputs = Object.keys(CONTACT_RULES).map((name) => form.elements[name]);
    const invalid = inputs.filter((input) => !validateContactField(input));
    form.dataset.submitted = 'true';

    if (invalid.length) {
      invalid[0].focus();
      return;
    }

    if (latestResult) $('#deal-summary').value = dealSummary(latestResult);

    // On Netlify this posts to Netlify Forms. Elsewhere (local file, GitHub Pages)
    // there is no backend, so the request fails quietly and the confirmation still shows.
    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString(),
      });
    } catch (e) {
      /* no backend available */
    }

    const firstName = form.elements.name.value.trim().split(/\s+/)[0];
    $('#contact-success-text').textContent =
      `Thanks, ${firstName}. An Intrigue agent will review your deal and reach out within one business day.`;
    form.hidden = true;
    $('#contact-success').hidden = false;
    $('#contact-success').focus();
  }

  function resetContact() {
    const form = $('#contact-form');
    form.reset();
    delete form.dataset.submitted;
    form.querySelectorAll('.form-error').forEach((el) => (el.textContent = ''));
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    $('#contact-success').hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  }

  // ---------------------------------------------------------------------------
  // Start up
  // ---------------------------------------------------------------------------

  function init() {
    renderFields();
    fillForm(valuesFromUrl());

    // Narrow screens start with key years so the table is not 30 columns wide.
    if (window.matchMedia('(max-width: 640px)').matches) $('#year-filter').value = 'key';

    $('#calc-form').addEventListener('input', scheduleUpdate);
    $('#calc-form').addEventListener('submit', (e) => e.preventDefault());
    $('#year-filter').addEventListener('change', () => renderTable(latestResult, $('#year-filter').value));
    $('#share-button').addEventListener('click', copyShareLink);
    $('#print-button').addEventListener('click', () => window.print());
    $('#reset-button').addEventListener('click', () => {
      fillForm(getDefault);
      history.replaceState(null, '', `${location.pathname}#calculator`);
      update();
      setStatus('Inputs reset to the example deal.');
    });

    $('#theme-toggle').addEventListener('click', toggleTheme);
    syncThemeButton();

    const contactForm = $('#contact-form');
    contactForm.addEventListener('submit', submitContact);
    // After the first submit attempt, re-check fields as the visitor fixes them.
    contactForm.addEventListener('input', (e) => {
      if (contactForm.dataset.submitted && CONTACT_RULES[e.target.name]) validateContactField(e.target);
    });
    $('#contact-again').addEventListener('click', resetContact);

    $('#year').textContent = new Date().getFullYear();
    update();
  }

  init();
})();
