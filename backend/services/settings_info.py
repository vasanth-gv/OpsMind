"""
Read-only settings/configuration info.

Only ever returns NON-SECRET configuration (URLs, regions, intervals).
No AWS keys, Jenkins tokens, or other credentials are read from
environment/config here -- those stay server-side inside boto3 /
requests and are never serialized into an API response.
"""

from services.aws_monitor import AWS_REGION
from services.jenkins_monitor import JENKINS_URL


def get_settings(overview: dict):
    systems = (overview or {}).get("systems", {})

    def conn_status(sys_data):
        return "CONNECTED" if sys_data.get("status") == "success" else "UNAVAILABLE"

    return {
        "status": "success",
        "backend": {
            "url": "http://127.0.0.1:8000",
            "overview_refresh_interval_seconds": 15
        },
        "integrations": {
            "aws": {
                "status": conn_status(systems.get("aws", {})),
                "region": AWS_REGION
            },
            "jenkins": {
                "status": conn_status(systems.get("jenkins", {})),
                "url": JENKINS_URL
            },
            "docker": {
                "status": conn_status(systems.get("docker", {}))
            },
            "kubernetes": {
                "status": conn_status(systems.get("kubernetes", {}))
            }
        },
        "notes": [
            "Credentials are configured via environment/AWS CLI/kubeconfig on the backend host only.",
            "No secrets are ever returned by this API."
        ]
    }
