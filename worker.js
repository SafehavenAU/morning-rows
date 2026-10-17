const HOSPITAL = {
  year: "2024-25",
  uploaded: "2026-08-19",
  states: [
    { code: "NSW", name: "New South Wales", Resuscitation: 100, Emergency: 76, Urgent: 68, "Semi-urgent": 74, "Non-urgent": 90 },
    { code: "Vic", name: "Victoria", Resuscitation: 100, Emergency: 64, Urgent: 69, "Semi-urgent": 76, "Non-urgent": 91 },
    { code: "Qld", name: "Queensland", Resuscitation: 100, Emergency: 73, Urgent: 67, "Semi-urgent": 78, "Non-urgent": 93 },
    { code: "WA", name: "Western Australia", Resuscitation: 100, Emergency: 67, Urgent: 29, "Semi-urgent": 47, "Non-urgent": 80 },
    { code: "SA", name: "South Australia", Resuscitation: 99, Emergency: 50, Urgent: 44, "Semi-urgent": 61, "Non-urgent": 84 },
    { code: "Tas", name: "Tasmania", Resuscitation: 100, Emergency: 47, Urgent: 38, "Semi-urgent": 52, "Non-urgent": 74 },
    { code: "ACT", name: "Australian Capital Territory", Resuscitation: 99, Emergency: 64, Urgent: 51, "Semi-urgent": 69, "Non-urgent": 89 },
    { code: "NT", name: "Northern Territory", Resuscitation: 98, Emergency: 49, Urgent: 40, "Semi-urgent": 48, "Non-urgent": 82 },
  ],
};

const TRIAGE = ["Resuscitation", "Emergency", "Urgent", "Semi-urgent", "Non-urgent"];
const REGIONS = { NSW1: "New South Wales", QLD1: "Queensland", VIC1: "Victoria", SA1: "South Australia", TAS1: "Tasmania" };

