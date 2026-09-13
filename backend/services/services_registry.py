"""
Service inventory, built from REAL monitoring data returned by the
AWS / Jenkins / Docker / Kubernetes checks. There is no fake service
catalog here -- if a system is unavailable, its services show up as
"unavailable" rather than being hidden or faked as healthy.
"""

from datetime import datetime, timezone


def _now():
    return datetime.now(timezone.utc).isoformat()


def get_services(overview: dict):
    systems = (overview or {}).get("systems", {})
    services = []

    # ---------------- AWS: one row per EC2 instance ----------------
    aws = systems.get("aws", {})
    if aws.get("status") == "success":
        for inst in aws.get("instances", []):
            services.append({
                "service": inst.get("instance_id", "unknown-instance"),
                "type": "AWS EC2",
                "environment": "Production",
                "status": "online" if inst.get("state") == "running" else inst.get("state", "unknown"),
                "health": inst.get("health", "unknown"),
                "endpoint": inst.get("public_ip") or inst.get("private_ip") or "—",
                "version": inst.get("instance_type", "—"),
                "response_time": None,
                "last_checked": aws.get("checked_at"),
                "risk": 60 if inst.get("health") == "critical" else (30 if inst.get("health") == "warning" else 5)
            })
        if not aws.get("instances"):
            services.append({
                "service": "AWS EC2 fleet", "type": "AWS", "environment": "Production",
                "status": "online", "health": "healthy", "endpoint": aws.get("region", "—"),
                "version": "—", "response_time": None, "last_checked": aws.get("checked_at"),
                "risk": 5
            })
    else:
        services.append({
            "service": "AWS EC2 fleet", "type": "AWS", "environment": "Production",
            "status": "unavailable", "health": "unknown", "endpoint": "—",
            "version": "—", "response_time": None,
            "last_checked": aws.get("checked_at") or _now(),
            "risk": 100
        })

    # ---------------- Jenkins: one row per job ----------------
    jenkins = systems.get("jenkins", {})
    if jenkins.get("status") == "success":
        for job in jenkins.get("jobs", []):
            color = str(job.get("status") or "").lower()
            health = "healthy" if color == "blue" else ("critical" if "red" in color else "warning")
            services.append({
                "service": job.get("name", "unknown-job"),
                "type": "Jenkins Job",
                "environment": "CI/CD",
                "status": "online",
                "health": health,
                "endpoint": job.get("url", "—"),
                "version": "—",
                "response_time": None,
                "last_checked": jenkins.get("checked_at"),
                "risk": 5 if health == "healthy" else (40 if health == "warning" else 80)
            })
        if not jenkins.get("jobs"):
            services.append({
                "service": "Jenkins", "type": "CI/CD", "environment": "CI/CD",
                "status": "online", "health": "healthy", "endpoint": jenkins.get("url", "—"),
                "version": "—", "response_time": None, "last_checked": jenkins.get("checked_at"),
                "risk": 5
            })
    else:
        services.append({
            "service": "Jenkins", "type": "CI/CD", "environment": "CI/CD",
            "status": "unavailable", "health": "unknown", "endpoint": jenkins.get("url", "—"),
            "version": "—", "response_time": None,
            "last_checked": jenkins.get("checked_at") or _now(),
            "risk": 100
        })

    # ---------------- Docker: one row per container ----------------
    docker = systems.get("docker", {})
    if docker.get("status") == "success":
        for c in docker.get("containers", []):
            services.append({
                "service": c.get("name", "unknown-container"),
                "type": "Docker Container",
                "environment": "Local",
                "status": "online" if c.get("status") == "running" else c.get("status", "unknown"),
                "health": "healthy" if c.get("status") == "running" else "warning",
                "endpoint": c.get("image", "—"),
                "version": c.get("id", "—"),
                "response_time": None,
                "last_checked": docker.get("checked_at"),
                "risk": 5 if c.get("status") == "running" else 35
            })
        if not docker.get("containers"):
            services.append({
                "service": "Docker Engine", "type": "Docker", "environment": "Local",
                "status": "online", "health": "healthy", "endpoint": "—",
                "version": "—", "response_time": None, "last_checked": docker.get("checked_at"),
                "risk": 5
            })
    else:
        services.append({
            "service": "Docker Engine", "type": "Docker", "environment": "Local",
            "status": "unavailable", "health": "unknown", "endpoint": "—",
            "version": "—", "response_time": None,
            "last_checked": docker.get("checked_at") or _now(),
            "risk": 100
        })

    # ---------------- Kubernetes: one row per node ----------------
    kubernetes = systems.get("kubernetes", {})
    if kubernetes.get("status") == "success":
        for node in kubernetes.get("nodes", []):
            services.append({
                "service": node.get("name", "unknown-node"),
                "type": f"K8s {node.get('role', 'node')}",
                "environment": "Cluster",
                "status": "online" if node.get("status") == "Ready" else "offline",
                "health": "healthy" if node.get("status") == "Ready" else "critical",
                "endpoint": "—",
                "version": node.get("version", "—"),
                "response_time": None,
                "last_checked": kubernetes.get("checked_at"),
                "risk": 5 if node.get("status") == "Ready" else 90
            })
        if not kubernetes.get("nodes"):
            services.append({
                "service": "Kubernetes cluster", "type": "Kubernetes", "environment": "Cluster",
                "status": "online", "health": "healthy", "endpoint": "—",
                "version": "—", "response_time": None, "last_checked": kubernetes.get("checked_at"),
                "risk": 5
            })
    else:
        services.append({
            "service": "Kubernetes cluster", "type": "Kubernetes", "environment": "Cluster",
            "status": "unavailable", "health": "unknown", "endpoint": "—",
            "version": "—", "response_time": None,
            "last_checked": kubernetes.get("checked_at") or _now(),
            "risk": 100
        })

    return {
        "status": "success",
        "count": len(services),
        "services": services,
        "checked_at": _now()
    }
