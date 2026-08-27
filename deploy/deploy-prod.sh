#!/bin/sh

set -eu

NEW_IMAGE_TAG="${1:?image tag is required}"
DEPLOY_DIRECTORY="/opt/nms-dashboard"
AUTH_FILE="/etc/nms-dashboard/infisical-auth.env"
COMPOSE_FILE="$DEPLOY_DIRECTORY/docker-compose.prod.yml"
CURRENT_TAG_FILE="$DEPLOY_DIRECTORY/.current-image-tag"

cd "$DEPLOY_DIRECTORY"

if [ ! -f "$AUTH_FILE" ]; then
  echo "Infisical authentication file not found: $AUTH_FILE"
  exit 1
fi

set -a
. "$AUTH_FILE"
set +a

: "${INFISICAL_DOMAIN:=https://app.infisical.com}"

command -v docker >/dev/null 2>&1 || {
  echo "docker command not found"
  exit 1
}

docker compose version >/dev/null 2>&1 || {
  echo "docker compose command not available"
  exit 1
}

command -v infisical >/dev/null 2>&1 || {
  echo "infisical command not found"
  exit 1
}

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Compose file not found: $COMPOSE_FILE"
  exit 1
fi

export INFISICAL_TOKEN="$(
  infisical login \
    --domain="$INFISICAL_DOMAIN" \
    --method=universal-auth \
    --client-id="$INFISICAL_CLIENT_ID" \
    --client-secret="$INFISICAL_CLIENT_SECRET" \
    --silent \
    --plain
)"

PREVIOUS_IMAGE_TAG=""

if [ -f "$CURRENT_TAG_FILE" ]; then
  PREVIOUS_IMAGE_TAG="$(cat "$CURRENT_TAG_FILE")"
fi

deploy_image() {
  export IMAGE_TAG="$1"

  infisical run \
    --domain="$INFISICAL_DOMAIN" \
    --projectId="$INFISICAL_PROJECT_ID" \
    --env=prod \
    --path=/runtime \
    -- sh -eu -c '
      echo "$DOCKERHUB_READ_TOKEN" |
        docker login \
          --username "$DOCKERHUB_USERNAME" \
          --password-stdin

      docker compose \
        -f /opt/nms-dashboard/docker-compose.prod.yml \
        pull

      docker compose \
        -f /opt/nms-dashboard/docker-compose.prod.yml \
        up -d \
        --remove-orphans

      docker logout
    '
}

containers_healthy() {
  attempt=0

  while [ "$attempt" -lt 30 ]; do
    BFF_ID="$(
      docker compose -f "$COMPOSE_FILE" ps -q nms-bff
    )"

    WEB_ID="$(
      docker compose -f "$COMPOSE_FILE" ps -q nms-web
    )"

    if [ -z "$BFF_ID" ] || [ -z "$WEB_ID" ]; then
      attempt=$((attempt + 1))
      sleep 2
      continue
    fi

    BFF_STATUS="$(
      docker inspect \
        --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
        "$BFF_ID" 2>/dev/null || true
    )"

    WEB_STATUS="$(
      docker inspect \
        --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
        "$WEB_ID" 2>/dev/null || true
    )"

    if [ "$BFF_STATUS" = "healthy" ] &&
       [ "$WEB_STATUS" = "healthy" ]; then
      return 0
    fi

    attempt=$((attempt + 1))
    sleep 2
  done

  return 1
}

echo "Deploying image tag: $NEW_IMAGE_TAG"

deploy_image "$NEW_IMAGE_TAG"

if containers_healthy; then
  printf "%s\n" "$NEW_IMAGE_TAG" > "$CURRENT_TAG_FILE"
  echo "Deployment successful: $NEW_IMAGE_TAG"
  exit 0
fi

echo "Deployment health check failed."

if [ -n "$PREVIOUS_IMAGE_TAG" ]; then
  echo "Rolling back to: $PREVIOUS_IMAGE_TAG"
  deploy_image "$PREVIOUS_IMAGE_TAG"

  if containers_healthy; then
    echo "Rollback successful."
  else
    echo "Rollback failed."
  fi
fi

exit 1