async function readGrid() {
  const response = await fetch("https://visualisations.aemo.com.au/aemo/apps/api/report/ELEC_NEM_SUMMARY", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("grid");
  const body = await response.json();
  return body.ELEC_NEM_SUMMARY.map((row) => ({
    region: REGIONS[row.REGIONID] || row.REGIONID,
    code: row.REGIONID,
    price: Math.round(Number(row.PRICE) * 100) / 100,
    demand_mw: Math.round(Number(row.TOTALDEMAND) * 10) / 10,
    status: row.PRICE_STATUS,
    at: row.SETTLEMENTDATE,
  }));
}

async function readQuakes() {
  const response = await fetch("https://earthquakes.ga.gov.au/cache/recent-earthquakes.json");
  if (!response.ok) throw new Error("quakes");
  const body = await response.json();
  const rows = [];
  for (const feature of body.features) {
    const item = feature.properties;
    if (item.located_in_australia !== "Y") continue;
    rows.push({
      id: item.earthquake_id,
      place: item.description,
      when: item.origin_time,
      magnitude: item.preferred_magnitude,
      magnitude_type: item.preferred_magnitude_type,
      depth_km: Math.round(Number(item.depth) * 10) / 10,
    });
  }
  rows.sort((a, b) => String(b.when).localeCompare(String(a.when)));
  return rows;
}

const JOBS = [
  ["1", "New South Wales", "20"],
  ["2", "Victoria", "20"],
  ["3", "Queensland", "20"],
  ["5", "Western Australia", "20"],
  ["4", "South Australia", "20"],
  ["6", "Tasmania", "20"],
  ["8", "Australian Capital Territory", "10"],
  ["7", "Northern Territory", "10"],
];

async function abs(url) {
  const response = await fetch(url, { headers: { accept: "application/vnd.sdmx.data+json" } });
  if (!response.ok) throw new Error("abs");
  return response.json();
}

async function readJobs() {
  const rows = [];
  for (const [code, name, adjustment] of JOBS) {
    const body = await abs(`https://data.api.abs.gov.au/rest/data/ABS,LF,1.0.0/M13.3.1599.${adjustment}.${code}.M?lastNObservations=1`);
    const series = Object.values(body.data.dataSets[0].series)[0];
    rows.push({
      name,
      rate: Math.round(Number(series.observations["0"][0]) * 10) / 10,
      basis: adjustment === "10" ? "Original" : "Seasonally adjusted",
      period: body.data.structures[0].dimensions.observation[0].values[0].id,
    });
  }
  return rows;
}

async function readPrice() {
  const body = await abs("https://data.api.abs.gov.au/rest/data/ABS,CPI,1.1.0/1.10001.10.50.Q?lastNObservations=5");
  const periods = body.data.structures[0].dimensions.observation[0].values;
  const series = Object.values(body.data.dataSets[0].series)[0];
  const values = periods.map((_, index) => Number(series.observations[String(index)][0]));
  return {
    name: "All groups, eight capitals",
    period: periods[0].id,
    index: values[0],
    quarter_change: Math.round((values[0] / values[1] - 1) * 1000) / 10,
    year_change: Math.round((values[0] / values[4] - 1) * 1000) / 10,
  };
}

async function readApprovals() {
  const body = await abs("https://data.api.abs.gov.au/rest/data/ABS,BA_GCCSA,1.0.0/1.1.9.TOT.100.10.1+2+3+4+5+6+7+8+AUS.M?lastNObservations=1");
  const period = body.data.structures[0].dimensions.observation[0].values[0].id;
  const dims = body.data.structures[0].dimensions.series;
  const order = ["New South Wales", "Victoria", "Queensland", "Western Australia", "South Australia", "Tasmania", "Australian Capital Territory", "Northern Territory", "Australia"];
  const rows = Object.entries(body.data.dataSets[0].series).map(([key, series]) => {
    const indexes = key.split(":").map(Number);
    let name = "Unknown";
    dims.forEach((dimension, index) => {
      if (dimension.id === "REGION") name = dimension.values[indexes[index]].name;
    });
    return { name, dwellings: Math.round(Number(series.observations["0"][0])), period };
  });
  rows.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  return rows;
}

async function readWage() {
  const body = await abs("https://data.api.abs.gov.au/rest/data/ABS,WPI,1.2.0/1+2+3.THRPEB.7.TOT.20.AUS.Q?lastNObservations=1");
  const period = body.data.structures[0].dimensions.observation[0].values[0].id;
  const dims = body.data.structures[0].dimensions.series;
  const found = {};
  for (const [key, series] of Object.entries(body.data.dataSets[0].series)) {
    const indexes = key.split(":").map(Number);
    let measure = "";
    dims.forEach((dimension, index) => {
      if (dimension.id === "MEASURE") measure = dimension.values[indexes[index]].id;
    });
    found[measure] = Number(series.observations["0"][0]);
  }
  return {
    name: "Total hourly rates of pay excluding bonuses",
    period,
    index: found["1"],
    quarter_change: found["2"],
    year_change: found["3"],
  };
}

const STATE_ORDER = ["New South Wales", "Victoria", "Queensland", "Western Australia", "South Australia", "Tasmania", "Australian Capital Territory", "Northern Territory", "Australia"];

async function stateSeries(url, regionId, whole = false) {
  const body = await abs(url);
  const period = body.data.structures[0].dimensions.observation[0].values[0].id;
  const dims = body.data.structures[0].dimensions.series;
  const rows = Object.entries(body.data.dataSets[0].series).map(([key, series]) => {
    const indexes = key.split(":").map(Number);
    let name = "Unknown";
    dims.forEach((dimension, index) => {
      if (dimension.id === regionId) name = dimension.values[indexes[index]].name;
    });
    const raw = Number(series.observations["0"][0]);
    return { name, value: whole ? Math.round(raw) : Math.round(raw * 10) / 10, period };
  });
  rows.sort((a, b) => STATE_ORDER.indexOf(a.name) - STATE_ORDER.indexOf(b.name));
  return rows;
}

function protoFields(buf) {
  const found = [];
  let index = 0;
  while (index < buf.length) {
    let key = 0;
    let shift = 0;
    while (index < buf.length) {
      const byte = buf[index++];
      key += (byte & 0x7f) * 2 ** shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    const field = Math.floor(key / 8);
    const wire = key % 8;
    if (wire === 0) {
      let num = 0;
      shift = 0;
      while (index < buf.length) {
        const byte = buf[index++];
        num += (byte & 0x7f) * 2 ** shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
      }
      found.push({ field, num });
    } else if (wire === 2) {
      let length = 0;
      shift = 0;
      while (index < buf.length) {
        const byte = buf[index++];
        length += (byte & 0x7f) * 2 ** shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
      }
      found.push({ field, bytes: buf.slice(index, index + length) });
      index += length;
    } else if (wire === 5) index += 4;
    else if (wire === 1) index += 8;
    else break;
  }
  return found;
}

function alertHeadline(entity) {
  const alert = protoFields(entity).find((item) => item.field === 5 && item.bytes)?.bytes;
  if (!alert) return "";
  const header = protoFields(alert).find((item) => item.field === 10 && item.bytes)?.bytes;
  if (!header) return "";
  const translation = protoFields(header).find((item) => item.field === 1 && item.bytes)?.bytes;
  if (!translation) return "";
  const text = protoFields(translation).find((item) => item.field === 1 && item.bytes)?.bytes;
  return text ? new TextDecoder().decode(text).trim() : "";
}

async function readShop() {
  return stateSeries("https://data.api.abs.gov.au/rest/data/ABS,RT,1.0.0/M1.20.20.1+2+3+4+5+6+7+8+AUS.M?lastNObservations=1", "REGION");
}
async function readPeople() {
  return stateSeries("https://data.api.abs.gov.au/rest/data/ABS,ERP_Q,1.0.0/1.3.TOT.1+2+3+4+5+6+7+8+AUS.Q?lastNObservations=1", "REGION", true);
}
async function readSpend() {
  const rows = await stateSeries("https://data.api.abs.gov.au/rest/data/ABS,HSI_M,1.6.0/8.TOT.CUR.20.1+2+3+4+5+6+7+8+AUS.M?lastNObservations=1", "STATE");
  const total = await abs("https://data.api.abs.gov.au/rest/data/ABS,HSI_M,1.6.0/7.TOT.CUR.20.AUS.M?lastNObservations=1");
  const series = Object.values(total.data.dataSets[0].series)[0];
  return { rows, australia_million: Math.round(Number(series.observations["0"][0]) * 10) / 10 };
}
async function readWorks() {
  const rows = await stateSeries("https://data.api.abs.gov.au/rest/data/ABS,CWD,1.0.0/M1.CVM.9.TOT.20.1+2+3+4+5+6+7+8+AUS.Q?lastNObservations=1", "REGION");
  return rows.map((row) => ({ ...row, value: Math.round((row.value / 1000000) * 10) / 10 }));
}
async function readService() {
  const response = await fetch("https://gtfsrt.api.translink.com.au/api/realtime/SEQ/alerts");
  if (!response.ok) throw new Error("service");
  const headlines = protoFields(new Uint8Array(await response.arrayBuffer()))
    .filter((item) => item.field === 2 && item.bytes)
    .map((item) => alertHeadline(item.bytes))
    .filter((line) => line.length > 0);
  return { count: headlines.length, headlines: headlines.slice(0, 8), region: "South East Queensland" };
}

function page(data) {
  const cards = data.grid.map((row) => `<article><h3>${row.region}</h3><p class="price">$${row.price.toFixed(2)}</p><p>per megawatt hour</p><p>${row.demand_mw.toLocaleString("en-AU")} MW demand</p><p>${row.status}</p></article>`).join("");
  const heads = TRIAGE.map((name) => `<th>${name}</th>`).join("");
  const hospital = HOSPITAL.states.map((row) => `<tr><td>${row.name}</td>${TRIAGE.map((name) => `<td>${row[name]}%</td>`).join("")}</tr>`).join("");
  const quakes = data.quakes.map((row) => `<tr><td>${row.when}</td><td>${row.place}</td><td>${row.magnitude} ${row.magnitude_type}</td><td>${row.depth_km} km</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Morning Australia</title><style>
    body{margin:0;font-family:Segoe UI,sans-serif;background:#f4f6f8;color:#13213a}
    main{max-width:64rem;margin:0 auto;padding:1.5rem}
    h1,h2{color:#0e2a52} a{color:#1f64bf}
    .grid{display:grid;gap:.75rem;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))}
    article,table{background:#fff;border:1px solid #d5dee8;border-radius:.5rem}
    article{padding:.75rem} .price{font-size:1.5rem;font-weight:650;margin:.4rem 0}
    table{width:100%;border-collapse:collapse;font-size:.9rem} th,td{text-align:left;padding:.5rem .75rem;border-bottom:1px solid #d5dee8}
    th{background:#dbe7f6} .note{background:#f8f1e3;border:1px solid #d5dee8;border-radius:.5rem;padding:.75rem}
  </style></head><body><main>
    <p>For agents</p><h1>Morning Australia</h1>
    <p>Combined public records. Not the land-lead list. The grid and the ground are read on each request. The hospital year is ${HOSPITAL.year}.</p>
    <p><a href="/">Countries</a> · <a href="/new-zealand">New Zealand</a> · <a href="/morning.json">morning.json</a> · <a href="/llms.txt">llms.txt</a></p>
    <h2>Come back when this changes</h2>
    <p>The grid moves about every five minutes. The ground moves when a new Australian earthquake is published. The job is monthly. Prices are quarterly. The hospital year does not move until the next official upload.</p>
    <h2>The job</h2>
    <p>${data.jobs[0] ? data.jobs[0].period : "Not read"}. Unemployment rate, persons. Territory rows are original. Creative Commons Attribution 4.0.</p>
    <table><thead><tr><th>State</th><th>Rate</th><th>Basis</th></tr></thead><tbody>${(data.jobs || []).map((row) => `<tr><td>${row.name}</td><td>${row.rate}%</td><td>${row.basis}</td></tr>`).join("")}</tbody></table>
    <h2>The price of living</h2>
    <p>${data.price ? data.price.period : "Not read"}. All groups, eight capitals. Creative Commons Attribution 4.0.</p>
    <article><h3>${data.price ? data.price.name : "Not read"}</h3><p class="price">${data.price ? data.price.index : ""}</p><p>${data.price ? data.price.quarter_change : ""}% on the previous quarter</p><p>${data.price ? data.price.year_change : ""}% on a year earlier</p></article>
    <h2>The approval</h2>
    <p>${data.approvals && data.approvals[0] ? data.approvals[0].period : "Not read"}. Residential dwelling units approved. Original. Creative Commons Attribution 4.0.</p>
    <table><thead><tr><th>State</th><th>Dwellings</th></tr></thead><tbody>${(data.approvals || []).map((row) => `<tr><td>${row.name}</td><td>${row.dwellings.toLocaleString("en-AU")}</td></tr>`).join("")}</tbody></table>
    <h2>The wage</h2>
    <p>${data.wage ? data.wage.period : "Not read"}. Hourly rates of pay excluding bonuses, seasonally adjusted. Creative Commons Attribution 4.0.</p>
    <article><h3>${data.wage ? data.wage.name : "Not read"}</h3><p class="price">${data.wage ? data.wage.index : ""}</p><p>${data.wage ? data.wage.quarter_change : ""}% on the previous quarter</p><p>${data.wage ? data.wage.year_change : ""}% on a year earlier</p></article>
    <h2>The shop</h2><p>Retail turnover, million dollars. ${(data.shop && data.shop[0]) ? data.shop[0].period : "Not read"}. Creative Commons Attribution 4.0.</p>
    <table><thead><tr><th>State</th><th>Million dollars</th></tr></thead><tbody>${(data.shop || []).map((row) => `<tr><td>${row.name}</td><td>${row.value.toLocaleString("en-AU")}</td></tr>`).join("")}</tbody></table>
    <h2>The people</h2><p>Estimated resident population. ${(data.people && data.people[0]) ? data.people[0].period : "Not read"}. Creative Commons Attribution 4.0.</p>
    <table><thead><tr><th>State</th><th>People</th></tr></thead><tbody>${(data.people || []).map((row) => `<tr><td>${row.name}</td><td>${row.value.toLocaleString("en-AU")}</td></tr>`).join("")}</tbody></table>
    <h2>The spend</h2><p>Percent change on the month before. Australia spent ${data.spend_total_million ?? ""} million dollars. Creative Commons Attribution 4.0.</p>
    <table><thead><tr><th>State</th><th>Change</th></tr></thead><tbody>${(data.spend || []).map((row) => `<tr><td>${row.name}</td><td>${row.value}%</td></tr>`).join("")}</tbody></table>
    <h2>The works</h2><p>Construction work done, billion dollars, chain volume. ${(data.works && data.works[0]) ? data.works[0].period : "Not read"}. Creative Commons Attribution 4.0.</p>
    <table><thead><tr><th>State</th><th>Billion dollars</th></tr></thead><tbody>${(data.works || []).map((row) => `<tr><td>${row.name}</td><td>${row.value}</td></tr>`).join("")}</tbody></table>
    <h2>The service running</h2><p>${data.service ? data.service.count : 0} South East Queensland alerts. Not the whole country. Creative Commons Attribution 4.0.</p>
    <ul>${((data.service && data.service.headlines) || []).map((line) => `<li>${String(line).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">")}</li>`).join("")}</ul>
    <h2>The grid</h2><p>Read ${data.read_at}. The reuse terms on the AEMO feed were not read.</p><div class="grid">${cards}</div>
    <h2>The hospital</h2><p>Share seen within the recommended time. No patient is named. Creative Commons Attribution 3.0. Uploaded ${HOSPITAL.uploaded}.</p>
    <table><thead><tr><th>State</th>${heads}</tr></thead><tbody>${hospital}</tbody></table>
    <h2>The ground</h2><p>${data.quakes.length} earthquakes marked as in Australia. Creative Commons Attribution 4.0.</p>
    <table><thead><tr><th>When, UTC</th><th>Place</th><th>Magnitude</th><th>Depth</th></tr></thead><tbody>${quakes}</tbody></table>
    <h2>Not on this read</h2>
    <div class="note"><strong>The river.</strong> Capital-city storage percentages are published by the Bureau of Meteorology. The Bureau's terms are not a Creative Commons licence, so those percentages are not copied here.</div>
  </main></body></html>`;
}

const LLMS = `# Morning Rows

> https://morningrows.com. Public records for an agent, one country at a time. Read the files. Do not scrape the HTML.

## Read in this order

- [The catalog](/catalog.json): the countries and how often each set changes
- [Australia](/australia.json): the Australian rows. [/morning.json](/morning.json) is the same file.
- [New Zealand](/new-zealand.json): wholesale prices at five grid points, and earthquakes
- [Canada](/canada.json): unemployment, prices, retail sales, and earthquakes
- [England](/england.json): the system price, carbon intensity, the job, prices, the wage, and earthquakes

## Australia

- [The catalog](/catalog.json): what each Australian set is, how often it changes, and the licence

## Sets

- [The grid](/morning.json): wholesale price and demand for five regions. A new interval about every five minutes. Reuse terms were not read.
- [The hospital](/morning.json): emergency patients seen on time, by state, for 2024-25. Creative Commons Attribution 3.0. No patient is named.
- [The job](/morning.json): unemployment rate by state, monthly. Creative Commons Attribution 4.0.
- [The price of living](/morning.json): consumer prices for the eight capitals. Creative Commons Attribution 4.0.
- [The approval](/morning.json): residential dwelling units approved, by state. Creative Commons Attribution 4.0.
- [The wage](/morning.json): hourly rates of pay excluding bonuses, Australia. Creative Commons Attribution 4.0.
- [The shop](/morning.json): retail turnover by state, million dollars. Creative Commons Attribution 4.0.
- [The people](/morning.json): estimated resident population by state. Creative Commons Attribution 4.0.
- [The spend](/morning.json): household spending, percent change on the month before. Creative Commons Attribution 4.0.
- [The works](/morning.json): construction work done by state, billion dollars. Creative Commons Attribution 4.0.
- [The service running](/morning.json): South East Queensland public transport alerts. Creative Commons Attribution 4.0.
- [The ground](/morning.json): earthquakes marked as in Australia. Creative Commons Attribution 4.0.

## Not here

The river and live public transport are not in these files. A phone number, a person's name, and a patient record are not stored.
`;

const CATALOG = {
  name: "Morning Australia",
  site: "https://morningrows.com",
  summary: "Combined Australian public records. Fetch again when the grid interval or the earthquake list changes.",
  auth: "none",
  records: "/morning.json",
  index: "/llms.txt",
  sets: [
    { name: "The grid", changes: "about every five minutes", licence: "AEMO public summary. Reuse terms were not read.", contains: "wholesale price and demand for five regions" },
    { name: "The hospital", changes: "when the next official year is uploaded", licence: "CC BY 3.0", contains: "emergency patients seen on time, by state, 2024-25. No patient is named." },
    { name: "The job", changes: "monthly", licence: "CC BY 4.0", contains: "unemployment rate by state. Territory rows are original, not seasonally adjusted." },
    { name: "The price of living", changes: "quarterly", licence: "CC BY 4.0", contains: "all groups consumer price index for the eight capitals" },
    { name: "The approval", changes: "monthly", licence: "CC BY 4.0", contains: "residential dwelling units approved, by state" },
    { name: "The wage", changes: "quarterly", licence: "CC BY 4.0", contains: "hourly rates of pay excluding bonuses, Australia" },
    { name: "The shop", changes: "monthly", licence: "CC BY 4.0", contains: "retail turnover by state, million dollars" },
    { name: "The people", changes: "quarterly", licence: "CC BY 4.0", contains: "estimated resident population by state" },
    { name: "The spend", changes: "monthly", licence: "CC BY 4.0", contains: "household spending, percent change on the month before" },
    { name: "The works", changes: "quarterly", licence: "CC BY 4.0", contains: "construction work done by state, billion dollars" },
    { name: "The service running", changes: "every few minutes", licence: "CC BY 4.0", contains: "South East Queensland public transport alert headlines" },
    { name: "The ground", changes: "when a new Australian earthquake is published", licence: "CC BY 4.0", contains: "earthquakes marked as in Australia" },
  ],
};

const AI_CATALOG = {
  name: "Morning Australia",
  description: "Combined Australian public records an agent can read without an account.",
  auth: { type: "none" },
  services: [
    { name: "records", path: "/morning.json", description: "The grid, the hospital year, and Australian earthquakes.", methods: ["GET"] },
    { name: "catalog", path: "/catalog.json", description: "What each set contains, how often it changes, and the licence.", methods: ["GET"] },
    { name: "index", path: "/llms.txt", description: "Short index for an agent.", methods: ["GET"] },
  ],
};

const ROBOTS = [
  "# Reading is allowed. Training is not.",
  "User-agent: *",
  "Content-signal: search=yes, ai-train=no, use=reference",
  "Allow: /",
  "",
  "User-agent: Amazonbot",
  "Disallow: /",
  "",
  "User-agent: Applebot-Extended",
  "Disallow: /",
  "",
  "User-agent: Bytespider",
  "Disallow: /",
  "",
  "User-agent: CCBot",
  "Disallow: /",
  "",
  "User-agent: ClaudeBot",
  "Disallow: /",
  "",
  "User-agent: Google-Extended",
  "Disallow: /",
  "",
  "User-agent: GPTBot",
  "Disallow: /",
  "",
  "User-agent: meta-externalagent",
  "Disallow: /",
  "",
].join("\n");

function json(body) {
  return new Response(JSON.stringify(body, null, 2), { headers: { "content-type": "application/json; charset=utf-8" } });
}

const DESK = `<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="canonical" href="https://morningrows.com/"><title>Morning Rows</title></head><body>
<main><p>For agents</p><h1>Morning Rows</h1>
<p>The address is morningrows.com. Read the files. Do not scrape the HTML.</p>
<ol>
<li><a href="/llms.txt">/llms.txt</a>, the index.</li>
<li><a href="/catalog.json">/catalog.json</a>, the countries and how often each set changes.</li>
<li>One country file. <a href="/australia.json">/australia.json</a>, <a href="/new-zealand.json">/new-zealand.json</a>, <a href="/canada.json">/canada.json</a>, or <a href="/england.json">/england.json</a>.</li>
</ol>
</main></body></html>`;

const NZ_NODES = [
  ["OTA2201", "Otahuhu, Auckland"],
  ["HAY2201", "Haywards, Wellington"],
  ["ISL2201", "Islington, Christchurch"],
  ["BEN2201", "Benmore"],
  ["INV2201", "Invercargill"],
];

async function readNzPrices() {
  const start = new Date();
  let text = "";
  for (let back = 0; back < 4 && !text; back += 1) {
    const day = new Date(start.getTime() - back * 86400000).toISOString().slice(0, 10).replaceAll("-", "");
    for (const suffix of ["_I", ""]) {
      const response = await fetch(`https://www.emi.ea.govt.nz/Wholesale/Datasets/DispatchAndPricing/FinalEnergyPrices/${day}_FinalEnergyPrices${suffix}.csv`);
      if (response.ok) { text = await response.text(); break; }
    }
  }
  if (!text) throw new Error("grid");
  const latest = new Map();
  for (const line of text.split("\n").slice(1)) {
    const [date, period, code, price] = line.split(",");
    if (!NZ_NODES.some((node) => node[0] === code)) continue;
    const trading = Number(period);
    const current = latest.get(code);
    if (!current || trading > current.period) latest.set(code, { code, price: Number(price), period: trading, date });
  }
  return NZ_NODES.map(([code, name]) => ({ code, name, ...latest.get(code) })).filter((row) => row.price !== undefined);
}

async function readSome(response, max = 65536) {
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  try { await reader.cancel(); } catch (error) { /* The first slice is enough. */ }
  const bytes = new Uint8Array(Math.min(size, max));
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.byteLength, bytes.length - offset);
    bytes.set(chunk.subarray(0, take), offset);
    offset += take;
    if (offset >= bytes.length) break;
  }
  return new TextDecoder().decode(bytes);
}

