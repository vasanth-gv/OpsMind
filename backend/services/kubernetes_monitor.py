from datetime import datetime
from kubernetes import client, config


def get_kubernetes_status():

    try:
        # Load Docker Desktop Kubernetes config
        config.load_kube_config()

        v1 = client.CoreV1Api()

        # Get nodes
        nodes_response = v1.list_node()

        # Get all pods
        pods_response = v1.list_pod_for_all_namespaces()

        nodes = []
        pods = []

        running_pods = 0
        stopped_pods = 0

        # -----------------------------
        # NODES
        # -----------------------------

        for node in nodes_response.items:

            node_name = node.metadata.name

            node_status = "Unknown"

            for condition in node.status.conditions or []:

                if condition.type == "Ready":

                    node_status = (
                        "Ready"
                        if condition.status == "True"
                        else "NotReady"
                    )

            nodes.append({
                "name": node_name,
                "status": node_status,
                "role": (
                    "control-plane"
                    if "control-plane"
                    in (node.metadata.labels or {})
                    else "worker"
                ),
                "version": (
                    node.status.node_info.kubelet_version
                    if node.status.node_info
                    else "unknown"
                )
            })

        # -----------------------------
        # PODS
        # -----------------------------

        for pod in pods_response.items:

            pod_status = (
                pod.status.phase
                if pod.status
                else "Unknown"
            )

            if pod_status == "Running":
                running_pods += 1
            else:
                stopped_pods += 1

            pods.append({
                "name": pod.metadata.name,
                "namespace": pod.metadata.namespace,
                "status": pod_status,
                "node": pod.spec.node_name
            })

        # -----------------------------
        # RESPONSE
        # -----------------------------

        return {
            "status": "success",
            "kubernetes": "online",

            "node_count": len(nodes),

            "pod_count": len(pods),

            "running_pods": running_pods,

            "stopped_pods": stopped_pods,

            "checked_at": datetime.now().isoformat(),

            "nodes": nodes,

            "pods": pods
        }

    except Exception as error:

        return {
            "status": "error",
            "kubernetes": "offline",

            "node_count": 0,
            "pod_count": 0,

            "running_pods": 0,
            "stopped_pods": 0,

            "checked_at": datetime.now().isoformat(),

            "nodes": [],
            "pods": [],

            "message": str(error)
        }