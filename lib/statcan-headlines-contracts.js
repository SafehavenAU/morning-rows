// Exact existing series pins from original publisher metadata. See verification/gap-pass-2026-10-20/statcan/CONTRACT.md.
export const STATCAN_HEADLINE_CONTRACTS = {
  "jobs": {
    "unit": "percent",
    "adjustment": "Seasonally adjusted",
    "population": "Civilian, non-institutionalized labour force aged 15 years and over, total gender; Canada excludes the territories.",
    "measure_name": "Unemployment rate",
    "definition": "Unemployed persons as a percentage of the labour force; not a claimant rate, population share or count.",
    "limitations": "Sampling estimates; Canada excludes the territories. Not recruitment availability. Seasonal estimates can be revised; no historical vintage archive.",
    "revision_policy": "Seasonally adjusted estimates can be revised annually and with revised inputs; symbol none does not establish finality.",
    "legacy_field": "rate",
    "statuses": [
      0
    ],
    "product_id": 14100287,
    "cube_title": "Labour force characteristics, monthly, seasonally adjusted and trend-cycle",
    "frequency_code": 6,
    "dimension_count": 6,
    "series": [
      {
        "id": "canada",
        "product_id": 14100287,
        "coordinate": "1.7.1.1.1.1.0.0.0.0",
        "vector_id": 2062815,
        "title": "Canada;Unemployment rate;Total - Gender;15 years and over;Estimate;Seasonally adjusted",
        "geography": "Canada",
        "frequency_code": 6,
        "scalar_code": 0,
        "decimals": 1,
        "unit_code": 239,
        "members": [
          {
            "position": 1,
            "name": "Geography",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Canada",
              "classificationCode": "11124",
              "classificationTypeCode": "1",
              "geoLevel": 0,
              "vintage": 2021,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 2,
            "name": "Labour force characteristics",
            "has_uom": true,
            "member": {
              "memberId": 7,
              "memberNameEn": "Unemployment rate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": 239
            }
          },
          {
            "position": 3,
            "name": "Gender",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Total - Gender",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 4,
            "name": "Age group",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "15 years and over",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 5,
            "name": "Statistics",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Estimate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 6,
            "name": "Data type",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Seasonally adjusted",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          }
        ]
      },
      {
        "id": "newfoundland_and_labrador",
        "product_id": 14100287,
        "coordinate": "2.7.1.1.1.1.0.0.0.0",
        "vector_id": 2063004,
        "title": "Newfoundland and Labrador;Unemployment rate;Total - Gender;15 years and over;Estimate;Seasonally adjusted",
        "geography": "Newfoundland and Labrador",
        "frequency_code": 6,
        "scalar_code": 0,
        "decimals": 1,
        "unit_code": 239,
        "members": [
          {
            "position": 1,
            "name": "Geography",
            "has_uom": false,
            "member": {
              "memberId": 2,
              "memberNameEn": "Newfoundland and Labrador",
              "classificationCode": "10",
              "classificationTypeCode": "1",
              "geoLevel": 2,
              "vintage": 2021,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 2,
            "name": "Labour force characteristics",
            "has_uom": true,
            "member": {
              "memberId": 7,
              "memberNameEn": "Unemployment rate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": 239
            }
          },
          {
            "position": 3,
            "name": "Gender",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Total - Gender",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 4,
            "name": "Age group",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "15 years and over",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 5,
            "name": "Statistics",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Estimate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 6,
            "name": "Data type",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Seasonally adjusted",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          }
        ]
      },
      {
        "id": "prince_edward_island",
        "product_id": 14100287,
        "coordinate": "3.7.1.1.1.1.0.0.0.0",
        "vector_id": 2063193,
        "title": "Prince Edward Island;Unemployment rate;Total - Gender;15 years and over;Estimate;Seasonally adjusted",
        "geography": "Prince Edward Island",
        "frequency_code": 6,
        "scalar_code": 0,
        "decimals": 1,
        "unit_code": 239,
        "members": [
          {
            "position": 1,
            "name": "Geography",
            "has_uom": false,
            "member": {
              "memberId": 3,
              "memberNameEn": "Prince Edward Island",
              "classificationCode": "11",
              "classificationTypeCode": "1",
              "geoLevel": 2,
              "vintage": 2021,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 2,
            "name": "Labour force characteristics",
            "has_uom": true,
            "member": {
              "memberId": 7,
              "memberNameEn": "Unemployment rate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": 239
            }
          },
          {
            "position": 3,
            "name": "Gender",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Total - Gender",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 4,
            "name": "Age group",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "15 years and over",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 5,
            "name": "Statistics",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Estimate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 6,
            "name": "Data type",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Seasonally adjusted",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          }
        ]
      },
      {
        "id": "nova_scotia",
        "product_id": 14100287,
        "coordinate": "4.7.1.1.1.1.0.0.0.0",
        "vector_id": 2063382,
        "title": "Nova Scotia;Unemployment rate;Total - Gender;15 years and over;Estimate;Seasonally adjusted",
        "geography": "Nova Scotia",
        "frequency_code": 6,
        "scalar_code": 0,
        "decimals": 1,
        "unit_code": 239,
        "members": [
          {
            "position": 1,
            "name": "Geography",
            "has_uom": false,
            "member": {
              "memberId": 4,
              "memberNameEn": "Nova Scotia",
              "classificationCode": "12",
              "classificationTypeCode": "1",
              "geoLevel": 2,
              "vintage": 2021,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 2,
            "name": "Labour force characteristics",
            "has_uom": true,
            "member": {
              "memberId": 7,
              "memberNameEn": "Unemployment rate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": 239
            }
          },
          {
            "position": 3,
            "name": "Gender",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Total - Gender",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 4,
            "name": "Age group",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "15 years and over",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 5,
            "name": "Statistics",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Estimate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 6,
            "name": "Data type",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Seasonally adjusted",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          }
        ]
      },
      {
        "id": "new_brunswick",
        "product_id": 14100287,
        "coordinate": "5.7.1.1.1.1.0.0.0.0",
        "vector_id": 2063571,
        "title": "New Brunswick;Unemployment rate;Total - Gender;15 years and over;Estimate;Seasonally adjusted",
        "geography": "New Brunswick",
        "frequency_code": 6,
        "scalar_code": 0,
        "decimals": 1,
        "unit_code": 239,
        "members": [
          {
            "position": 1,
            "name": "Geography",
            "has_uom": false,
            "member": {
              "memberId": 5,
              "memberNameEn": "New Brunswick",
              "classificationCode": "13",
              "classificationTypeCode": "1",
              "geoLevel": 2,
              "vintage": 2021,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 2,
            "name": "Labour force characteristics",
            "has_uom": true,
            "member": {
              "memberId": 7,
              "memberNameEn": "Unemployment rate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": 239
            }
          },
          {
            "position": 3,
            "name": "Gender",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Total - Gender",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 4,
            "name": "Age group",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "15 years and over",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 5,
            "name": "Statistics",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Estimate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 6,
            "name": "Data type",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Seasonally adjusted",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          }
        ]
      },
      {
        "id": "quebec",
        "product_id": 14100287,
        "coordinate": "6.7.1.1.1.1.0.0.0.0",
        "vector_id": 2063760,
        "title": "Quebec;Unemployment rate;Total - Gender;15 years and over;Estimate;Seasonally adjusted",
        "geography": "Quebec",
        "frequency_code": 6,
        "scalar_code": 0,
        "decimals": 1,
        "unit_code": 239,
        "members": [
          {
            "position": 1,
            "name": "Geography",
            "has_uom": false,
            "member": {
              "memberId": 6,
              "memberNameEn": "Quebec",
              "classificationCode": "24",
              "classificationTypeCode": "1",
              "geoLevel": 2,
              "vintage": 2021,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 2,
            "name": "Labour force characteristics",
            "has_uom": true,
            "member": {
              "memberId": 7,
              "memberNameEn": "Unemployment rate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": 239
            }
          },
          {
            "position": 3,
            "name": "Gender",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Total - Gender",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 4,
            "name": "Age group",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "15 years and over",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 5,
            "name": "Statistics",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Estimate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 6,
            "name": "Data type",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Seasonally adjusted",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          }
        ]
      },
      {
        "id": "ontario",
        "product_id": 14100287,
        "coordinate": "7.7.1.1.1.1.0.0.0.0",
        "vector_id": 2063949,
        "title": "Ontario;Unemployment rate;Total - Gender;15 years and over;Estimate;Seasonally adjusted",
        "geography": "Ontario",
        "frequency_code": 6,
        "scalar_code": 0,
        "decimals": 1,
        "unit_code": 239,
        "members": [
          {
            "position": 1,
            "name": "Geography",
            "has_uom": false,
            "member": {
              "memberId": 7,
              "memberNameEn": "Ontario",
              "classificationCode": "35",
              "classificationTypeCode": "1",
              "geoLevel": 2,
              "vintage": 2021,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 2,
            "name": "Labour force characteristics",
            "has_uom": true,
            "member": {
              "memberId": 7,
              "memberNameEn": "Unemployment rate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": 239
            }
          },
          {
            "position": 3,
            "name": "Gender",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Total - Gender",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 4,
            "name": "Age group",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "15 years and over",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 5,
            "name": "Statistics",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Estimate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 6,
            "name": "Data type",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Seasonally adjusted",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          }
        ]
      },
      {
        "id": "manitoba",
        "product_id": 14100287,
        "coordinate": "8.7.1.1.1.1.0.0.0.0",
        "vector_id": 2064138,
        "title": "Manitoba;Unemployment rate;Total - Gender;15 years and over;Estimate;Seasonally adjusted",
        "geography": "Manitoba",
        "frequency_code": 6,
        "scalar_code": 0,
        "decimals": 1,
        "unit_code": 239,
        "members": [
          {
            "position": 1,
            "name": "Geography",
            "has_uom": false,
            "member": {
              "memberId": 8,
              "memberNameEn": "Manitoba",
              "classificationCode": "46",
              "classificationTypeCode": "1",
              "geoLevel": 2,
              "vintage": 2021,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 2,
            "name": "Labour force characteristics",
            "has_uom": true,
            "member": {
              "memberId": 7,
              "memberNameEn": "Unemployment rate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": 239
            }
          },
          {
            "position": 3,
            "name": "Gender",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Total - Gender",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 4,
            "name": "Age group",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "15 years and over",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 5,
            "name": "Statistics",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Estimate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 6,
            "name": "Data type",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Seasonally adjusted",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          }
        ]
      },
      {
        "id": "saskatchewan",
        "product_id": 14100287,
        "coordinate": "9.7.1.1.1.1.0.0.0.0",
        "vector_id": 2064327,
        "title": "Saskatchewan;Unemployment rate;Total - Gender;15 years and over;Estimate;Seasonally adjusted",
        "geography": "Saskatchewan",
        "frequency_code": 6,
        "scalar_code": 0,
        "decimals": 1,
        "unit_code": 239,
        "members": [
          {
            "position": 1,
            "name": "Geography",
            "has_uom": false,
            "member": {
              "memberId": 9,
              "memberNameEn": "Saskatchewan",
              "classificationCode": "47",
              "classificationTypeCode": "1",
              "geoLevel": 2,
              "vintage": 2021,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 2,
            "name": "Labour force characteristics",
            "has_uom": true,
            "member": {
              "memberId": 7,
              "memberNameEn": "Unemployment rate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": 239
            }
          },
          {
            "position": 3,
            "name": "Gender",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Total - Gender",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 4,
            "name": "Age group",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "15 years and over",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 5,
            "name": "Statistics",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Estimate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 6,
            "name": "Data type",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Seasonally adjusted",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          }
        ]
      },
      {
        "id": "alberta",
        "product_id": 14100287,
        "coordinate": "10.7.1.1.1.1.0.0.0.0",
        "vector_id": 2064516,
        "title": "Alberta;Unemployment rate;Total - Gender;15 years and over;Estimate;Seasonally adjusted",
        "geography": "Alberta",
        "frequency_code": 6,
        "scalar_code": 0,
        "decimals": 1,
        "unit_code": 239,
        "members": [
          {
            "position": 1,
            "name": "Geography",
            "has_uom": false,
            "member": {
              "memberId": 10,
              "memberNameEn": "Alberta",
              "classificationCode": "48",
              "classificationTypeCode": "1",
              "geoLevel": 2,
              "vintage": 2021,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 2,
            "name": "Labour force characteristics",
            "has_uom": true,
            "member": {
              "memberId": 7,
              "memberNameEn": "Unemployment rate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": 239
            }
          },
          {
            "position": 3,
            "name": "Gender",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Total - Gender",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 4,
            "name": "Age group",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "15 years and over",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 5,
            "name": "Statistics",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Estimate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 6,
            "name": "Data type",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Seasonally adjusted",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          }
        ]
      },
      {
        "id": "british_columbia",
        "product_id": 14100287,
        "coordinate": "11.7.1.1.1.1.0.0.0.0",
        "vector_id": 2064705,
        "title": "British Columbia;Unemployment rate;Total - Gender;15 years and over;Estimate;Seasonally adjusted",
        "geography": "British Columbia",
        "frequency_code": 6,
        "scalar_code": 0,
        "decimals": 1,
        "unit_code": 239,
        "members": [
          {
            "position": 1,
            "name": "Geography",
            "has_uom": false,
            "member": {
              "memberId": 11,
              "memberNameEn": "British Columbia",
              "classificationCode": "59",
              "classificationTypeCode": "1",
              "geoLevel": 2,
              "vintage": 2021,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 2,
            "name": "Labour force characteristics",
            "has_uom": true,
            "member": {
              "memberId": 7,
              "memberNameEn": "Unemployment rate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": 239
            }
          },
          {
            "position": 3,
            "name": "Gender",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Total - Gender",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 4,
            "name": "Age group",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "15 years and over",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 5,
            "name": "Statistics",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Estimate",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 6,
            "name": "Data type",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Seasonally adjusted",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          }
        ]
      }
    ]
  },
  "price_index": {
    "unit": "index (2002=100)",
    "adjustment": "Not seasonally adjusted",
    "population": "Canada all-items consumer basket; representative goods and services purchased by Canadian households.",
    "measure_name": "All-items Consumer Price Index",
    "definition": "Canada all-items fixed-basket consumer price index, 2002=100; not an inflation percentage or a cost-of-living index.",
    "limitations": "Index level, not a price, annual inflation rate or cost-of-living index. No derived change or historical coverage.",
    "revision_policy": "Preserve publisher corrections and changed release metadata; basket updates do not silently authorize rebasing the index.",
    "legacy_field": "index",
    "statuses": [
      0
    ],
    "product_id": 18100004,
    "cube_title": "Consumer Price Index, monthly, not seasonally adjusted",
    "frequency_code": 6,
    "dimension_count": 2,
    "series": [
      {
        "id": "index",
        "product_id": 18100004,
        "coordinate": "2.2.0.0.0.0.0.0.0.0",
        "vector_id": 41690973,
        "title": "Canada;All-items",
        "geography": "Canada",
        "frequency_code": 6,
        "scalar_code": 0,
        "decimals": 1,
        "unit_code": 17,
        "members": [
          {
            "position": 1,
            "name": "Geography",
            "has_uom": false,
            "member": {
              "memberId": 2,
              "memberNameEn": "Canada",
              "classificationCode": "11124",
              "classificationTypeCode": "1",
              "geoLevel": 0,
              "vintage": 2016,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 2,
            "name": "Products and product groups",
            "has_uom": true,
            "member": {
              "memberId": 2,
              "memberNameEn": "All-items",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": 17
            }
          }
        ]
      }
    ]
  },
  "shop": {
    "unit": "thousands of Canadian dollars",
    "adjustment": "Seasonally adjusted",
    "population": "Canada retail trade, NAICS 44-45; total retail sales.",
    "measure_name": "Total retail sales",
    "definition": "Total Canadian retail sales at current dollar value, seasonally adjusted, in thousands of Canadian dollars; not constant-price sales volume.",
    "limitations": "Reported value is already in thousands; do not multiply into a second thousands scale. Quality grades and revisions remain explicit. The latest retail release may be preliminary even when WDS reports symbol none; symbol none does not establish finality.",
    "revision_policy": "Monthly estimates can be revised as survey inputs and seasonal factors are updated; preserve quality and revision flags.",
    "legacy_field": "thousand_dollars",
    "statuses": [
      0,
      3,
      4,
      5,
      6,
      7
    ],
    "product_id": 20100056,
    "cube_title": "Monthly retail trade sales by province and territory",
    "frequency_code": 6,
    "dimension_count": 4,
    "series": [
      {
        "id": "total_retail_sales",
        "product_id": 20100056,
        "coordinate": "1.1.1.2.0.0.0.0.0.0",
        "vector_id": 1446859483,
        "title": "Canada;Retail trade;Total retail sales;Seasonally adjusted",
        "geography": "Canada",
        "frequency_code": 6,
        "scalar_code": 3,
        "decimals": 0,
        "unit_code": 81,
        "members": [
          {
            "position": 1,
            "name": "Geography",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Canada",
              "classificationCode": "11124",
              "classificationTypeCode": "1",
              "geoLevel": 0,
              "vintage": 2021,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 2,
            "name": "North American Industry Classification System (NAICS)",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Retail trade",
              "classificationCode": "44-45",
              "classificationTypeCode": "74",
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 3,
            "name": "Sales",
            "has_uom": true,
            "member": {
              "memberId": 1,
              "memberNameEn": "Total retail sales",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": 81
            }
          },
          {
            "position": 4,
            "name": "Adjustments",
            "has_uom": false,
            "member": {
              "memberId": 2,
              "memberNameEn": "Seasonally adjusted",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          }
        ]
      }
    ]
  },
  "homes": {
    "unit": "dwellings",
    "adjustment": "Not specified by the selected publisher metadata",
    "population": "Total dwelling units started in Canadian centres with populations of 10,000 and over; excludes smaller centres.",
    "measure_name": "Housing starts in centres of 10,000 and over",
    "definition": "Reported quarterly housing starts, total units, in Canadian centres of 10,000 and over; not a monthly or all-centres estimate. No seasonal-adjustment interpretation is supplied by the selected metadata.",
    "limitations": "Geographic boundaries change with census definitions, limiting historical comparability. Covers centres of 10,000 and over only. CMHC data reuse terms apply.",
    "revision_policy": "Current and earlier figures can be corrected or revised; CMHC corrected and reissued September/Q3 2023 data. No historical vintage archive.",
    "legacy_field": "starts",
    "statuses": [
      0
    ],
    "product_id": 34100136,
    "cube_title": "Canada Mortgage and Housing Corporation, housing starts, under construction and completions in all centres of 10,000 and over for Canada and provinces",
    "frequency_code": 9,
    "dimension_count": 3,
    "series": [
      {
        "id": "starts",
        "product_id": 34100136,
        "coordinate": "1.1.1.0.0.0.0.0.0.0",
        "vector_id": 15817836,
        "title": "Canada;Housing starts;Total units",
        "geography": "Canada",
        "frequency_code": 9,
        "scalar_code": 0,
        "decimals": 0,
        "unit_code": 300,
        "members": [
          {
            "position": 1,
            "name": "Geography",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Canada",
              "classificationCode": "11124",
              "classificationTypeCode": "1",
              "geoLevel": 0,
              "vintage": 2016,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 2,
            "name": "Housing estimates",
            "has_uom": false,
            "member": {
              "memberId": 1,
              "memberNameEn": "Housing starts",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": null
            }
          },
          {
            "position": 3,
            "name": "Type of unit",
            "has_uom": true,
            "member": {
              "memberId": 1,
              "memberNameEn": "Total units",
              "classificationCode": null,
              "classificationTypeCode": null,
              "geoLevel": null,
              "vintage": null,
              "terminated": 0,
              "memberUomCode": 300
            }
          }
        ]
      }
    ]
  }
};
