# Calling Another Pod Directly Within AKS (Same Namespace)

Pods running in AKS can call each other **directly** through the cluster's internal
DNS (provided by CoreDNS), bypassing any external load balancer or ingress
("front door"). This keeps traffic inside the cluster — lower latency, and no
public ingress consumed.

## URL Format

For a **Service** in the same namespace, the shorthand is just the service name:

```
http://<service-name>:<port>
```

Longer forms (all valid, increasing specificity):

| Scope                        | Format                                              |
| ---------------------------- | --------------------------------------------------- |
| Same namespace (shorthand)   | `http://my-service:8080`                            |
| Cross-namespace              | `http://my-service.my-namespace:8080`               |
| Fully qualified (FQDN)       | `http://my-service.my-namespace.svc.cluster.local:8080` |

## Key Points

- **Use the Service name, not the pod name.** The Service provides a stable
  `ClusterIP` and load-balances across the pods behind it. Pod IPs are ephemeral.
- **`<port>` is the Service's port** (the `port` field in the Service spec),
  which may differ from the container's `targetPort`.
- **Scheme is whatever your app speaks** — `http`, `https`, gRPC, etc. Internal
  traffic typically uses plain `http` since it stays inside the cluster (unless a
  service mesh is doing mTLS).
- Traffic stays inside the cluster — no hop out to the Azure load balancer.

## Example

Given a Service fronting the target pods:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: orchestrator
  namespace: genai
spec:
  selector:
    app: orchestrator
  ports:
    - port: 80
      targetPort: 3000
```

From a pod in the same `genai` namespace you'd call:

```
http://orchestrator/api/whatever
```

or fully qualified:

```
http://orchestrator.genai.svc.cluster.local/api/whatever
```

## Caveat

This requires a **Service** object to exist for the target pods. If you only have
a bare Deployment with no Service, create one (typically `ClusterIP` type — the
default) to get the stable DNS name.
