#!/usr/bin/env python3
"""Compare production, test and code-level DB schema parity."""

import os
import sys
from typing import Dict, Set

from sqlalchemy import create_engine, inspect

from models import Base


IGNORED_TABLES = {"alembic_version"}


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _table_set(database_url: str) -> Set[str]:
    engine = create_engine(database_url)
    try:
        tables = set(inspect(engine).get_table_names(schema="public"))
    finally:
        engine.dispose()
    return {t for t in tables if t not in IGNORED_TABLES}


def _diff(left: Set[str], right: Set[str]) -> Dict[str, Set[str]]:
    return {
        "missing": sorted(left - right),
        "extra": sorted(right - left),
    }


def main() -> int:
    prod_url = _required_env("PROD_DATABASE_URL")
    test_url = _required_env("TEST_DATABASE_URL")

    expected_tables = {t for t in Base.metadata.tables.keys() if t not in IGNORED_TABLES}
    prod_tables = _table_set(prod_url)
    test_tables = _table_set(test_url)

    prod_vs_code = _diff(expected_tables, prod_tables)
    test_vs_code = _diff(expected_tables, test_tables)
    test_vs_prod = _diff(prod_tables, test_tables)

    print("=== Schema parity report ===")
    print(f"Code table count : {len(expected_tables)}")
    print(f"Prod table count : {len(prod_tables)}")
    print(f"Test table count : {len(test_tables)}")

    def print_diff(title: str, payload: Dict[str, Set[str]]):
        print(f"\n[{title}]")
        if not payload["missing"] and not payload["extra"]:
            print("OK - no differences")
            return
        if payload["missing"]:
            print("Missing:", ", ".join(payload["missing"]))
        if payload["extra"]:
            print("Extra:", ", ".join(payload["extra"]))

    print_diff("Prod vs Code", prod_vs_code)
    print_diff("Test vs Code", test_vs_code)
    print_diff("Test vs Prod", test_vs_prod)

    if any((prod_vs_code["missing"], test_vs_code["missing"], test_vs_prod["missing"])):
        return 2
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}")
        raise SystemExit(1)
