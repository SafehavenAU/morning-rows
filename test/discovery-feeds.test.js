import test from 'node:test';
import assert from 'node:assert/strict';
import { foodAuthorities, scottishBillStages, canadianRecalls } from '../lib/discovery-feeds.js';

const authorities = { meta: { totalCount: 2, totalPages: 1, extractDate: '2026-10-17T09:00:00' }, authorities: [
  { LocalAuthorityId: 1, Name: 'Example district', RegionName: 'London', EstablishmentCount: 10, LastPublishedDate: '2026-10-16', Email: 'omit@example.org' },
  { LocalAuthorityId: 2, Name: 'Example council', RegionName: 'Scotland', EstablishmentCount: 0, LastPublishedDate: '2026-10-15', Email: 'omit@example.org' },
] };
test('food counts keep nation boundaries, zero values, dates and no contacts', () => {
  const uk = foodAuthorities(authorities, 'United Kingdom');
  assert.equal(uk.count, 10); assert.equal(uk.authority_count, 2);
  assert.deepEqual(uk.publication_range, { oldest: '2026-10-15', newest: '2026-10-16' });
  const scotland = foodAuthorities(authorities, 'Scotland');
  assert.equal(scotland.count, 0); assert.equal(scotland.rows.length, 1);
  assert.ok(!JSON.stringify(uk).includes('omit@example.org'));
});
test('food counts reject incomplete snapshots, duplicates and unknown geography', () => {
  assert.throws(() => foodAuthorities({ ...authorities, meta: { ...authorities.meta, totalCount: 3 } }, 'England'), /Incomplete/);
  assert.throws(() => foodAuthorities({ ...authorities, authorities: [authorities.authorities[0], authorities.authorities[0]] }, 'England'), /Invalid/);
  assert.throws(() => foodAuthorities({ ...authorities, authorities: authorities.authorities.map(r => ({ ...r, RegionName: 'Unknown' })) }, 'England'), /unrecognised/);
});
test('bill stages join exact IDs, omit people, and exclude future or undated stages', () => {
  const bills = [{ ID: 1, ShortName: 'Example Bill', PersonID: 123 }];
  const stages = [{ ID: 1, BillID: 1, BillStageTypeID: 5, StageDate: '2026-10-01T00:00:00' }, { ID: 2, BillID: 1, BillStageTypeID: 5, StageDate: null }, { ID: 3, BillID: 1, BillStageTypeID: 5, StageDate: '2099-01-01T00:00:00' }];
  const result = scottishBillStages(bills, stages, [{ ID: 5, Name: 'Introduced' }], '2026-10-17');
  assert.deepEqual(result.rows, [{ bill_id: 1, title: 'Example Bill', stage: 'Introduced', date: '2026-10-01' }]);
  assert.throws(() => scottishBillStages([], stages, [{ ID: 5, Name: 'Introduced' }], '2026-10-17'), /Unmatched/);
});
const rss = '<rss><channel><description>Consumer product</description><item><title><![CDATA[Item & accessory]]></title><link>https://recalls-rappels.canada.ca/en/alert-recall/example</link><pubDate>2026-10-16T12:00:00</pubDate><description>Not copied</description></item></channel></rss>';
test('recalls retain publisher timestamps and links without descriptions', () => {
  const result = canadianRecalls(rss);
  assert.equal(result.rows[0].title, 'Item & accessory');
  assert.equal(result.rows[0].published_at, '2026-10-16T12:00:00');
  assert.ok(!JSON.stringify(result).includes('Not copied'));
  assert.deepEqual(canadianRecalls('<rss><channel><description>Consumer product</description></channel></rss>').rows, []);
});
test('recalls reject malformed documents and nonofficial links', () => {
  assert.throws(() => canadianRecalls(rss.slice(0, -10)), /Invalid/);
  assert.throws(() => canadianRecalls(rss.replace('https://recalls-rappels.canada.ca', 'https://example.org')), /Unexpected/);
  assert.throws(() => canadianRecalls('<!DOCTYPE rss>' + rss), /Invalid/);
});
