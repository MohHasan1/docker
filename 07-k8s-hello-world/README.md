# Kubernetes Hello World

A small Kubernetes exercise that deploys a Spring Boot application, supplies its message from a ConfigMap, and exposes it through a NodePort Service.

## Resources

| File | Purpose |
| --- | --- |
| `config.yaml` | Creates the `app-config` ConfigMap used by the application. |
| `app.yaml` | Creates the `hello-world` Deployment and its NodePort Service. |
| `secret.yaml` | Demonstrates an opaque Kubernetes Secret; it is not consumed by the Deployment. |
| `service.yaml` | Standalone Service experiment. Do not apply it with `app.yaml`, which already defines the `hello-world` Service. |
| `cmd.txt` | Short command notes from the exercise. |

The Deployment runs one `embarkx/hello-spring:latest` container on port `8080`. The Service exposes the application on NodePort `30000`.

## Prerequisites

- Docker Desktop with Kubernetes enabled, or another local Kubernetes cluster
- `kubectl`
- A current Kubernetes context that points to the intended cluster

For Docker Desktop, check the cluster before deploying:

```powershell
kubectl config use-context docker-desktop
kubectl cluster-info
kubectl get nodes
```

The `docker-desktop` node should report `Ready`.

## Deploy

From this directory, create the ConfigMap before the Deployment:

```powershell
kubectl apply -f config.yaml
kubectl apply -f app.yaml
```

Do not use `kubectl apply -f .` for this exercise. Both `app.yaml` and `service.yaml` define a Service named `hello-world`, but with different port settings.

Check the deployed resources:

```powershell
kubectl get deployments
kubectl get pods
kubectl get services
```

When the pod is running, open <http://localhost:30000>.

## Configuration

`config.yaml` defines `APP_MESSAGE`. The Deployment maps it to the container's `ENV_VALUE` environment variable:

```text
ConfigMap app-config / APP_MESSAGE -> container / ENV_VALUE
```

After changing the ConfigMap, apply it and restart the Deployment because environment variables in existing pods do not update automatically:

```powershell
kubectl apply -f config.yaml
kubectl rollout restart deployment/hello-world
kubectl rollout status deployment/hello-world
```

`secret.yaml` is only a learning example. Its Base64 value is encoding, not encryption, and must not be used for a real password.

## Troubleshooting

Inspect a pod that is not starting:

```powershell
kubectl get pods
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

If `kubectl` tries to connect to `http://localhost:8080` or reports that it cannot download OpenAPI data, verify that Kubernetes is running and that the correct context is selected:

```powershell
kubectl config current-context
kubectl config get-contexts
kubectl cluster-info
```

On Docker Desktop for Windows, a Kubernetes startup failure mentioning cgroup v1 can usually be resolved by updating and restarting WSL, then restarting Docker Desktop:

```powershell
wsl --update
wsl --shutdown
```

After Docker Desktop restarts, verify that `docker info --format '{{.CgroupVersion}}'` prints `2` and that `kubectl get nodes` reports a ready node. Resetting the Kubernetes cluster from Docker Desktop's troubleshooting screen is a last resort because it removes local Kubernetes resources.

## Clean up

```powershell
kubectl delete -f app.yaml
kubectl delete -f config.yaml
```

If you created the example Secret, remove it separately:

```powershell
kubectl delete -f secret.yaml
```
