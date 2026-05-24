# PoolPilot

Smart pool control for iAqualink systems. Designed to be run locally at home on any networked computer (PC, Mac, or Linux) and accessed from any device on your local network (smartphones, computers, and older wall-mounted iPads).

---

## Features

1. **Self-Contained Local Setup**: Run on any computer on your home network without needing any LLMs, API keys, or cloud subscriptions.
2. **Local Credential Setup Wizard**: On first run, a wizard prompts you for your iAquaLink cloud username and password, which are saved locally in a secure `config.json` file.
3. **Bento Grid Controls**: View current pool, air, and target temperatures. Toggle equipment like the cleaner, lights (with custom light shows/color presets), and bubbler jets with confirm safety prompts.
4. **Per-Device Visibility Settings**: Customize card visibility (show/hide) for each screen individually (stored in browser `localStorage`). Perfect for dedicated wall-mounted controllers.
5. **Legacy View**: A specially optimized HTML view (`http://<ip>:3000/legacy`) running clean ES5 JavaScript for compatibility with older devices like iPad 2, iPad mini, and iOS 9/10 browsers.

---

## System Requirements

To run the local server, the host machine requires:
1. **Node.js** (v18 or higher)
2. **Python 3** (Required to interface with iAquaLink)
   * *Note*: Python is only required on the host server machine; client tablets or phones do not need it.

---

## Step-by-Step Installation

1. **Install Host Node & Python**: Ensure Node.js and Python 3 are installed on your host computer and added to your system `PATH`.
2. **Install & Download Packages**:
   Open a terminal/command prompt in the project directory and run:
   ```bash
   npm install
   ```
   > [!TIP]
   > The installation process will automatically run a post-install script (`install-pip.js`) that downloads `get-pip.py`, sets up a local dependency folder (`.python_lib`), and installs the `iaqualink` Python client package there. This keeps your system python installation clean and ensures all dependencies are packed locally.

3. **Build the Application**:
   Compile the React modern view and build the local server wrapper:
   ```bash
   npm run build
   ```

4. **Start the Monitor Server**:
   Start the production server:
   ```bash
   npm run start
   ```
   The server is now running on port `3000` and listening on all network interfaces (`0.0.0.0`) so other devices on your home network can connect.

---

## Accessing the Dashboard on Your Local Network

To load the dashboard on other devices on your network (like iPads, tablets, or phones):

### 1. Find the Server's IP Address
* **Windows**:
  1. Open Command Prompt and type `ipconfig`.
  2. Look for the **IPv4 Address** under your active network adapter (e.g., `192.168.1.15`).
* **Mac / Linux**:
  1. Open Terminal and type `ifconfig` (or `ip a`).
  2. Look for `inet` under your active adapter (e.g., `en0` or `wlan0`), showing an IP like `192.168.1.15`.

### 2. Open the Browser on Client Devices
Connect your device to the same Wi-Fi network and enter the following address:
* **Modern Dashboard** (React View):
  ```
  http://<server-ip>:3000
  ```
* **Legacy Dashboard** (Optimized for iOS 9/10 & Older iPads):
  ```
  http://<server-ip>:3000/legacy
  ```

---

## Configuration

* **Setup Wizard**: On first access, the app will automatically detect missing credentials and guide you through entering your iAquaLink credentials.
* **Server Level Settings (Gear Icon)**:
  * Manage your iAquaLink cloud username/password.
  * Toggle which services are active on your physical pool system (Lights, Cleaner, Bubbler, Heater, Pump). Disabled options are hidden globally.
* **Client Card Visibility (Screen Level)**:
  * Toggle card visibility on each device independently. Changes are saved locally on the client browser (`localStorage`), allowing you to customize individual wall displays.