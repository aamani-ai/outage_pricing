"""
01_ingest.py — pull the EAGLE-I public dataset from Figshare.

Source: Figshare article 24237376 (EAGLE-I Power Outage Data).
Downloads:
  - eaglei_outages_YYYY.csv for 2014..2025  (12 files)
  - MCC.csv               (Modeled County Customers)
  - coverage_history.csv  (state/year coverage-quality diagnostic)
  - DQI.csv               (Data Quality Index by FEMA region/year)

Outputs to: price_engine/data/raw/

Idempotent: skips files already present unless --force is passed.
Verifies MD5 against the Figshare API metadata.

Usage:
    python 01_ingest.py             # download missing files
    python 01_ingest.py --force     # re-download everything
    python 01_ingest.py --list      # print file list from API, no download
"""

from __future__ import annotations

import argparse
import hashlib
import subprocess
import sys
import time
from pathlib import Path

import requests

ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))
from core import data_paths  # noqa: E402 — maps each raw file to its canonical lake key

ARTICLE_ID = 24237376
API_URL = f"https://api.figshare.com/v2/articles/{ARTICLE_ID}"

# Files we want. Yearly CSVs are 2014..2025; supplementary files by name.
YEARS = list(range(2014, 2026))
YEARLY_PATTERN = "eaglei_outages_{year}.csv"
SUPPLEMENTARY = {"MCC.csv", "coverage_history.csv", "DQI.csv"}

# Where to put downloads (relative to repo root).
RAW_DIR = Path(__file__).resolve().parent / "raw"

CHUNK_SIZE = 1 << 20  # 1 MiB
HTTP_TIMEOUT = 60
MAX_RETRIES = 4


def fetch_article_metadata() -> dict:
    """Hit the Figshare API and return the parsed article JSON."""
    print(f"[meta] GET {API_URL}", flush=True)
    resp = requests.get(API_URL, timeout=HTTP_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def select_files(meta: dict) -> list[dict]:
    """Filter the article's file list to just the ones v0 needs."""
    wanted_yearly = {YEARLY_PATTERN.format(year=y) for y in YEARS}
    wanted = wanted_yearly | SUPPLEMENTARY

    selected = [f for f in meta.get("files", []) if f["name"] in wanted]
    found_names = {f["name"] for f in selected}
    missing = wanted - found_names

    if missing:
        print(f"[meta] WARNING: not found in article: {sorted(missing)}", flush=True)

    return sorted(selected, key=lambda f: f["name"])


def md5_of(path: Path) -> str:
    h = hashlib.md5()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(CHUNK_SIZE), b""):
            h.update(chunk)
    return h.hexdigest()


def download_one(file_info: dict, dest_dir: Path, force: bool) -> None:
    name = file_info["name"]
    url = file_info["download_url"]
    expected_md5 = file_info.get("computed_md5") or file_info.get("supplied_md5")
    expected_size = file_info.get("size")
    out_path = dest_dir / name

    if out_path.exists() and not force:
        local_size = out_path.stat().st_size
        if expected_size and local_size == expected_size:
            if expected_md5:
                local_md5 = md5_of(out_path)
                if local_md5 == expected_md5:
                    print(f"[skip] {name} (size+md5 match)", flush=True)
                    return
                print(f"[redo] {name} md5 mismatch (local={local_md5} expected={expected_md5})", flush=True)
            else:
                print(f"[skip] {name} (size match, no md5 to compare)", flush=True)
                return
        else:
            print(f"[redo] {name} size mismatch (local={local_size} expected={expected_size})", flush=True)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"[get ] {name} (attempt {attempt}/{MAX_RETRIES}, {expected_size or '?'} bytes)", flush=True)
            with requests.get(url, stream=True, timeout=HTTP_TIMEOUT) as r:
                r.raise_for_status()
                tmp_path = out_path.with_suffix(out_path.suffix + ".part")
                with tmp_path.open("wb") as fh:
                    for chunk in r.iter_content(chunk_size=CHUNK_SIZE):
                        if chunk:
                            fh.write(chunk)
                tmp_path.replace(out_path)
            break
        except (requests.RequestException, OSError) as exc:
            wait = 2 ** attempt
            print(f"[warn] {name} attempt {attempt} failed: {exc}; retry in {wait}s", flush=True)
            time.sleep(wait)
    else:
        raise RuntimeError(f"failed to download {name} after {MAX_RETRIES} attempts")

    # Verify
    if expected_md5:
        local_md5 = md5_of(out_path)
        if local_md5 != expected_md5:
            raise RuntimeError(f"{name} md5 mismatch: local={local_md5} expected={expected_md5}")
        print(f"[ok  ] {name} md5 verified", flush=True)
    else:
        print(f"[ok  ] {name} downloaded (no md5 published)", flush=True)


def push_to_lake(files: list[dict], dest_dir: Path) -> int:
    """Promote each verified local raw file to its canonical lake location.

    Uses `gcloud storage cp` (the right tool for the ~11 GB of raw) rather than streaming
    through pandas/gcsfs. Each file's lake key comes from the SAME data_paths map the rest of
    the pipeline reads through, so ingest and read agree on layout (sources/eagle_i, /mcc, /reference).
    """
    if not data_paths.using_gcs():
        print(
            "[lake] --push-lake needs OUTAGE_PRICING_DATA_ROOT=gs://<bucket> "
            f"(currently {data_paths.root_label()})",
            flush=True,
        )
        return 1
    for f in files:
        name = f["name"]
        local = dest_dir / name
        if not local.exists():
            print(f"[lake] skip {name} (not present locally)", flush=True)
            continue
        target = data_paths.resolve(f"price_engine/data/raw/{name}")
        print(f"[lake] cp {name} -> {target}", flush=True)
        subprocess.run(["gcloud", "storage", "cp", str(local), target], check=True)
    print(f"[lake] raw promoted to {data_paths.root_label()}", flush=True)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="re-download even if present")
    parser.add_argument("--list", action="store_true", help="list files from API and exit")
    parser.add_argument("--dest", type=Path, default=RAW_DIR, help="output directory")
    parser.add_argument(
        "--push-lake",
        action="store_true",
        help="after download, promote each raw file to the lake (needs OUTAGE_PRICING_DATA_ROOT=gs://...)",
    )
    args = parser.parse_args()

    args.dest.mkdir(parents=True, exist_ok=True)
    meta = fetch_article_metadata()
    files = select_files(meta)

    print(f"[meta] article '{meta.get('title')}' — {len(files)} files matched", flush=True)
    for f in files:
        size_mb = (f.get("size") or 0) / (1 << 20)
        print(f"        {f['name']:40s}  {size_mb:8.1f} MB", flush=True)

    if args.list:
        return 0

    for f in files:
        try:
            download_one(f, args.dest, args.force)
        except Exception as exc:
            print(f"[FAIL] {f['name']}: {exc}", flush=True)
            return 1

    print(f"[done] all files in {args.dest}", flush=True)

    if args.push_lake:
        return push_to_lake(files, args.dest)
    return 0


if __name__ == "__main__":
    sys.exit(main())
