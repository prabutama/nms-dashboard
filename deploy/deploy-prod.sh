#!/bin/sh

set -eu

NEW_IMAGE_TAG="${1:?image tag is required}"
RUNTIME_MODE="${2:-}"
DEPLOY_DIRECTORY="/opt/nms-dashboard"
AUTH_FILE="/etc/nms-dashboard/infisical-auth.env"
CURRENT_TAG_FILE="$DEPLOY_DIRECTORY/.current-image-tag"
NAMESPACE="nms"
KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
export KUBECONFIG

cd "$DEPLOY_DIRECTORY"

if [ ! -f "$AUTH_FILE" ]; then
  echo "Infisical authentication file not found: $AUTH_FILE"
  exit 1
fi

set -a
. "$AUTH_FILE"
set +a

: "${INFISICAL_DOMAIN:=https://app.infisical.com}"

command -v kubectl >/dev/null 2>&1 || {
  echo "kubectl command not found"
  exit 1
}

command -v infisical >/dev/null 2>&1 || {
  echo "infisical command not found"
  exit 1
}

if [ ! -f "$KUBECONFIG" ]; then
  echo "kubeconfig not found: $KUBECONFIG"
  exit 1
fi

export INFISICAL_DISABLE_UPDATE_CHECK=true
export INFISICAL_TOKEN="$(infisical login \
  --domain="$INFISICAL_DOMAIN" \
  --method=universal-auth \
  --client-id="$INFISICAL_CLIENT_ID" \
  --client-secret="$INFISICAL_CLIENT_SECRET" \
  --silent \
  --plain)"

PREVIOUS_IMAGE_TAG=""
if [ -f "$CURRENT_TAG_FILE" ]; then
  PREVIOUS_IMAGE_TAG="$(cat "$CURRENT_TAG_FILE")"
fi

render_manifests() {
  image_tag="$1"
  render_directory="$(mktemp -d)"

  for manifest in 01-secret.yaml 02-deployment.yaml 03-service.yaml 04-ingress.yaml; do
    sed \
      -e "s|__DOCKERHUB_NAMESPACE__|$DOCKERHUB_NAMESPACE|g" \
      -e "s|__IMAGE_TAG__|$image_tag|g" \
      "$manifest" > "$render_directory/$manifest"
  done

  printf "%s\n" "$render_directory"
}

sync_secrets() {
  : "${THINGSBOARD_API_KEY:?THINGSBOARD_API_KEY is required from Infisical runtime secrets}"
  : "${DOCKERHUB_USERNAME:?DOCKERHUB_USERNAME is required from Infisical runtime secrets}"
  : "${DOCKERHUB_READ_TOKEN:?DOCKERHUB_READ_TOKEN is required from Infisical runtime secrets}"

  kubectl -n "$NAMESPACE" create secret generic nms-bff-secrets \
    --from-literal="THINGSBOARD_API_KEY=$THINGSBOARD_API_KEY" \
    --dry-run=client \
    -o yaml |
    kubectl apply -f -

  kubectl -n "$NAMESPACE" create secret docker-registry dockerhub-registry \
    --docker-server=https://index.docker.io/v1/ \
    --docker-username="$DOCKERHUB_USERNAME" \
    --docker-password="$DOCKERHUB_READ_TOKEN" \
    --dry-run=client \
    -o yaml |
    kubectl apply -f -
}

deploy_image() {
  image_tag="$1"
  render_directory="$(render_manifests "$image_tag")"

  kubectl apply -f "$render_directory/01-secret.yaml"
  sync_secrets

  kubectl apply \
    -f "$render_directory/02-deployment.yaml" \
    -f "$render_directory/03-service.yaml" \
    -f "$render_directory/04-ingress.yaml"

  kubectl -n "$NAMESPACE" rollout status deployment/nms-bff --timeout=180s
  kubectl -n "$NAMESPACE" rollout status deployment/nms-web --timeout=180s

  rm -rf "$render_directory"
}

deploy_with_infisical() {
  image_tag="$1"

  infisical run \
    --domain="$INFISICAL_DOMAIN" \
    --projectId="$INFISICAL_PROJECT_ID" \
    --env=prod \
    --path=/runtime \
    -- "$0" "$image_tag" --runtime
}

if [ "$RUNTIME_MODE" = "--runtime" ]; then
  : "${DOCKERHUB_NAMESPACE:?DOCKERHUB_NAMESPACE is required}"
  : "${THINGSBOARD_API_KEY:?THINGSBOARD_API_KEY is required}"
  : "${DOCKERHUB_USERNAME:?DOCKERHUB_USERNAME is required}"
  : "${DOCKERHUB_READ_TOKEN:?DOCKERHUB_READ_TOKEN is required}"
  deploy_image "$NEW_IMAGE_TAG"
  exit 0
fi

echo "Deploying image tag: $NEW_IMAGE_TAG"

if deploy_with_infisical "$NEW_IMAGE_TAG"; then
  printf "%s\n" "$NEW_IMAGE_TAG" > "$CURRENT_TAG_FILE"
  echo "Deployment successful: $NEW_IMAGE_TAG"
  exit 0
fi

echo "Deployment failed. Attempting rollback."

if [ -n "$PREVIOUS_IMAGE_TAG" ]; then
  echo "Rolling back to: $PREVIOUS_IMAGE_TAG"
  if deploy_with_infisical "$PREVIOUS_IMAGE_TAG"; then
    echo "Rollback successful: $PREVIOUS_IMAGE_TAG"
  else
    echo "Rollback failed. Inspect the Kubernetes deployment immediately."
  fi
else
  echo "No previous image tag is available for rollback."
fi

exit 1
