# Source Inventory

This folder tracks candidate data sources before ingestion.

Each source note should answer:

- what the source is;
- source owner / publisher;
- official documentation link;
- access method;
- license / redistribution caveat;
- grain;
- coverage years;
- update cadence;
- join keys;
- known quality issues;
- proposed role in this project.

## Initial Candidate Sources

| Source | Proposed role | First phase |
|---|---|---|
| EAGLE-I catalog outputs from `price_engine` | base event input | 0 / 1 |
| NOAA Storm Events Database | weather cause enrichment | 1 |
| DOE / OE-417 annual summaries | major disturbance cause enrichment | 1 |
| PNNL Event-Correlated Outage Dataset | external comparator for EAGLE-I event construction and OE-417 matching | 1 |
| EIA-861 detailed data | utility reliability and service-territory context | 2 |
| FERC Form 1 / PUDL | utility capex/O&M and plant proxies | 2 |
| FEMA disaster declarations | large-event / disaster tags | later |
| NHC hurricane tracks | named-storm context | later |
| state PUC filings | richer state-specific grid context | later |

## Primary Links To Review

- NOAA Storm Events Database:
  https://www.ncei.noaa.gov/stormevents/
- NOAA Storm Events bulk CSV format:
  https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/Storm-Data-Bulk-csv-Format.pdf
- DOE / OE-417 annual summaries:
  https://openenergyhub.ornl.gov/explore/dataset/oe-417-annual-summaries/map/
- PNNL Event-Correlated Outage Dataset:
  https://catalog.data.gov/dataset/event-correlated-outage-dataset-in-america
- EIA-861 detailed data:
  https://www.eia.gov/electricity/data/eia861/
- FERC data portal:
  https://data.ferc.gov/
- PUDL FERC Form 1 documentation:
  https://docs.catalyst.coop/pudl/en/nightly/data_sources/ferc1.html
