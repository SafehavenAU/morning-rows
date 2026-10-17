import { BUILD_REVISION, BUILD_CACHE_KEY, BUILD_DIRTY, BUILD_FINGERPRINT } from './.generated/build-info.js';
import { fetchOfficial, readSections, describeError, SourceError, mapLimit, hasFailures } from './lib/sources.js';
import { readStatsNz } from './lib/stats-nz.js';
import { readFoodAuthorities, readScottishBills, readCanadianRecalls } from './lib/discovery-feeds.js';

const HOSPITAL = {
  status: "degraded",
  error: "Legacy static table: the repository does not record its publisher URL, so these figures and the claimed upload date have not been independently reverified.",
  geography: "Australian states and territories",
  unit: "percent of emergency department presentations seen within the recommended triage time",
  source: "Publisher not recorded in the original table",
  licence: "Original table labelled CC BY 3.0; attribution and source require verification",
  refresh: "Static table embedded in source; not fetched on request",
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
  const response = await fetchOfficial("https://visualisations.aemo.com.au/aemo/apps/api/report/ELEC_NEM_SUMMARY", { headers: { accept: "application/json" } });
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
  const response = await fetchOfficial("https://earthquakes.ga.gov.au/cache/recent-earthquakes.json");
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
  const response = await fetchOfficial(url, { headers: { accept: "application/vnd.sdmx.data+json" } });
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
  const response = await fetchOfficial("https://gtfsrt.api.translink.com.au/api/realtime/SEQ/alerts");
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
    <h2>The hospital</h2><p>Share seen within the recommended time. Legacy static table for ${HOSPITAL.year}. ${escapeHtml(HOSPITAL.error)}</p>
    <table><thead><tr><th>State</th>${heads}</tr></thead><tbody>${hospital}</tbody></table>
    <h2>The ground</h2><p>${data.quakes.length} earthquakes marked as in Australia. Creative Commons Attribution 4.0.</p>
    <table><thead><tr><th>When, UTC</th><th>Place</th><th>Magnitude</th><th>Depth</th></tr></thead><tbody>${quakes}</tbody></table>
    <h2>The bond</h2><p>${data.bonds ? data.bonds.date : "Not read"}. Australian government bond yields, percent. Reserve Bank of Australia.</p>
    <table><thead><tr><th>Bond</th><th>Yield</th></tr></thead><tbody>${((data.bonds && data.bonds.rows) || []).map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.value}</td></tr>`).join("")}</tbody></table>
    <h2>Not on this read</h2>
    <div class="note"><strong>The river.</strong> Capital-city storage percentages are published by the Bureau of Meteorology. The Bureau's terms are not a Creative Commons licence, so those percentages are not copied here.</div>
    ${alsoSection(data.also)}
  </main></body></html>`;
}

const LLMS = `# Morning Rows

> https://morningrows.com. A public data desk for agents. Any official figure from a reliable source, read from a free API when an agent asks. Not a building site. Not a land-lead list. Read the files. Do not scrape the HTML.

## Rules

- One desk per country. The United Kingdom is split: a UK-wide file, then England, Scotland, Wales, and Northern Ireland.
- A source must be an official publisher. If its terms forbid copying, it is left out. If the terms say nothing, it is read.
- Free sources that need a key are listed in [/keys.json](/keys.json). They are not called until a key is saved.
- Categories come later. Do not guess a category that is not in the file.

## Read in this order

- [The catalog](/catalog.json): the desks
- [Australia](/australia.json). [/morning.json](/morning.json) is the same file.
- [New Zealand](/new-zealand.json)
- [Canada](/canada.json)
- [United Kingdom](/united-kingdom.json): UK-wide figures only
- [England](/england.json)
- [Scotland](/scotland.json)
- [Wales](/wales.json)
- [Northern Ireland](/northern-ireland.json)

## Australia

- [The catalog](/catalog.json): what each Australian set is, how often it changes, and the licence

## Sets

- [The grid](/morning.json): wholesale price and demand for five regions. A new interval about every five minutes. Reuse terms were not read.
- [The hospital](/morning.json): legacy static emergency-department table for 2024-25; publisher attribution and values await verification. Read its error field before use.
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
    { name: "The hospital", changes: "static legacy table; not fetched on request", licence: HOSPITAL.licence, contains: "emergency patients seen on time, by state, 2024-25; source and values await verification" },
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
  return new Response(JSON.stringify(body, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "x-data-status": hasFailures(body) ? "degraded" : "ok" } });
}

const DESK = `<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="canonical" href="https://morningrows.com/"><title>Morning Rows</title></head><body>
<main><p>For agents</p><h1>Morning Rows</h1>
<p>A public data desk. Any official figure from a reliable source, fetched from a free API when you ask. Not a building site.</p>
<ol>
<li><a href="/llms.txt">/llms.txt</a>, the index and the rules.</li>
<li><a href="/catalog.json">/catalog.json</a>, the desks.</li>
<li><a href="/keys.json">/keys.json</a>, free sources that still need a key.</li>
<li>One desk. <a href="/australia.json">Australia</a>, <a href="/new-zealand.json">New Zealand</a>, <a href="/canada.json">Canada</a>, <a href="/united-kingdom.json">United Kingdom</a>, <a href="/england.json">England</a>, <a href="/scotland.json">Scotland</a>, <a href="/wales.json">Wales</a>, or <a href="/northern-ireland.json">Northern Ireland</a>.</li>
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
      const response = await fetchOfficial(`https://www.emi.ea.govt.nz/Wholesale/Datasets/DispatchAndPricing/FinalEnergyPrices/${day}_FinalEnergyPrices${suffix}.csv`, { allowStatuses: [404] });
      if (response.ok) { text = await response.text(); break; }
      await response.body?.cancel();
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

