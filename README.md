# Outage Pricing

This project is centered on `price_engine/`: the historical-only baseline for parametric outage insurance pricing.

The first goal is to reproduce the existing v0 method locally on the full 2014-2025 EAGLE-I public release, then serve the static dashboard from the generated artifacts.

## Local run

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
bash price_engine/run_all.sh
cd price_engine
python -m http.server 8000
```

Open `http://127.0.0.1:8000/dashboard/`.

Generated raw and derived data are reproducible local artifacts and are ignored by git.
