#!/usr/bin/env bash
# Install cron jobs for backups and log rotation on the VPS host.
# Usage: sudo ./install-cron.sh /opt/memoryhub
set -euo pipefail

INSTALL_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
CRON_USER="${SUDO_USER:-$(whoami)}"
CRON_FILE="/etc/cron.d/memoryhub"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo $0 [install-dir]"
  exit 1
fi

cat > "${CRON_FILE}" <<EOF
# MemoryHub scheduled tasks — installed by deploy/scripts/install-cron.sh
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Daily MongoDB + uploads backup at 03:00 UTC
0 3 * * * ${CRON_USER} ${INSTALL_DIR}/deploy/scripts/backup-all.sh >> ${INSTALL_DIR}/deploy/backups/cron.log 2>&1

# Weekly backup retention log trim
0 4 * * 0 ${CRON_USER} find ${INSTALL_DIR}/deploy/backups -name 'backup-*.log' -mtime +30 -delete 2>/dev/null || true
EOF

chmod 644 "${CRON_FILE}"
echo "Installed ${CRON_FILE}"
echo "Verify with: cat ${CRON_FILE}"
