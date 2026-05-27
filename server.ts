import express from "express";
import { exec } from "child_process";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fs from "fs";
import os from "os";

// Load environment variables from .env.local first, then .env
dotenv.config({ path: ".env.local" });
dotenv.config();

const CONFIG_PATH = path.join(process.cwd(), "config.json");

interface Config {
  username?: string;
  password?: string;
  services?: {
    lights: boolean;
    cleaner: boolean;
    bubbler: boolean;
    heater: boolean;
    pump: boolean;
  };
  schedules?: {
    pump?: string[];
    cleaner?: string[];
    lights?: string[];
    bubbler?: string[];
    heater?: string[];
    [key: string]: string[] | undefined;
  };
}

function loadConfig(): Config {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      if (!config.schedules) {
        config.schedules = {
          pump: ["24 hrs, Every Day"],
          cleaner: ["7:00 AM - 10:00 AM, Every Day"],
          lights: [],
          bubbler: [],
          heater: []
        };
      }
      return config;
    } catch (e) {
      console.error("Error reading config.json, using default:", e);
    }
  }
  return {
    username: "",
    password: "",
    services: {
      lights: true,
      cleaner: true,
      bubbler: true,
      heater: true,
      pump: true
    },
    schedules: {
      pump: ["24 hrs, Every Day"],
      cleaner: ["7:00 AM - 10:00 AM, Every Day"],
      lights: [],
      bubbler: [],
      heater: []
    }
  };
}

