#!/usr/bin/env bash
set -e

# --- Colors for Output ---
GN='\033[1;92m'
YW='\033[33m'
RD='\033[01;31m'
CL='\033[m'

echo -e "${GN}===================================================${CL}"
echo -e "${GN}     Proxmox VE PoolPilot LXC Installer            ${CL}"
echo -e "${GN}===================================================${CL}"

# 1. Environment Verification
if [ "$(id -u)" -ne 0 ]; then
  echo -e "${RD}Error: This script must be run as root on your Proxmox VE host.${CL}"
  exit 1
fi

if ! command -v pct &> /dev/null; then
  echo -e "${RD}Error: This script must be run directly on a Proxmox VE host (pct command not found).${CL}"
  exit 1
fi

# 2. Securely Get Jandy / iAquaLink Credentials
echo -e "${YW}Please enter your Jandy / iAquaLink credentials.${CL}"
echo -e "These will be stored locally inside the container at /opt/poolpilot/config.json."
echo ""
read -p "iAquaLink Username (email): " IA_USER
read -s -p "iAquaLink Password: " IA_PASS
echo ""

if [ -z "$IA_USER" ] || [ -z "$IA_PASS" ]; then
  echo -e "${RD}Error: Credentials cannot be empty. Setup aborted.${CL}"
  exit 1
fi

# 3. Detect Proxmox Storage & VM/CT IDs
echo -e "\n${YW}Detecting Proxmox storage pools...${CL}"
TEMPLATE_STORAGE=$(pvesm status -content vztmpl | awk 'NR>1 {print $1}' | head -n1)
if [ -z "$TEMPLATE_STORAGE" ]; then
  TEMPLATE_STORAGE="local"
fi
echo -e "Using template storage: ${GN}$TEMPLATE_STORAGE${CL}"

DISK_STORAGE=$(pvesm status -content rootdir | awk 'NR>1 {print $1}' | head -n1)
if [ -z "$DISK_STORAGE" ]; then
  DISK_STORAGE="local-lvm"
fi
echo -e "Using container disk storage: ${GN}$DISK_STORAGE${CL}"

NEXTID=$(pvesh get /cluster/nextid)
echo -e "Assigning Container ID: ${GN}$NEXTID${CL}"

# 4. Fetch and download latest Debian 12 standard template
echo -e "\n${YW}Updating Proxmox template database...${CL}"
pveam update > /dev/null

echo -e "${YW}Locating latest Debian 12 LXC template...${CL}"
TEMPLATE_NAME=$(pveam available | grep "debian-12-standard" | head -n1 | awk '{print $2}')

if [ -z "$TEMPLATE_NAME" ]; then
  echo -e "${RD}Error: Could not find Debian 12 template in pveam available database.${CL}"
  exit 1
fi

echo -e "Downloading ${GN}$TEMPLATE_NAME${CL} to ${GN}$TEMPLATE_STORAGE${CL}..."
pveam download "$TEMPLATE_STORAGE" "$TEMPLATE_NAME"

# 5. Create the Container
echo -e "\n${YW}Creating new LXC Container ($NEXTID)...${CL}"
pct create "$NEXTID" "$TEMPLATE_STORAGE:vztmpl/$TEMPLATE_NAME" \
  --hostname poolpilot \
  --cores 1 \
  --memory 512 \
  --swap 512 \
  --rootfs "$DISK_STORAGE:4" \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --onboot 1 \
  --unprivileged 1 \
  --features nesting=1

# 6. Pre-configure Jandy credentials in the Container filesystem
echo -e "${YW}Injecting Jandy / iAquaLink credentials into LXC container...${CL}"
pct exec "$NEXTID" -- mkdir -p /opt/poolpilot
pct exec "$NEXTID" -- bash -c "cat << 'EOF' > /opt/poolpilot/config.json
{
  \"username\": \"$IA_USER\",
  \"password\": \"$IA_PASS\",
  \"services\": {
    \"lights\": true,
    \"cleaner\": true,
    \"bubbler\": true,
    \"heater\": true,
    \"pump\": true
  },
  \"schedules\": {
    \"pump\": [],
    \"cleaner\": [],
    \"lights\": [],
    \"bubbler\": [],
    \"heater\": []
  }
}
EOF"

# 7. Start container and wait for network
echo -e "${YW}Starting Container ($NEXTID)...${CL}"
pct start "$NEXTID"

echo -e "${YW}Waiting for LXC network configuration (10s)...${CL}"
sleep 10

# 8. Run the in-container installation script
echo -e "${YW}Downloading and executing installer inside the container...${CL}"
pct exec "$NEXTID" -- bash -c "curl -sL https://raw.githubusercontent.com/zfitzjarrell/poolpilot/main/poolpilot-install.sh > /tmp/poolpilot-install.sh && bash /tmp/poolpilot-install.sh"

# 9. Get the assigned container IP
IP_ADDR=$(pct exec "$NEXTID" -- ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n1)

echo -e "\n${GN}===================================================${CL}"
echo -e "${GN}     PoolPilot Container Successfully Created!     ${CL}"
echo -e "${GN}===================================================${CL}"
echo -e "LXC Container ID: ${GN}$NEXTID${CL}"
echo -e "Dashboard URL:    ${YW}http://${IP_ADDR}:3000${CL}"
echo -e "Legacy View:      ${YW}http://${IP_ADDR}:3000/legacy${CL}"
echo -e "==================================================="