const STATS_CATALOGUE = [
  ["AGR_AGR_001", "Forestry by Regional Council"],
  ["AGR_AGR_002", "Horticulture by Regional Council"],
  ["AGR_AGR_003", "Livestock Numbers by Regional Council"],
  ["BDS_BDS_001", "Geographic units by area (TA and RC) and industry 2000-2025"],
  ["BDS_BDS_002", "Geographic units by industry and area (RC, TA, CB, SA2) 2000-2025"],
  ["BDS_BDS_003", "Geographic units births and deaths by area (TA and RC) and industry 2001-2025"],
  ["BDS_BDS_004", "Enterprises by industry 2000-2025"],
  ["BDS_BDS_005", "Enterprises by business type and industry 2000-2025"],
  ["BDS_BDS_006", "Enterprises by institutional sector and industry 2000-2025"],
  ["BDS_BDS_007", "Enterprises by overseas equity and industry 2000-2025"],
  ["BDS_BDS_008", "Enterprises by business type and employee count size 2000-2025"],
  ["BDS_BDS_009", "Enterprises by institutional sector and employee count size 2000-2025"],
  ["BDS_BDS_010", "Enterprises by overseas equity and employee count size 2000-2025"],
  ["BDS_BDS_011", "Enterprises by industry and enterprise employee count size group 2000-2025"],
  ["BDS_BDS_012", "Geographic units by region and enterprise employee count size group 2000-2025"],
  ["BDS_BDS_013", "Enterprises by control classification and industry 2000-2025"],
  ["BDS_BDS_014", "Enterprises by control classification and employee count size 2000-2025"],
  ["CORR_CAL_001", "Annual Community Sentence Offender Population for the latest Calendar Years (ANZSOC)"],
  ["CORR_CAL_002", "Annual Completed Community Work Offender Population for the latest Calendar Years (ANZSOC)"],
  ["CORR_CAL_003", "Annual Post-prison Offender Population for the latest Calendar Years (ANZSOC)"],
  ["CORR_CAL_004", "Annual Remand Prisoner Population for the latest Calendar Years (ANZSOC)"],
  ["CORR_CAL_005", "Annual Sentenced Prisoner Population for the latest Calendar Years (ANZSOC)"],
  ["CORR_FIS_001", "Annual Community Sentence Offender Population for the latest Fiscal Years (ANZSOC)"],
  ["CORR_FIS_002", "Annual Completed Community Work Offender Population for the latest Fiscal Years (ANZSOC)"],
  ["CORR_FIS_003", "Annual Post-prison Offender Population for the latest Fiscal Years (ANZSOC)"],
  ["CORR_FIS_004", "Annual Remand Prisoner Population for the latest Fiscal Years (ANZSOC)"],
  ["CORR_FIS_005", "Annual Sentenced Prisoner Population for the latest Fiscal Years (ANZSOC)"],
  ["HES_HES_001", "Household expenditure for group, subgroup and class"],
  ["HES_HES_002", "Household expenditure for group and subgroup by broad region"],
  ["HES_HES_003", "Household expenditure for group and subgroup by household income group"],
  ["HES_HES_004", "Household expenditure for group and subgroup by number of people in household"],
  ["HES_HES_005", "Household expenditure for group and subgroup by principal source of income"],
  ["HES_HES_006", "Household expenditure for group and subgroup by household composition and number of dependent children"],
  ["HES_HES_007", "Household expenditure for group and subgroup by tenure of household"],
  ["INC_INC_001", "Earnings for people in paid employment by region, sex, age groups and ethnic groups"],
  ["INC_INC_002", "Earnings from main wage and salary job by industry (ANZSIC 2006), sex, age groups, and ethnic groups"],
  ["INC_INC_003", "Earnings from main wage and salary job by industry (ANZSIC 2006), sex, and highest qualification"],
  ["INC_INC_004", "Earnings from main wage and salary job by occupation (ANZSCO 2006), sex, age groups, and ethnic groups"],
  ["INC_INC_005", "Earnings from main wage and salary job by occupation (ANZSCO 2006), sex, and highest qualification"],
  ["INC_INC_006", "Earnings from wage and salary jobs by sex, age groups, ethnic groups, and full-time and part-time status"],
  ["INC_INC_007", "Earnings from wage and salary jobs by sex, age groups, region, and full-time and part-time status"],
  ["INC_INC_008", "Earnings from wages and salaries and self-employment, by sex, age groups and ethnic groups"],
  ["INC_INC_009", "Earnings from wages and salaries and self-employment, by sex, region and ethnic groups"],
  ["INC_INC_010", "Gender pay gap by age groups (based on median hourly earnings)"],
  ["INC_INC_011", "Household income by region, household type, and source of household income"],
  ["INC_INC_012", "Income by disability status, age groups and income source"],
  ["INC_INC_013", "Income by region, sex, age groups and ethnic groups"],
  ["INC_INC_014", "Income by sex, age groups, ethnic groups and income source"],
  ["INC_INC_015", "Income by sex, region, ethnic groups and income source"],
  ["INC_INC_016", "Earnings from wages and salaries by disability status and age groups"],
  ["INJ_INJ_001", "Count of fatal and serious non-fatal injuries by sex, age group, ethnicity, cause, and severity of injury, 2000-2024"],
  ["INJ_INJ_002", "Table 1: All claims for work-related injury by territorial authority 2002 - 2023"],
  ["INJ_INJ_003", "Table 2: All claims for work-related injury by district health board 2002 - 2023"],
  ["INJ_INJ_004", "Table 3: All claims for work-related injury by territorial authority 2024 PROVISIONAL"],
  ["INJ_INJ_005", "Table 4: All claims for work-related injury by district health board 2024 PROVISIONAL"],
  ["INJ_INJ_006", "Table 5: All claims for work-related injury by industry and territorial authority 2009 - 2024(P)"],
  ["IWI18_EST_001", "Iwi affiliation (estimated count), for the Maori descent usually resident population, 2018"],
  ["IWI18_EST_002", "Iwi affiliation (estimated count) by age group, for the Maori descent usually resident population, 2018"],
  ["IWI18_EST_003", "Iwi affiliation (estimated count) by highest qualification, for the Maori descent usually resident population aged 15 years and over, 2018"],
  ["IWI18_EST_004", "Iwi affiliation (estimated count) by industry, for the employed Maori descent usually resident population aged 15 years and over, 2018"],
  ["IWI18_EST_005", "Iwi affiliation (estimated count) by religious affiliation, for the Maori descent usually resident population, 2018"],
  ["IWI18_EST_006", "Iwi affiliation (estimated count) by sex, for the Maori descent usually resident population, 2018"],
  ["IWI18_EST_007", "Iwi affiliation (estimated count) by sources of personal income, for the Maori descent usually resident population aged 15 years and over, 2018"],
  ["IWI18_EST_008", "Iwi affiliation (estimated count) by status in employment, for the employed Maori descent usually resident population aged 15 years and over, 2018"],
  ["IWI18_EST_009", "Iwi affiliation (estimated count) by total personal income (grouped), for the Maori descent usually resident population aged 15 years and over, 2018"],
  ["IWI18_EST_010", "Iwi affiliation (estimated count) by usual residence address (Auckland local board), for the Maori descent usually resident population, 2018"],
  ["IWI18_EST_011", "Iwi affiliation (estimated count) by usual residence address (regional council area), for the Maori descent usually resident population, 2018"],
  ["IWI18_EST_012", "Iwi affiliation (estimated count) by usual residence address (territorial authority area), for the Maori descent usually resident population, 2018"],
  ["IWI18_GRP_001", "Iwi grouping (estimated count), for the Maori descent usually resident population, 2018"],
  ["IWI18_GRP_002", "Iwi grouping (estimated count) by age group, for the Maori descent usually resident population, 2018"],
  ["IWI18_GRP_003", "Iwi grouping (estimated count) by highest qualification, for the Maori descent usually resident population aged 15 years and over, 2018"],
  ["IWI18_GRP_004", "Iwi grouping (estimated count) by industry, for the employed Maori descent usually resident population aged 15 years and over, 2018"],
  ["IWI18_GRP_005", "Iwi grouping (estimated count) by religious affiliation, for the Maori descent usually resident population, 2018"],
  ["IWI18_GRP_006", "Iwi grouping (estimated count) by sex, for the Maori descent usually resident population, 2018"],
  ["IWI18_GRP_007", "Iwi grouping (estimated count) by sources of personal income, for the Maori descent usually resident population aged 15 years and over, 2018"],
  ["IWI18_GRP_008", "Iwi grouping (estimated count) by status in employment, for the employed Maori descent usually resident population aged 15 years and over, 2018"],
  ["IWI18_GRP_009", "Iwi grouping (estimated count) by total personal income (grouped), for the Maori descent usually resident population aged 15 years and over, 2018"],
  ["IWI18_GRP_010", "Iwi grouping (estimated count) by usual residence address (Auckland local board), for the Maori descent usually resident population, 2018"],
  ["IWI18_GRP_011", "Iwi grouping (estimated count) by usual residence address (regional council area), for the Maori descent usually resident population, 2018"],
  ["IWI18_GRP_012", "Iwi grouping (estimated count) by usual residence address (territorial authority area), for the Maori descent usually resident population, 2018"],
  ["JUS_CAL_001", "Adults convicted in court by sentence type - most serious offence calendar year"],
  ["JUS_CAL_002", "Adults with finalised charges in court - most serious offence calendar year"],
  ["JUS_CAL_003", "Charges finalised for adults by offence type calendar year"],
  ["JUS_CAL_004", "Children and young people with finalised charges in court - most serious offence calendar year"],
  ["JUS_CAL_005", "Children and young people given an order in court - most serious offence calendar year"],
  ["JUS_FIS_001", "Adults convicted in court by sentence type - most serious offence fiscal year"],
  ["JUS_FIS_002", "Adults with finalised charges in court - most serious offence fiscal year"],
  ["JUS_FIS_003", "Charges finalised for adults by offence type fiscal year"],
  ["JUS_FIS_004", "Children and young people with finalised charges in court - most serious offence fiscal year"],
  ["JUS_FIS_005", "Children and young people given an order in court - most serious offence fiscal year"],
  ["LEED_AP1_001", "Table 1.1: Source of taxable income"],
  ["LEED_AP1_002", "Table 1.2: Median annual earnings"],
  ["LEED_AP1_003", "Table 1.3: Source of taxable income, by proportion"],
  ["LEED_AP1_004", "Table 1.401: Main source of taxable income, by secondary source of taxable income (person counts)"],
  ["LEED_AP1_005", "Table 1.402: Main source of taxable income, by secondary source of taxable income (median income)"],
  ["LEED_AP1_006", "Table 1.5: Main earnings source, by industry (ANZSIC06)"],
  ["LEED_AP1_007", "Table 1.6: Main earnings source, by industry (NZSIOC)"],
  ["LEED_AP3_001", "Table 3.1: Source of taxable income, by months received"],
  ["LEED_AP3_002", "Table 3.2: Median annual earnings, by months received"],
  ["LEED_AP3_003", "Table 3.3: Source of taxable income, by continuous spell length"],
  ["LEED_AP3_004", "Table 3.4: Length of continuous job tenure (ANZSIC06)"],
  ["LEED_AP3_005", "Table 3.5: Length of continuous job tenure (region)"],
  ["LEED_AP3_006", "Table 3.6: Length of continuous job tenure (NZSIOC06)"],
  ["LEED_AP4_001", "Table 4.1: Number of jobs held and earnings"],
  ["LEED_AP4_002", "Table 4.2: Workers with multiple jobs, by industry (ANZSIC06)"],
  ["LEED_AP5_001", "Table 5.1: Main earnings source, by average firm size"],
  ["LEED_AP5_002", "Table 5.2: Wages and salaries as main source of taxable income and self-employment as secondary source (ANZSIC06)"],
  ["LEED_AP5_003", "Table 5.3: Self-employment as main source of taxable income and wages and salaries as secondary source (ANZSIC06)"],
  ["LEED_AP5_004", "Table 5.4: Firms with employment (ANZSIC06)"],
  ["LEED_AP5_005", "Table 5.5-01: Comparison of employee jobs in firms with and without working proprietors (industry) (ANZSIC06)"],
  ["LEED_AP5_006", "Table 5.5-02 Comparison of employee jobs in firms with and without working proprietors (region)"],
  ["LEED_AP5_007", "Table 5.6: Comparison of employee jobs in firms with and without working proprietors (NZSIOC06)"],
  ["LEED_Q1W_001", "Table 01: LEED measures, by age"],
  ["LEED_Q1W_002", "Table 02: LEED measures, by sex"],
  ["LEED_Q1W_003", "Table 03: LEED measures, by sector"],
  ["LEED_Q1W_004", "Table 04: LEED measures, by industry (based on ANZSIC06)"],
  ["LEED_Q1W_005", "Table 05: LEED measures, by region"],
  ["LEED_Q1W_006", "Table 06: LEED measures, by firm size"],
  ["LEED_Q1W_007", "Table 37: LEED measures, by territorial authority"],
  ["LEED_Q2W_001", "Table 08: LEED measures, by age and sector"],
  ["LEED_Q2W_002", "Table 07: LEED measures, by age and sex"],
  ["LEED_Q2W_003", "Table 09: LEED measures, by age and industry (based on ANZSIC06)"],
  ["LEED_Q2W_004", "Table 10: LEED measures, by age and region"],
  ["LEED_Q2W_005", "Table 11: LEED measures, by age and firm size"],
  ["LEED_Q2W_006", "Table 12: LEED measures, by sex and sector"],
  ["LEED_Q2W_007", "Table 13: LEED measures, by sex and industry (based on ANZSIC06)"],
  ["LEED_Q2W_008", "Table 14: LEED measures, by sex and region"],
  ["LEED_Q2W_009", "Table 15: LEED measures, by sex and firm size"],
  ["LEED_Q2W_010", "Table 16: LEED measures, by sector and region"],
  ["LEED_Q2W_011", "Table 17: LEED measures, by sector and firm size"],
  ["LEED_Q2W_012", "Table 18: LEED measures, by industry (based on ANZSIC06) and region"],
  ["LEED_Q2W_013", "Table 19: LEED measures, by industry (based on ANZSIC06) and firm size"],
  ["LEED_Q2W_014", "Table 20: LEED measures, by region and firm size"],
  ["LEED_Q3W_001", "Table 21: LEED measures, by age, sex, and sector"],
  ["LEED_Q3W_002", "Table 22: LEED measures, by age, sex, and industry (based on ANZSIC06)"],
  ["LEED_Q3W_003", "Table 23: LEED measures, by age, sex and, region"],
  ["LEED_Q3W_004", "Table 24: LEED measures, by age, sex, and firm size"],
  ["LEED_Q3W_005", "Table 25: LEED measures, by age, sector, and region"],
  ["LEED_Q3W_006", "Table 26: LEED measures, by age, sector and firm size"],
  ["LEED_Q3W_007", "Table 27: LEED measures, by age, industry (based on ANZSIC06) and region"],
  ["LEED_Q3W_008", "Table 28: LEED measures, by age, industry (based on ANZSIC06) and firm size"],
  ["LEED_Q3W_009", "Table 29: LEED measures, by age, region and firm size"],
  ["LEED_Q3W_010", "Table 30: LEED measures, by sex, sector and region"],
  ["LEED_Q3W_011", "Table 31: LEED measures, by sex, sector and firm size"],
  ["LEED_Q3W_012", "Table 32: LEED measures, by sex, industry (based on ANZSIC06) and region"],
  ["LEED_Q3W_013", "Table 33: LEED measures, by sex, industry (based on ANZSIC06) and firm size"],
  ["LEED_Q3W_014", "Table 34: LEED measures, by sex, region and firm size"],
  ["LEED_Q3W_015", "Table 35: LEED measures, by sector, region and firm size"],
  ["LEED_Q3W_016", "Table 36: LEED measures, by industry (based on ANZSIC06), region and firm size"],
  ["POPES_ERP_001", "Estimated components of subnational intercensal population change (RC, TA), 1981-2023"],
  ["POPES_ERP_002", "Estimated resident population of Māori descent, age and sex, at 30 June 2001, 2006, 2013, 2018 and 2023"],
  ["POPES_ERP_003", "Estimated resident population (ERP), adjustments to derive ERP at 30 June 2013 (from census usually resident population)"],
  ["POPES_ERP_004", "Estimated resident population (ERP), adjustments to derive ERP at 30 June 2018 (from census usually resident population)"],
  ["POPES_ERP_005", "Estimated resident population (ERP), national population by ethnic group, age and sex, 30 June 1996, 2001, 2006, 2013, 2018, and 2023"],
  ["POPES_ERP_007", "Estimated resident population (ERP), subnational population estimates (urban rural) by ethnic group, age and sex, 30 June 1996, 2001, 2006, 2013, 2018, and 2023"],
  ["POPES_ERP_008", "Estimated resident population (ERP), subnational population estimates (RC, SA2) by ethnic group, age and sex, 30 June 1996, 2001, 2006, 2013, 2018, and 2023"],
  ["POPES_ERP_009", "Estimated resident population (ERP), subnational population estimates (TALB, SA3, SA2) by ethnic group, age and sex, 30 June 1996, 2001, 2006, 2013, 2018, and 2023"],
  ["POPES_ERP_010", "Estimated resident population (ERP), subnational population estimates (health region, health district, DHB) by ethnic group, age and sex, 30 June 1996, 2001, 2006, 2013, 2018, and 2023"],
  ["POPES_ERP_012", "Estimated resident population (ERP), subnational population estimates (functional urban area) by ethnic group, age and sex, 30 June 1996, 2001, 2006, 2013, 2018, and 2023"],
  ["POPES_ERP_013", "Estimated resident population (ERP), adjustments to derive ERP at 30 June 2023 (from census usually resident population)"],
  ["POPES_SUB_001", "Subnational population component changes and median age (RC, TALB), at 30 June 2018-25 (2025 boundaries)"],
  ["POPES_SUB_002", "Subnational population estimates (Health regions and Health districts), by age and sex, at 30 June 1996-25 (2023 boundaries)"],
  ["POPES_SUB_003", "Subnational population estimates (RC, constituency), by age and sex, at 30 June 2023-25 (2026 boundaries)"],
  ["POPES_SUB_004", "Subnational population estimates (RC, SA2), by age and sex, at 30 June 1996-2025 (2025 boundaries)"],
  ["POPES_SUB_005", "Subnational population estimates (TA, community board), by age and sex, at 30 June 2023-25 (2026 boundaries)"],
  ["POPES_SUB_006", "Subnational population estimates (TALB, SA3, SA2), by age and sex, at 30 June 1996-2025 (2025 boundaries)"],
  ["POPES_SUB_007", "Subnational population estimates (TA, subdivision), by age and sex, at 30 June 2023-25 (2026 boundaries)"],
  ["POPES_SUB_008", "Subnational population estimates (TA, ward), by age and sex, at 30 June 2023-25  (2026 boundaries)"],
  ["POPES_SUB_009", "Subnational population estimates (urban rural), by age and sex, at 30 June 1996-2025 (2025 boundaries)"],
  ["POPES_SUB_010", "Subnational population estimates (functional urban areas), by age and sex, at 30 June 1996-2025 (2023 boundaries)"],
  ["POPPR_ETH_004", "Subnational ethnic population projections, by age and sex, 2018(base)-2043"],
  ["POPPR_ETH_005", "Subnational ethnic population projections, characteristics, 2018(base)-2043"],
  ["POPPR_ETH_006", "Subnational ethnic population projections, projection assumptions, 2018(base)-2043"],
  ["POPPR_ETH_010", "Subnational ethnic population projections, by age and sex, 2018(base)-2043 update"],
  ["POPPR_ETH_011", "Subnational ethnic population projections, characteristics, 2018(base)-2043 update"],
  ["POPPR_ETH_012", "Subnational ethnic population projections, projection assumptions, 2018(base)-2043 update"],
  ["POPPR_ETH_013", "National ethnic population projections, by age and sex, 2023(base)-2048"],
  ["POPPR_ETH_014", "National ethnic population projections, characteristics, 2023(base)-2048"],
  ["POPPR_ETH_015", "National ethnic population projections, projection assumptions, 2023(base)-2048"],
  ["POPPR_FHH_001", "National family and household projections, population by living arrangement type, age, and sex, 2018(base)-2043"],
  ["POPPR_FHH_002", "National family projections, by family type, 2018(base)-2043"],
  ["POPPR_FHH_003", "National household projections, by household type, 2018(base)-2043"],
  ["POPPR_FHH_004", "Statistical area 2 (SA2) household projections, 2018(base)-2043"],
  ["POPPR_FHH_005", "Subnational family and household projections, population by living arrangement type, and age, 2018(base)-2043"],
  ["POPPR_FHH_006", "Subnational family projections, by family type, 2018(base)-2043"],
  ["POPPR_FHH_007", "Subnational household projections, by household type, 2018(base)-2043"],
  ["POPPR_LAB_003", "National labour force projections, by age and sex, 2024(base)-2078"],
  ["POPPR_LAB_004", "National labour force projections, characteristics, 2024(base)-2078"],
  ["POPPR_NAT_007", "National population projections, by age and sex, 2024(base)-2078"],
  ["POPPR_NAT_008", "National population projections, characteristics, 2024(base)-2078"],
  ["POPPR_NAT_009", "National population projections, projection assumptions, 2024(base)-2078"],
  ["POPPR_SUB_001", "Statistical area 2 population projections, by age and sex, 2018(base)-2048"],
  ["POPPR_SUB_002", "Statistical area 2 population projections, characteristics, 2018(base)-2048"],
  ["POPPR_SUB_003", "Statistical area 2 population projections, projection assumptions, 2018(base)-2048"],
  ["POPPR_SUB_007", "Statistical area 2 population projections, by age and sex, 2018(base)-2048 (update)"],
  ["POPPR_SUB_008", "Statistical area 2 population projections, projection assumptions, 2018(base)-2048(update)"],
  ["POPPR_SUB_009", "Statistical area 2 population projections, characteristics, 2018(base)-2048(update)"],
  ["POPPR_SUB_014", "Subnational population projections, by age and sex, 2023(base)-2053"],
  ["POPPR_SUB_015", "Subnational population projections, characteristics, 2023(base)-2053"],
  ["POPPR_SUB_016", "Subnational population projections, projection assumptions, 2023(base)–2053"],
  ["POPPR_SUB_017", "Statistical area 2 and 3 population projections, by age and sex, 2023(base)-2053"],
  ["POPPR_SUB_018", "Statistical area 2 and 3 population projections, projection assumptions, 2023(base)-2053"],
  ["POPPR_SUB_019", "Statistical area 2 and 3 population projections, characteristics, 2023(base)-2053"],
  ["PRD_PRD_001", "Industry Productivity Statistics ANZSIC06"],
  ["PRD_PRD_002", "Productivity Statistics - Growth accounting for labour productivity ANZSIC06"],
  ["PRD_PRD_003", "Productivity Statistics - Growth accounting for output ANZSIC06"],
];

