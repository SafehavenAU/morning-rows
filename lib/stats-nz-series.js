// Series codes and period labels verified against Stats NZ SDMX structures on 2026-10-17.
// These are metadata, not stored statistical observations.
export const STATS_NZ_SERIES = [
  {
    "id": "AGR_AGR_001",
    "name": "New forest area planted",
    "unit": "hectares",
    "geography": "New Zealand",
    "key": "6050.20.",
    "dimensions": {
      "FORESTRY_AGR_AGR_001": {
        "code": "6050",
        "label": "Total new area planted (hectares)"
      },
      "AREA_AGR_AGR_001": {
        "code": "20",
        "label": "Total New Zealand"
      }
    },
    "period_column": "YEAR_AGR_AGR_001",
    "period_labels": {
      "2002": "For year ended 31 December 2001",
      "2003": "For year ended 31 December 2002",
      "2004": "For year ended 31 December 2003",
      "2005": "For year ended 31 March 2005",
      "2006": "For year ended 31 March 2006",
      "2007": "For year ended 31 March 2007",
      "2008": "For year ended 31 March 2008",
      "2009": "For year ended 31 March 2009",
      "2010": "For year ended 31 March 2010",
      "2011": "For year ended 31 March 2011",
      "2012": "For year ended 31 March 2012",
      "2013": "For year ended 31 March 2013",
      "2014": "For year ended 31 March 2014",
      "2015": "For year ended 31 March 2015",
      "2016": "For year ended 31 March 2016",
      "2017": "For year ended 31 March 2017",
      "2018": "For year ended 31 March 2018",
      "2019": "For year ended 31 March 2019",
      "2020": "For year ended 31 March 2020"
    },
    "kind": "observation"
  },
  {
    "id": "AGR_AGR_002",
    "name": "Apple growing area",
    "unit": "hectares",
    "geography": "New Zealand",
    "key": "8500.20.",
    "dimensions": {
      "HORTICULTURE_AGR_AGR_002": {
        "code": "8500",
        "label": "Total apples (hectares)"
      },
      "AREA_AGR_AGR_002": {
        "code": "20",
        "label": "Total New Zealand"
      }
    },
    "period_column": "YEAR_AGR_AGR_002",
    "period_labels": {
      "1994": "As at June 30 1994",
      "2002": "As at June 30 2002",
      "2003": "As at June 30 2003",
      "2005": "As at June 30 2005",
      "2007": "As at June 30 2007",
      "2009": "As at June 30 2009",
      "2011": "As at June 30 2011",
      "2012": "As at June 30 2012",
      "2013": "As at June 30 2013",
      "2014": "As at June 30 2014",
      "2015": "As at June 30 2015",
      "2016": "As at June 30 2016",
      "2017": "As at June 30 2017",
      "2018": "As at June 30 2018",
      "2019": "As at June 30 2019",
      "2020": "As at June 30 2020",
      "2021": "As at June 30 2021",
      "2022": "As at June 30 2022",
      "2023": "As at June 30 2023",
      "2024": "As at June 30 2024",
      "2025": "As at June 30 2025"
    },
    "kind": "observation"
  },
  {
    "id": "AGR_AGR_003",
    "name": "Total sheep",
    "unit": "animals",
    "geography": "New Zealand",
    "key": "6731.20.",
    "dimensions": {
      "LIVESTOCK_AGR_AGR_003": {
        "code": "6731",
        "label": "Total sheep"
      },
      "AREA_AGR_AGR_003": {
        "code": "20",
        "label": "Total New Zealand"
      }
    },
    "period_column": "YEAR_AGR_AGR_003",
    "period_labels": {
      "1994": "As at June 30 1994",
      "2002": "As at June 30 2002",
      "2003": "As at June 30 2003",
      "2004": "As at June 30 2004",
      "2005": "As at June 30 2005",
      "2006": "As at June 30 2006",
      "2007": "As at June 30 2007",
      "2008": "As at June 30 2008",
      "2009": "As at June 30 2009",
      "2010": "As at June 30 2010",
      "2011": "As at June 30 2011",
      "2012": "As at June 30 2012",
      "2013": "As at June 30 2013",
      "2014": "As at June 30 2014",
      "2015": "As at June 30 2015",
      "2016": "As at June 30 2016",
      "2017": "As at June 30 2017",
      "2018": "As at June 30 2018",
      "2019": "As at June 30 2019",
      "2020": "As at June 30 2020",
      "2021": "As at June 30 2021",
      "2022": "As at June 30 2022",
      "2023": "As at June 30 2023",
      "2024": "As at June 30 2024",
      "2025": "As at June 30 2025",
      "2026": "As at June 30 2026",
      "2027": "As at June 30 2027",
      "2028": "As at June 30 2028",
      "2029": "As at June 30 2029",
      "2030": "As at June 30 2030"
    },
    "kind": "observation"
  },
  {
    "id": "BDS_BDS_004",
    "name": "Enterprises, all industries",
    "unit": "enterprises",
    "geography": "New Zealand",
    "key": "TOTAL..ENT_COUNT",
    "dimensions": {
      "ANZSIC06_BDS_BDS_004": {
        "code": "TOTAL",
        "label": "Total Industry"
      },
      "MEASURE_BDS_BDS_004": {
        "code": "ENT_COUNT",
        "label": "Enterprises"
      }
    },
    "period_column": "YEAR_BDS_BDS_004",
    "period_labels": {
      "2000": "2000",
      "2001": "2001",
      "2002": "2002",
      "2003": "2003",
      "2004": "2004",
      "2005": "2005",
      "2006": "2006",
      "2007": "2007",
      "2008": "2008",
      "2009": "2009",
      "2010": "2010",
      "2011": "2011",
      "2012": "2012",
      "2013": "2013",
      "2014": "2014",
      "2015": "2015",
      "2016": "2016",
      "2017": "2017",
      "2018": "2018",
      "2019": "2019",
      "2020": "2020",
      "2021": "2021",
      "2022": "2022",
      "2023": "2023",
      "2024": "2024",
      "2025": "2025"
    },
    "kind": "observation"
  },
  {
    "id": "CORR_FIS_005",
    "period_convention": "Fiscal year ended 30 June; 2025 means 2024/25. A calendar-year release is not a replacement for this selected fiscal series.",
    "publication_status": "Stats NZ announced on 11 September 2026 that fiscal-year prison releases are discontinued; calendar-year releases continue. The last fiscal observation may legitimately remain unchanged.",
    "name": "Sentenced prisoners, all offences and demographic groups",
    "unit": "people",
    "geography": "New Zealand",
    "key": ".X.X.X.X.X",
    "dimensions": {
      "OFFENCE_CORR_FIS_005": {
        "code": "X",
        "label": "Total offence"
      },
      "SEX_CORR_FIS_005": {
        "code": "X",
        "label": "Total sex"
      },
      "ETHNICITY_CORR_FIS_005": {
        "code": "X",
        "label": "Total ethnicity"
      },
      "DURATION_CORR_FIS_005": {
        "code": "X",
        "label": "Total duration"
      },
      "AGE_CORR_FIS_005": {
        "code": "X",
        "label": "Total age"
      }
    },
    "period_column": "YEAR_CORR_FIS_005",
    "period_labels": {
      "1999": "1998/1999",
      "2000": "1999/2000",
      "2001": "2000/2001",
      "2002": "2001/2002",
      "2003": "2002/2003",
      "2004": "2003/2004",
      "2005": "2004/2005",
      "2006": "2005/2006",
      "2007": "2006/2007",
      "2008": "2007/2008",
      "2009": "2008/2009",
      "2010": "2009/2010",
      "2011": "2010/2011",
      "2012": "2011/2012",
      "2013": "2012/2013",
      "2014": "2013/2014",
      "2015": "2014/2015",
      "2016": "2015/2016",
      "2017": "2016/2017",
      "2018": "2017/2018",
      "2019": "2018/2019",
      "2020": "2019/2020",
      "2021": "2020/2021",
      "2022": "2021/2022",
      "2023": "2022/2023",
      "2024": "2023/2024",
      "2025": "2024/2025"
    },
    "kind": "observation"
  },
  {
    "id": "HES_HES_001",
    "name": "Average weekly household expenditure, total",
    "unit": "NZD per week",
    "geography": "New Zealand",
    "key": ".98.AV_WKLY_AMT",
    "dimensions": {
      "NZHEC_LEV_HES_HES_001": {
        "code": "98",
        "label": "Total"
      },
      "MEASURE_HES_HES_001": {
        "code": "AV_WKLY_AMT",
        "label": "Average weekly household expenditure"
      }
    },
    "period_column": "YEAR_HES_HES_001",
    "period_labels": {
      "2007": "2007",
      "2010": "2010",
      "2013": "2013",
      "2016": "2016",
      "2019": "2019",
      "2023": "2023"
    },
    "kind": "observation"
  },
  {
    "id": "INC_INC_001",
    "name": "Median weekly earnings from paid employment, all groups",
    "population_group": "People in paid employment (wages and salaries and/or self-employment) within the HLFS income survey population: non-institutionalised people aged 15 years and over who usually live in New Zealand. Total selected ethnic groups, regions, sexes and ages.",
    "period_convention": "June-quarter weekly-income snapshot collected during April–June; self-employment questions cover the preceding 12 months. Not annual earnings.",
    "limitations": "Paid-employment earnings are not interchangeable with the wages-and-salaries-only headline or household income. Do not multiply the weekly snapshot by 52 to imply annual earnings.",
    "unit": "NZD per week",
    "geography": "New Zealand",
    "key": ".98.98.98.98.MED_WEEK_INC",
    "dimensions": {
      "ETHGP_INC_INC_001": {
        "code": "98",
        "label": "Total Ethnic Groups"
      },
      "LGR_INC_INC_001": {
        "code": "98",
        "label": "Total Regions"
      },
      "SEX_INC_INC_001": {
        "code": "98",
        "label": "Total Both Sexes"
      },
      "AGEGP_INC_INC_001": {
        "code": "98",
        "label": "Total Age Groups"
      },
      "MEASURE_INC_INC_001": {
        "code": "MED_WEEK_INC",
        "label": "Median Weekly Earnings"
      }
    },
    "period_column": "PERIOD_INC_INC_001",
    "period_labels": {
      "199806": "1998",
      "199906": "1999",
      "200006": "2000",
      "200106": "2001",
      "200206": "2002",
      "200306": "2003",
      "200406": "2004",
      "200506": "2005",
      "200606": "2006",
      "200706": "2007",
      "200806": "2008",
      "200906": "2009",
      "201006": "2010",
      "201106": "2011",
      "201206": "2012",
      "201306": "2013",
      "201406": "2014",
      "201506": "2015",
      "201606": "2016",
      "201706": "2017",
      "201806": "2018",
      "201906": "2019",
      "202006": "2020",
      "202106": "2021",
      "202206": "2022",
      "202306": "2023",
      "202406": "2024",
      "202506": "2025",
      "202606": "2026"
    },
    "kind": "observation"
  },
  {
    "id": "INC_INC_010",
    "name": "Gender pay gap, all ages",
    "unit": "percent",
    "geography": "New Zealand",
    "key": ".98.MEDIAN_PAY_GAP",
    "dimensions": {
      "AGEGP_INC_INC_010": {
        "code": "98",
        "label": "Total Age Groups"
      },
      "MEASURE_INC_INC_010": {
        "code": "MEDIAN_PAY_GAP",
        "label": "Gender pay gap based on median hourly earnings (percent)"
      }
    },
    "period_column": "PERIOD_INC_INC_010",
    "period_labels": {
      "199806": "1998",
      "199906": "1999",
      "200006": "2000",
      "200106": "2001",
      "200206": "2002",
      "200306": "2003",
      "200406": "2004",
      "200506": "2005",
      "200606": "2006",
      "200706": "2007",
      "200806": "2008",
      "200906": "2009",
      "201006": "2010",
      "201106": "2011",
      "201206": "2012",
      "201306": "2013",
      "201406": "2014",
      "201506": "2015",
      "201606": "2016",
      "201706": "2017",
      "201806": "2018",
      "201906": "2019",
      "202006": "2020",
      "202106": "2021",
      "202206": "2022",
      "202306": "2023",
      "202406": "2024",
      "202506": "2025",
      "202606": "2026"
    },
    "kind": "observation"
  },
  {
    "id": "INC_INC_011",
    "population_group": "Survey households with at least one member aged 18–64; households with all members outside those ages are excluded, including all-65+ households. Total regions and household types within that population.",
    "period_convention": "June-quarter weekly-income snapshot collected during April–June; some components such as self-employment use the preceding 12 months. Not annual household income.",
    "limitations": "Weekly snapshot values must not be multiplied by 52 to imply an annual household-income estimate. The selected household population differs from all New Zealand households.",
    "name": "Median household income from all sources, all regions and household types",
    "unit": "NZD per week",
    "geography": "New Zealand",
    "key": ".98.98.MED_INC_ALL_SOUR",
    "dimensions": {
      "LGR_INC_INC_011": {
        "code": "98",
        "label": "Total Regions"
      },
      "HHTYPE_INC_INC_011": {
        "code": "98",
        "label": "Total Household Type"
      },
      "MEASURE_INC_INC_011": {
        "code": "MED_INC_ALL_SOUR",
        "label": "Median Income from All Sources collected"
      }
    },
    "period_column": "PERIOD_INC_INC_011",
    "period_labels": {
      "199806": "1998",
      "199906": "1999",
      "200006": "2000",
      "200106": "2001",
      "200206": "2002",
      "200306": "2003",
      "200406": "2004",
      "200506": "2005",
      "200606": "2006",
      "200706": "2007",
      "200806": "2008",
      "200906": "2009",
      "201006": "2010",
      "201106": "2011",
      "201206": "2012",
      "201306": "2013",
      "201406": "2014",
      "201506": "2015",
      "201606": "2016",
      "201706": "2017",
      "201806": "2018",
      "201906": "2019",
      "202006": "2020",
      "202106": "2021",
      "202206": "2022",
      "202306": "2023",
      "202406": "2024",
      "202506": "2025",
      "202606": "2026"
    },
    "kind": "observation"
  },
  {
    "id": "INJ_INJ_001",
    "name": "Fatal and serious non-fatal injuries, all groups",
    "unit": "injuries",
    "geography": "New Zealand",
    "key": "1.1.1..1.1",
    "dimensions": {
      "SEVERITY_INJ_INJ_001": {
        "code": "1",
        "label": "Total fatal and serious non fatal injuries"
      },
      "SEX_INJ_INJ_001": {
        "code": "1",
        "label": "Total both sexes"
      },
      "ETHNIC_INJ_INJ_001": {
        "code": "1",
        "label": "Total all ethnic groups"
      },
      "AGE_INJ_INJ_001": {
        "code": "1",
        "label": "Total all ages"
      },
      "INJURY_INJ_INJ_001": {
        "code": "1",
        "label": "Total all injuries"
      }
    },
    "period_column": "YEAR_INJ_INJ_001",
    "period_labels": {
      "2000": "2000",
      "2001": "2001",
      "2002": "2002",
      "2003": "2003",
      "2004": "2004",
      "2005": "2005",
      "2006": "2006",
      "2007": "2007",
      "2008": "2008",
      "2009": "2009",
      "2010": "2010",
      "2011": "2011",
      "2012": "2012",
      "2013": "2013",
      "2014": "2014",
      "2015": "2015",
      "2016": "2016",
      "2017": "2017",
      "2018": "2018",
      "2019": "2019",
      "2020": "2020",
      "2021": "2021",
      "2022": "2022",
      "2023": "2023",
      "2024": "2024"
    },
    "kind": "observation"
  },
  {
    "id": "IWI18_GRP_001",
    "name": "Ngai Tahu Whanui iwi grouping, Maori descent usually resident population",
    "unit": "estimated people",
    "geography": "New Zealand",
    "key": "03",
    "dimensions": {
      "IWI_IWI18_GRP_001": {
        "code": "03",
        "label": "Ngai Tahu Whanui"
      }
    },
    "period_column": null,
    "period_labels": {},
    "reference_period": "2018",
    "population_group": "Ngai Tahu Whanui iwi grouping",
    "kind": "observation"
  },
  {
    "id": "JUS_FIS_001",
    "period_convention": "Fiscal year ended 30 June; 2025 means 2024/25. Calendar-year observations cannot silently replace this series.",
    "publication_status": "Stats NZ announced on 11 September 2026 that fiscal-year criminal-conviction and sentencing releases are discontinued; calendar-year releases continue.",
    "name": "Adults convicted, all regions and groups",
    "unit": "people",
    "geography": "New Zealand",
    "key": "T.00.T.T.T.T.",
    "dimensions": {
      "COURT_CLUSTER_JUS_FIS_001": {
        "code": "T",
        "label": "Total Regions"
      },
      "MAIN_OFFENCE_JUS_FIS_001": {
        "code": "00",
        "label": "Total offences"
      },
      "AGE_GROUP_JUS_FIS_001": {
        "code": "T",
        "label": "Total Age"
      },
      "GENDER_JUS_FIS_001": {
        "code": "T",
        "label": "Total Gender"
      },
      "ETHNICITY_JUS_FIS_001": {
        "code": "T",
        "label": "Total Ethnicity"
      },
      "SENTENCE_JUS_FIS_001": {
        "code": "T",
        "label": "Total sentences"
      }
    },
    "period_column": "YEAR_JUS_FIS_001",
    "period_labels": {
      "1981": "1980/1981",
      "1982": "1981/1982",
      "1983": "1982/1983",
      "1984": "1983/1984",
      "1985": "1984/1985",
      "1986": "1985/1986",
      "1987": "1986/1987",
      "1988": "1987/1988",
      "1989": "1988/1989",
      "1990": "1989/1990",
      "1991": "1990/1991",
      "1992": "1991/1992",
      "1993": "1992/1993",
      "1994": "1993/1994",
      "1995": "1994/1995",
      "1996": "1995/1996",
      "1997": "1996/1997",
      "1998": "1997/1998",
      "1999": "1998/1999",
      "2000": "1999/2000",
      "2001": "2000/2001",
      "2002": "2001/2002",
      "2003": "2002/2003",
      "2004": "2003/2004",
      "2005": "2004/2005",
      "2006": "2005/2006",
      "2007": "2006/2007",
      "2008": "2007/2008",
      "2009": "2008/2009",
      "2010": "2009/2010",
      "2011": "2010/2011",
      "2012": "2011/2012",
      "2013": "2012/2013",
      "2014": "2013/2014",
      "2015": "2014/2015",
      "2016": "2015/2016",
      "2017": "2016/2017",
      "2018": "2017/2018",
      "2019": "2018/2019",
      "2020": "2019/2020",
      "2021": "2020/2021",
      "2022": "2021/2022",
      "2023": "2022/2023",
      "2024": "2023/2024",
      "2025": "2024/2025"
    },
    "kind": "observation"
  },
  {
    "id": "LEED_AP1_001",
    "name": "People with taxable income, all groups",
    "population_group": "People aged 15 years and over at the start of the tax year, with a valid IRD identifier and non-zero covered taxable income. Covered sources include employment, self-employment and specified transfers; not all residents or all possible income sources.",
    "period_convention": "Tax year ended 31 March: 1 April of the preceding year through 31 March of the labelled year. People counted over the year, not a quarterly job snapshot.",
    "limitations": "Covered taxable income excludes some income sources, including rental and investment income. The latest annual year is provisional until the next annual release; empty source attributes do not establish final status. The two annual numerical reference cells remain independently unverified.",
    "unit": "people",
    "geography": "New Zealand",
    "key": ".IZ.AZ.XZ.RZ",
    "dimensions": {
      "INCOME_SOURCE_LEED_AP1_001": {
        "code": "IZ",
        "label": "Total people"
      },
      "AGE_LEED_AP1_001": {
        "code": "AZ",
        "label": "Total age"
      },
      "SEX_LEED_AP1_001": {
        "code": "XZ",
        "label": "Total sex"
      },
      "REGION_LEED_AP1_001": {
        "code": "RZ",
        "label": "Total region"
      }
    },
    "period_column": "TAX_YEAR_NBR_LEED_AP1_001",
    "period_labels": {
      "2030": "2030",
      "2029": "2029",
      "2028": "2028",
      "2027": "2027",
      "2026": "2026",
      "2025": "2025",
      "2024": "2024",
      "2023": "2023",
      "2022": "2022",
      "2021": "2021",
      "2020": "2020",
      "2019": "2019",
      "2018": "2018",
      "2017": "2017",
      "2016": "2016",
      "2015": "2015",
      "2014": "2014",
      "2013": "2013",
      "2012": "2012",
      "2011": "2011",
      "2010": "2010",
      "2009": "2009",
      "2008": "2008",
      "2007": "2007",
      "2006": "2006",
      "2005": "2005",
      "2004": "2004",
      "2003": "2003",
      "2002": "2002",
      "2001": "2001",
      "2000": "2000"
    },
    "kind": "observation"
  },
  {
    "id": "LEED_AP1_002",
    "name": "Median annual earnings, total earnings and all groups",
    "population_group": "People aged 15 years and over at the start of the tax year whose main annual earnings source was wages and salaries or self-employment; valid IRD identifier and non-zero covered income.",
    "period_convention": "Tax year ended 31 March: 1 April of the preceding year through 31 March of the labelled year. Gross annual earnings across all jobs, not a full-year-worker requirement.",
    "limitations": "Total earnings combine wages and salaries with self-employment, including negative self-employment; not all taxable income or wages alone. The latest annual year is provisional until the next annual release; empty source attributes do not establish final status. This annual numerical reference cell remains independently unverified.",
    "unit": "NZD per year",
    "geography": "New Zealand",
    "key": ".IZ.AZ.XZ.RZ",
    "dimensions": {
      "INCOME_SOURCE_LEED_AP1_002": {
        "code": "IZ",
        "label": "Total earnings"
      },
      "AGE_LEED_AP1_002": {
        "code": "AZ",
        "label": "Total age"
      },
      "SEX_LEED_AP1_002": {
        "code": "XZ",
        "label": "Total sex"
      },
      "REGION_LEED_AP1_002": {
        "code": "RZ",
        "label": "Total region"
      }
    },
    "period_column": "TAX_YEAR_NBR_LEED_AP1_002",
    "period_labels": {
      "2030": "2030",
      "2029": "2029",
      "2028": "2028",
      "2027": "2027",
      "2026": "2026",
      "2025": "2025",
      "2024": "2024",
      "2023": "2023",
      "2022": "2022",
      "2021": "2021",
      "2020": "2020",
      "2019": "2019",
      "2018": "2018",
      "2017": "2017",
      "2016": "2016",
      "2015": "2015",
      "2014": "2014",
      "2013": "2013",
      "2012": "2012",
      "2011": "2011",
      "2010": "2010",
      "2009": "2009",
      "2008": "2008",
      "2007": "2007",
      "2006": "2006",
      "2005": "2005",
      "2004": "2004",
      "2003": "2003",
      "2002": "2002",
      "2001": "2001",
      "2000": "2000"
    },
    "kind": "observation"
  },
  {
    "id": "LEED_Q1W_001",
    "name": "Median earnings of full-quarter jobs, all ages",
    "population_group": "Full-quarter PAYE jobs: employer–employee pairs for people aged 15 years and over with valid IRD identifiers, continuous throughout the reference quarter. Social-assistance payments are excluded; some working proprietors taxed at source cannot be separated.",
    "period_convention": "Calendar quarter identified by its ending month; 202506 covers 1 April–30 June 2025. Gross earnings include lump sums and describe jobs, not individual people or annual income.",
    "limitations": "All full-quarter jobs, not only continuing jobs or new hires. Published earnings use confidentiality rounding to base 10 or 100. Quarterly figures may be revised for two subsequent quarters; no final status is inferred from empty attributes or undisplayed export flags.",
    "unit": "NZD per quarter",
    "geography": "New Zealand",
    "key": ".A3Z.MEDIAN_EARN",
    "dimensions": {
      "AGE_LEED_Q1W_001": {
        "code": "A3Z",
        "label": "Total age"
      },
      "MEASURE_LEED_Q1W_001": {
        "code": "MEDIAN_EARN",
        "label": "Median earnings of full quarters jobs"
      }
    },
    "period_column": "QUARTER_LEED_Q1W_001",
    "period_labels": {
      "202512": "Dec-25",
      "202509": "Sep-25",
      "202506": "Jun-25",
      "202503": "Mar-25",
      "202412": "Dec-24",
      "202409": "Sep-24",
      "202406": "Jun-24",
      "202403": "Mar-24",
      "202312": "Dec-23",
      "202309": "Sep-23",
      "202306": "Jun-23",
      "202303": "Mar-23",
      "202212": "Dec-22",
      "202209": "Sep-22",
      "202206": "Jun-22",
      "202203": "Mar-22",
      "202112": "Dec-21",
      "202109": "Sep-21",
      "202106": "Jun-21",
      "202103": "Mar-21",
      "202012": "Dec-20",
      "202009": "Sep-20",
      "202006": "Jun-20",
      "202003": "Mar-20",
      "201912": "Dec-19",
      "201909": "Sep-19",
      "201906": "Jun-19",
      "201903": "Mar-19",
      "201812": "Dec-18",
      "201809": "Sep-18",
      "201806": "Jun-18",
      "201803": "Mar-18",
      "201712": "Dec-17",
      "201709": "Sep-17",
      "201706": "Jun-17",
      "201703": "Mar-17",
      "201612": "Dec-16",
      "201609": "Sep-16",
      "201606": "Jun-16",
      "201603": "Mar-16",
      "201512": "Dec-15",
      "201509": "Sep-15",
      "201506": "Jun-15",
      "201503": "Mar-15",
      "201412": "Dec-14",
      "201409": "Sep-14",
      "201406": "Jun-14",
      "201403": "Mar-14",
      "201312": "Dec-13",
      "201309": "Sep-13",
      "201306": "Jun-13",
      "201303": "Mar-13",
      "201212": "Dec-12",
      "201209": "Sep-12",
      "201206": "Jun-12",
      "201203": "Mar-12",
      "201112": "Dec-11",
      "201109": "Sep-11",
      "201106": "Jun-11",
      "201103": "Mar-11",
      "201012": "Dec-10",
      "201009": "Sep-10",
      "201006": "Jun-10",
      "201003": "Mar-10",
      "200912": "Dec-09",
      "200909": "Sep-09",
      "200906": "Jun-09",
      "200903": "Mar-09",
      "200812": "Dec-08",
      "200809": "Sep-08",
      "200806": "Jun-08",
      "200803": "Mar-08",
      "200712": "Dec-07",
      "200709": "Sep-07",
      "200706": "Jun-07",
      "200703": "Mar-07",
      "200612": "Dec-06",
      "200609": "Sep-06",
      "200606": "Jun-06",
      "200603": "Mar-06",
      "200512": "Dec-05",
      "200509": "Sep-05",
      "200506": "Jun-05",
      "200503": "Mar-05",
      "200412": "Dec-04",
      "200409": "Sep-04",
      "200406": "Jun-04",
      "200403": "Mar-04",
      "200312": "Dec-03",
      "200309": "Sep-03",
      "200306": "Jun-03",
      "200303": "Mar-03",
      "200212": "Dec-02",
      "200209": "Sep-02",
      "200206": "Jun-02",
      "200203": "Mar-02",
      "200112": "Dec-01",
      "200109": "Sep-01",
      "200106": "Jun-01",
      "200103": "Mar-01",
      "200012": "Dec-00",
      "200009": "Sep-00",
      "200006": "Jun-00",
      "200003": "Mar-00",
      "199912": "Dec-99",
      "199909": "Sep-99",
      "199906": "Jun-99"
    },
    "kind": "observation"
  },
  {
    "id": "POPES_SUB_001",
    "name": "Estimated resident population, New Zealand",
    "unit": "people",
    "geography": "New Zealand",
    "key": ".RC9999.POP",
    "dimensions": {
      "AREA_POPES_SUB_001": {
        "code": "RC9999",
        "label": "Total New Zealand by regional council"
      },
      "MEASURE_POPES_SUB_001": {
        "code": "POP",
        "label": "Population"
      }
    },
    "period_column": "YEAR_POPES_SUB_001",
    "period_labels": {
      "2018": "2018",
      "2019": "2019",
      "2020": "2020",
      "2021": "2021",
      "2022": "2022",
      "2023": "2023",
      "2024": "2024",
      "2025": "2025"
    },
    "kind": "observation"
  },
  {
    "id": "POPES_ERP_005",
    "name": "Estimated resident population, all ethnic groups, sexes and ages",
    "unit": "people",
    "geography": "New Zealand",
    "key": "9999..3.999999",
    "dimensions": {
      "ETHNIC_POPES_ERP_005": {
        "code": "9999",
        "label": "Total people, ethnic group"
      },
      "SEX_POPES_ERP_005": {
        "code": "3",
        "label": "Total people, sex"
      },
      "AGE_POPES_ERP_005": {
        "code": "999999",
        "label": "Total people, age"
      }
    },
    "period_column": "YEAR_POPES_ERP_005",
    "period_labels": {
      "1996": "1996",
      "2001": "2001",
      "2006": "2006",
      "2013": "2013",
      "2018": "2018",
      "2023": "2023"
    },
    "kind": "observation"
  },
  {
    "id": "POPPR_NAT_007",
    "name": "Population projection, median scenario, current calendar year",
    "unit": "people",
    "geography": "New Zealand",
    "key": "P50..SEX3.TOTALALLAGES",
    "dimensions": {
      "SCENARIO_POPPR_NAT_007": {
        "code": "P50",
        "label": "50th percentile (median)"
      },
      "SEX_POPPR_NAT_007": {
        "code": "SEX3",
        "label": "Total people, sex"
      },
      "AGE_POPPR_NAT_007": {
        "code": "TOTALALLAGES",
        "label": "Total people, age"
      }
    },
    "period_column": "YEAR_POPPR_NAT_007",
    "period_labels": {
      "2024": "2024",
      "2025": "2025",
      "2026": "2026",
      "2027": "2027",
      "2028": "2028",
      "2029": "2029",
      "2030": "2030",
      "2031": "2031",
      "2032": "2032",
      "2033": "2033",
      "2034": "2034",
      "2035": "2035",
      "2036": "2036",
      "2037": "2037",
      "2038": "2038",
      "2039": "2039",
      "2040": "2040",
      "2041": "2041",
      "2042": "2042",
      "2043": "2043",
      "2044": "2044",
      "2045": "2045",
      "2046": "2046",
      "2047": "2047",
      "2048": "2048",
      "2049": "2049",
      "2050": "2050",
      "2051": "2051",
      "2052": "2052",
      "2053": "2053",
      "2054": "2054",
      "2055": "2055",
      "2056": "2056",
      "2057": "2057",
      "2058": "2058",
      "2059": "2059",
      "2060": "2060",
      "2061": "2061",
      "2062": "2062",
      "2063": "2063",
      "2064": "2064",
      "2065": "2065",
      "2066": "2066",
      "2067": "2067",
      "2068": "2068",
      "2069": "2069",
      "2070": "2070",
      "2071": "2071",
      "2072": "2072",
      "2073": "2073",
      "2074": "2074",
      "2075": "2075",
      "2076": "2076",
      "2077": "2077",
      "2078": "2078"
    },
    "kind": "projection"
  },
  {
    "id": "POPPR_LAB_003",
    "name": "Labour force projection, median scenario, current calendar year",
    "unit": "people",
    "geography": "New Zealand",
    "key": "P50..SEX3.TOTALALLAGES",
    "dimensions": {
      "SCENARIO_POPPR_LAB_003": {
        "code": "P50",
        "label": "50th percentile (median)"
      },
      "SEX_POPPR_LAB_003": {
        "code": "SEX3",
        "label": "Total people, sex"
      },
      "AGE_POPPR_LAB_003": {
        "code": "TOTALALLAGES",
        "label": "Total people, ages"
      }
    },
    "period_column": "YEAR_POPPR_LAB_003",
    "period_labels": {
      "2024": "2024",
      "2025": "2025",
      "2026": "2026",
      "2027": "2027",
      "2028": "2028",
      "2029": "2029",
      "2030": "2030",
      "2031": "2031",
      "2032": "2032",
      "2033": "2033",
      "2034": "2034",
      "2035": "2035",
      "2036": "2036",
      "2037": "2037",
      "2038": "2038",
      "2039": "2039",
      "2040": "2040",
      "2041": "2041",
      "2042": "2042",
      "2043": "2043",
      "2044": "2044",
      "2045": "2045",
      "2046": "2046",
      "2047": "2047",
      "2048": "2048",
      "2049": "2049",
      "2050": "2050",
      "2051": "2051",
      "2052": "2052",
      "2053": "2053",
      "2054": "2054",
      "2055": "2055",
      "2056": "2056",
      "2057": "2057",
      "2058": "2058",
      "2059": "2059",
      "2060": "2060",
      "2061": "2061",
      "2062": "2062",
      "2063": "2063",
      "2064": "2064",
      "2065": "2065",
      "2066": "2066",
      "2067": "2067",
      "2068": "2068",
      "2069": "2069",
      "2070": "2070",
      "2071": "2071",
      "2072": "2072",
      "2073": "2073",
      "2074": "2074",
      "2075": "2075",
      "2076": "2076",
      "2077": "2077",
      "2078": "2078"
    },
    "kind": "projection"
  },
  {
    "id": "POPPR_FHH_003",
    "projection_period": "next_available",
    "name": "Household projection, Medium A, next published horizon",
    "unit": "households",
    "geography": "New Zealand",
    "key": "MEDIUMA..HH",
    "dimensions": {
      "PROJECTION_POPPR_FHH_003": {
        "code": "MEDIUMA",
        "label": "Medium A"
      },
      "MEASURE_POPPR_FHH_003": {
        "code": "HH",
        "label": "Total households"
      }
    },
    "period_column": "YEAR_POPPR_FHH_003",
    "period_labels": {
      "2018": "2018",
      "2019": "2019",
      "2020": "2020",
      "2021": "2021",
      "2022": "2022",
      "2023": "2023",
      "2024": "2024",
      "2025": "2025",
      "2026": "2026",
      "2027": "2027",
      "2028": "2028",
      "2029": "2029",
      "2030": "2030",
      "2031": "2031",
      "2032": "2032",
      "2033": "2033",
      "2034": "2034",
      "2035": "2035",
      "2036": "2036",
      "2037": "2037",
      "2038": "2038",
      "2039": "2039",
      "2040": "2040",
      "2041": "2041",
      "2042": "2042",
      "2043": "2043"
    },
    "kind": "projection"
  },
  {
    "id": "PRD_PRD_001",
    "period_convention": "Year ended March.",
    "index_reference": "Year ended March 1996 = 1000; measured sector, not whole-economy labour productivity.",
    "name": "Labour productivity index, measured sector",
    "unit": "index",
    "geography": "New Zealand",
    "key": ".MSZ.2.I",
    "dimensions": {
      "INDUSTRY_PRD_PRD_001": {
        "code": "MSZ",
        "label": "Measured sector"
      },
      "VAR_PRD_PRD_001": {
        "code": "2",
        "label": "Labour productivity"
      },
      "SERIESTYPE_PRD_PRD_001": {
        "code": "I",
        "label": "Index"
      }
    },
    "period_column": "YEAR_PRD_PRD_001",
    "period_labels": {
      "1978": "1978",
      "1979": "1979",
      "1980": "1980",
      "1981": "1981",
      "1982": "1982",
      "1983": "1983",
      "1984": "1984",
      "1985": "1985",
      "1986": "1986",
      "1987": "1987",
      "1988": "1988",
      "1989": "1989",
      "1990": "1990",
      "1991": "1991",
      "1992": "1992",
      "1993": "1993",
      "1994": "1994",
      "1995": "1995",
      "1996": "1996",
      "1997": "1997",
      "1998": "1998",
      "1999": "1999",
      "2000": "2000",
      "2001": "2001",
      "2002": "2002",
      "2003": "2003",
      "2004": "2004",
      "2005": "2005",
      "2006": "2006",
      "2007": "2007",
      "2008": "2008",
      "2009": "2009",
      "2010": "2010",
      "2011": "2011",
      "2012": "2012",
      "2013": "2013",
      "2014": "2014",
      "2015": "2015",
      "2016": "2016",
      "2017": "2017",
      "2018": "2018",
      "2019": "2019",
      "2020": "2020",
      "2021": "2021",
      "2022": "2022",
      "2023": "2023",
      "2024": "2024",
      "2025": "2025"
    },
    "kind": "observation"
  },
  {
    "id": "PRD_PRD_002",
    "name": "Labour productivity annual change, measured sector",
    "unit": "percent",
    "geography": "New Zealand",
    "key": ".MSZ.2.P",
    "dimensions": {
      "INDUSTRY_PRD_PRD_002": {
        "code": "MSZ",
        "label": "Measured sector"
      },
      "VAR_PRD_PRD_002": {
        "code": "2",
        "label": "Labour productivity"
      },
      "SERIESTYPE_PRD_PRD_002": {
        "code": "P",
        "label": "Percentage change"
      }
    },
    "period_column": "YEAR_PRD_PRD_002",
    "period_labels": {
      "1978": "1978",
      "1979": "1979",
      "1980": "1980",
      "1981": "1981",
      "1982": "1982",
      "1983": "1983",
      "1984": "1984",
      "1985": "1985",
      "1986": "1986",
      "1987": "1987",
      "1988": "1988",
      "1989": "1989",
      "1990": "1990",
      "1991": "1991",
      "1992": "1992",
      "1993": "1993",
      "1994": "1994",
      "1995": "1995",
      "1996": "1996",
      "1997": "1997",
      "1998": "1998",
      "1999": "1999",
      "2000": "2000",
      "2001": "2001",
      "2002": "2002",
      "2003": "2003",
      "2004": "2004",
      "2005": "2005",
      "2006": "2006",
      "2007": "2007",
      "2008": "2008",
      "2009": "2009",
      "2010": "2010",
      "2011": "2011",
      "2012": "2012",
      "2013": "2013",
      "2014": "2014",
      "2015": "2015",
      "2016": "2016",
      "2017": "2017",
      "2018": "2018",
      "2019": "2019",
      "2020": "2020",
      "2021": "2021",
      "2022": "2022",
      "2023": "2023",
      "2024": "2024",
      "2025": "2025"
    },
    "kind": "observation"
  },
  {
    "id": "PRD_PRD_003",
    "name": "Output annual growth, measured sector",
    "unit": "percent",
    "geography": "New Zealand",
    "key": ".MSZ.4.P",
    "dimensions": {
      "INDUSTRY_PRD_PRD_003": {
        "code": "MSZ",
        "label": "Measured sector"
      },
      "VAR_PRD_PRD_003": {
        "code": "4",
        "label": "Output"
      },
      "SERIESTYPE_PRD_PRD_003": {
        "code": "P",
        "label": "Percentage change"
      }
    },
    "period_column": "YEAR_PRD_PRD_003",
    "period_labels": {
      "1978": "1978",
      "1979": "1979",
      "1980": "1980",
      "1981": "1981",
      "1982": "1982",
      "1983": "1983",
      "1984": "1984",
      "1985": "1985",
      "1986": "1986",
      "1987": "1987",
      "1988": "1988",
      "1989": "1989",
      "1990": "1990",
      "1991": "1991",
      "1992": "1992",
      "1993": "1993",
      "1994": "1994",
      "1995": "1995",
      "1996": "1996",
      "1997": "1997",
      "1998": "1998",
      "1999": "1999",
      "2000": "2000",
      "2001": "2001",
      "2002": "2002",
      "2003": "2003",
      "2004": "2004",
      "2005": "2005",
      "2006": "2006",
      "2007": "2007",
      "2008": "2008",
      "2009": "2009",
      "2010": "2010",
      "2011": "2011",
      "2012": "2012",
      "2013": "2013",
      "2014": "2014",
      "2015": "2015",
      "2016": "2016",
      "2017": "2017",
      "2018": "2018",
      "2019": "2019",
      "2020": "2020",
      "2021": "2021",
      "2022": "2022",
      "2023": "2023",
      "2024": "2024",
      "2025": "2025"
    },
    "kind": "observation"
  }
];
