/*
 * Calculator field definitions.
 *
 * Every input on the page is described here once: its key (matching
 * calculator.js), label, unit and the short explanation shown under it.
 * app.js turns these into labelled form controls.
 *
 * unit: 'money' shows a $ prefix, 'percent' a % suffix, 'years' a "yrs" suffix.
 * min: lowest value the browser spinner allows (validation in calculator.js
 *      still handles anything typed).
 */
(function (root) {
  'use strict';

  const PRIMARY_FIELDS = [
    {
      key: 'purchasePrice',
      label: 'Purchase price',
      unit: 'money',
      help: 'The price you pay for the property.',
    },
    {
      key: 'afterRepairValue',
      label: 'Value after renovation',
      unit: 'money',
      help: 'What the property is worth once work is finished. Used for cap rate, appreciation and equity.',
    },
    {
      key: 'renovationCost',
      label: 'Renovation cost',
      unit: 'money',
      help: 'Cash you spend on repairs and upgrades. Enter 0 if the property is move-in ready.',
    },
    {
      key: 'downPaymentPct',
      label: 'Down payment',
      unit: 'percent',
      help: 'Share of the purchase price you pay up front. 100% means an all cash purchase.',
    },
    {
      key: 'interestRatePct',
      label: 'Interest rate',
      unit: 'percent',
      step: 0.125,
      help: 'Annual mortgage interest rate. 0% is allowed.',
    },
    {
      key: 'loanTermYears',
      label: 'Loan term',
      unit: 'years',
      step: 1,
      help: 'Length of the mortgage. Payments stop once it is paid off.',
    },
    {
      key: 'monthlyRent',
      label: 'Monthly rent',
      unit: 'money',
      help: 'Rent you expect to charge each month when the unit is occupied.',
    },
    {
      key: 'monthlyTaxes',
      label: 'Monthly property taxes',
      unit: 'money',
      help: 'Annual property tax bill divided by 12.',
    },
    {
      key: 'monthlyInsurance',
      label: 'Monthly insurance',
      unit: 'money',
      help: 'Landlord insurance premium divided by 12.',
    },
    {
      key: 'monthlyHoa',
      label: 'Monthly HOA fees',
      unit: 'money',
      help: 'Homeowners association dues, if any. Enter 0 if there is no HOA.',
    },
  ];

  /* Advanced assumptions, shown in groups inside a collapsible section. */
  const ADVANCED_GROUPS = [
    {
      title: 'Operating assumptions',
      fields: [
        {
          key: 'vacancyPct',
          label: 'Vacancy rate',
          unit: 'percent',
          help: 'Share of the year the unit sits empty. Reduces rent collected.',
        },
        {
          key: 'maintenancePct',
          label: 'Maintenance reserve',
          unit: 'percent',
          help: 'Money set aside for repairs, as a share of gross scheduled rent.',
        },
        {
          key: 'managementPct',
          label: 'Property management fee',
          unit: 'percent',
          help: 'Manager fee, as a share of rent actually collected after vacancy.',
        },
      ],
    },
    {
      title: 'Monthly utilities paid by the owner',
      fields: ['Electric', 'Gas', 'Water', 'Sewer', 'Trash', 'Lawn care', 'Snow removal'].map((name, i) => ({
        key: `utilities.${i}`,
        label: name,
        unit: 'money',
        help: `Monthly ${name.toLowerCase()} cost you pay. Leave at 0 if the tenant pays.`,
      })),
    },
    {
      title: 'Other monthly expenses',
      fields: Array.from({ length: 10 }, (_, i) => ({
        key: `misc.${i}`,
        label: `Other expense ${i + 1}`,
        unit: 'money',
        help: 'Any other recurring monthly cost, such as pest control or permits.',
      })),
    },
    {
      title: 'Growth and appreciation',
      fields: [
        {
          key: 'incomeGrowthPct',
          label: 'Rent growth',
          unit: 'percent',
          min: -100,
          help: 'Yearly increase in rent.',
        },
        {
          key: 'expenseGrowthPct',
          label: 'Expense growth',
          unit: 'percent',
          min: -100,
          help: 'Yearly increase in taxes, utilities and other expenses.',
        },
        {
          key: 'insuranceGrowthPct',
          label: 'Insurance growth',
          unit: 'percent',
          min: -100,
          help: 'Yearly increase in the insurance premium. Defaults to 3%.',
        },
        {
          key: 'hoaGrowthPct',
          label: 'HOA growth',
          unit: 'percent',
          min: -100,
          help: 'Yearly increase in HOA dues. Defaults to 3%.',
        },
        {
          key: 'appreciationPct',
          label: 'Property appreciation',
          unit: 'percent',
          min: -100,
          help: 'Yearly increase in property value, compounded from the value after renovation.',
        },
      ],
    },
    {
      title: 'Taxes and closing costs',
      fields: [
        {
          key: 'buildingRatioPct',
          label: 'Building-to-land ratio',
          unit: 'percent',
          help: 'Share of the property value that is the building. Only the building can be depreciated.',
        },
        {
          key: 'buyClosingPct',
          label: 'Buying closing costs',
          unit: 'percent',
          step: 0.1,
          help: 'Lender, title and other fees at purchase, as a share of the purchase price.',
        },
        {
          key: 'sellClosingPct',
          label: 'Selling closing costs',
          unit: 'percent',
          step: 0.1,
          help: 'Agent commission and fees when you sell, as a share of the sale price.',
        },
      ],
    },
  ];

  root.IntrigueFields = { PRIMARY_FIELDS, ADVANCED_GROUPS };
})(typeof self !== 'undefined' ? self : this);
