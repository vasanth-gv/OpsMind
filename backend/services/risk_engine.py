"""
Rule-based risk scoring.

This is deterministic, explainable scoring based on the actual
/api/overview payload -- NOT a machine-learning model and NOT an LLM.
It is intentionally simple and auditable: every point added to the
risk score is traceable to a concrete signal (a system being down, a
failed Jenkins job, an unhealthy EC2 instance, etc).

A small in-memory history of recent scores is kept so the API can
report a trend (rising / falling / stable) without needing an external
time-series database.
"""

from collections import deque
from datetime import datetime, timezone

_HISTORY_LEN = 50
_history = deque(maxlen=_HISTORY_LEN)


def _now():
    return datetime.now(timezone.utc).isoformat()


def compute_risk(overview: dict):
    systems = (overview or {}).get("systems", {})
    reasons = []
    score = 0

    aws = systems.get("aws", {})
    if aws.get("status") != "success":
        score += 25
        reasons.append("AWS monitoring unavailable")
    else:
        for inst in aws.get("instances", []):
            if inst.get("health") == "critical":
                score += 10
                reasons.append(f"EC2 instance {inst.get('instance_id')} critical (high CPU)")
            elif inst.get("health") == "warning":
                score += 4
                reasons.append(f"EC2 instance {inst.get('instance_id')} elevated CPU")

    jenkins = systems.get("jenkins", {})
    if jenkins.get("status") != "success":
        score += 15
        reasons.append("Jenkins unavailable")
    else:
        failed = jenkins.get("failed_jobs", 0)
        if failed:
            score += min(failed * 5, 20)
            reasons.append(f"{failed} Jenkins job(s) failing")

    docker = systems.get("docker", {})
    if docker.get("status") != "success":
        score += 15
        reasons.append("Docker unavailable")
    elif docker.get("stopped_containers", 0) > 0:
        score += min(docker.get("stopped_containers") * 3, 15)
        reasons.append(f"{docker.get('stopped_containers')} stopped container(s)")

    kubernetes = systems.get("kubernetes", {})
    if kubernetes.get("status") != "success":
        score += 15
        reasons.append("Kubernetes unavailable")
    elif kubernetes.get("stopped_pods", 0) > 0:
        score += min(kubernetes.get("stopped_pods") * 3, 15)
        reasons.append(f"{kubernetes.get('stopped_pods')} pod(s) not running")

    score = max(0, min(100, score))

    _history.append({"score": score, "at": _now()})

    trend = "stable"
    if len(_history) >= 2:
        prev = _history[-2]["score"]
        if score > prev:
            trend = "rising"
        elif score < prev:
            trend = "falling"

    return {
        "risk_score": score,
        "trend": trend,
        "reasons": reasons or ["No risk signals detected"],
        "history": list(_history),
        "method": "rule-based (deterministic) - not a machine-learning model",
        "checked_at": _now()
    }
