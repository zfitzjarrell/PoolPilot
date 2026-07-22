#!/usr/bin/env bash
set -e

# --- Colors for Output ---
GN='\033[1;92m'
YW='\033[33m'
RD='\033[01;31m'
CL='\033[m'

echo -e "${GN}=== Starting PoolPilot Installation ===${CL}"

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
  echo -e "${RD}Error: This script must be run as root.${CL}"
  exit 1
fi

# Detect system timezone and update APT
echo -e "${YW}Updating system packages...${CL}"
apt-get update -y
apt-get install -y curl git python3 python3-pip python3-venv build-essential

# Install NodeSource Node.js 20 LTS
echo -e "${YW}Installing Node.js...${CL}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Clone the repository to temporary folder
echo -e "${YW}Downloading PoolPilot source code...${CL}"
if [ -d "/opt/poolpilot-tmp" ]; then
  rm -rf /opt/poolpilot-tmp
fi
git clone https://github.com/zfitzjarrell/poolpilot.git /opt/poolpilot-tmp

# Preserve credentials config if pre-written by the Proxmox host script
if [ -f "/opt/poolpilot/config.json" ]; then
  echo -e "${GN}Preserving Jandy credentials...${CL}"
  mv /opt/poolpilot/config.json /opt/poolpilot-tmp/config.json
fi

# Clean up any existing directory and finalize folder location
rm -rf /opt/poolpilot
mv /opt/poolpilot-tmp /opt/poolpilot
cd /opt/poolpilot

# Prompt for credentials if config.json does not exist
if [ ! -f "config.json" ]; then
  echo -e "${YW}=== iAquaLink Credential Setup ===${CL}"
  read -p "Enter iAquaLink Username (email): " IA_USER
  read -sp "Enter iAquaLink Password: " IA_PASS
  echo ""
  
  cat << EOF > config.json
{
  "username": "$IA_USER",
  "password": "$IA_PASS",
  "services": {
    "lights": true,
    "cleaner": true,
    "bubbler": true,
    "heater": true,
    "pump": true
  },
  "schedules": {
    "pump": [],
    "cleaner": [],
    "lights": [],
    "bubbler": [],
    "heater": []
  }
}
EOF
  echo -e "${GN}Credentials saved locally in config.json.${CL}"
fi

# Install npm dependencies (which triggers python pip packages via postinstall)
echo -e "${YW}Installing NPM and Python libraries...${CL}"
npm install

# Build the application
echo -e "${YW}Building frontend and server wrapper...${CL}"
npm run build

# Register systemd service
echo -e "${YW}Registering systemd service...${CL}"
cat << 'EOF' > /etc/systemd/system/poolpilot.service
[Unit]
Description=PoolPilot Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/poolpilot
ExecStart=/usr/bin/node dist/server.cjs
Restart=always
RestartSec=10
Environment=NODE_ENV=production PORT=3000

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
systemctl daemon-reload
systemctl enable poolpilot
systemctl start poolpilot

# Output confirmation and local IP
IP_ADDR=$(hostname -I | awk '{print $1}')
echo -e "${GN}===============================================${CL}"
echo -e "${GN}     PoolPilot Installation Complete!          ${CL}"
echo -e "${GN}===============================================${CL}"
echo -e "Dashboard URL:  ${YW}http://${IP_ADDR}:3000${CL}"
echo -e "Legacy View:    ${YW}http://${IP_ADDR}:3000/legacy${CL}"
echo -e "==============================================="