async function readStatsNz(env) {
  const key = env && env.STATSNZ_KEY;
  if (!key) return { present: false, rows: [] };
  const headers = { "Ocp-Apim-Subscription-Key": key, accept: "text/csv,*/*" };
  const tables = [
    ["people", "POPES_SUB_001", "Subnational population change and median age"],
    ["wages", "INC_INC_001", "Earnings for people in paid employment"],
    ["pay", "INC_INC_010", "Gender pay gap"],
    ["spend", "HES_HES_001", "Household expenditure"],
    ["firms", "BDS_BDS_004", "Enterprises by industry"],
    ["output", "PRD_PRD_003", "Productivity, growth in output"],
  ];
  const rows = [];
  for (const [label, id, name] of tables) {
    const response = await fetch(`https://api.data.stats.govt.nz/rest/data/STATSNZ,${id},1.0/all?lastNObservations=1&dimensionAtObservation=AllDimensions&format=csvfilewithlabels`, { headers });
    if (!response.ok) {
      rows.push({ label, name, id, error: response.status });
      continue;
    }
    const text = await readSome(response);
    const lines = text.split(/\r?\n/).filter((line) => line && !line.startsWith("STRUCTURE"));
    const header = (lines[0] || "").split(",");
    const value = (lines[1] || "").split(",");
    const periodIndex = header.findIndex((column) => /TIME_PERIOD/i.test(column));
    const observationIndex = header.findIndex((column) => /OBS_VALUE/i.test(column));
    rows.push({
      label,
      name,
      id,
      period: periodIndex >= 0 ? value[periodIndex] : "",
      value: observationIndex >= 0 ? value[observationIndex] : "",
    });
  }
  return {
    present: true,
    rows,
    licence: "Creative Commons Attribution 4.0. Credit Stats NZ.",
    not_in_this_api: "Consumers price index, the labour force survey, retail trade, and building consents are not in the Aotearoa Data Explorer API yet.",
  };
}