function saveConfig(config: Config): boolean {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("Error writing config.json:", e);
    return false;
  }
}

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      // Check for IPv4 and ensure it's not local loopback
      const family = typeof net.family === "string" ? net.family : (net as any).family;
      if (family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add middleware to parse JSON and urlencoded request bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Config management endpoints
  app.get("/api/config", (req, res) => {
    const config = loadConfig();
    res.json({
      username: config.username || "",
      hasPassword: !!config.password,
      services: config.services || {
        lights: true,
        cleaner: true,
        bubbler: true,
        heater: true,
        pump: true
      },
      schedules: config.schedules || {
        pump: ["24 hrs, Every Day"],
        cleaner: ["7:00 AM - 10:00 AM, Every Day"],
        lights: [],
        bubbler: [],
        heater: []
      },
      localIp: getLocalIpAddress(),
      port: PORT
    });
  });

  app.post("/api/config", (req, res) => {
    const { username, password, services } = req.body;
    const config = loadConfig();
    
    const testUsername = username !== undefined ? username : (config.username || process.env.IAQUALINK_USERNAME || "");
    const testPassword = (password !== undefined && password !== "" && password !== "********") 
      ? password 
      : (config.password || process.env.IAQUALINK_PASSWORD || "");

    if (!testUsername || !testPassword) {
      return res.status(400).json({ success: false, error: "Setup required: Missing credentials" });
    }

    // Verification check against iAquaLink API before saving configuration
    const cmd = process.platform === "win32" ? "python get_pool_temp.py" : "python3 get_pool_temp.py";
    exec(
      cmd,
      {
        env: {
          ...process.env,
          IAQUALINK_USERNAME: testUsername,
          IAQUALINK_PASSWORD: testPassword,
          PYTHONPATH: ".python_lib"
        }
      },
      (error, stdout, stderr) => {
        try {
          const data = JSON.parse(stdout);
          if (data.error || !data.success) {
            return res.status(400).json({ 
              success: false, 
              error: data.error || "Failed to authenticate with iAquaLink. Please check your username and password." 
            });
          }
          
          // Connection verified, safe to save config
          if (username !== undefined) config.username = username;
          if (password !== undefined && password !== "" && password !== "********") {
            config.password = password;
          }
          if (services !== undefined) {
            config.services = {
              lights: !!services.lights,
              cleaner: !!services.cleaner,
              bubbler: !!services.bubbler,
              heater: !!services.heater,
              pump: !!services.pump
            };
          }

          if (saveConfig(config)) {
            res.json({ success: true, message: "Configuration saved successfully" });
          } else {
            res.status(500).json({ error: "Failed to save configuration file" });
          }
        } catch (e) {
          console.error("Failed to parse verification response:", e, "stdout:", stdout);
          res.status(400).json({ 
            success: false, 
            error: "Failed to verify connection to iAquaLink. Please verify your credentials." 
          });
        }
      }
    );
  });

  app.post("/api/schedules", (req, res) => {
    const { schedules } = req.body;
    if (!schedules) {
      return res.status(400).json({ success: false, error: "Missing schedules data" });
    }
    
    const config = loadConfig();
    config.schedules = schedules;
    
    if (saveConfig(config)) {
      res.json({ success: true, message: "Schedules updated successfully" });
    } else {
      res.status(500).json({ error: "Failed to save configuration file" });
    }
  });

  // Add a route to trigger the python script
  app.get("/api/pool-temp", (req, res) => {
    const config = loadConfig();
    const username = config.username || process.env.IAQUALINK_USERNAME || "";
    const password = config.password || process.env.IAQUALINK_PASSWORD || "";

    if (!username || !password) {
      return res.json({ success: false, error: "Setup required: Missing credentials" });
    }

    const cmd = process.platform === "win32" ? "python get_pool_temp.py" : "python3 get_pool_temp.py";
    exec(
      cmd,
      {
        env: {
          ...process.env,
          IAQUALINK_USERNAME: username,
          IAQUALINK_PASSWORD: password,
          PYTHONPATH: ".python_lib"
        }
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error("Execution error:", error);
          console.error("Stderr:", stderr);
        }
        
        // Let's try parsing anyway, because maybe there was a Python error we caught and returned as JSON
        try {
          const data = JSON.parse(stdout);
          res.json(data);
        } catch (e) {
          console.error("Parse error:", e);
          console.error("Raw Stdout:", stdout);
          res.status(500).json({ error: "Parse Error", rawOutput: stdout, stdErr: stderr });
        }
      }
    );
  });

  app.all("/api/toggle", (req, res) => {
    const device = req.body?.device || req.query?.device;
    const action = req.body?.action || req.query?.action;
    const color = req.body?.color || req.query?.color;

    if (!device || !action) {
      return res.status(400).json({ error: "Missing device or action parameters" });
    }

    const config = loadConfig();
    const username = config.username || process.env.IAQUALINK_USERNAME || "";
    const password = config.password || process.env.IAQUALINK_PASSWORD || "";

    if (!username || !password) {
      return res.status(400).json({ error: "Setup required: Missing credentials" });
    }

    const colorArg = color ? ` "${color}"` : "";
    const cmd = process.platform === "win32" 
      ? `python toggle_device.py "${device}" "${action}"${colorArg}` 
      : `python3 toggle_device.py "${device}" "${action}"${colorArg}`;

    exec(
      cmd,
      {
        env: {
          ...process.env,
          IAQUALINK_USERNAME: username,
          IAQUALINK_PASSWORD: password,
          PYTHONPATH: ".python_lib"
        }
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error("Toggle execution error:", error);
        }
        try {
          const data = JSON.parse(stdout);
          res.json(data);
        } catch (e) {
          res.status(500).json({ error: "Parse Error", rawOutput: stdout, stdErr: stderr });
        }
      }
    );
  });

  // Serve the legacy HTML dashboard for older browsers (e.g., iOS 9 Safari)
  app.get("/legacy", (req, res) => {
    res.sendFile(path.join(process.cwd(), "legacy.html"));
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    const url = `http://localhost:${PORT}`;
    console.log(`Server running on port ${PORT}`);
    console.log(`Opening browser at ${url}...`);
    
    // Automatically open default browser
    const startCmd =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
        ? "start"
        : "xdg-open";
    exec(`${startCmd} ${url}`);
  });
}

startServer();
