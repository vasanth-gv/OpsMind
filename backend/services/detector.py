"""
Anomaly / pattern detector.

Rule-based detection over the current + recent overview snapshots.
Not a machine-learning model. Every anomaly returned here is traceable
to a concrete rule so the Intelligence page can show *why* something
was flagged instead of a black-box score.
"""

from collections import deque
from datetime import datetime, timezone

_HISTORY_LEN = 20
_health_history = deque(maxlen=_HISTORY_LEN)


def _now():
    return datetime.now(timezone.utc).isoformat()


def detect_anomalies(overview: dict):
    systems = (overview or {}).get("systems", {})
    platform = (overview or {}).get("platform", {})
    anomalies = []

    _health_history.append(platform.get("health_score", 0))

    # Rule 1: platform health dropped compared to previous check
    if len(_health_history) >= 2:
        prev, curr = _health_history[-2], _health_history[-1]
        if curr < prev:
            anomalies.append({
                "type": "health_drop",
                "severity": "warning",
                "message": f"Platform health dropped from {prev}% to {curr}%"
            })

    # Rule 2: any system fully down
    for name, sys_data in systems.items():
        if sys_data.get("status") != "success":
            anomalies.append({
                "type": "system_down",
                "severity": "critical",
                "message": f"{name.upper()} is unreachable: {sys_data.get('message', 'no details')}"
            })

    # Rule 3: AWS instance(s) with critical CPU
    aws = systems.get("aws", {})
    for inst in aws.get("instances", []):
        if inst.get("health") == "critical":
            anomalies.append({
                "type": "high_cpu",
                "severity": "critical",
                "message": f"EC2 {inst.get('instance_id')} CPU at {inst.get('cpu_utilization')}%"
            })

    # Rule 4: Jenkins failure rate
    jenkins = systems.get("jenkins", {})
    if jenkins.get("status") == "success" and jenkins.get("job_count"):
        fail_ratio = jenkins.get("failed_jobs", 0) / jenkins["job_count"]
        if fail_ratio > 0.3:
            anomalies.append({
                "type": "high_failure_rate",
                "severity": "warning",
                "message": f"{round(fail_ratio*100)}% of Jenkins jobs are failing"
            })

    return {
        "status": "success",
        "anomaly_count": len(anomalies),
        "anomalies": anomalies,
        "checked_at": _now()
    }