async function readNzQuakes() {
  const response = await fetch("https://api.geonet.org.nz/quake?MMI=4", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("quakes");
  const body = await response.json();
  return body.features.slice(0, 12).map((feature) => {
    const item = feature.properties;
    return { id: item.publicID, place: item.locality, when: item.time, magnitude: Math.round(item.magnitude * 10) / 10, depth_km: Math.round(item.depth * 10) / 10 };
  });
}

function nzPage(data) {
  const cards = (data.prices || []).map((row) => `<article><h3>${row.name}</h3><p class="price">$${row.price.toFixed(2)}</p><p>per megawatt hour</p></article>`).join("");
  const quakes = (data.quakes || []).map((row) => `<tr><td>${row.when}</td><td>${row.place}</td><td>${row.magnitude}</td><td>${row.depth_km} km</td></tr>`).join("");
  const first = data.prices && data.prices[0];
  const official = data.stats || { present: false, rows: [] };
  const statRows = (official.rows || []).map((row) => `<tr><td>${escapeHtml(row.name || row.label)}</td><td>${escapeHtml(row.period || row.error || "")}</td><td>${escapeHtml(row.value || "")}</td></tr>`).join("");
  const stats = official.present ? (official.error ? "The key was refused, status " + official.error + "." : (official.licence || "Read.") + (official.not_in_this_api ? " " + official.not_in_this_api : "")) : "The STATSNZ_KEY binding is not visible to this worker.";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Morning New Zealand</title></head><body><main>
    <p>For agents</p><h1>Morning New Zealand</h1>
    <p><a href="/">Countries</a> · <a href="/australia">Australia</a> · <a href="/new-zealand.json">new-zealand.json</a></p>
    <h2>The grid</h2><p>${first ? first.date + ", period " + first.period : "Not read"}. The reuse terms on the Electricity Authority file were not read.</p><div class="grid">${cards}</div>
    <h2>The ground</h2><p>${(data.quakes || []).length} earthquakes. Creative Commons Attribution.</p>
    <table><thead><tr><th>When, UTC</th><th>Place</th><th>Magnitude</th><th>Depth</th></tr></thead><tbody>${quakes}</tbody></table>
    <h2>Stats NZ</h2>
    <p>${stats}</p>
    <table><thead><tr><th>Set</th><th>Period</th><th>Value</th></tr></thead><tbody>${statRows}</tbody></table>
    <h2>Not on this read</h2>
    <p>A national hospital table, a river summary, and a national service-alert feed were not found.</p>
  </main></body></html>`;
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}

async function statcan(payload) {
  const response = await fetch("https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("statcan");
  return response.json();
}

async function readCanada() {
  const provinces = ["Canada", "Newfoundland and Labrador", "Prince Edward Island", "Nova Scotia", "New Brunswick", "Quebec", "Ontario", "Manitoba", "Saskatchewan", "Alberta", "British Columbia"];
  const [jobs, price, shop, quakes, rate, exchange, product, bonds, homes, ontarioText, rivers] = await Promise.all([
    statcan(provinces.map((_, index) => ({ productId: 14100287, coordinate: `${index + 1}.7.1.1.1.1.0.0.0.0`, latestN: 1 }))),
    statcan([{ productId: 18100004, coordinate: "2.2.0.0.0.0.0.0.0.0", latestN: 1 }]),
    statcan([{ productId: 20100056, coordinate: "1.1.1.2.0.0.0.0.0.0", latestN: 1 }]),
    fetch("https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=8&minmagnitude=2.5&minlatitude=48&maxlatitude=70&minlongitude=-141&maxlongitude=-52&orderby=time").then((response) => response.json()),
    readCanadaRate(),
    readCanadaExchange(),
    statcan([{ productId: 36100104, coordinate: "1.1.1.30.0.0.0.0.0.0", latestN: 2 }]),
    fetch("https://www.bankofcanada.ca/valet/observations/BD.CDN.2YR.DQ.YLD,BD.CDN.10YR.DQ.YLD/json?recent=1").then((response) => response.json()),
    statcan([{ productId: 34100136, coordinate: "1.1.1.0.0.0.0.0.0.0", latestN: 1 }]),
    fetch("https://reports-public.ieso.ca/public/RealtimeOntarioZonalPrice/PUB_RealtimeOntarioZonalPrice.xml").then((response) => response.text()),
    Promise.all(["08MF005", "02KF005", "02OA016"].map((code) => fetch(`https://api.weather.gc.ca/collections/hydrometric-realtime/items?f=json&limit=1&STATION_NUMBER=${code}`).then((response) => response.json()))),
  ]);
  return {
    site: "https://morningrows.com",
    country: "Canada",
    page: "/canada",
    jobs: jobs.map((row, index) => ({ name: provinces[index], rate: row.object.vectorDataPoint[0].value, period: row.object.vectorDataPoint[0].refPer.slice(0, 7) })),
    price_index: { period: price[0].object.vectorDataPoint[0].refPer.slice(0, 7), index: price[0].object.vectorDataPoint[0].value },
    shop: { period: shop[0].object.vectorDataPoint[0].refPer.slice(0, 7), thousand_dollars: shop[0].object.vectorDataPoint[0].value },
    rate,
    exchange,
    product: (() => {
      const points = product[0].object.vectorDataPoint;
      const previous = points[0].value;
      const latest = points[points.length - 1];
      return { period: latest.refPer.slice(0, 7), level: latest.value, quarter_change: Math.round((latest.value / previous - 1) * 10000) / 100 };
    })(),
    bonds: { date: bonds.observations.at(-1).d, two_year: Number(bonds.observations.at(-1)["BD.CDN.2YR.DQ.YLD"].v), ten_year: Number(bonds.observations.at(-1)["BD.CDN.10YR.DQ.YLD"].v) },
    homes: { period: homes[0].object.vectorDataPoint[0].refPer.slice(0, 7), starts: homes[0].object.vectorDataPoint[0].value },
    ontario: (() => {
      const prices = [...ontarioText.matchAll(/<ZonalPrice>[\s\S]*?<Interval>(\d+)<\/Interval>[\s\S]*?<LmpCap>([^<]*)<\/LmpCap>/g)].filter((match) => match[2] !== "");
      const latest = prices[prices.length - 1];
      return {
        date: ontarioText.match(/<DeliveryDate>([^<]+)<\/DeliveryDate>/)?.[1] ?? null,
        hour: ontarioText.match(/<DeliveryHour>([^<]+)<\/DeliveryHour>/)?.[1] ?? null,
        interval: latest ? Number(latest[1]) : null,
        price: latest ? Number(latest[2]) : null,
        hour_average: Number(ontarioText.match(/<AveragePrice>[\s\S]*?<LmpCap>([^<]+)<\/LmpCap>/)?.[1]),
        geography: "Ontario",
      };
    })(),
    rivers: rivers.map((body) => {
      const item = body.features[0].properties;
      return { name: item.STATION_NAME, province: item.PROV_TERR_STATE_LOC, when: item.DATETIME, level_m: item.LEVEL, discharge: item.DISCHARGE };
    }),
    quakes: (quakes.features || []).map((feature) => ({ place: feature.properties.place, when: new Date(feature.properties.time).toISOString(), magnitude: feature.properties.mag })),
  };
}

