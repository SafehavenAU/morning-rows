#!/usr/bin/env python3
"""Independent original ZIP/CSV/Decimal extraction; no runtime imports or HTTP."""
import csv
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from hashlib import sha256
import io
import json
from pathlib import Path
import re
import struct
import sys
import zipfile

ROOT = Path(__file__).resolve().parent
ORIGINAL = ROOT / 'original'
DAY = datetime(2026, 10, 20, tzinfo=timezone(timedelta(hours=10)))
REGIONS = ['SA1', 'VIC1']
DEFINITION_PIN = 'da76ccbff14d3b5c0126b63c2cbb2b1f6a149c2ba23e6129c7ade7b75790d3ed'

def need(ok, message):
    if not ok:
        raise ValueError(message)

def decimal(raw):
    need(isinstance(raw, str) and len(raw) <= 24 and re.fullmatch(
        r'-?(?:0|[1-9]\d{0,7})(?:\.\d{1,5})?(?:[Ee][+-]?\d{1,2})?', raw),
        'Unsupported decimal token')
    value = Decimal(raw)
    need(value.is_finite() and value.as_tuple().exponent >= -5 and abs(value) <= Decimal('99999999.99999'),
         'Excess decimal precision or numeric magnitude')
    return value

def round_cent(value):
    return value.quantize(Decimal('.01'), rounding=ROUND_HALF_UP)

def stamp(raw):
    value = datetime.strptime(raw, '%Y/%m/%d %H:%M:%S').replace(tzinfo=DAY.tzinfo)
    need(value.strftime('%Y/%m/%d %H:%M:%S') == raw, 'Noncanonical publisher timestamp')
    return value

def summary(values):
    need(len(values) == 288, 'A summary requires all 288 intervals')
    cents = [round_cent(value) for value in values]
    return {'mean': str(round_cent(sum(cents) / 288)), 'minimum': str(min(cents)),
            'maximum': str(max(cents)), 'negative_count': sum(v < 0 for v in cents),
            'zero_count': sum(v == 0 for v in cents), 'interval_count': len(cents),
            'cent_sum': str(sum(cents))}

def zip_csv(blob, name):
    """Validate framing independently with struct + bounded stdlib ZIP reader."""
    need(100 <= len(blob) <= 524288, 'ZIP compressed bound')
    end = len(blob) - 22
    trailer = struct.unpack_from('<4s4H2IH', blob, end)
    signature, disk, central_disk, disk_entries, entries, central_size, central, comment = trailer
    need((signature, disk, central_disk, disk_entries, entries, comment) ==
         (b'PK\x05\x06', 0, 0, 1, 1, 0), 'One-volume one-member ZIP without comment')
    need(central + central_size == end and central_size >= 46, 'Exact central directory position')
    info = struct.unpack_from('<4s6H3I5H2I', blob, central)
    (signature, made_by, required, flags, method, mod_time, mod_date, crc,
     compressed, expanded, name_size, extra_size, comment_size, start_disk,
     internal_attrs, attrs, local_offset) = info
    need(signature == b'PK\x01\x02' and required <= 20 and flags == 0 and method in [0, 8] and
         extra_size == comment_size == start_disk == local_offset == 0 and central_size == 46 + name_size,
         'Unsupported central framing or ZIP flags')
    need(not attrs & 16 and ((attrs >> 16) & 0xf000) != 0xa000, 'Flat regular file required')
    need(0 < compressed <= 524288 and 0 < expanded <= 2097152, 'ZIP sizes bounded before extraction')
    expected_name = name.replace('.zip', '.CSV').encode('ascii')
    need(blob[central + 46:central + 46 + name_size] == expected_name, 'Exact central filename')
    local = struct.unpack_from('<4s5H3I2H', blob, 0)
    need(local[0] == b'PK\x03\x04' and local[1] == required and
         local[2:6] == (flags, method, mod_time, mod_date) and local[6:9] == (crc, compressed, expanded) and
         local[9:] == (name_size, 0), 'Local/central metadata equality')
    start = 30 + name_size
    need(blob[30:start] == expected_name and start + compressed == central,
         'Exact local filename and payload end')
    with zipfile.ZipFile(io.BytesIO(blob)) as archive:
        need(archive.namelist() == [expected_name.decode()], 'Exactly one named CSV member')
        with archive.open(archive.infolist()[0]) as stream:
            data = stream.read(2097153)
            need(len(data) == expanded and len(data) <= 2097152 and stream.read(1) == b'', 'Actual expansion bound')
        # zipfile verifies the original CRC while reading the complete member.
    return data

