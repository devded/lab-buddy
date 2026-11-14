"""Lab Buddy MCP server (stdio). AI assistants see only abnormal results and the doctor brief.
Acts for one account: LABBUDDY_USER env var (default "demo")."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from mcp.server.fastmcp import FastMCP  # noqa: E402

from app import db  # noqa: E402
from app.brief import doctor_brief  # noqa: E402

UID = os.getenv("LABBUDDY_USER", "demo")
mcp = FastMCP("lab-buddy")


@mcp.tool()
def get_abnormal_results() -> list[dict]:
    """List the user's abnormal (low/high) lab results across all reports. Normal results are never shared."""
    res = db.abnormal_results(UID)
    db.log(UID, "mcp", "get_abnormal_results", f"{len(res)} abnormal results")
    return res


@mcp.tool()
def get_doctor_brief(report_id: int | None = None) -> dict:
    """Short formal German doctor brief (plus English) for the latest report, or the given report_id."""
    rid = report_id or db.latest_report_id(UID)
    if not rid or not db.get_report(UID, rid):
        db.log(UID, "mcp", "get_doctor_brief", "no report")
        return {"error": "No report found."}
    b = doctor_brief(UID, rid)
    db.log(UID, "mcp", "get_doctor_brief", f"brief for report {rid}")
    return b


@mcp.tool()
def compare_test(test_name: str) -> list[dict]:
    """Values for one test (e.g. 'HbA1c') across all reports, ordered by date."""
    rows = [{k: v for k, v in r.items() if k != "report_id"} for r in db.compare(UID, test_name)]
    db.log(UID, "mcp", "compare_test", f"{test_name}: {len(rows)} values")
    return rows


if __name__ == "__main__":
    mcp.run()
