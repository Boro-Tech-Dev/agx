#!/usr/bin/env bash
# Host swap bootstrap for VPS deployments (Ollama + rerankers + Playwright stack).
# Does not touch Docker volumes or Compose state. Brief swapoff when replacing smaller swap.
#
# Usage: sudo ./scripts/setup-swap.sh
# Env:   SWAP_SIZE_GB (default 64), SWAP_FILE (default /swapfile), SWAPPINESS (default 10)
set -euo pipefail

SWAP_SIZE_GB="${SWAP_SIZE_GB:-64}"
SWAP_FILE="${SWAP_FILE:-/swapfile}"
SWAPPINESS="${SWAPPINESS:-10}"
DISK_BUFFER_GB=5

if [[ "$(id -u)" -ne 0 ]]; then
  echo "setup-swap: run as root (e.g. sudo ./scripts/setup-swap.sh)" >&2
  exit 1
fi

if ! [[ "$SWAP_SIZE_GB" =~ ^[0-9]+$ ]] || [[ "$SWAP_SIZE_GB" -lt 1 ]]; then
  echo "setup-swap: SWAP_SIZE_GB must be a positive integer (got: ${SWAP_SIZE_GB})" >&2
  exit 1
fi

target_bytes=$((SWAP_SIZE_GB * 1024 * 1024 * 1024))
required_free_bytes=$(((SWAP_SIZE_GB + DISK_BUFFER_GB) * 1024 * 1024 * 1024))

swap_total_kb() {
  awk '/^SwapTotal:/ {print $2; exit}' /proc/meminfo
}

current_swap_bytes() {
  local kb
  kb="$(swap_total_kb)"
  echo $((kb * 1024))
}

remove_fstab_swap_for_file() {
  local file="$1"
  if [[ ! -f /etc/fstab ]]; then
    return 0
  fi
  local tmp
  tmp="$(mktemp)"
  grep -Fv "$file" /etc/fstab >"$tmp" || true
  mv "$tmp" /etc/fstab
}

ensure_fstab_entry() {
  local file="$1"
  local line="$file none swap sw 0 0"
  if [[ -f /etc/fstab ]] && grep -qF "$line" /etc/fstab; then
    return 0
  fi
  echo "$line" >>/etc/fstab
  echo "setup-swap: appended to /etc/fstab: $line"
}

create_swap_file() {
  local path="$1"
  local size_gb="$2"
  echo "setup-swap: allocating ${size_gb}G at ${path}..."
  if fallocate -l "${size_gb}G" "$path" 2>/dev/null; then
    :
  else
    echo "setup-swap: fallocate failed; using dd (slower)..."
    dd if=/dev/zero of="$path" bs=1M count=$((size_gb * 1024)) status=progress
  fi
  chmod 600 "$path"
  mkswap "$path"
  swapon "$path"
}

configure_swappiness() {
  local conf="/etc/sysctl.d/99-agent-x-swappiness.conf"
  echo "vm.swappiness=${SWAPPINESS}" >"$conf"
  sysctl -p "$conf" >/dev/null
  echo "setup-swap: vm.swappiness=${SWAPPINESS} (${conf})"
}

current="$(current_swap_bytes)"
echo "setup-swap: target ${SWAP_SIZE_GB}G (${target_bytes} bytes); current swap ${current} bytes"

if [[ "$current" -ge "$target_bytes" ]]; then
  echo "setup-swap: swap already meets or exceeds target; nothing to do."
  free -h
  swapon --show || true
  exit 0
fi

if [[ "$current" -gt 0 ]]; then
  echo "setup-swap: replacing existing swap (swapoff -a)..."
  swapoff -a || true
fi

# Drop fstab lines for this swap file and remove stale file before recreate.
remove_fstab_swap_for_file "$SWAP_FILE"
if [[ -f "$SWAP_FILE" ]]; then
  echo "setup-swap: removing existing ${SWAP_FILE}"
  rm -f "$SWAP_FILE"
fi

swap_dir="$(dirname "$SWAP_FILE")"
mkdir -p "$swap_dir"
avail_bytes="$(df -B1 --output=avail "$swap_dir" 2>/dev/null | tail -1 | tr -d ' ')"
if [[ -z "$avail_bytes" ]] || [[ "$avail_bytes" -lt "$required_free_bytes" ]]; then
  echo "setup-swap: insufficient disk on ${swap_dir} (need ~$((SWAP_SIZE_GB + DISK_BUFFER_GB))G free):" >&2
  df -h "$swap_dir" >&2 || df -h / >&2
  exit 1
fi

create_swap_file "$SWAP_FILE" "$SWAP_SIZE_GB"
ensure_fstab_entry "$SWAP_FILE"
configure_swappiness

echo "setup-swap: done."
free -h
swapon --show