function splitCsv(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (quoted && line[index + 1] === "\"") { current += "\""; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells;
}

async function readNzQuakes() {
  const response = await fetchOfficial("https://api.geonet.org.nz/quake?MMI=4", { headers: { accept: "application/json" } });
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
  const statRows = (official.rows || []).map((row) => `<tr><td>${escapeHtml(row.name || row.label)}</td><td>${escapeHtml(row.period || row.error || "")}</td><td>${escapeHtml(row.value ?? "")}</td></tr>`).join("");
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
    ${alsoSection(data.also)}
  </main></body></html>`;
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}

async function statcan(payload) {
  const response = await fetchOfficial("https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("statcan");
  return response.json();
}

async function readCanada() {
  const provinces = ["Canada", "Newfoundland and Labrador", "Prince Edward Island", "Nova Scotia", "New Brunswick", "Quebec", "Ontario", "Manitoba", "Saskatchewan", "Alberta", "British Columbia"];
  const point = async (productId, coordinate) => (await statcan([{ productId, coordinate, latestN: 1 }]))[0].object.vectorDataPoint[0];
  const data = await readSections({
    jobs: async () => (await statcan(provinces.map((_, index) => ({ productId: 14100287, coordinate: `${index + 1}.7.1.1.1.1.0.0.0.0`, latestN: 1 })))).map((row, index) => ({ name: provinces[index], rate: row.object.vectorDataPoint[0].value, period: row.object.vectorDataPoint[0].refPer.slice(0, 7), source: "Statistics Canada", licence: "Statistics Canada Open Licence" })),
    price_index: async () => { const p = await point(18100004, "2.2.0.0.0.0.0.0.0.0"); return { period: p.refPer.slice(0, 7), index: p.value }; },
    shop: async () => { const p = await point(20100056, "1.1.1.2.0.0.0.0.0.0"); return { period: p.refPer.slice(0, 7), thousand_dollars: p.value }; },
    rate: readCanadaRate,
    exchange: readCanadaExchange,
    product: async () => {
      const points = (await statcan([{ productId: 36100104, coordinate: "1.1.1.30.0.0.0.0.0.0", latestN: 2 }]))[0].object.vectorDataPoint;
      const last = points.at(-1);
      return { period: last.refPer.slice(0,7), level: last.value, quarter_change: Math.round((last.value / points[0].value - 1) * 10000) / 100 };
    },
    bonds: async () => {
      const last = (await fetchOfficial("https://www.bankofcanada.ca/valet/observations/BD.CDN.2YR.DQ.YLD,BD.CDN.10YR.DQ.YLD/json?recent=1").then(r => r.json())).observations.at(-1);
      return { date: last.d, two_year: Number(last["BD.CDN.2YR.DQ.YLD"].v), ten_year: Number(last["BD.CDN.10YR.DQ.YLD"].v) };
    },
    homes: async () => { const p = await point(34100136, "1.1.1.0.0.0.0.0.0.0"); return { period: p.refPer.slice(0,7), starts: p.value }; },
    ontario: async () => {
      const xml = await fetchOfficial("https://reports-public.ieso.ca/public/RealtimeOntarioZonalPrice/PUB_RealtimeOntarioZonalPrice.xml").then(r => r.text());
      const latest = [...xml.matchAll(/<ZonalPrice>[\s\S]*?<Interval>(\d+)<\/Interval>[\s\S]*?<LmpCap>([^<]*)<\/LmpCap>/g)].filter(m => m[2] !== "").at(-1);
      if (!latest) throw new SourceError("No Ontario price returned");
      return { date: xml.match(/<DeliveryDate>([^<]+)<\/DeliveryDate>/)?.[1] ?? null, hour: xml.match(/<DeliveryHour>([^<]+)<\/DeliveryHour>/)?.[1] ?? null, interval: Number(latest[1]), price: Number(latest[2]), hour_average: Number(xml.match(/<AveragePrice>[\s\S]*?<LmpCap>([^<]+)<\/LmpCap>/)?.[1]), geography: "Ontario" };
    },
    rivers: async () => {
      const stations = await readSections(Object.fromEntries(["08MF005", "02KF005", "02OA016"].map(code => [code, async () => {
        const item = (await fetchOfficial(`https://api.weather.gc.ca/collections/hydrometric-realtime/items?f=json&limit=1&STATION_NUMBER=${code}`).then(r => r.json())).features[0].properties;
        return { name: item.STATION_NAME, province: item.PROV_TERR_STATE_LOC, when: item.DATETIME, level_m: item.LEVEL, discharge: item.DISCHARGE };
      }])));
      return Object.entries(stations.sources).map(([code, health]) => stations[code] || { station: code, ...health });
    },
    quakes: async () => (await fetchOfficial("https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=8&minmagnitude=2.5&minlatitude=48&maxlatitude=70&minlongitude=-141&maxlongitude=-52&orderby=time").then(r => r.json())).features.map(f => ({ place: f.properties.place, when: new Date(f.properties.time).toISOString(), magnitude: f.properties.mag, geography: "Bounding box around Canada; may include neighbouring territories", source: "USGS" })),
    recalls: readCanadianRecalls, mortgages: readCanadaMortgages, posted_rates: readPostedRates, air: readAir, demand: readOntarioDemand, commodities: readCommodityIndex,
  });
  const also = await readSections({ world: () => readWorld("CA"), space: readSpace });
  return { site: "https://morningrows.com", country: "Canada", page: "/canada", ...data, also };
}

