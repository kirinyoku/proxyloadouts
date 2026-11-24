#!/usr/bin/env bash
set -euo pipefail

release_dir="$(cd "${1:?Usage: install-systemd-release.sh RELEASE_DIR GIT_SHA}" && pwd)"
release="${2:?Expected full Git SHA}"
target=/usr/local/bin/proxyloadouts
backup="${target}.bak"

[[ "$release" =~ ^[0-9a-f]{40}$ ]]
[[ "$(uname -m)" == x86_64 ]]
systemctl is-active --quiet proxyloadouts
cd "$release_dir"
sha256sum --check server.sha256

install -m 0755 server "${target}.new"
cp -p "$target" "$backup"

rollback() {
  trap - ERR
  echo 'Release verification failed; restoring the previous binary.' >&2
  install -m 0755 "$backup" "${target}.new"
  mv "${target}.new" "$target"
  systemctl restart proxyloadouts
  exit 1
}

trap rollback ERR
mv "${target}.new" "$target"
systemctl restart proxyloadouts

for _ in {1..15}; do
  if systemctl is-active --quiet proxyloadouts &&
    curl --fail --silent --show-error --max-time 3 http://127.0.0.1:8090/api/v1/health >/dev/null &&
    curl --fail --silent --show-error --max-time 3 http://127.0.0.1:8091/api/admin/health |
      grep -Fq "\"release\":\"${release}\""; then
    trap - ERR
    echo "Production is healthy on commit ${release}."
    exit 0
  fi
  sleep 2
done

echo "Production did not become healthy on commit ${release}." >&2
false
