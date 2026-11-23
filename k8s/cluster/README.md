# Cluster bootstrap — `website` AKS cluster

Cluster-wide prerequisites for the `website` cluster (RG `website_group`,
francecentral), which hosts both **audit.gov.gh** (production) and
**test.audit.gov.gh** (staging). Everything here is plain YAML applied with
`kubectl` (no Helm). Upstream manifests are vendored at a pinned version and
customised with Kustomize patches, so an upgrade is: replace the vendored
file, bump the name in `kustomization.yaml`, re-render, apply.

| Component     | Version           | Source                                                        |
| ------------- | ----------------- | ------------------------------------------------------------- |
| cert-manager  | v1.21.2           | `cert-manager/cert-manager` release asset `cert-manager.yaml` |
| ingress-nginx | controller-1.15.1 | `deploy/static/provider/cloud/deploy.yaml` (upstream retired) |

Ingress IP: **40.89.171.199** — static Public IP `pip-website-ingress` in
`website_group` (outside the auto-managed `MC_*` group, so it survives a
cluster rebuild). All public hostnames point here.

## One-time Azure steps (az CLI)

```bash
# Static inbound IP, owned by us rather than by the cluster
az network public-ip create -g website_group -n pip-website-ingress \
  --sku Standard --allocation-method static -l francecentral

# Let the cluster's control-plane identity attach that IP to its load balancer
az role assignment create --role "Network Contributor" \
  --assignee-object-id "$(az aks show -g website_group -n website --query identity.principalId -o tsv)" \
  --assignee-principal-type ServicePrincipal \
  --scope "$(az group show -n website_group --query id -o tsv)"

# Image pulls from the shared registry (kubelet identity gets AcrPull)
az aks update -g website_group -n website --attach-acr regisry

# Blob CSI driver: provides the azureblob-nfs-premium class used by the
# ReadWriteMany public-files PVC
az aks update -g website_group -n website --enable-blob-driver --yes

az aks get-credentials -g website_group -n website --context website
```

## Apply order

```bash
kubectl --context website apply -k k8s/cluster/cert-manager
kubectl --context website -n cert-manager rollout status \
  deploy/cert-manager deploy/cert-manager-webhook deploy/cert-manager-cainjector

kubectl --context website apply -k k8s/cluster/ingress-nginx
kubectl --context website -n ingress-nginx rollout status deploy/ingress-nginx-controller
kubectl --context website -n ingress-nginx get svc ingress-nginx-controller   # EXTERNAL-IP 40.89.171.199

# ClusterIssuer last: its CRD and the webhook must exist first
kubectl --context website apply -f k8s/cluster/cert-manager/cluster-issuer.yaml
kubectl --context website get clusterissuer letsencrypt-prod                  # READY True
```

## Verify

```bash
curl -sI http://40.89.171.199/        # HTTP/1.1 404 Not Found from nginx
kubectl --context website get sc | grep azureblob
```

## Settings worth knowing

- `ingress-nginx/patches/controller-config.yaml` sets `http-redirect-code: 301`
  (www → apex), hides the app's one-year HSTS header and sends a short one
  (`hsts-max-age: 300`) instead — raise in steps after go-live, and disables
  snippet annotations.
- `externalTrafficPolicy: Local` keeps real client IPs for the app's rate
  limiter and analytics.
- The cluster is on the AKS **Free** tier, with no availability zones and no
  network policy engine. Revisit before the apex DNS record moves.
