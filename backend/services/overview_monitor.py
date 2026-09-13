from datetime import datetime

from services.aws_monitor import get_ec2_instances
from services.jenkins_monitor import get_jenkins_status
from services.docker_monitor import get_docker_status
from services.kubernetes_monitor import get_kubernetes_status
from services.incidents_engine import process_overview
from services.event_log import add_log


def get_overview_status():

    checked_at = datetime.now().isoformat()

    # -----------------------------------------
    # Get live monitoring data
    # -----------------------------------------

    try:
        aws = get_ec2_instances()
    except Exception as error:
        aws = {
            "status": "error",
            "message": str(error)
        }

    try:
        jenkins = get_jenkins_status()
    except Exception as error:
        jenkins = {
            "status": "error",
            "message": str(error)
        }

    try:
        docker = get_docker_status()
    except Exception as error:
        docker = {
            "status": "error",
            "message": str(error)
        }

    try:
        kubernetes = get_kubernetes_status()
    except Exception as error:
        kubernetes = {
            "status": "error",
            "message": str(error)
        }

    # -----------------------------------------
    # Determine platform health
    # -----------------------------------------

    systems = [
        aws,
        jenkins,
        docker,
        kubernetes
    ]

    online_count = sum(
        1
        for system in systems
        if system.get("status") == "success"
    )

    total_systems = len(systems)

    if online_count == total_systems:
        platform_status = "healthy"
    elif online_count == 0:
        platform_status = "offline"
    else:
        platform_status = "degraded"

    health_score = round(
        (online_count / total_systems) * 100
    )

    # -----------------------------------------
    # Overview response
    # -----------------------------------------

    result = {
        "status": "success",

        "platform": {
            "name": "OpsMind",
            "status": platform_status,
            "health_score": health_score,
            "online_systems": online_count,
            "total_systems": total_systems
        },

        "systems": {
            "aws": aws,
            "jenkins": jenkins,
            "docker": docker,
            "kubernetes": kubernetes
        },

        "checked_at": checked_at
    }

    # -----------------------------------------
    # Keep real incident state + real event log
    # in sync with this check (does not change
    # the response shape above).
    # -----------------------------------------

    try:
        process_overview(result)
        add_log(
            "INFO" if platform_status == "healthy" else "WARNING",
            "platform",
            f"Overview check: {online_count}/{total_systems} systems online ({platform_status})",
            source="overview_monitor"
        )
    except Exception:
        pass  # never let logging/incident tracking break the overview response

    return result