async function readCanadaRate() {
  const response = await fetch("https://www.bankofcanada.ca/valet/observations/V39079/json?recent=1");
  const body = await response.json();
  const last = body.observations[body.observations.length - 1];
  return { date: last.d, rate: Number(last.V39079.v) };
}

async function readCanadaExchange() {
  const response = await fetch("https://www.bankofcanada.ca/valet/observations/FXUSDCAD,FXAUDCAD,FXGBPCAD,FXNZDCAD/json?recent=1");
  const body = await response.json();
  const last = body.observations[body.observations.length - 1];
  return {
    date: last.d,
    rows: [
      { name: "US dollar", value: Number(last.FXUSDCAD.v) },
      { name: "Australian dollar", value: Number(last.FXAUDCAD.v) },
      { name: "UK pound", value: Number(last.FXGBPCAD.v) },
      { name: "New Zealand dollar", value: Number(last.FXNZDCAD.v) },
    ],
  };
}

async function ons(path) {
  const response = await fetch(`https://www.ons.gov.uk/generator?format=csv&uri=${path}`);
  if (!response.ok) throw new Error("ons");
  const lines = (await response.text()).split("\n").map((line) => line.split(",").map((cell) => cell.replaceAll("\"", "")));
  const dated = lines.filter((row) => row.length >= 2 && /^\d{4}/.test(row[0]) && row[1] !== "");
  const last = dated[dated.length - 1];
  return { period: last[0], value: last[1] };
}

