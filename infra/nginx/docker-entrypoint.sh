#!/bin/sh
set -e

# Flashfix Nginx Gateway dynamic upstream resolution
# Resolves upstream targets from environment variables (e.g. Render Blueprint) with fallbacks for Docker Compose.

clean_host() {
  val="$1"
  default_port="$2"
  if [ -z "$val" ]; then
    echo ""
    return
  fi
  # Strip protocol and trailing paths or slashes
  val=$(echo "$val" | sed -e 's|^https\?://||' -e 's|/.*$||')
  case "$val" in
    *:*) echo "$val" ;;
    *) echo "${val}:${default_port}" ;;
  esac
}

export AUTH_UPSTREAM=$(clean_host "${AUTH_SERVICE_HOST:-${AUTH_SERVICE_URL:-${AUTH_HOST:-}}}" "3001")
export BOOKING_UPSTREAM=$(clean_host "${BOOKING_SERVICE_HOST:-${BOOKING_SERVICE_URL:-${BOOKING_HOST:-}}}" "3002")
export STORE_UPSTREAM=$(clean_host "${STORE_SERVICE_HOST:-${STORE_SERVICE_URL:-${STORE_HOST:-}}}" "3006")
export ADMIN_UPSTREAM=$(clean_host "${ADMIN_SERVICE_HOST:-${ADMIN_API_URL:-${ADMIN_HOST:-}}}" "3007")
export INVENTORY_UPSTREAM=$(clean_host "${INVENTORY_SERVICE_HOST:-${INVENTORY_SERVICE_URL:-${INVENTORY_HOST:-}}}" "3008")
export NOTIFY_UPSTREAM=$(clean_host "${NOTIFY_SERVICE_HOST:-${NOTIFY_SERVICE_URL:-${NOTIFY_HOST:-}}}" "3005")
export WEB_UPSTREAM=$(clean_host "${WEB_SERVICE_HOST:-${WEB_URL:-${WEB_HOST:-}}}" "80")
export ADMIN_PANEL_UPSTREAM=$(clean_host "${ADMIN_PANEL_SERVICE_HOST:-${ADMIN_PANEL_URL:-${ADMIN_PANEL_HOST:-}}}" "80")

TARGET_CONF="/etc/nginx/nginx.conf"

if [ -w "$TARGET_CONF" ]; then
  if [ -n "$AUTH_UPSTREAM" ]; then
    sed -i "s|server auth-service:3001;|server ${AUTH_UPSTREAM};|g" "$TARGET_CONF"
  fi
  if [ -n "$BOOKING_UPSTREAM" ]; then
    sed -i "s|server booking-service:3002;|server ${BOOKING_UPSTREAM};|g" "$TARGET_CONF"
  fi
  if [ -n "$STORE_UPSTREAM" ]; then
    sed -i "s|server store-service:3006;|server ${STORE_UPSTREAM};|g" "$TARGET_CONF"
  fi
  if [ -n "$ADMIN_UPSTREAM" ]; then
    sed -i "s|server admin-api:3007;|server ${ADMIN_UPSTREAM};|g" "$TARGET_CONF"
  fi
  if [ -n "$INVENTORY_UPSTREAM" ]; then
    sed -i "s|server inventory-service:3008;|server ${INVENTORY_UPSTREAM};|g" "$TARGET_CONF"
  fi
  if [ -n "$NOTIFY_UPSTREAM" ]; then
    sed -i "s|server notify-service:3005;|server ${NOTIFY_UPSTREAM};|g" "$TARGET_CONF"
  fi
  if [ -n "$WEB_UPSTREAM" ]; then
    sed -i "s|server web:80;|server ${WEB_UPSTREAM};|g" "$TARGET_CONF"
  fi
  if [ -n "$ADMIN_PANEL_UPSTREAM" ]; then
    sed -i "s|server admin-panel:80;|server ${ADMIN_PANEL_UPSTREAM};|g" "$TARGET_CONF"
  fi
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi
