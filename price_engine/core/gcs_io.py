"""
GCS-or-local I/O for the outage-pricing pipeline. Mirrors model-gpr's core/io/gcs.py.

A path is either a local filesystem path or a `gs://` URI. pandas (via gcsfs) handles `gs://` for
parquet/csv natively; JSON/text go through gcsfs explicitly. Auth: ADC (`gcloud auth
application-default login`) locally, a bound service account in prod.

Pair with `data_paths.resolve()`, which decides local-vs-`gs://` from the OUTAGE_PRICING_DATA_ROOT env var.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd


def is_gcs(path: str | Path) -> bool:
    return str(path).startswith("gs://")


def _ensure_parent(path: str | Path) -> None:
    if not is_gcs(path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)


# ---- read (gs:// handled by pandas+gcsfs for parquet/csv; by gcsfs for json/text) ----
def read_parquet(path: str | Path, **kw) -> pd.DataFrame:
    return pd.read_parquet(path, **kw)


def read_csv(path: str | Path, **kw) -> pd.DataFrame:
    return pd.read_csv(path, **kw)


def read_json(path: str | Path) -> Any:
    if is_gcs(path):
        import gcsfs

        with gcsfs.GCSFileSystem().open(str(path), "r") as f:
            return json.load(f)
    with open(path) as f:
        return json.load(f)


def read_text(path: str | Path) -> str:
    if is_gcs(path):
        import gcsfs

        with gcsfs.GCSFileSystem().open(str(path), "r") as f:
            return f.read()
    return Path(path).read_text()


def exists(path: str | Path) -> bool:
    if is_gcs(path):
        import gcsfs

        return gcsfs.GCSFileSystem().exists(str(path))
    return Path(path).exists()


def ls(path: str | Path) -> list[str]:
    """List object/file names under a directory-ish path (gs:// or local). Returns basenames."""
    if is_gcs(path):
        import gcsfs

        return [p.rsplit("/", 1)[-1] for p in gcsfs.GCSFileSystem().ls(str(path)) if not p.endswith("/")]
    return [p.name for p in Path(path).iterdir() if p.is_file()]


# ---- write ----
def write_parquet(df: pd.DataFrame, path: str | Path, **kw) -> str:
    _ensure_parent(path)
    df.to_parquet(path, **kw)
    return str(path)


def write_csv(df: pd.DataFrame, path: str | Path, **kw) -> str:
    _ensure_parent(path)
    kw.setdefault("index", False)
    df.to_csv(path, **kw)
    return str(path)


def write_json(obj: Any, path: str | Path, **kw) -> str:
    kw.setdefault("separators", (",", ":"))
    text = json.dumps(obj, **kw)
    if is_gcs(path):
        import gcsfs

        with gcsfs.GCSFileSystem().open(str(path), "w") as f:
            f.write(text)
    else:
        _ensure_parent(path)
        Path(path).write_text(text)
    return str(path)
