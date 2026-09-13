"""
Automation engine.

IMPORTANT / HONEST LIMITATION:
There is no real execution engine wired up (no Ansible/SSM/kubectl
remediation runner behind this). This module does two honest things
only:

1. Reports SAFE, real, already-executed automation: none exist yet,
   so `executed_actions` starts empty and only grows if a real
   executor is plugged in later.
2. Generates rule-based SUGGESTIONS from the real overview data,
   each clearly marked `requires_approval: true` and
   `executed: false`. Nothing here is auto-applied. This matches the
   project's own approval-flow requirement.

This keeps the Automation page from lying about "successful actions"
when nothing has actually been automated yet.
"""

from datetime import datetime, timezone


def _now():
    return datetime.now(timezone.utc).isoformat()


# In-memory action history. Would be populated by a real executor
# (e.g. a webhook or SSM runner) if/when one is connected. Empty by
# default -- NOT pre-filled with fake successful actions.
_executed_actions = []


def get_automation_status(overview: dict):
    systems = (overview or {}).get("systems", {})
    suggestions = []

    docker = systems.get("docker", {})
    if docker.get("status") == "success" and docker.get("stopped_containers", 0) > 0:
        suggestions.append({
            "id": "restart-stopped-containers",
            "action_type": "restart",
            "target": "Docker containers",
            "trigger": f"{docker['stopped_containers']} container(s) stopped",
            "recommended_action": "Restart stopped containers",
            "requires_approval": True,
            "executed": False
        })

    kubernetes = systems.get("kubernetes", {})
    if kubernetes.get("status") == "success" and kubernetes.get("stopped_pods", 0) > 0:
        suggestions.append({
            "id": "investigate-failed-pods",
            "action_type": "investigate",
            "target": "Kubernetes pods",
            "trigger": f"{kubernetes['stopped_pods']} pod(s) not running",
            "recommended_action": "Inspect and restart failed pods",
            "requires_approval": True,
            "executed": False
        })

    jenkins = systems.get("jenkins", {})
    if jenkins.get("status") == "success" and jenkins.get("failed_jobs", 0) > 0:
        suggestions.append({
            "id": "review-failed-jenkins-jobs",
            "action_type": "review",
            "target": "Jenkins jobs",
            "trigger": f"{jenkins['failed_jobs']} job(s) failing",
            "recommended_action": "Review console output for failing jobs",
            "requires_approval": True,
            "executed": False
        })

    aws = systems.get("aws", {})
    for inst in aws.get("instances", []) if aws.get("status") == "success" else []:
        if inst.get("health") == "critical":
            suggestions.append({
                "id": f"scale-{inst.get('instance_id')}",
                "action_type": "scale",
                "target": inst.get("instance_id"),
                "trigger": f"CPU at {inst.get('cpu_utilization')}%",
                "recommended_action": "Consider vertical/horizontal scaling",
                "requires_approval": True,
                "executed": False
            })

    executed_count = len(_executed_actions)
    successful = len([a for a in _executed_actions if a.get("result") == "success"])
    failed = len([a for a in _executed_actions if a.get("result") == "failed"])

    return {
        "status": "success",
        "engine_connected": False,
        "note": "No execution engine is connected yet. Suggestions below are rule-based recommendations only and are never applied automatically.",
        "total_actions": executed_count,
        "successful_actions": successful,
        "failed_actions": failed,
        "running_actions": 0,
        "recent_actions": _executed_actions[-10:],
        "pending_suggestions": suggestions,
        "checked_at": _now()
    }
