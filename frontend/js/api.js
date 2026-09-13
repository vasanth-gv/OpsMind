const API_BASE_URL = "http://127.0.0.1:8000";

async function fetchAWSData() {
    const response = await fetch(`${API_BASE_URL}/api/aws`);
    return await response.json();
}