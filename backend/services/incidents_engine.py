"""
Incident tracking, derived from REAL monitoring signals only.

An incident is opened when a system in /api/overview reports
status == "error" (or Jenkins reports failed_jobs > 0), and it is
automatically resolved when that system reports status == "success"
again. There is no synthetic/demo incident data here -- if AWS,
Jenkins, Docker and Kubernetes are all healthy, this returns an empty
list and the UI should show "All systems operational".

State lives in-memory for the life of the FastAPI process.
"""

from datetime import datetime, timezone
from threading import Lock

from services.event_log import add_log

_lock = Lock()
_active = {}       # key -> incident dict
_resolved = []      # list of resolved incident dicts (most recent first)
_next_id = 1

_MAX_RESOLVED = 100


def _now():
    return datetime.now(timezone.utc).isoformat()


def _open_incident(key, service, severity, title):
    global _next_id
    incident = {
        "id": f"inc-{_next_id}",
        "service": service,
        "severity": severity,
        "title": title,
        "status": "active",
        "created_at": _now(),
        "updated_at": _now(),
        "resolved_at": None
    }
    _next_id += 1
    _active[key] = incident
    add_log("ERROR" if severity == "critical" else "WARNING", service, title, source="incidents_engine")
    return incident


def _resolve_incident(key):
    incident = _active.pop(key, None)
    if incident:
        incident["status"] = "resolved"
        incident["resolved_at"] = _now()
        incident["updated_at"] = _now()
        _resolved.insert(0, incident)
        del _resolved[_MAX_RESOLVED:]
        add_log("INFO", incident["service"], f"{incident['title']} — resolved", source="incidents_engine")


def process_overview(overview: dict):
    """
    Call this every time /api/overview is computed, so incidents stay
    in sync with real system status. Returns nothing; state is
    read via get_incidents().
    """
    systems = (overview or {}).get("systems", {})

    with _lock:

        # AWS
        aws = systems.get("aws", {})
        key = "aws-down"
        if aws.get("status") != "success":
            if key not in _active:
                _open_incident(key, "AWS", "critical",
                                f"AWS unavailable: {aws.get('message', 'unknown error')}")
        else:
            _resolve_incident(key)

        # Jenkins
        jenkins = systems.get("jenkins", {})
        key = "jenkins-down"
        if jenkins.get("status") != "success":
            if key not in _active:
                _open_incident(key, "Jenkins", "critical",
                                f"Jenkins unavailable: {jenkins.get('message', 'unknown error')}")
        else:
            _resolve_incident(key)

        # Jenkins failed jobs (warning, independent of connectivity)
        key = "jenkins-failed-jobs"
        failed_jobs = jenkins.get("failed_jobs", 0) if jenkins.get("status") == "success" else 0
        if failed_jobs and failed_jobs > 0:
            if key not in _active:
                _open_incident(key, "Jenkins", "warning",
                                f"{failed_jobs} Jenkins job(s) failing")
            else:
                _active[key]["title"] = f"{failed_jobs} Jenkins job(s) failing"
                _active[key]["updated_at"] = _now()
        else:
            _resolve_incident(key)

        # Docker
        docker = systems.get("docker", {})
        key = "docker-down"
        if docker.get("status") != "success":
            if key not in _active:
                _open_incident(key, "Docker", "critical",
                                f"Docker unavailable: {docker.get('message', 'unknown error')}")
        else:
            _resolve_incident(key)

        # Kubernetes
        kubernetes = systems.get("kubernetes", {})
        key = "kubernetes-down"
        if kubernetes.get("status") != "success":
            if key not in _active:
                _open_incident(key, "Kubernetes", "critical",
                                f"Kubernetes unavailable: {kubernetes.get('message', 'unknown error')}")
        else:
            _resolve_incident(key)


def get_incidents():
    with _lock:
        active = list(_active.values())
        resolved = list(_resolved)

    active.sort(key=lambda i: i["created_at"], reverse=True)

    return {
        "status": "success",
        "active_count": len(active),
        "resolved_count": len(resolved),
        "active": active,
        "resolved": resolved[:50]
    }