async function readCanadaRate() {
  const response = await fetchOfficial("https://www.bankofcanada.ca/valet/observations/V39079/json?recent=1");
  const body = await response.json();
  const last = body.observations[body.observations.length - 1];
  return { date: last.d, rate: Number(last.V39079.v) };
}

async function readCanadaExchange() {
  const response = await fetchOfficial("https://www.bankofcanada.ca/valet/observations/FXUSDCAD,FXAUDCAD,FXGBPCAD,FXNZDCAD/json?recent=1");
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
  const response = await fetchOfficial(`https://www.ons.gov.uk/generator?format=csv&uri=${path}`);
  if (!response.ok) throw new Error("ons");
  const lines = (await response.text()).split("\n").map((line) => line.split(",").map((cell) => cell.replaceAll("\"", "")));
  const dated = lines.filter((row) => row.length >= 2 && /^\d{4}/.test(row[0]) && row[1] !== "");
  const last = dated[dated.length - 1];
  return { period: last[0], value: last[1] };
}

async function readOnsNation(name, slug, peoplePath, jobPath, holidayDivision) {
  const meta = { source: "Office for National Statistics", licence: "Open Government Licence", geography: name };
  const data = await readSections({
    people: async () => ({ ...await ons(peoplePath), ...meta, unit: "people" }),
    job: async () => ({ ...await ons(jobPath), ...meta, unit: "percent" }),
    next_holiday: () => nextHoliday(holidayDivision),
    food_establishments: () => readFoodAuthorities(name),
    ...(slug === "scotland" ? { bill_stages: readScottishBills } : {}),
  });
  return { site: "https://morningrows.com", country: name, page: `/${slug}`, ...data };
}