def extract():
    acquisition_bytes = (ORIGINAL / 'acquisition.json').read_bytes()
    acquisition = json.loads(acquisition_bytes)
    audit_bytes = (ORIGINAL / 'acquisition-audit.json').read_bytes()
    audit = json.loads(audit_bytes)
    need(audit['pass'] and audit['calendar_day'] == '2026-10-20' and audit['request_records_consistent'] and
         audit['acquisition_sha256'] == sha256(acquisition_bytes).hexdigest(), 'Retained full-wire/minimal derivation audit')
    need(acquisition['pass'] is True and acquisition['calendar_day'] == DAY.strftime('%Y-%m-%d'),
         'Successful exact-day acquisition required')
    bundles = acquisition['bundles']
    need(len(bundles) == 2 and [b['trading_day'] for b in bundles] == ['2026-10-19', '2026-10-20'],
         'Exactly ordered advertised required trading days')
    need(len(acquisition['requests']) == 5, 'Exactly one index, two ZIPs and two monthly presentation requests')
    for record in acquisition['requests']:
        requested, retrieved = map(datetime.fromisoformat, [record['requested_at'], record['retrieved_at']])
        need(datetime(2026, 10, 20, 18, 6, tzinfo=timezone.utc) <= requested <= retrieved <
             datetime(2026, 10, 21, 14, tzinfo=timezone.utc), 'Actual acquisition window')
        need(record['status'] == 200, 'Only successful original responses')
    chosen = {region: {} for region in REGIONS}
    inputs = [{'file': 'original/acquisition.json', 'bytes': len(acquisition_bytes),
               'sha256': sha256(acquisition_bytes).hexdigest()},
              {'file': 'original/acquisition-audit.json', 'bytes': len(audit_bytes), 'sha256': sha256(audit_bytes).hexdigest()}]
    excerpt = acquisition['index_excerpt']
    need(excerpt['file'] == 'original/index-directory-excerpt.html', 'Exact safe retained index path')
    excerpt_bytes = (ROOT / excerpt['file']).read_bytes()
    need(len(excerpt_bytes) == excerpt['bytes'] and sha256(excerpt_bytes).hexdigest() == excerpt['sha256'],
         'Retained minimal index binding')
    inputs.append({key: excerpt[key] for key in ['file', 'bytes', 'sha256']})
    definition = ORIGINAL / 'public-prices-definition.yaml'
    metadata = definition.read_bytes()
    need(sha256(metadata).hexdigest() == DEFINITION_PIN, 'Original publisher definition unchanged')
    text = metadata.decode('utf-8', errors='strict')
    need('description: Next Day Public Daily Prices Dispatch Reports' in text, 'Declared dispatch dataset')
    fields, report = {}, None
    for line in text.splitlines():
        match = re.fullmatch('   name: (.+)', line)
        if match:
            report = match[1]
            fields[report] = []
        match = re.fullmatch('      name: (.+)', line)
        if match and report:
            fields[report].append(match[1])
    need(set(fields) == {'DREGION-NULL-2', 'DREGION-NULL-3', 'TREGION-NULL-1', 'TREGION-NULL-2'},
         'Explicit mixed publisher report family')
    need(text.count('description: Regional Energy Price - EnergyPrice attribute after capping/flooring and scaling') >= 2
         and 'format: NUMBER(15,5)' in text, 'Publisher RRP precision and adjustment')
    inputs.append({'file': 'original/public-prices-definition.yaml', 'bytes': len(metadata),
                   'sha256': DEFINITION_PIN, 'DREGION2_fields': len(fields['DREGION-NULL-2']),
                   'DREGION3_fields': len(fields['DREGION-NULL-3']),
                   'source_url': 'https://visualisations.aemo.com.au/aemo/nemweb/datasets/public-prices-definition.yaml',
                   'acquisition_note': 'Byte-identical previously retained publisher metadata, not a new retrieval'})
    for bundle in bundles:
        name = bundle['filename']
        need(re.fullmatch(r'PUBLIC_PRICES_\d{8}0000_\d{14}\.zip', name) and bundle['file'] == 'original/' + name and
             bundle['url'] == 'https://nemweb.com.au/Reports/CURRENT/Public_Prices/' + name, 'Advertised original URL identity')
        need(datetime.strptime(name[14:22], '%Y%m%d').strftime('%Y-%m-%d') == bundle['trading_day'],
             'Filename trading day equals retained bundle trading day')
        blob = (ORIGINAL / name).read_bytes()
        need(len(blob) == bundle['bytes'] and sha256(blob).hexdigest() == bundle['sha256'], 'Original ZIP hash/size')
        data = zip_csv(blob, name)
        csv_text = data.decode('utf-8', errors='strict')
        need(not csv_text.startswith('\ufeff') and not re.search(r'\r(?!\n)', csv_text), 'Strict original UTF-8/line endings')
        lines = csv_text.replace('\r\n', '\n').split('\n')
        if lines[-1] == '':
            lines.pop()
        need(4 <= len(lines) <= 3000 and all(len(line) <= 4096 for line in lines), 'Record and line bounds')
        rows = [next(csv.reader([line], strict=True)) for line in lines]
        first = rows[0]
        need(len(first) == 10 and first[:5] == ['C', 'NEMP.WORLD', 'PRICES', 'AEMO', 'PUBLIC'] and
             re.fullmatch(r'\d{16}', first[7]) and first[8] == '' and re.fullmatch(r'\d{16}', first[9]),
             'Exact original report identity')
        need(rows[-1] == ['C', 'END OF REPORT', str(len(rows))], 'Complete report trailer')
        generated_raw = first[5] + ' ' + first[6]
        generated = stamp(generated_raw)
        filename_generated = datetime.strptime(name[-18:-4], '%Y%m%d%H%M%S').replace(tzinfo=DAY.tzinfo)
        need(generated == filename_generated and generated.isoformat() == bundle['report_generated_at'] and
             generated <= datetime.fromisoformat(bundle['requested_at']), 'Original header/filename/actual-clock generation equality')
        trading_start = datetime.strptime(bundle['trading_day'], '%Y-%m-%d').replace(tzinfo=DAY.tzinfo, hour=4)
        trading_end = trading_start + timedelta(days=1)
        need(trading_end <= generated, 'Generation cannot precede trading-day completion')
        layouts = {}
        group = {region: {'2': {}, '3': {}} for region in REGIONS}
        for row in rows[1:-1]:
            need(len(row) >= 4 and row[1:3] == ['DREGION', ''] and row[3] in ['2', '3'], 'Only declared DREGION layouts')
            if row[0] == 'I':
                need(row[3] not in layouts, 'Unique layout header')
                layouts[row[3]] = row[4:]
                continue
            need(row[0] == 'D' and row[3] in layouts and len(row) == len(layouts[row[3]]) + 4,
                 'Header-before-data and full CSV field count')
            entry = dict(zip(layouts[row[3]], row[4:]))
            region = entry['REGIONID']
            need(region in ['NSW1', 'QLD1', 'SA1', 'TAS1', 'VIC1'], 'Known NEM region')
            if region not in REGIONS:
                continue
            ending = stamp(entry['SETTLEMENTDATE'])
            need(trading_start < ending <= trading_end and (ending - trading_start).total_seconds() % 300 == 0,
                 'Exact declared trading-bundle ownership and five-minute boundary')
            need(all(entry[key] == expected for key, expected in
                     [('RUNNO', '1'), ('INTERVENTION', '0'), ('APCFLAG', '0'), ('MARKETSUSPENDEDFLAG', '0')]),
                 'Exact run, intervention and status flags')
            raw = entry['RRP']
            decimal(raw)
            need(ending not in group[region][row[3]], 'Unique regional/layout interval')
            group[region][row[3]][ending] = raw
        need(set(layouts) == {'2', '3'}, 'Both selected layouts')
        for version, names in layouts.items():
            need(names == fields['DREGION-NULL-' + version], 'Every header equals publisher field definitions')
        for region, versions in group.items():
            expected = {trading_start + timedelta(minutes=5 * n) for n in range(1, 289)}
            need(set(versions['2']) == set(versions['3']) == expected, 'Each full regional trading bundle has 288 intervals')
            for ending, raw in versions['3'].items():
                need(decimal(raw) == decimal(versions['2'][ending]), 'Original layouts agree numerically')
                if not DAY < ending <= DAY + timedelta(days=1):
                    continue
                need(ending not in chosen[region], 'Unique selected calendar interval across bundles')
                chosen[region][ending] = {'raw': raw, 'layout2_raw': versions['2'][ending],
                                         'rounded': str(round_cent(decimal(raw))), 'source_filename': name}
        inputs.append({'file': bundle['file'], 'bytes': len(blob), 'sha256': bundle['sha256'],
                       'csv_bytes': len(data), 'csv_sha256': sha256(data).hexdigest(),
                       'csv_name': name.replace('.zip', '.CSV'), 'report_generated_raw': generated_raw,
                       'report_generated_at': generated.isoformat(), 'trading_day': bundle['trading_day'],
                       'report_records': len(rows), 'source_url': bundle['url'],
                       'requested_at': bundle['requested_at'], 'retrieved_at': bundle['retrieved_at']})
    need(len(acquisition.get('monthly', [])) == 2 and [m['region'] for m in acquisition['monthly']] == REGIONS and
         all(m['pass'] for m in acquisition['monthly']), 'Both separately acquired monthly presentations required')
    output, summaries = [], []
    expected = [DAY + timedelta(minutes=5 * n) for n in range(1, 289)]
    for region in REGIONS:
        need(set(chosen[region]) == set(expected), 'Exactly 288 fixed-AEST calendar intervals')
        retained = next(m for m in acquisition['monthly'] if m['region'] == region)
        wire, specimen = retained['wire'], retained['retained']
        need(wire['url'] == 'https://www.aemo.com.au/aemo/data/nem/priceanddemand/PRICE_AND_DEMAND_202610_' + region + '.csv',
             'Exact independently presented official monthly URL')
        need(specimen['file'] == 'original/monthly-' + region + '-2026-10-20.csv' and specimen['rows'] == 288,
             'Exact minimal monthly specimen identity')
        monthly_bytes = (ROOT / specimen['file']).read_bytes()
        need(len(monthly_bytes) == specimen['bytes'] and sha256(monthly_bytes).hexdigest() == specimen['sha256'],
             'Minimal monthly original hash/size')
        reader = csv.DictReader(io.StringIO(monthly_bytes.decode('utf-8', errors='strict')), strict=True)
        need(reader.fieldnames == ['REGION', 'SETTLEMENTDATE', 'TOTALDEMAND', 'RRP', 'PERIODTYPE'],
             'Exact separate monthly presentation columns')
        monthly = {}
        for row in reader:
            need(row['REGION'] == region and row['PERIODTYPE'] == 'TRADE', 'Monthly exact geography and period type')
            ending = stamp(row['SETTLEMENTDATE'])
            need(ending not in monthly, 'Unique monthly interval')
            value = decimal(row['RRP'])
            need(value == round_cent(value), 'Monthly price is exact cent precision')
            monthly[ending] = value
        need(set(monthly) == set(expected), 'Separate monthly presentation has all 288 exact calendar intervals')
        for ending in expected:
            need(Decimal(chosen[region][ending]['rounded']) == monthly[ending],
                 'Zero-tolerance rounded daily vs separately presented monthly comparison')
        daily_summary = summary([decimal(chosen[region][ending]['raw']) for ending in expected])
        monthly_summary = summary([monthly[ending] for ending in expected])
        for statistic in ['mean', 'minimum', 'maximum', 'negative_count', 'zero_count']:
            need(Decimal(str(daily_summary[statistic])) == Decimal(str(monthly_summary[statistic])),
                 'Independent daily/monthly derived summary equality: ' + statistic)
        output.extend({'region': region, 'period_end': ending.isoformat(), **chosen[region][ending]} for ending in expected)
        summaries.append({'region': region, **daily_summary})
        inputs.append({key: specimen[key] for key in ['file', 'bytes', 'sha256']} |
                      {'source_url': wire['url'], 'wire_bytes': wire['bytes'], 'wire_sha256': wire['sha256'],
                       'requested_at': wire['requested_at'], 'retrieved_at': wire['retrieved_at'],
                       'presentation': 'Separate official monthly PRICE_AND_DEMAND table, shared AEMO market lineage'})
    return inputs, output, summaries

