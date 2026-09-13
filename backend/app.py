from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from datetime import datetime
from pathlib import Path

from services.aws_monitor import get_ec2_instances

from services.jenkins_monitor import get_jenkins_status

from services.docker_monitor import get_docker_status

from services.kubernetes_monitor import get_kubernetes_status


from services.overview_monitor import get_overview_status
from services.incidents_engine import get_incidents
from services.services_registry import get_services
from services.automation_engine import get_automation_status
from services.risk_engine import compute_risk
from services.detector import detect_anomalies
from services.event_log import get_logs
from services.settings_info import get_settings
from services.auth import verify_credentials, create_session, verify_session, destroy_session
from pydantic import BaseModel

# ==========================================================
# PATHS
# ==========================================================

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"


# ==========================================================
# FASTAPI APPLICATION
# ==========================================================

app = FastAPI(
    title="OpsMind API",
    description="Autonomous DevOps Monitoring & Remediation Platform",
    version="0.2.0"
)


# ==========================================================
# CORS
# ==========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================================
# API ROUTES
# ==========================================================

@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "opsmind-backend",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/aws/instances")
def aws_instances():
    return get_ec2_instances()


@app.get("/api/aws")
def aws_monitoring():
    return get_ec2_instances()

@app.get("/api/jenkins")
def jenkins_monitoring():
    return get_jenkins_status()

@app.get("/api/docker")
def docker_monitoring():
    return get_docker_status()

@app.get("/api/kubernetes")
def kubernetes_monitoring():
    return get_kubernetes_status()

@app.get("/api/overview")
def overview_monitoring():
    return get_overview_status()


@app.get("/api/services")
def services_endpoint():
    overview = get_overview_status()
    return get_services(overview)


@app.get("/api/incidents")
def incidents_endpoint():
    # process_overview() already runs as a side effect of
    # get_overview_status(), so incident state is fresh here.
    get_overview_status()
    return get_incidents()


@app.get("/api/automation")
def automation_endpoint():
    overview = get_overview_status()
    return get_automation_status(overview)


@app.get("/api/intelligence")
def intelligence_endpoint():
    overview = get_overview_status()
    risk = compute_risk(overview)
    anomalies = detect_anomalies(overview)
    return {
        "status": "success",
        "risk": risk,
        "anomalies": anomalies,
        "ai_connected": False,
        "note": "Rule-based analysis only. No LLM/AI provider is connected yet; this architecture is ready for one to be plugged in later."
    }


@app.get("/api/logs")
def logs_endpoint(limit: int = 200, level: str = "all", service: str = "all"):
    return {
        "status": "success",
        "logs": get_logs(limit=limit, level=level, service=service)
    }


@app.get("/api/settings")
def settings_endpoint():
    overview = get_overview_status()
    return get_settings(overview)


# ==========================================================
# AUTH — real session-based admin login
# ==========================================================

class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/auth/login")
def login(payload: LoginRequest):
    if not verify_credentials(payload.username, payload.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    session = create_session(payload.username)
    return {"status": "success", "token": session["token"], "expires_at": session["expires_at"]}


@app.get("/api/auth/verify")
def verify(authorization: str = Header(default="")):
    token = authorization.replace("Bearer ", "").strip()
    if not token or not verify_session(token):
        raise HTTPException(status_code=401, detail="Session invalid or expired")
    return {"status": "success", "valid": True}


@app.post("/api/auth/logout")
def logout(authorization: str = Header(default="")):
    token = authorization.replace("Bearer ", "").strip()
    if token:
        destroy_session(token)
    return {"status": "success"}




# ==========================================================
# ROOT
# ==========================================================

@app.get("/")
def root():
    return {
        "application": "OpsMind",
        "status": "online",
        "message": "Autonomous DevOps Command Center"
    }




# ==========================================================
# SERVE FRONTEND
# ==========================================================

if FRONTEND_DIR.exists():

    app.mount(
        "/",
        StaticFiles(
            directory=str(FRONTEND_DIR),
            html=True
        ),
        name="frontend"
    )

else:

    print(f"WARNING: Frontend directory not found: {FRONTEND_DIR}")