async function readUnitedKingdom() {
  const series = {
    people: ["/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/ukpop/pop", "people"],
    job: ["/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms", "percent"],
    price_index: ["/economy/inflationandpriceindices/timeseries/d7bt/mm23", "index"],
    wage: ["/employmentandlabourmarket/peopleinwork/earningsandworkinghours/timeseries/kab9/lms", "GBP per week"],
    product: ["/economy/grossdomesticproductgdp/timeseries/ybez/ukea", "GBP million"],
    trade: ["/economy/nationalaccounts/balanceofpayments/timeseries/ikbj/pnbp", "GBP million"],
  };
  const tasks = Object.fromEntries(Object.entries(series).map(([name, [path, unit]]) => [name, async () => ({ ...await ons(path), unit, geography: "United Kingdom", source: "Office for National Statistics", licence: "Open Government Licence" })]));
  const data = await readSections({ ...tasks, bills: readBills, laws: readUkLaws, space: readSpace, food_establishments: () => readFoodAuthorities("United Kingdom") });
  return { site: "https://morningrows.com", country: "United Kingdom", page: "/united-kingdom", ...data, nations: ["/england.json", "/scotland.json", "/wales.json", "/northern-ireland.json"] };
}

async function readEngland() {
  const onsPoint = async (path, geography, unit) => ({ ...await ons(path), geography, unit, source: "Office for National Statistics", licence: "Open Government Licence" });
  const data = await readSections({
    food_establishments: () => readFoodAuthorities("England"),
    grid: async () => {
      for (let back = 0; back < 3; back++) {
        const day = new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
        const body = await fetchOfficial(`https://data.elexon.co.uk/bmrs/api/v1/balancing/settlement/system-prices/${day}`).then(r => r.json());
        const price = body.data?.at(-1);
        if (price) return { date: price.settlementDate, period: price.settlementPeriod, pounds_per_mwh: price.systemBuyPrice, geography: "Great Britain", source: "Elexon", licence: "Elexon open data licence", licence_url: "https://www.elexon.co.uk/bsc/data/balancing-mechanism-reporting-agent/copyright-licence-bmrs-data/", attribution: `Contains BMRS data © Elexon Limited copyright and database right ${day.slice(0, 4)}.` };
      }
      throw new SourceError("No recent system price returned");
    },
    carbon: async () => {
      const body = await fetchOfficial("https://api.carbonintensity.org.uk/regional").then(r => r.json());
      const slot = body.data[0], region = slot.regions.find(r => r.shortname === "England");
      return { from: slot.from, grams_per_kwh: region.intensity.forecast, band: region.intensity.index, geography: "England", source: "National Energy System Operator", source_url: "https://api.carbonintensity.org.uk/", licence: "CC BY 4.0" };
    },
    job: () => onsPoint("/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/ycnl/lms", "England", "percent"),
    people: () => onsPoint("/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/enpop/pop", "England", "people"),
    price_index: async () => ({ ...await onsPoint("/economy/inflationandpriceindices/timeseries/d7bt/mm23", "United Kingdom", "index"), year_change: (await ons("/economy/inflationandpriceindices/timeseries/d7g7/mm23")).value }),
    wage: () => onsPoint("/employmentandlabourmarket/peopleinwork/earningsandworkinghours/timeseries/kab9/lms", "United Kingdom", "GBP per week"),
    product: () => onsPoint("/economy/grossdomesticproductgdp/timeseries/ybez/ukea", "United Kingdom", "GBP million"),
    shop: () => onsPoint("/businessindustryandtrade/retailindustry/timeseries/j45u/drsi", "United Kingdom", "index"),
    vacancy: () => onsPoint("/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/jpc5/lms", "United Kingdom", "unemployed people per vacancy"),
    trade: () => onsPoint("/economy/nationalaccounts/balanceofpayments/timeseries/ikbd/pnbp", "United Kingdom", "GBP million; services balance"),
    floods: async () => {
      const body = await fetchOfficial("https://environment.data.gov.uk/flood-monitoring/id/floods").then(r => r.json());
      return { count: (body.items || []).length, rows: (body.items || []).slice(0, 8).map(i => ({ severity: i.severity, description: i.description })), source: "Environment Agency", licence: "Open Government Licence", geography: "England" };
    },
    service: async () => (await fetchOfficial("https://api.tfl.gov.uk/Line/Mode/tube,elizabeth-line,overground,dlr/Status").then(r => r.json())).map(line => ({ name: line.name, status: line.lineStatuses[0].statusSeverityDescription, geography: "London" })),
    rail: async () => {
      const lines = await fetchOfficial("https://api.tfl.gov.uk/Line/Mode/national-rail/Status").then(r => r.json());
      return { count: lines.length, not_good: lines.filter(line => line.lineStatuses[0].statusSeverityDescription !== "Good Service").map(line => ({ name: line.name, status: line.lineStatuses[0].statusSeverityDescription })) };
    },
    calendar: async () => (await fetchOfficial("https://www.gov.uk/bank-holidays.json").then(r => r.json()))["england-and-wales"].events.filter(e => e.date >= new Date().toISOString().slice(0,10)).slice(0,4),
    quakes: async () => [...(await fetchOfficial("http://quakes.bgs.ac.uk/feeds/MhSeismology.xml").then(r => r.text())).matchAll(/<title>([^<]*Earthquake alert[^<]*)<\/title>/g)].slice(0,8).map(m => m[1].replace(/\s+/g," ").trim()),
  });
  const also = await readSections({ world: () => readWorld("GB"), police: readPolice, health: readNhs, rainfall: readRain, rivers: readLevels, roads: readRoads, crime_data_current_to: () => fetchOfficial("https://data.police.uk/api/crime-last-updated").then(r => r.json()), space: readSpace });
  return { site: "https://morningrows.com", country: "England", page: "/england", ...data, also };
}

