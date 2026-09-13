import requests
from datetime import datetime, timezone


# ==========================================================
# JENKINS CONFIGURATION
# ==========================================================

JENKINS_URL = "http://localhost:8080"


# ==========================================================
# JENKINS MONITOR
# ==========================================================

def get_jenkins_status():

    try:
        response = requests.get(
            f"{JENKINS_URL}/api/json",
            params={
                "tree": "jobs[name,url,color]"
            },
            timeout=5
        )

        # Jenkins reachable
        response.raise_for_status()

        data = response.json()

        jobs = data.get("jobs", [])

        running = 0
        successful = 0
        failed = 0

        for job in jobs:

            color = str(job.get("color", "")).lower()

            # Jenkins uses these colors to represent job state
            if color in ["blue_anime", "red_anime", "yellow_anime"]:
                running += 1

            elif color == "blue":
                successful += 1

            elif color in ["red", "aborted", "notbuilt"]:
                failed += 1

        return {
            "status": "success",
            "jenkins": "online",
            "url": JENKINS_URL,
            "job_count": len(jobs),
            "running_jobs": running,
            "successful_jobs": successful,
            "failed_jobs": failed,
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "jobs": [
                {
                    "name": job.get("name"),
                    "url": job.get("url"),
                    "status": job.get("color")
                }
                for job in jobs
            ]
        }

    except requests.exceptions.ConnectionError:

        return {
            "status": "error",
            "jenkins": "offline",
            "url": JENKINS_URL,
            "message": "Cannot connect to Jenkins",
            "checked_at": datetime.now(timezone.utc).isoformat()
        }

    except requests.exceptions.Timeout:

        return {
            "status": "error",
            "jenkins": "timeout",
            "url": JENKINS_URL,
            "message": "Jenkins connection timed out",
            "checked_at": datetime.now(timezone.utc).isoformat()
        }

    except requests.exceptions.RequestException as error:

        return {
            "status": "error",
            "jenkins": "error",
            "url": JENKINS_URL,
            "message": str(error),
            "checked_at": datetime.now(timezone.utc).isoformat()
        }

    except Exception as error:

        return {
            "status": "error",
            "jenkins": "error",
            "url": JENKINS_URL,
            "message": str(error),
            "checked_at": datetime.now(timezone.utc).isoformat()
        }