def controls():
    rows = []
    for raw, expected in [('0.00499', '0.00'), ('-0.00499', '-0.00'), ('0.005', '0.01'),
                          ('-0.005', '-0.01'), ('1.005', '1.01'), ('-1.005', '-1.01'),
                          ('3E-05', '0.00'), ('-3E-05', '-0.00')]:
        result = round_cent(decimal(raw))
        need(result == Decimal(expected), 'Half-away rounding control')
        rows.append({'raw': raw, 'rounded': str(result), 'negative_after_rounding': result < 0,
                     'zero_after_rounding': result == 0})
    need(summary([Decimal('-0.00499')] * 288)['negative_count'] == 0, 'Round before negative classification')
    need(summary([Decimal('.005')] * 144 + [Decimal(0)] * 144)['mean'] == '0.01',
         'Positive mean half-away tie')
    need(summary([Decimal('-.005')] * 144 + [Decimal(0)] * 144)['mean'] == '-0.01', 'Negative mean half-away tie')
    return rows

def main():
    need(len(sys.argv) == 2, 'FRESH_OUTPUT.json required; no date or file-selection override')
    rounding_controls = controls()
    inputs, observations, summaries = extract()
    report = {'pass': True, 'kind': 'Independent Python stdlib ZIP/CSV/Decimal full-original extraction',
              'verified_at': datetime.now(timezone.utc).isoformat(), 'input_files': inputs,
              'calendar_day': '2026-10-20', 'intervals_per_region': 288,
              'independently_extracted_intervals': len(observations), 'layout_numeric_agreement_count': len(observations),
              'exact_cent_comparisons': len(observations),
              'derived_summary_count': 10, 'tolerance_after_rounding': '0',
              'rounding': 'Per-interval cents ROUND_HALF_UP (half away from zero) before summaries and sign counts',
              'rounding_controls': rounding_controls, 'mean_tie_controls_pass': True,
              'round_before_sign_control_pass': True, 'summaries': summaries, 'observations': observations,
              'monthly_comparison': {'status': 'matched', 'count': len(observations)},
              'limits': ['Layouts 2/3 share the same AEMO publication and market lineage; they are not independent presentations.',
                         'The separately acquired monthly table and daily ZIP share AEMO market lineage, not independently produced prices.',
                         'No future-vintage, finality, runtime, Worker-resource, release, scheduled or delivery acceptance.'],
              'attribution': 'Australian Energy Market Operator (AEMO), NEMweb PUBLIC_PRICES; summaries calculated by Morning Rows.',
              'licence_url': 'https://www.aemo.com.au/privacy-and-legal-notices/copyright-permissions'}
    with Path(sys.argv[1]).open('x') as handle:
        json.dump(report, handle, indent=2)
        handle.write('\n')
    print(json.dumps({key: report[key] for key in ['pass', 'calendar_day', 'independently_extracted_intervals',
                                                   'layout_numeric_agreement_count', 'derived_summary_count', 'monthly_comparison']}))

if __name__ == '__main__':
    main()