async function readAustraliaExchange() {
  const response = await fetchOfficial("https://www.rba.gov.au/statistics/tables/csv/f11.1-data.csv");
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

async function readRbaTable(url) {
  const response = await fetchOfficial(url);
  if (!response.ok) throw new Error("rba");
  const lines = (await response.text()).replace(/^\uFEFF/, "").split("\n");
  const title = lines.find((line) => line.startsWith("Title,"));
  const headers = title ? title.split(",").slice(1) : [];
  const dated = lines.filter((line) => /^\d{2}[/-](?:[A-Za-z]{3}|\d{2})[/-]\d{4},-?\d/.test(line));
  if (!dated.length) return { date: null, rows: [] };
  const last = dated[dated.length - 1].split(",");
  return {
    date: last[0],
    rows: headers.slice(0, last.length - 1).map((name, index) => ({ name: name.replace(/^"|"$/g, ""), value: Number(last[index + 1]) })).filter((row) => Number.isFinite(row.value)),
  };
}

async function readRbaBundle() {
  const tables = [
    ["balance_sheet", "a1"],
    ["policy", "a2"],
    ["institutions", "b1"],
    ["lending", "d2"],
    ["deposits", "f4"],
    ["housing_rates", "f6"],
    ["business_rates", "f7"],
    ["inflation", "g1"],
    ["expectations", "g3"],
    ["product", "h1"],
    ["activity", "h3"],
    ["demand", "h2"],
    ["costs", "h4"],
    ["labour", "h5"],
    ["balance", "e1"],
    ["household", "e2"],
    ["personal_rates", "f8"],
    ["prices", "g2"],
    ["banks", "b2"],
    ["cards", "c2"],
  ];
  const pairs = await mapLimit(tables, 4, async ([name, file]) => {
    try {
      return [name, await readRbaTable(`https://www.rba.gov.au/statistics/tables/csv/${file}-data.csv`)];
    } catch (error) {
      return [name, { ...describeError(error) }];
    }
  });
  return Object.fromEntries(pairs);
}

async function readPostedRates() {
  const response = await fetchOfficial("https://www.bankofcanada.ca/valet/observations/group/CHARTERED_BANK_INTEREST/json?recent=1");
  if (!response.ok) throw new Error("posted");
  const body = await response.json();
  const last = body.observations[body.observations.length - 1];
  return {
    date: last.d,
    source: "Bank of Canada",
    rows: Object.entries(body.seriesDetail).map(([id, detail]) => ({ name: detail.label, rate: Number(last[id].v) })),
  };
}

async function readAir() {
  const names = ["Toronto", "Vancouver", "Calgary"];
  const rows = await Promise.all(names.map(async (name) => {
    try {
      const response = await fetchOfficial(`https://api.weather.gc.ca/collections/aqhi-forecasts-realtime/items?f=json&limit=1&location_name_en=${encodeURIComponent(name)}`);
      if (!response.ok) return { name, error: response.status };
      const body = await response.json();
      const item = body.features && body.features[0] && body.features[0].properties;
      if (!item) return { name, error: "none" };
      return { name: item.location_name_en, when: item.forecast_datetime, index: item.aqhi };
    } catch (error) {
      return { name, error: "not read" };
    }
  }));
  return { source: "Environment and Climate Change Canada", rows };
}

async function readQuakeStats() {
  const response = await fetchOfficial("https://api.geonet.org.nz/quake/stats");
  if (!response.ok) throw new Error("stats");
  const body = await response.json();
  return { days: 365, by_magnitude: body.magnitudeCount && body.magnitudeCount.days365, source: "GeoNet" };
}

async function readAuLaws() {
  try {
    const response = await fetchOfficial("https://api.prod.legislation.gov.au/v1/titles?search=bill&limit=8");
    if (!response.ok) return { error: response.status };
    const body = await response.json();
    return { source: "Federal Register of Legislation", rows: (body.value || []).slice(0, 8).map((item) => ({ name: item.name, when: item.makingDate || "" })) };
  } catch (error) {
    return { ...describeError(error) };
  }
}

async function readUkLaws() {
  try {
    const response = await fetchOfficial("https://www.legislation.gov.uk/new/data.feed");
    if (!response.ok) return { error: response.status };
    const text = await response.text();
    return { source: "legislation.gov.uk", rows: [...text.matchAll(/<title[^>]*>([^<]+)<\/title>/g)].slice(1, 9).map((match) => match[1]) };
  } catch (error) {
    return { ...describeError(error) };
  }
}

async function readRoads() {
  try {
    const response = await fetchOfficial("https://api.tfl.gov.uk/Road");
    if (!response.ok) return [];
    const body = await response.json();
    return body.map((road) => ({ name: road.displayName, status: road.statusSeverityDescription }));
  } catch (error) {
    throw error;
  }
}

async function nextHoliday(division) {
  try {
    const response = await fetchOfficial("https://www.gov.uk/bank-holidays.json");
    if (!response.ok) return null;
    const body = await response.json();
    const today = new Date().toISOString().slice(0, 10);
    return ((body[division] && body[division].events) || []).find((event) => event.date >= today) || null;
  } catch (error) {
    throw error;
  }
}

async function readCommodityIndex() {
  const response = await fetchOfficial("https://www.bankofcanada.ca/valet/observations/group/BCPI_WEEKLY/json?recent=1");
  if (!response.ok) throw new Error("commodity");
  const body = await response.json();
  const last = body.observations[body.observations.length - 1];
  return {
    date: last.d,
    source: "Bank of Canada",
    rows: Object.entries(body.seriesDetail).map(([id, detail]) => ({ name: detail.label, value: Number(last[id].v) })),
  };
}

async function readOntarioDemand() {
  const response = await fetchOfficial("https://reports-public.ieso.ca/public/Demand/PUB_Demand.csv");
  if (!response.ok) throw new Error("demand");
  const lines = (await response.text()).split("\n").filter((line) => /^\d{4}-\d{2}-\d{2},/.test(line));
  const last = lines[lines.length - 1].split(",");
  return { date: last[0], hour: Number(last[1]), market_mw: Number(last[2]), ontario_mw: Number(last[3]), source: "IESO" };
}

async function readCanadaMortgages() {
  const response = await fetchOfficial("https://www.bankofcanada.ca/valet/observations/group/A4_RATES_MORTGAGES/json?recent=1");
  if (!response.ok) throw new Error("mortgages");
  const body = await response.json();
  const last = body.observations[body.observations.length - 1];
  return {
    date: last.d,
    source: "Bank of Canada",
    rows: Object.entries(body.seriesDetail).slice(0, 6).map(([id, detail]) => ({ name: detail.label, rate: Number(last[id].v) })),
  };
}

async function readLevels() {
  try {
    const response = await fetchOfficial("https://environment.data.gov.uk/flood-monitoring/id/measures?parameter=level&_limit=6");
    if (!response.ok) return [];
    const body = await response.json();
    return (body.items || []).map((item) => ({ label: item.label, when: item.latestReading && item.latestReading.dateTime, metres: item.latestReading && item.latestReading.value }));
  } catch (error) {
    throw error;
  }
}

async function readWalesPopulation() {
  try {
    const response = await fetchOfficial("https://api.stats.gov.wales/v2/20b6276b-92f7-48fd-806e-69c35b54d9e0/data?format=json");
    if (!response.ok) return null;
    const rows = await response.json();
    const row = rows.find((item) => item.Age === "All Ages" && item.Sex === "Persons") || rows[0];
    return { source: "StatsWales", period: row.Year, value: row["Data values"], area: row.Area, meaning: "national population projection" };
  } catch (error) {
    throw error;
  }
}

async function readRain() {
  try {
    const response = await fetchOfficial("https://environment.data.gov.uk/flood-monitoring/id/measures?parameter=rainfall&_limit=8");
    if (!response.ok) return [];
    const body = await response.json();
    return (body.items || []).map((item) => ({ label: item.label, when: item.latestReading && item.latestReading.dateTime, mm: item.latestReading && item.latestReading.value }));
  } catch (error) {
    throw error;
  }
}

async function readCash() {
  const response = await fetchOfficial("https://www.rba.gov.au/statistics/tables/csv/f1.1-data.csv");
  if (!response.ok) throw new Error("cash");
  const lines = (await response.text()).replace(/^\uFEFF/, "").split("\n");
  const dated = lines.filter((line) => /^\d{2}\/\d{2}\/\d{4},/.test(line));
  const last = dated[dated.length - 1].split(",");
  return { date: last[0], target: Number(last[1]) };
}

async function readWorld(code) {
  const indicators = [["population", "SP.POP.TOTL"], ["gdp_usd", "NY.GDP.MKTP.CD"], ["inflation", "FP.CPI.TOTL.ZG"], ["unemployment", "SL.UEM.TOTL.ZS"], ["life_years", "SP.DYN.LE00.IN"]];
  const rows = await mapLimit(indicators, 3, async ([name, id]) => {
    try {
      const body = await fetchOfficial(`https://api.worldbank.org/v2/country/${code}/indicator/${id}?format=json&mrnev=1`).then(r => r.json());
      const point = body[1]?.[0];
      if (!point || point.value == null) throw new SourceError("No published observation returned");
      return { name, year: point.date, value: point.value, geography: point.country.value, source: "World Bank", licence: "CC BY 4.0" };
    } catch (error) { return { name, ...describeError(error) }; }
  });
  return { source: "World Bank", status: rows.some(row => row.error) ? "degraded" : "ok", rows };
}

async function readSpace() {
  try {
    const response = await fetchOfficial("https://services.swpc.noaa.gov/products/noaa-scales.json");
    if (!response.ok) return { error: response.status };
    const body = await response.json();
    const today = body["0"] || {};
    return { source: "NOAA space weather", date: today.DateStamp, radio: today.R && today.R.Scale, solar: today.S && today.S.Scale, geomagnetic: today.G && today.G.Scale };
  } catch (error) {
    return { ...describeError(error) };
  }
}

async function readPolice() {
  try {
    const response = await fetchOfficial("https://data.police.uk/api/crimes-street/all-crime?lat=51.5074&lng=-0.1278");
    if (!response.ok) return { error: response.status };
    const body = await response.json();
    const counts = {};
    for (const row of body) counts[row.category] = (counts[row.category] || 0) + 1;
    return { source: "data.police.uk", place: "Westminster", month: body[0] && body[0].month, counts };
  } catch (error) {
    return { ...describeError(error) };
  }
}

async function readBills() {
  try {
    const response = await fetchOfficial("https://bills-api.parliament.uk/api/v1/Bills?Take=8");
    if (!response.ok) return { error: response.status };
    const body = await response.json();
    return { source: "UK Parliament", rows: (body.items || []).map((item) => ({ id: item.billId, title: item.shortTitle })) };
  } catch (error) {
    return { ...describeError(error) };
  }
}

async function readNhs() {
  try {
    const response = await fetchOfficial("https://www.england.nhs.uk/feed/");
    if (!response.ok) return { error: response.status };
    const text = await response.text();
    const rows = [...text.matchAll(/<title>([^<]+)<\/title>/g)].slice(1, 6).map((match) => match[1]);
    return { source: "NHS England", rows };
  } catch (error) {
    return { ...describeError(error) };
  }
}

function alsoSection(also) {
  if (!also) return "";
  const world = ((also.world && also.world.rows) || []).map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.year || "")}</td><td>${escapeHtml(row.value ?? "")}</td></tr>`).join("");
  const weatherRows = (also.weather && also.weather.rows) || [];
  const weather = weatherRows.length ? `<table><thead><tr><th>Place</th><th>Degrees</th><th>Wind, km/h</th></tr></thead><tbody>${weatherRows.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.degrees_c ?? "")}</td><td>${escapeHtml(row.wind_kmh ?? "")}</td></tr>`).join("")}</tbody></table>` : "";
  return `<h2>Also on this read</h2><p>Not sorted yet. World Bank figures are the latest published year.</p><table><thead><tr><th>World Bank</th><th>Year</th><th>Value</th></tr></thead><tbody>${world}</tbody></table>${weather}`;
}

