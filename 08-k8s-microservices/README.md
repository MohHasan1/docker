# Kubernetes Microservices

This exercise deploys two services that communicate inside a Kubernetes cluster:

- **Service A** runs on port `3000` and is exposed outside the cluster through NodePort `30000`.
- **Service B** runs on port `4000` and is available only inside the cluster through a ClusterIP Service.

## Request flow

```text
Browser
  |
  | http://localhost:30000
  v
Kubernetes Service: service-a-price
  |
  v
Service A pod
  |
  | http://service-b-tax:4000
  v
Kubernetes Service: service-b-tax
  |
  v
Service B pod
```

## Why applications use Service names

Pods created by a Deployment are temporary. Kubernetes can replace a pod during a restart, update, rescheduling event, or failure. Replacement pods receive new generated names and IP addresses, for example:

```text
service-b-tax-7d8c9f6b5-x2abc
```

A Kubernetes Service provides a stable name and virtual IP in front of matching pods. It also distributes requests when a Deployment has multiple replicas.

Applications should therefore call the Service's `metadata.name`, not a Deployment name, pod name, or container name.

Within the same namespace, Service B is available at:

```text
http://service-b-tax:4000
```

Its fully qualified cluster DNS name is:

```text
service-b-tax.default.svc.cluster.local
```

The short name is normally sufficient when both applications are in the same namespace.

## Required URL

The Service in `app2.yaml` is named `service-b-tax`:

```yaml
metadata:
  name: service-b-tax
```

The `TAX_SERVICE_URL` value in `app1.yaml` must use the same name:

```yaml
env:
  - name: TAX_SERVICE_URL
    value: "http://service-b-tax:4000"
```

Use a plain URL in YAML. Markdown link syntax such as `[URL](URL)` is not valid for this environment-variable value.

## Resource relationships

Kubernetes Services select pods by labels:

| Resource | Selector or label | Port |
| --- | --- | --- |
| Service A Deployment pods | `app: service-a` | `3000` |
| `service-a-price` Service | `app: service-a` | `3000`, NodePort `30000` |
| Service B Deployment pods | `app: service-b` | `4000` |
| `service-b-tax` Service | `app: service-b` | `4000`, ClusterIP |

The Service selector must match the labels on its target pods. The Service name does not need to match the Deployment, pod, or container name.

## Deploy

From this directory, apply both manifests:

```powershell
kubectl apply -f app2.yaml
kubectl apply -f app1.yaml
```

The order is not strictly required, but creating Service B first ensures its stable cluster address exists before Service A starts making requests.

Check the resources:

```powershell
kubectl get deployments
kubectl get pods
kubectl get services
```

Wait for both Deployments:

```powershell
kubectl rollout status deployment/service-a-price
kubectl rollout status deployment/service-b-tax
```

Open Service A at <http://localhost:30000>.

## Verify internal DNS

Find the Service A pod:

```powershell
kubectl get pods -l app=service-a
```

Test whether the Service name resolves from that pod:

```powershell
kubectl exec <service-a-pod> -- getent hosts service-b-tax
```

This command depends on the container image including `getent`. If it is unavailable, inspect the application logs instead:

```powershell
kubectl logs deployment/service-a-price
kubectl logs deployment/service-b-tax
```

Useful endpoint checks:

```powershell
kubectl get endpoints service-a-price
kubectl get endpoints service-b-tax
```

Each Service should list at least one pod IP. An empty endpoint list usually means that the Service selector does not match any ready pods.

## Troubleshooting

### Service name does not resolve

Confirm that the Service exists in the same namespace:

```powershell
kubectl get service service-b-tax
kubectl config view --minify --output "jsonpath={..namespace}"
```

If the applications use different namespaces, use:

```text
http://service-b-tax.<namespace>:4000
```

### Connection refused

Check that Service B is running and listening on port `4000`:

```powershell
kubectl get pods -l app=service-b
kubectl describe service service-b-tax
kubectl logs deployment/service-b-tax
```

### Service has no endpoints

Compare the Service selector with the pod labels:

```powershell
kubectl get service service-b-tax -o wide
kubectl get pods --show-labels
```

## Clean up

Delete only the resources created by these manifests:

```powershell
kubectl delete -f app1.yaml
kubectl delete -f app2.yaml
```

Avoid `kubectl delete all --all` unless you intend to remove all common workload resources from the current namespace.
