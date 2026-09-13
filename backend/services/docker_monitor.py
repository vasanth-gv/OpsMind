import docker
from datetime import datetime


def get_docker_status():

    try:
        client = docker.from_env()

        containers = client.containers.list(all=True)
        images = client.images.list()

        container_data = []

        running_count = 0
        stopped_count = 0

        for container in containers:

            status = container.status

            if status == "running":
                running_count += 1
            else:
                stopped_count += 1

            # Get actual image name
            image_name = "unknown"

            try:
                if container.image.tags:
                    image_name = container.image.tags[0]
                else:
                    image_name = container.image.short_id
            except Exception:
                image_name = "unknown"

            # Format ports
            ports = {}

            try:
                for container_port, bindings in container.ports.items():

                    if bindings:
                        ports[container_port] = bindings
                    else:
                        ports[container_port] = []

            except Exception:
                ports = {}

            container_data.append({

                "id": container.short_id,

                "name": container.name,

                "status": status,

                "image": image_name,

                "ports": ports,

                "created": container.attrs.get(
                    "Created",
                    ""
                )

            })

        return {

            "status": "success",

            "docker": "online",

            "container_count": len(containers),

            "running_containers": running_count,

            "stopped_containers": stopped_count,

            "image_count": len(images),

            "checked_at": datetime.now().isoformat(),

            "containers": container_data

        }

    except Exception as error:

        return {

            "status": "error",

            "docker": "offline",

            "container_count": 0,

            "running_containers": 0,

            "stopped_containers": 0,

            "image_count": 0,

            "checked_at": datetime.now().isoformat(),

            "containers": [],

            "message": str(error)

        }