function simplePage(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body><main><p><a href="/">Countries</a></p><h1>${title}</h1>${body}</main></body></html>`;
}

const HOLD_SECONDS = {
  "/australia": 300,
  "/australia.json": 300,
  "/morning.json": 300,
  "/new-zealand": 120,
  "/new-zealand.json": 120,
  "/england": 600,
  "/england.json": 600,
  "/united-kingdom": 600,
  "/united-kingdom.json": 600,
  "/scotland": 600,
  "/scotland.json": 600,
  "/wales": 600,
  "/wales.json": 600,
  "/northern-ireland": 600,
  "/northern-ireland.json": 600,
  "/canada": 3600,
  "/canada.json": 3600,
};

async function held(request, response) {
  const seconds = response.headers.get("x-data-status") === "degraded" ? 30 : HOLD_SECONDS[new URL(request.url).pathname];
  const headers = new Headers(response.headers);
  if (seconds) headers.set("Cache-Control", `public, max-age=${seconds}`);
  const stored = new Response(response.body, { status: response.status, headers });
  if (!seconds) return stored;
  try {
    const url = new URL(request.url);
    await caches.default.put(new Request(`${url.origin}${url.pathname}?release=${BUILD_CACHE_KEY}`, { method: "GET" }), stored.clone());
  } catch (error) {
    return stored;
  }
  return stored;
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health.json") return json({ service: "Morning Rows", source_revision: BUILD_REVISION, source_dirty: BUILD_DIRTY, build_fingerprint: BUILD_FINGERPRINT, worker_version: env.WORKER_VERSION?.id || null, note: "Runtime identity only; inspect each desk sources field for data health." });
    if (url.pathname === "/llms.txt") return new Response(LLMS, { headers: { "content-type": "text/plain; charset=utf-8" } });
    if (url.pathname === "/robots.txt") return new Response(ROBOTS, { headers: { "content-type": "text/plain; charset=utf-8" } });
    if (url.pathname === "/catalog.json") return json({
      name: "Morning Rows",
      site: "https://morningrows.com",
      summary: "Official public figures for agents. One desk per country. The United Kingdom is split. Fetch the index, then one desk file. Do not scrape the HTML.",
      auth: "none",
      index: "/llms.txt",
      countries: [
        { name: "Australia", page: "/australia", records: "/australia.json", also: "/morning.json" },
        { name: "New Zealand", page: "/new-zealand", records: "/new-zealand.json" },
        { name: "Canada", page: "/canada", records: "/canada.json" },
        { name: "United Kingdom", page: "/united-kingdom", records: "/united-kingdom.json" },
        { name: "England", page: "/england", records: "/england.json" },
        { name: "Scotland", page: "/scotland", records: "/scotland.json" },
        { name: "Wales", page: "/wales", records: "/wales.json" },
        { name: "Northern Ireland", page: "/northern-ireland", records: "/northern-ireland.json" },
      ],
    });
    if (url.pathname === "/.well-known/ai-catalog.json") return json(AI_CATALOG);
    if (url.pathname === "/keys.json") return json({
      site: "https://morningrows.com",
      note: "needs_a_key is collected for later and is not called. blocked is a feed that refused. Keep looking for another open feed from the same publisher.",
      configured: [{ country: "New Zealand", source: "Stats NZ", binding: "STATSNZ_KEY", status: "Existing integration; see new-zealand.json for live health" }],
      needs_a_key: [
        { country: "New Zealand", source: "Auckland Transport", would_unlock: "Registered transport APIs, including real-time service data", checked: "2026-10-17", evidence: "https://dev-portal.at.govt.nz/" },
        { country: "Wales", source: "Natural Resources Wales", would_unlock: "Flood warnings and rainfall, river and sea-level API data", checked: "2026-10-17", evidence: "https://api-portal.naturalresources.wales/" },
        { country: "United Kingdom", source: "HMRC Trade Tariff API Developer Hub", would_unlock: "Hub-managed API subscriptions; separately assess open Department for Business and Trade datasets", checked: "2026-10-17", evidence: "https://hub.trade-tariff.service.gov.uk/" },
        { country: "Australia", source: "Bureau of Meteorology", would_unlock: "forecasts, observations, and warnings" },
        { country: "Australia", source: "AEMO developer portal", would_unlock: "registered market APIs, not the public grid files" },
        { country: "Australia", source: "NSW emergency feeds and Western Australia SLIP", would_unlock: "some fire and warning feeds" },
        { country: "Australia", source: "Australian Business Register", would_unlock: "a business lookup" },
        { country: "New Zealand", source: "LINZ Data Service", would_unlock: "addresses, parcels, and place names" },
        { country: "New Zealand", source: "MetService", would_unlock: "the national forecast" },
        { country: "New Zealand", source: "NIWA", would_unlock: "climate stations and forecasts" },
        { country: "Canada", source: "AESO", would_unlock: "the Alberta pool price as JSON. A free key. The publisher limits use." },
        { country: "Canada", source: "IESO participant APIs", would_unlock: "registered Ontario market tools, not the public reports" },
        { country: "Australia", source: "Service NSW FuelCheck", would_unlock: "published fuel prices" },
        { country: "New Zealand", source: "Companies Office and NZBN", would_unlock: "a business lookup" },
        { country: "United Kingdom", source: "Companies House", would_unlock: "company search and filings" },
        { country: "United Kingdom", source: "Met Office DataPoint", would_unlock: "forecasts and observations" },
        { country: "United Kingdom", source: "Energy Performance of Buildings", would_unlock: "home energy certificates" },
        { country: "United Kingdom", source: "Ordnance Survey", would_unlock: "detailed addresses and maps" },
        { country: "United Kingdom", source: "Transport for London", would_unlock: "a higher rate limit. The current lines work without it." },
        { country: "United Kingdom", source: "DVSA MOT history", would_unlock: "a vehicle test history" },
      ],
      blocked: [
        { country: "Australia", source: "Australian Financial Security Authority quarterly insolvency statistics discovery page", status: 503, checked: "2026-10-17", url: "https://www.afsa.gov.au/about-us/statistics-and-insights/headline-statistics/quarterly-personal-insolvency-statistics", note: "The discovery page returned HTTP 503 from the workspace. An official CSV link was not resolved; this does not establish that its underlying dataset is unavailable." },
        { country: "Australia", source: "ABS SDMX API from Cloudflare Workers", status: 403, checked: "2026-10-17", note: "CloudFront refuses Worker requests. The same API responds from the development workspace. No workaround or stored figures substituted." },
        { country: "United Kingdom, England, Scotland, Wales, Northern Ireland", source: "ONS CSV and timeseries API from Cloudflare Workers", status: 403, checked: "2026-10-17", note: "Publisher firewall refuses Worker requests. Other desk sources remain independent." },
        { country: "New Zealand", source: "Reserve Bank of New Zealand", status: 403, note: "The statistics pages refused the read. No open file was found." },
        { country: "New Zealand", source: "MetService", status: 403, note: "Missing authentication token. Listed under needs_a_key." },
        { country: "New Zealand", source: "NIWA", status: 401, note: "A key is required. Listed under needs_a_key." },
        { country: "New Zealand", source: "LINZ feature download", status: 404, note: "The layer list is public. A feature download was not found without a key." },
        { country: "United Kingdom", source: "Companies House", status: 401, note: "An empty authorisation header was refused. Listed under needs_a_key." },
        { country: "United Kingdom", source: "Bank of England database", status: 200, note: "The CSV address returned an HTML page, not the series. Not copied." },
        { country: "Scotland", source: "statistics.gov.scot", status: "closed", note: "The SPARQL service closed the connection. No rows were read." },
        { country: "Australia", source: "Parliament of Australia bills", status: 403, note: "The site firewall refused the read." },
        { country: "Australia", source: "Geoscience Australia hazard map", status: 403, note: "The map service refused the read. Earthquake rows already come from the open quake feed." },
        { country: "Canada", source: "IESO yearly price file", status: "stale", note: "The public file stops at 2025-04-30. It was not copied as a current price." },
        { country: "United Kingdom", source: "coronavirus.data.gov.uk", status: "gone", note: "The hostname did not resolve." },
      ],
    });
    if (url.pathname === "/" ) return new Response(DESK, { headers: { "content-type": "text/html; charset=utf-8" } });
    const hold = HOLD_SECONDS[url.pathname];
    if (hold && request.method === "GET") {
      try {
        const hit = await caches.default.match(new Request(`${url.origin}${url.pathname}?release=${BUILD_CACHE_KEY}`, { method: "GET" }));
        if (hit) return hit;
      } catch (error) {
        // A miss still reads the source once.
      }
    }
    if (url.pathname === "/new-zealand" || url.pathname === "/new-zealand.json") {
      const [priceResult, quakeResult, volcanoResult, noticeResult, statsResult, worldResult, spaceResult, quakeStatsResult] = await Promise.allSettled([
        readNzPrices(),
        readNzQuakes(),
        fetchOfficial("https://api.geonet.org.nz/volcano/val").then(response => response.json()).then(body => body.features.map(feature => ({ name: feature.properties.volcanoTitle, colour: feature.properties.acc, level: feature.properties.level }))),
        fetchOfficial("https://api.geonet.org.nz/news/geonet").then(response => response.json()).then(body => body.feed.slice(0,3).map(item => ({ when: item.published, title: item.title }))),
        readStatsNz(env, STATS_CATALOGUE),
        readWorld("NZ"),
        readSpace(),
        readQuakeStats(),
      ]);
      const nz = {
        sources: Object.fromEntries([priceResult, quakeResult, volcanoResult, noticeResult, statsResult, worldResult, spaceResult, quakeStatsResult].map((result, index) => [["prices", "quakes", "volcanoes", "notices", "stats", "world", "space", "quake_stats"][index], result.status === "fulfilled" ? { status: hasFailures(result.value) ? "degraded" : "ok", fetched_at: new Date().toISOString() } : { status: "error", fetched_at: new Date().toISOString(), ...describeError(result.reason) }])),
        site: "https://morningrows.com",
        country: "New Zealand",
        page: "/new-zealand",
        prices: priceResult.status === "fulfilled" ? priceResult.value : [],
        quakes: quakeResult.status === "fulfilled" ? quakeResult.value : [],
        volcanoes: volcanoResult.status === "fulfilled" ? volcanoResult.value : [],
        notices: noticeResult.status === "fulfilled" ? noticeResult.value : [],
        quake_stats: quakeStatsResult.status === "fulfilled" ? quakeStatsResult.value : null,
        stats: statsResult.status === "fulfilled" ? statsResult.value : { present: Boolean(env?.STATSNZ_KEY), status: "error", rows: [], ...describeError(statsResult.reason) },
        also: {
          world: worldResult.status === "fulfilled" ? worldResult.value : { rows: [] },
          space: spaceResult.status === "fulfilled" ? spaceResult.value : {},
        },
      };
      if (url.pathname === "/new-zealand.json") return held(request, json(nz));
      return held(request, new Response(nzPage(nz), { headers: { "content-type": "text/html; charset=utf-8" } }));
    }
    if (url.pathname === "/canada" || url.pathname === "/canada.json") {
      const canada = await readCanada().catch(() => ({ site: "https://morningrows.com", country: "Canada", error: "not read" }));
      if (url.pathname === "/canada.json") return held(request, json(canada));
      const rows = (canada.jobs || []).map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.rate}%</td></tr>`).join("");
      return held(request, new Response(simplePage("Morning Canada", `<p>The file is <a href="/canada.json">canada.json</a>.</p><h2>The job</h2><table>${rows}</table><h2>The price of living</h2><p>${canada.price_index ? canada.price_index.index : ""}</p><h2>The shop</h2><p>${canada.shop ? canada.shop.thousand_dollars : ""} thousand dollars</p>${alsoSection(canada.also)}`), { headers: { "content-type": "text/html; charset=utf-8" } }));
    }
    if (url.pathname === "/united-kingdom" || url.pathname === "/united-kingdom.json") {
      const uk = await readUnitedKingdom().catch(() => ({ site: "https://morningrows.com", country: "United Kingdom", error: "not read" }));
      if (url.pathname === "/united-kingdom.json") return held(request, json(uk));
      return held(request, new Response(simplePage("Morning United Kingdom", `<p>UK-wide figures only. The nations are <a href="/england">England</a>, <a href="/scotland">Scotland</a>, <a href="/wales">Wales</a>, and <a href="/northern-ireland">Northern Ireland</a>.</p><p>People ${uk.people ? uk.people.value : ""}. Unemployment ${uk.job ? uk.job.value : ""}%. The file is <a href="/united-kingdom.json">united-kingdom.json</a>.</p>`), { headers: { "content-type": "text/html; charset=utf-8" } }));
    }
    const nations = {
      "/scotland": ["Scotland", "scotland", "/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/scpop/pop", "/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/ycnn/lms", "scotland"],
      "/wales": ["Wales", "wales", "/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/wapop/pop", "/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/ycnm/lms", "england-and-wales"],
      "/northern-ireland": ["Northern Ireland", "northern-ireland", "/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/nipop/pop", "/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/zsfb/lms", "northern-ireland"],
    };
    const nationKey = url.pathname.endsWith(".json") ? url.pathname.slice(0, -5) : url.pathname;
    if (nations[nationKey]) {
      const [name, slug, peoplePath, jobPath, holidayDivision] = nations[nationKey];
      const nation = await readOnsNation(name, slug, peoplePath, jobPath, holidayDivision).catch(() => ({ site: "https://morningrows.com", country: name, error: "not read" }));
      if (slug === "wales") { const projection = await readSections({ projection: readWalesPopulation }); nation.projection = projection.projection; nation.sources = { ...nation.sources, ...projection.sources }; }
      if (url.pathname.endsWith(".json")) return held(request, json(nation));
      return held(request, new Response(simplePage(`Morning ${name}`, `<p>The file is <a href="/${slug}.json">${slug}.json</a>. UK-wide figures are on <a href="/united-kingdom">the United Kingdom desk</a>.</p><p>People ${nation.people ? nation.people.value : ""}. Unemployment ${nation.job ? nation.job.value : "not read on this desk"}.</p>`), { headers: { "content-type": "text/html; charset=utf-8" } }));
    }
    if (url.pathname === "/england" || url.pathname === "/england.json") {
      const england = await readEngland().catch(() => ({ site: "https://morningrows.com", country: "England", error: "not read" }));
      if (url.pathname === "/england.json") return held(request, json(england));
      const lines = (england.quakes || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("");
      return held(request, new Response(simplePage("Morning England", `<p>The file is <a href="/england.json">england.json</a>.</p><p>System price ${england.grid ? england.grid.pounds_per_mwh : ""} pounds. Carbon ${england.carbon ? england.carbon.grams_per_kwh : ""} grams. Job ${england.job ? england.job.value : ""}%. Wage ${england.wage ? england.wage.value : ""} pounds a week.</p><ul>${lines}</ul>${alsoSection(england.also)}`), { headers: { "content-type": "text/html; charset=utf-8" } }));
    }
    if (url.pathname !== "/australia" && url.pathname !== "/australia.json" && url.pathname !== "/morning.json") {
      return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    const settled = await Promise.allSettled([readGrid(), readQuakes(), readJobs(), readPrice(), readApprovals(), readWage(), readShop(), readPeople(), readSpend(), readWorks(), readService(), readCash(), readAustraliaExchange(), readWorld("AU"), readSpace(), readRbaTable("https://www.rba.gov.au/statistics/tables/csv/f2.1-data.csv"), readRbaTable("https://www.rba.gov.au/statistics/tables/csv/i2-data.csv"), readAuLaws(), readRbaTable("https://www.rba.gov.au/statistics/tables/csv/d3-data.csv"), readRbaTable("https://www.rba.gov.au/statistics/tables/csv/d1-data.csv"), readRbaBundle()]);
    const sourceNames = ["grid", "quakes", "jobs", "price", "approvals", "wage", "shop", "people", "spend", "works", "service", "cash", "exchange", "world", "space", "bonds", "commodities", "laws", "money", "credit", "rba"];
    const sources = Object.fromEntries(settled.map((result, index) => [sourceNames[index], result.status === "fulfilled" ? { status: hasFailures(result.value) ? "degraded" : "ok", fetched_at: new Date().toISOString() } : { status: "error", fetched_at: new Date().toISOString(), ...describeError(result.reason) }]));
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
    const also = {
      world: settled[13].status === "fulfilled" ? settled[13].value : { rows: [] },
      space: settled[14].status === "fulfilled" ? settled[14].value : {},
    };
    const bonds = settled[15].status === "fulfilled" ? settled[15].value : null;
    const commodities = settled[16].status === "fulfilled" ? settled[16].value : null;
    const laws = settled[17].status === "fulfilled" ? settled[17].value : null;
    const money = settled[18].status === "fulfilled" ? settled[18].value : null;
    const credit = settled[19].status === "fulfilled" ? settled[19].value : null;
    const rba = settled[20].status === "fulfilled" ? settled[20].value : null;
    sources.hospital = { status: "degraded", error: HOSPITAL.error, reference_period: HOSPITAL.year };
    const body = { sources, site: "https://morningrows.com", country: "Australia", page: "/australia", read_at: grid[0]?.at ?? null, grid, quakes, jobs, price, approvals, wage, shop, people, spend: spend.rows, spend_total_million: spend.australia_million, works, service, cash, exchange, bonds, commodities, money, credit, rba, laws, hospital: HOSPITAL, catalog: CATALOG.sets, also };
    if (url.pathname === "/morning.json" || url.pathname === "/australia.json") return held(request, json(body));
    return held(request, new Response(page(body), { headers: { "content-type": "text/html; charset=utf-8" } }));
  },
};

export default {
  async fetch(request, env = {}) {
    const response = await worker.fetch(request, env);
    const headers = new Headers(response.headers);
    headers.set("x-source-revision", BUILD_REVISION);
    if (env.WORKER_VERSION?.id) headers.set("x-worker-version", env.WORKER_VERSION.id);
    return new Response(response.body, { status: response.status, headers });
  },
};

export { readOnsNation, readUnitedKingdom, readEngland, readCanada, readNzPrices, hasFailures };