async function readEngland() {
  const start = new Date();
  let price = null;
  for (let back = 0; back < 3 && !price; back += 1) {
    const day = new Date(start.getTime() - back * 86400000).toISOString().slice(0, 10);
    const response = await fetch(`https://data.elexon.co.uk/bmrs/api/v1/balancing/settlement/system-prices/${day}`);
    if (!response.ok) continue;
    const body = await response.json();
    if (body.data?.length) price = body.data[body.data.length - 1];
  }
  const [carbonBody, job, cpi, rate, wage, product, people, shop, vacancy, trade, floods, service, rail, calendar, quakeText] = await Promise.all([
    fetch("https://api.carbonintensity.org.uk/regional").then((response) => response.json()),
    ons("/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/ycnl/lms"),
    ons("/economy/inflationandpriceindices/timeseries/d7bt/mm23"),
    ons("/economy/inflationandpriceindices/timeseries/d7g7/mm23"),
    ons("/employmentandlabourmarket/peopleinwork/earningsandworkinghours/timeseries/kab9/lms"),
    ons("/economy/grossdomesticproductgdp/timeseries/ybez/ukea"),
    ons("/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/enpop/pop"),
    ons("/businessindustryandtrade/retailindustry/timeseries/j45u/drsi"),
    ons("/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/jpc5/lms"),
    ons("/economy/nationalaccounts/balanceofpayments/timeseries/ikbd/pnbp"),
    fetch("https://environment.data.gov.uk/flood-monitoring/id/floods").then((response) => response.json()),
    fetch("https://api.tfl.gov.uk/Line/Mode/tube,elizabeth-line,overground,dlr/Status").then((response) => response.json()),
    fetch("https://api.tfl.gov.uk/Line/Mode/national-rail/Status").then((response) => response.json()),
    fetch("https://www.gov.uk/bank-holidays.json").then((response) => response.json()),
    fetch("http://quakes.bgs.ac.uk/feeds/MhSeismology.xml").then((response) => response.text()),
  ]);
  const slot = carbonBody.data[0];
  const england = slot.regions.find((region) => region.shortname === "England");
  const quakes = [...quakeText.matchAll(/<title>([^<]*Earthquake alert[^<]*)<\/title>/g)].slice(0, 8).map((match) => match[1].replace(/\s+/g, " ").trim());
  return {
    site: "https://morningrows.com",
    country: "England",
    page: "/england",
    grid: price ? { date: price.settlementDate, period: price.settlementPeriod, pounds_per_mwh: price.systemBuyPrice, geography: "Great Britain" } : null,
    carbon: { from: slot.from, grams_per_kwh: england.intensity.forecast, band: england.intensity.index, geography: "England" },
    job: { ...job, geography: "England" },
    price_index: { ...cpi, year_change: rate.value, geography: "United Kingdom" },
    wage: { ...wage, geography: "United Kingdom", unit: "pounds a week" },
    product: { ...product, geography: "United Kingdom" },
    people: { ...people, geography: "England" },
    shop: { ...shop, geography: "United Kingdom" },
    vacancy: { ...vacancy, geography: "United Kingdom", meaning: "unemployed people per vacancy" },
    trade: { ...trade, geography: "United Kingdom", unit: "million pounds", meaning: "trade in services balance" },
    floods: { count: (floods.items || []).length, rows: (floods.items || []).slice(0, 8).map((item) => ({ severity: item.severity, description: item.description })) },
    service: (service || []).map((line) => ({ name: line.name, status: line.lineStatuses[0].statusSeverityDescription, geography: "London" })),
    rail: { count: (rail || []).length, not_good: (rail || []).filter((line) => line.lineStatuses[0].statusSeverityDescription !== "Good Service").map((line) => ({ name: line.name, status: line.lineStatuses[0].statusSeverityDescription })) },
    calendar: (calendar["england-and-wales"].events || []).filter((event) => event.date >= new Date().toISOString().slice(0, 10)).slice(0, 4),
    quakes,
  };
}

