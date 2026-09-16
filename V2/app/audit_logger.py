"""
Module: Security Activity & Audit Logger
Records immutable user audit trails in the exact format:
  username_or_id :- action details
"""

import os
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import List, Dict

# Log directory and file paths
LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "user_activity_audit.log"

_log_lock = Lock()

def record_audit(user_id: str, action: str, details: str = "") -> Dict:
    """
    Appends an audit entry in the exact format:
      [TIMESTAMP] [AUDIT] username_or_id :- action details
    """
    clean_user = user_id.strip() if user_id and user_id.strip() else "Analyst_Agent_01"
    clean_action = action.strip() if action else "general_action"
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    details_part = f" | {details.strip()}" if details and details.strip() else ""
    log_line = f"[{timestamp_str}] [SECURITY AUDIT] {clean_user} :- {clean_action}{details_part}\n"

    with _log_lock:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(log_line)

    return {
        "timestamp": timestamp_str,
        "user_id": clean_user,
        "action": clean_action,
        "details": details.strip(),
        "raw": log_line.strip()
    }


def get_audit_trail(limit: int = 100) -> List[Dict]:
    """Returns the most recent audit records in reverse chronological order."""
    if not LOG_FILE.exists():
        return []

    entries = []
    with _log_lock:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()

    # Parse lines from newest to oldest
    for line in reversed(lines[-limit:]):
        line = line.strip()
        if not line:
            continue
        try:
            # Format: [2026-09-15 18:50:00] [SECURITY AUDIT] user :- action | details
            parts = line.split(" :- ", 1)
            header = parts[0]
            rest = parts[1] if len(parts) > 1 else ""
            
            # Extract timestamp and user
            ts_start = header.find("[")
            ts_end = header.find("]")
            timestamp = header[ts_start+1:ts_end] if ts_start != -1 and ts_end != -1 else ""
            user = header.split("] ")[-1].strip() if "] " in header else "Unknown"

            # Extract action and details
            if " | " in rest:
                action, details = rest.split(" | ", 1)
            else:
                action, details = rest, ""

            entries.append({
                "timestamp": timestamp,
                "user_id": user,
                "action": action.strip(),
                "details": details.strip(),
                "raw": line
            })
        except Exception:
            entries.append({
                "timestamp": "",
                "user_id": "System",
                "action": "log_entry",
                "details": line,
                "raw": line
            })

    return entries
