import boto3
from botocore.exceptions import BotoCoreError, ClientError
from datetime import datetime, timedelta, timezone


AWS_REGION = "ap-south-1"


def get_ec2_instances():
    try:
        ec2 = boto3.client("ec2", region_name=AWS_REGION)
        cloudwatch = boto3.client("cloudwatch", region_name=AWS_REGION)

        response = ec2.describe_instances()

        instances = []

        for reservation in response.get("Reservations", []):
            for instance in reservation.get("Instances", []):

                instance_id = instance.get("InstanceId")
                state = instance.get("State", {}).get("Name", "unknown")

                # -----------------------------------------
                # CloudWatch CPU
                # -----------------------------------------

                cpu_usage = None

                try:
                    end_time = datetime.now(timezone.utc)
                    start_time = end_time - timedelta(minutes=15)

                    metrics = cloudwatch.get_metric_statistics(
                        Namespace="AWS/EC2",
                        MetricName="CPUUtilization",
                        Dimensions=[
                            {
                                "Name": "InstanceId",
                                "Value": instance_id
                            }
                        ],
                        StartTime=start_time,
                        EndTime=end_time,
                        Period=300,
                        Statistics=["Average"]
                    )

                    datapoints = metrics.get("Datapoints", [])

                    if datapoints:
                        latest = sorted(
                            datapoints,
                            key=lambda x: x["Timestamp"]
                        )[-1]

                        cpu_usage = round(
                            latest.get("Average", 0),
                            2
                        )

                except Exception:
                    cpu_usage = None

                # -----------------------------------------
                # Health calculation
                # -----------------------------------------

                if state == "running":
                    if cpu_usage is not None and cpu_usage >= 90:
                        health = "critical"
                    elif cpu_usage is not None and cpu_usage >= 75:
                        health = "warning"
                    else:
                        health = "healthy"

                elif state in ["stopped", "stopping"]:
                    health = "stopped"

                elif state in ["pending", "rebooting"]:
                    health = "transitioning"

                else:
                    health = "unknown"

                # -----------------------------------------
                # Instance information
                # -----------------------------------------

                instances.append({
                    "instance_id": instance_id,
                    "state": state,
                    "health": health,
                    "cpu_utilization": cpu_usage,
                    "instance_type": instance.get("InstanceType"),
                    "private_ip": instance.get("PrivateIpAddress"),
                    "public_ip": instance.get("PublicIpAddress"),
                    "availability_zone": instance.get(
                        "Placement", {}
                    ).get("AvailabilityZone")
                })

        # ---------------------------------------------
        # Overall AWS health
        # ---------------------------------------------

        if not instances:
            overall_health = "no-instances"

        elif any(
            instance["health"] == "critical"
            for instance in instances
        ):
            overall_health = "critical"

        elif any(
            instance["health"] == "warning"
            for instance in instances
        ):
            overall_health = "warning"

        elif all(
            instance["health"] == "healthy"
            for instance in instances
        ):
            overall_health = "healthy"

        else:
            overall_health = "unknown"

        return {
            "status": "success",
            "region": AWS_REGION,
            "overall_health": overall_health,
            "instance_count": len(instances),
            "checked_at": datetime.now(
                timezone.utc
            ).isoformat(),
            "instances": instances
        }

    except (BotoCoreError, ClientError) as error:
        return {
            "status": "error",
            "region": AWS_REGION,
            "message": str(error)
        }

    except Exception as error:
        return {
            "status": "error",
            "region": AWS_REGION,
            "message": str(error)
        }