async function readAustraliaExchange() {
  const response = await fetch("https://www.rba.gov.au/statistics/tables/csv/f11.1-data.csv");
  const lines = (await response.text()).replace(/^\uFEFF/, "").split("\n");
  const dated = lines.filter((line) => /^\d{2}-[A-Za-z]{3}-\d{4},/.test(line));
  const last = dated[dated.length - 1].split(",");
  return {
    date: last[0],
    rows: [
      { name: "US dollar", value: Number(last[1]) },
      { name: "Euro", value: Number(last[5]) },
      { name: "UK pound", value: Number(last[7]) },
      { name: "New Zealand dollar", value: Number(last[11]) },
      { name: "Canadian dollar", value: Number(last[19]) },
      { name: "Trade-weighted index", value: Number(last[2]) },
    ],
  };
}

async function readCash() {
  const response = await fetch("https://www.rba.gov.au/statistics/tables/csv/f1.1-data.csv");
  if (!response.ok) throw new Error("cash");
  const lines = (await response.text()).replace(/^\uFEFF/, "").split("\n");
  const dated = lines.filter((line) => /^\d{2}\/\d{2}\/\d{4},/.test(line));
  const last = dated[dated.length - 1].split(",");
  return { date: last[0], target: Number(last[1]) };
}

function simplePage(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body><main><p><a href="/">Countries</a></p><h1>${title}</h1>${body}</main></body></html>`;
}

const HOLD_SECONDS = {
  "/australia": 300,
  "/australia.json": 300,
  "/morning.json": 300,
  "/new-zealand": 600,
  "/new-zealand.json": 600,
  "/england": 600,
  "/england.json": 600,
  "/canada": 3600,
  "/canada.json": 3600,
};

async function held(request, response) {
  const seconds = HOLD_SECONDS[new URL(request.url).pathname];
  const headers = new Headers(response.headers);
  if (seconds) headers.set("Cache-Control", `public, max-age=${seconds}`);
  const stored = new Response(response.body, { status: response.status, headers });
  if (!seconds) return stored;
  try {
    const url = new URL(request.url);
    await caches.default.put(new Request(`${url.origin}${url.pathname}`, { method: "GET" }), stored.clone());
  } catch (error) {
    return stored;
  }
  return stored;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/llms.txt") return new Response(LLMS, { headers: { "content-type": "text/plain; charset=utf-8" } });
    if (url.pathname === "/robots.txt") return new Response(ROBOTS, { headers: { "content-type": "text/plain; charset=utf-8" } });
    if (url.pathname === "/catalog.json") return json({
      name: "Morning Rows",
      site: "https://morningrows.com",
      summary: "Public records, one country at a time. Fetch the index, then one country file. Do not scrape the HTML.",
      auth: "none",
      index: "/llms.txt",
      countries: [
        { name: "Australia", page: "/australia", records: "/australia.json", also: "/morning.json" },
        { name: "New Zealand", page: "/new-zealand", records: "/new-zealand.json" },
        { name: "Canada", page: "/canada", records: "/canada.json" },
        { name: "England", page: "/england", records: "/england.json" },
      ],
    });
    if (url.pathname === "/.well-known/ai-catalog.json") return json(AI_CATALOG);
    if (url.pathname === "/keys.json") return json({
      site: "https://morningrows.com",
      note: "Collect these later. Open feeds are not listed.",
      needs_a_key: [
        { country: "Australia", source: "Bureau of Meteorology", would_unlock: "forecasts, observations, and warnings" },
        { country: "Australia", source: "AEMO developer portal", would_unlock: "registered market APIs, not the public grid files" },
        { country: "Australia", source: "NSW emergency feeds and Western Australia SLIP", would_unlock: "some fire and warning feeds" },
        { country: "Australia", source: "Australian Business Register", would_unlock: "a business lookup" },
        { country: "New Zealand", source: "Stats NZ", would_unlock: "already bound as STATSNZ_KEY when the secret is present" },
        { country: "New Zealand", source: "LINZ Data Service", would_unlock: "addresses, parcels, and place names" },
        { country: "New Zealand", source: "MetService", would_unlock: "the national forecast" },
        { country: "Canada", source: "AESO", would_unlock: "the Alberta pool price as JSON. A free key. The publisher limits use." },
        { country: "Canada", source: "IESO participant APIs", would_unlock: "registered Ontario market tools, not the public reports" },
        { country: "England", source: "Companies House", would_unlock: "company search and filings" },
        { country: "England", source: "Met Office DataPoint", would_unlock: "forecasts and observations" },
        { country: "England", source: "Energy Performance of Buildings", would_unlock: "home energy certificates" },
        { country: "England", source: "Ordnance Survey", would_unlock: "detailed addresses and maps" },
        { country: "England", source: "Transport for London", would_unlock: "a higher rate limit. The current lines work without it." },
      ],
    });
    if (url.pathname === "/" ) return new Response(DESK, { headers: { "content-type": "text/html; charset=utf-8" } });
    const hold = HOLD_SECONDS[url.pathname];
    if (hold && request.method === "GET") {
      try {
        const hit = await caches.default.match(new Request(`${url.origin}${url.pathname}`, { method: "GET" }));
        if (hit) return hit;
      } catch (error) {
        // A miss still reads the source once.
      }
    }
    if (url.pathname === "/new-zealand" || url.pathname === "/new-zealand.json") {
      const [priceResult, quakeResult, volcanoResult, noticeResult, statsResult] = await Promise.allSettled([
        readNzPrices(),
        readNzQuakes(),
        fetch("https://api.geonet.org.nz/volcano/val").then((response) => response.json()),
        fetch("https://api.geonet.org.nz/news/geonet").then((response) => response.json()),
        readStatsNz(env),
      ]);
      const nz = {
        site: "https://morningrows.com",
        country: "New Zealand",
        page: "/new-zealand",
        prices: priceResult.status === "fulfilled" ? priceResult.value : [],
        quakes: quakeResult.status === "fulfilled" ? quakeResult.value : [],
        volcanoes: volcanoResult.status === "fulfilled" ? volcanoResult.value.features.map((feature) => ({ name: feature.properties.volcanoTitle, colour: feature.properties.acc, level: feature.properties.level })) : [],
        notices: noticeResult.status === "fulfilled" ? noticeResult.value.feed.slice(0, 3).map((item) => ({ when: item.published, title: item.title })) : [],
        stats: statsResult.status === "fulfilled" ? statsResult.value : { present: false, rows: [] },
      };
      if (url.pathname === "/new-zealand.json") return held(request, json(nz));
      return held(request, new Response(nzPage(nz), { headers: { "content-type": "text/html; charset=utf-8" } }));
    }
    if (url.pathname === "/canada" || url.pathname === "/canada.json") {
      const canada = await readCanada().catch(() => ({ site: "https://morningrows.com", country: "Canada", error: "not read" }));
      if (url.pathname === "/canada.json") return held(request, json(canada));
      const rows = (canada.jobs || []).map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.rate}%</td></tr>`).join("");
      return held(request, new Response(simplePage("Morning Canada", `<p>The file is <a href="/canada.json">canada.json</a>.</p><h2>The job</h2><table>${rows}</table><h2>The price of living</h2><p>${canada.price_index ? canada.price_index.index : ""}</p><h2>The shop</h2><p>${canada.shop ? canada.shop.thousand_dollars : ""} thousand dollars</p>`), { headers: { "content-type": "text/html; charset=utf-8" } }));
    }
    if (url.pathname === "/england" || url.pathname === "/england.json") {
      const england = await readEngland().catch(() => ({ site: "https://morningrows.com", country: "England", error: "not read" }));
      if (url.pathname === "/england.json") return held(request, json(england));
      const lines = (england.quakes || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("");
      return held(request, new Response(simplePage("Morning England", `<p>The file is <a href="/england.json">england.json</a>.</p><p>System price ${england.grid ? england.grid.pounds_per_mwh : ""} pounds. Carbon ${england.carbon ? england.carbon.grams_per_kwh : ""} grams. Job ${england.job ? england.job.value : ""}%. Wage ${england.wage ? england.wage.value : ""} pounds a week.</p><ul>${lines}</ul>`), { headers: { "content-type": "text/html; charset=utf-8" } }));
    }
    if (url.pathname !== "/australia" && url.pathname !== "/australia.json" && url.pathname !== "/morning.json") {
      return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    const settled = await Promise.allSettled([readGrid(), readQuakes(), readJobs(), readPrice(), readApprovals(), readWage(), readShop(), readPeople(), readSpend(), readWorks(), readService(), readCash(), readAustraliaExchange()]);
    const [gridResult, quakeResult, jobResult, priceResult, approvalResult, wageResult, shopResult, peopleResult, spendResult, worksResult, serviceResult, cashResult, exchangeResult] = settled;
    const grid = gridResult.status === "fulfilled" ? gridResult.value : [];
    const quakes = quakeResult.status === "fulfilled" ? quakeResult.value : [];
    const jobs = jobResult.status === "fulfilled" ? jobResult.value : [];
    const price = priceResult.status === "fulfilled" ? priceResult.value : null;
    const approvals = approvalResult.status === "fulfilled" ? approvalResult.value : [];
    const wage = wageResult.status === "fulfilled" ? wageResult.value : null;
    const shop = shopResult.status === "fulfilled" ? shopResult.value : [];
    const people = peopleResult.status === "fulfilled" ? peopleResult.value : [];
    const spend = spendResult.status === "fulfilled" ? spendResult.value : { rows: [], australia_million: null };
    const works = worksResult.status === "fulfilled" ? worksResult.value : [];
    const service = serviceResult.status === "fulfilled" ? serviceResult.value : { count: 0, headlines: [] };
    const cash = cashResult.status === "fulfilled" ? cashResult.value : null;
    const exchange = exchangeResult.status === "fulfilled" ? exchangeResult.value : null;
    const body = { site: "https://morningrows.com", country: "Australia", page: "/australia", read_at: grid[0]?.at ?? null, grid, quakes, jobs, price, approvals, wage, shop, people, spend: spend.rows, spend_total_million: spend.australia_million, works, service, cash, exchange, hospital: HOSPITAL, catalog: CATALOG.sets };
    if (url.pathname === "/morning.json" || url.pathname === "/australia.json") return held(request, json(body));
    return held(request, new Response(page(body), { headers: { "content-type": "text/html; charset=utf-8" } }));
  },
};
