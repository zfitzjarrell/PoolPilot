/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from "react";
import { 
  Waves, 
  RefreshCw, 
  AlertCircle, 
  Activity, 
  Flame, 
  TrendingUp,
  Lightbulb,
  Droplets,
  Settings
} from "lucide-react";

const getTempColorStyle = (temp: number | null, settings?: { enabled: boolean; warmMin: number; veryWarmMin: number; hotMin: number }) => {
  if (temp === null) return {};
  const activeSettings = settings || { enabled: true, warmMin: 79, veryWarmMin: 84, hotMin: 88 };
  if (!activeSettings.enabled) return {};
  
  let color = "";
  if (temp >= activeSettings.hotMin) color = "#F94144";
  else if (temp >= activeSettings.veryWarmMin) color = "#FF924C";
  else if (temp >= activeSettings.warmMin) color = "#FFCA3A";
  else return {};
  
  return {
    color: color,
    backgroundImage: "none",
    WebkitTextFillColor: color,
  };
};

const COLOR_PRESETS: { [key: string]: { bg: string, label: string } } = {
  "Alpine White": { bg: "bg-white border border-slate-700 shadow-[0_0_8px_rgba(255,255,255,0.5)]", label: "Alpine White" },
  "Sky Blue": { bg: "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.4)]", label: "Sky Blue" },
  "Cobalt Blue": { bg: "bg-blue-700 shadow-[0_0_8px_rgba(29,78,216,0.4)]", label: "Cobalt Blue" },
  "Caribbean Blue": { bg: "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]", label: "Caribbean Blue" },
  "Spring Green": { bg: "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]", label: "Spring Green" },
  "Emerald Green": { bg: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]", label: "Emerald Green" },
  "Emerald Rose": { bg: "bg-gradient-to-br from-emerald-500 to-rose-500", label: "Emerald Rose" },
  "Magenta": { bg: "bg-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.4)]", label: "Magenta" },
  "Violet": { bg: "bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.4)]", label: "Violet" },
  "Slow Splash": { bg: "bg-gradient-to-br from-blue-500 via-cyan-500 to-emerald-500 animate-pulse", label: "Slow Splash" },
  "Fast Splash": { bg: "bg-gradient-to-br from-red-500 via-fuchsia-500 to-blue-500", label: "Fast Splash" },
  "USA!": { bg: "bg-gradient-to-r from-blue-600 via-white to-red-600", label: "USA!" },
  "Fat Tuesday": { bg: "bg-gradient-to-br from-purple-600 via-amber-500 to-emerald-500", label: "Fat Tuesday" },
  "Disco Tech": { bg: "bg-gradient-to-br from-rose-500 via-yellow-500 to-cyan-500", label: "Disco Tech" },
};

const SCHEDULES = {
  pool_pump: ["24 hrs, Every Day"],
  cleaner: ["7:00 AM - 10:00 AM, Every Day"]
};

const getUniqueSchedules = (schedules: string[]) => {
  return Array.from(new Set(schedules));
};

export default function App() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Configuration management states
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<any>({
    username: "",
    hasPassword: false,
    services: {
      lights: true,
      cleaner: true,
      bubbler: true,
      heater: true,
      pump: true
    }
  });
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  const [visibility, setVisibility] = useState<any>({
    lights: true,
    cleaner: true,
    bubbler: true,
    heater: true,
    pump: true,
    diagnostics: true
  });

  const [tempColorSettings, setTempColorSettings] = useState<any>({
    enabled: true,
    warmMin: 79,
    veryWarmMin: 84,
    hotMin: 88
  });

  const isSetupRequired = error === "Setup required: Missing credentials";

  const [lightConfirm, setLightConfirm] = useState(false);
  const [bubblerConfirm, setBubblerConfirm] = useState(false);
  const lightTimeoutRef = useRef<any>(null);
  const bubblerTimeoutRef = useRef<any>(null);

  const handleLightClick = (currentStatus: boolean) => {
    if (lightConfirm) {
      setLightConfirm(false);
      if (lightTimeoutRef.current) clearTimeout(lightTimeoutRef.current);
      toggleDevice("aux_2", currentStatus ? "off" : "on");
    } else {
      setLightConfirm(true);
      if (lightTimeoutRef.current) clearTimeout(lightTimeoutRef.current);
      lightTimeoutRef.current = setTimeout(() => {
        setLightConfirm(false);
      }, 4000);
    }
  };

  const handleBubblerClick = (currentStatus: boolean) => {
    if (bubblerConfirm) {
      setBubblerConfirm(false);
      if (bubblerTimeoutRef.current) clearTimeout(bubblerTimeoutRef.current);
      toggleDevice("aux_3", currentStatus ? "off" : "on");
    } else {
      setBubblerConfirm(true);
      if (bubblerTimeoutRef.current) clearTimeout(bubblerTimeoutRef.current);
      bubblerTimeoutRef.current = setTimeout(() => {
        setBubblerConfirm(false);
      }, 4000);
    }
  };

  useEffect(() => {
    return () => {
      if (lightTimeoutRef.current) clearTimeout(lightTimeoutRef.current);
      if (bubblerTimeoutRef.current) clearTimeout(bubblerTimeoutRef.current);
    };
  }, []);

  const openSettings = () => {
    if (!showSettings) {
      setUsernameInput(config.username || "");
      setPasswordInput(config.hasPassword ? "********" : "");
    }
    setShowSettings(!showSettings);
  };

  const fetchTemp = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pool-temp");
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Response from server was not JSON");
      }
      const json = await res.json();
      if (json.error || !json.success) {
        throw new Error(json.error || "Failed to fetch pool temperature");
      }
      setData(json.systems);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleDevice = async (device: string, action: "on" | "off") => {
    setToggling(device);
    try {
      const res = await fetch("/api/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ device, action }),
      });
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Response from server was not JSON");
      }
      const json = await res.json();
      if (!json.success) {
        alert(json.error || "Failed to toggle device");
      }
      await fetchTemp();
    } catch (err: any) {
      alert("Error toggling device: " + err.message);
    } finally {
      setToggling(null);
    }
  };

  const setColorDevice = async (device: string, color: string) => {
    setToggling(`${device}_color_${color}`);
    try {
      const res = await fetch("/api/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ device, action: "set_color", color }),
      });
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Response from server was not JSON");
      }
      const json = await res.json();
      if (!json.success) {
        alert(json.error || "Failed to set color");
      }
      await fetchTemp();
    } catch (err: any) {
      alert("Error setting color: " + err.message);
    } finally {
      setToggling(null);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Response from server was not JSON");
      }
      const json = await res.json();
      setConfig(json);
      if (json.username) {
        setUsernameInput(json.username);
      }
      if (json.hasPassword) {
        setPasswordInput("********");
      }
    } catch (err) {
      console.error("Failed to fetch configuration:", err);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: usernameInput,
          password: passwordInput,
          services: config.services
        }),
      });
      
      let json: any = {};
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        json = await res.json();
      }
      
      if (res.ok && json.success) {
        await fetchConfig();
        setShowSettings(false);
        fetchTemp();
      } else {
        alert(json.error || `Failed to save configuration (Status: ${res.status})`);
      }
    } catch (err: any) {
      alert("Error saving configuration: " + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleServiceChange = (serviceName: string, enabled: boolean) => {
    setConfig((prev: any) => ({
      ...prev,
      services: {
        ...prev.services,
        [serviceName]: enabled
      }
    }));
  };

  const handleVisibilityChange = (featureName: string, visible: boolean) => {
    const newVisibility = {
      ...visibility,
      [featureName]: visible
    };
    setVisibility(newVisibility);
    localStorage.setItem("poolpilot_visibility", JSON.stringify(newVisibility));
  };

  const handleTempColorSettingChange = (key: string, value: any) => {
    const newSettings = {
      ...tempColorSettings,
      [key]: value
    };
    setTempColorSettings(newSettings);
    localStorage.setItem("poolpilot_temp_colors", JSON.stringify(newSettings));
  };

  useEffect(() => {
    // Load local storage visibility settings
    const storedVisibility = localStorage.getItem("poolpilot_visibility");
    if (storedVisibility) {
      try {
        setVisibility((prev: any) => ({
          ...prev,
          ...JSON.parse(storedVisibility)
        }));
      } catch (e) {
        console.error("Error reading visibility config from localStorage:", e);
      }
    }

    // Load local storage temp color settings
    const storedTempSettings = localStorage.getItem("poolpilot_temp_colors");
    if (storedTempSettings) {
      try {
        setTempColorSettings((prev: any) => ({
          ...prev,
          ...JSON.parse(storedTempSettings)
        }));
      } catch (e) {
        console.error("Error reading temp color config from localStorage:", e);
      }
    }

    fetchConfig();
    fetchTemp();
    
    // Auto refresh every 5 minutes
    const interval = setInterval(fetchTemp, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans selection:bg-blue-500 selection:text-white flex flex-col justify-between">
      <div className="max-w-5xl mx-auto w-full flex-grow flex flex-col justify-between">
        
        {/* Header Section */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-white">
              <Waves className="w-8 h-8 text-blue-400 animate-pulse" />
              PoolPilot <span className="text-blue-500/50 italic font-medium">iAquaLink Controller</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {data && data[0] ? (
                <>System Serial: <span className="font-mono text-slate-400">{data[0].serial}</span> • Smart pool control for iAqualink systems</>
              ) : (
                <>Smart pool control for iAqualink systems</>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-4 self-stretch sm:self-auto justify-between sm:justify-start">
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest font-sans">System Online</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Last Updated</p>
                <p className="text-sm font-medium text-slate-300">
                  {lastUpdated ? lastUpdated.toLocaleTimeString() : "Never"}
                </p>
              </div>
              <button 
                onClick={fetchTemp}
                disabled={loading}
                className="p-2.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-blue-400 hover:border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                title="Refresh Status"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
              </button>
              <button 
                onClick={openSettings}
                className={`p-2.5 border rounded-xl transition-all cursor-pointer ${
                  showSettings 
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.25)]' 
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-blue-400 hover:border-slate-700'
                }`}
                title="Configure Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Setup Guard or Main Bento Grid */}
        {isSetupRequired ? (
          <div className="flex-grow flex items-center justify-center py-12">
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Settings className="text-blue-400 w-6 h-6 animate-spin" style={{ animationDuration: '6s' }} />
                Initial Setup Required
              </h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Please enter your iAquaLink cloud credentials to connect this local monitor server to your pool controller.
              </p>
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase font-bold tracking-widest text-slate-500 mb-1.5 font-sans">Username (Email)</label>
                  <input 
                    type="email" 
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm transition-all"
                    placeholder="e.g. poolowner@email.com"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-bold tracking-widest text-slate-500 mb-1.5 font-sans">Password</label>
                  <input 
                    type="password" 
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm transition-all"
                    placeholder="iAquaLink Password"
                  />
                </div>
                
                {config.localIp && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 my-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">Access on other devices</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Connect your tablets or phones to the same Wi-Fi and navigate to:
                    </p>
                    <div className="mt-2 space-y-1.5 font-mono text-[11px] bg-slate-950/60 p-2.5 rounded-lg border border-slate-950">
                      <div className="text-slate-300">
                        <span className="text-slate-500 font-sans">Modern: </span>
                        http://{config.localIp}:{config.port || 3000}
                      </div>
                      <div className="text-slate-300 pt-1 border-t border-slate-900/40">
                        <span className="text-slate-500 font-sans">Legacy: </span>
                        http://{config.localIp}:{config.port || 3000}/legacy
                      </div>
                    </div>
                  </div>
                )}
                
                <button 
                  type="submit" 
                  disabled={savingConfig}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 mt-4 cursor-pointer"
                >
                  {savingConfig ? "Saving & Connecting..." : "Connect Pool System"}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <>
            {/* Error Notification */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-5 flex gap-4 text-red-400 items-start mb-6">
                <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-300 text-base">Connection/Credential Error</h3>
                  <p className="text-sm mt-1 text-slate-400">{error}</p>
                  <p className="text-xs opacity-75 mt-2">
                    Make sure the credentials in your server settings are correct. You can update them by clicking the Gear icon in the header.
                  </p>
                </div>
              </div>
            )}

            {/* Skeleton Loading State */}
            {loading && !data && (
              <main className="grid grid-cols-12 gap-6 flex-grow">
                <div className="col-span-12 md:col-span-8 h-80 bg-slate-900/20 border border-slate-900 rounded-3xl animate-pulse" />
                <div className="col-span-12 md:col-span-4 h-80 md:h-auto bg-slate-900/20 border border-slate-900 rounded-3xl animate-pulse" />
                <div className="col-span-12 md:col-span-4 h-40 bg-slate-900/20 border border-slate-900 rounded-3xl animate-pulse" />
                <div className="col-span-12 md:col-span-4 h-40 bg-slate-900/20 border border-slate-900 rounded-3xl animate-pulse" />
                <div className="col-span-12 md:col-span-4 h-40 bg-slate-900/20 border border-slate-900 rounded-3xl animate-pulse" />
              </main>
            )}

            {/* Main Bento Content */}
            {data && data.map((system: any) => (
              <main key={system.serial} className="grid grid-cols-12 gap-6 flex-grow">
                
                {/* 1. Main Pool Temperature Card (Big Focus) */}
                <div className="col-span-12 md:col-span-8 md:row-span-4 bg-slate-900/30 border border-slate-900 rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden hover:border-slate-800 transition-all duration-300 group">
                  <div className="absolute top-0 right-0 p-8">
                    <div className="w-16 h-16 rounded-full border-4 border-blue-500/10 flex items-center justify-center group-hover:border-blue-500/20 transition-all">
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                         <Waves className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h2 className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-2 flex items-center gap-1.5 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      Device: pool_temp
                    </h2>
                    <h3 className="text-3xl font-medium text-white group-hover:text-blue-100 transition-colors">{system.name}</h3>
                  </div>

                  <div className="flex flex-row items-center justify-between my-6 md:my-0 select-none">
                    <div className="flex items-baseline gap-1">
                      <span 
                        className="text-[100px] md:text-[140px] font-extrabold leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-blue-400 via-cyan-300 to-white font-sans"
                        style={getTempColorStyle(system.pool_temp, tempColorSettings)}
                      >
                        {system.pool_temp !== null ? system.pool_temp : "--"}
                      </span>
                      <span 
                        className="text-4xl md:text-6xl font-light text-blue-300"
                        style={system.pool_temp !== null && getTempColorStyle(system.pool_temp, tempColorSettings).color ? { color: getTempColorStyle(system.pool_temp, tempColorSettings).color } : {}}
                      >
                        °F
                      </span>
                    </div>

                    <div className="flex flex-col items-center justify-center text-center pr-4 md:pr-12">
                      <span className="text-2xl md:text-4xl font-light text-slate-300 font-sans tracking-wide">Air Temp</span>
                      <span className="text-4xl md:text-6xl font-light text-white font-sans mt-2">
                        {system.air_temp !== null ? `${system.air_temp} F` : "-- F"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <div className="bg-slate-950/60 rounded-2xl px-5 py-3 border border-slate-900 flex flex-col justify-center min-w-[100px]">
                      <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-0.5 font-bold font-sans">Target Set Point</p>
                      <p className="text-lg font-semibold text-slate-300 font-sans">
                        {system.pool_set_point !== null ? `${system.pool_set_point}°F` : "Not Set"}
                      </p>
                    </div>
                    <div className="bg-slate-950/60 rounded-2xl px-5 py-3 border border-slate-900 flex flex-col justify-center min-w-[100px]">
                      <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-0.5 font-bold font-sans">Heater Status</p>
                      <p className={`text-lg font-semibold flex items-center gap-1.5 font-sans ${system.pool_heater ? "text-orange-400" : "text-slate-400"}`}>
                        {system.pool_heater && <Flame className="w-4 h-4 animate-pulse text-orange-500" />}
                        {system.pool_heater ? "Heating" : "Off"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Pool Cleaner Card */}
                {config.services?.cleaner && visibility.cleaner && (
                  <div className="col-span-12 md:col-span-4 md:row-span-2 bg-slate-900/30 border border-slate-900 rounded-3xl p-6 flex flex-col justify-between hover:border-slate-800 transition-all duration-300 group">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-1.5 font-sans">
                          <span className={`w-1.5 h-1.5 rounded-full ${system.cleaner ? "bg-orange-400 animate-pulse" : "bg-slate-500"}`}></span>
                          Device: aux_1
                        </span>
                        <span className="px-2 py-0.5 bg-slate-950 text-slate-500 rounded text-[9px] font-mono border border-slate-900">ID: 1</span>
                      </div>
                      <div className="my-4">
                        <h3 className="text-lg font-semibold text-slate-300 mb-1">Pool Cleaner</h3>
                        <p className="text-4xl font-extrabold text-white flex items-baseline gap-0.5">
                          {system.cleaner ? "Active" : "Standby"}
                        </p>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full mt-2 overflow-hidden border border-slate-900/50">
                        <div 
                          className={`h-full transition-all duration-1000 ${system.cleaner ? "bg-gradient-to-r from-orange-500 to-amber-400 w-full" : "bg-slate-800 w-0"}`}
                        />
                      </div>
                      <button
                        onClick={() => toggleDevice("aux_1", system.cleaner ? "off" : "on")}
                        disabled={toggling !== null}
                        className={`mt-4 w-full py-2 px-4 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-1.5 border cursor-pointer ${
                          system.cleaner
                            ? "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20 active:scale-[0.98]"
                            : "bg-slate-950 text-slate-400 border-slate-900/80 hover:bg-slate-900 active:scale-[0.98]"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {toggling === "aux_1" ? "Updating..." : system.cleaner ? "Turn Off" : "Turn On"}
                      </button>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-900/50 flex flex-col gap-1">
                      <p className="text-[8px] uppercase tracking-widest text-slate-500 font-bold font-sans">Schedule</p>
                      {getUniqueSchedules(SCHEDULES.cleaner).map((sched, idx) => (
                        <p key={idx} className="text-xs text-slate-400 font-medium font-sans">{sched}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Pump Circulation Card */}
                {config.services?.pump && visibility.pump && (
                  <div className="col-span-12 md:col-span-4 md:row-span-2 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-3xl p-6 text-white flex flex-col justify-between shadow-xl shadow-blue-900/10 hover:shadow-blue-900/20 transition-all duration-300 group">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-white/80 font-bold uppercase tracking-widest text-[10px] font-sans">Filter System</span>
                        <Activity className={`w-4 h-4 ${system.pool_pump ? 'animate-pulse' : ''}`} />
                      </div>
                      <div className="my-4">
                        <h3 className="text-lg font-semibold opacity-90 font-sans">Pump Circulation</h3>
                        <span className="text-3xl font-extrabold tracking-wide uppercase select-none font-sans">
                          {system.pool_pump ? "Active" : "Standby"}
                        </span>
                      </div>
                      <p className="text-[10px] opacity-75 font-bold uppercase tracking-widest font-mono">
                        {system.pool_pump ? "Flow Rate: Active • 2450 RPM" : "Scheduled cycle off"}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/15 flex flex-col gap-1">
                      <p className="text-[8px] uppercase tracking-widest text-white/70 font-bold font-sans">Schedule</p>
                      {getUniqueSchedules(SCHEDULES.pool_pump).map((sched, idx) => (
                        <p key={idx} className="text-xs text-white/95 font-medium font-sans">{sched}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Heater Status & Control */}
                {config.services?.heater && visibility.heater && (
                  <div className="col-span-12 md:col-span-4 md:row-span-2 bg-slate-900/30 border border-slate-900 rounded-3xl p-6 flex items-center justify-between hover:border-slate-800 transition-all duration-300 group">
                    <div className="flex flex-col justify-between h-full py-1">
                      <div>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-1 font-sans">Equipment</p>
                        <p className="text-xl font-semibold text-slate-300 font-sans">Heater Control</p>
                      </div>
                      <div className="mt-4">
                        <p className="text-2xl font-bold text-white font-sans">
                          {system.pool_heater || system.spa_heater ? "Active" : "Standby"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {system.pool_heater ? "Heating main pool" : system.spa_heater ? "Heating spa" : "Heaters inactive"}
                        </p>
                      </div>
                    </div>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${system.pool_heater || system.spa_heater ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-950 text-slate-600 border border-slate-900'}`}>
                      <Flame className={`w-7 h-7 ${system.pool_heater || system.spa_heater ? 'animate-bounce' : ''}`} />
                    </div>
                  </div>
                )}

                {/* 6. Pool Light Card */}
                {config.services?.lights && visibility.lights && (
                  <div className="col-span-12 md:col-span-4 md:row-span-2 bg-slate-900/30 border border-slate-900 rounded-3xl p-6 flex flex-col justify-between hover:border-slate-800 transition-all duration-300 group">
                    <div>
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-1 font-sans">Lighting</span>
                          <h3 className="text-xl font-semibold text-slate-300 font-sans">Pool Light</h3>
                        </div>
                        <button 
                          onClick={() => handleLightClick(system.pool_light)}
                          disabled={toggling !== null}
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                            lightConfirm 
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 animate-pulse shadow-[0_0_15px_rgba(249,115,22,0.25)]' 
                              : system.pool_light 
                                ? 'bg-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:bg-amber-500/30 active:scale-[0.95]' 
                                : 'bg-slate-950 text-slate-600 border border-slate-900 hover:bg-slate-900 active:scale-[0.95]'
                          }`}
                        >
                          <Lightbulb className={`w-6 h-6 ${system.pool_light ? 'animate-pulse' : ''}`} />
                        </button>
                      </div>
                      
                      <div className="mt-4">
                        <p className="text-2xl font-bold text-white font-sans">
                          {toggling === "aux_2" ? "Updating..." : lightConfirm ? "Confirm?" : system.pool_light ? "Active" : "Standby"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {toggling === "aux_2" 
                            ? "Updating status..." 
                            : lightConfirm 
                              ? (system.pool_light ? "Tap icon again to turn OFF" : "Tap icon again to turn ON") 
                              : system.pool_light 
                                ? "Select a color show option below:" 
                                : "Lights off"}
                        </p>
                      </div>

                      {system.pool_light && system.pool_light_colors && (
                        <div className="mt-4 animate-fadeIn">
                          <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-2 font-sans">Select Light Show / Color</p>
                          <div className="grid grid-cols-5 gap-2">
                            {system.pool_light_colors.map((colorName: string) => {
                              const preset = COLOR_PRESETS[colorName] || COLOR_PRESETS[colorName.replace("!", "")] || { bg: "bg-slate-500", label: colorName };
                              const isSettingThisColor = toggling === `aux_2_color_${colorName}`;
                              return (
                                <button
                                  key={colorName}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setColorDevice("aux_2", colorName);
                                  }}
                                  disabled={toggling !== null}
                                  title={colorName}
                                  className={`w-7 h-7 rounded-full ${preset.bg} relative transition-all duration-200 cursor-pointer flex items-center justify-center hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  {isSettingThisColor && (
                                    <span className="absolute inset-0 rounded-full bg-slate-950/60 flex items-center justify-center">
                                      <span className="w-2.5 h-2.5 border-t-2 border-r-2 border-white animate-spin rounded-full"></span>
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-900/50 flex justify-between items-center">
                      <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold font-sans">System aux_2</span>
                      <span className="px-2 py-0.5 bg-slate-950 text-slate-500 rounded text-[9px] font-mono border border-slate-900">ID: 2</span>
                    </div>
                  </div>
                )}

                {/* 7. Bubbler Card */}
                {config.services?.bubbler && visibility.bubbler && (
                  <button 
                    onClick={() => handleBubblerClick(system.bubbler)}
                    disabled={toggling !== null}
                    className={`col-span-12 md:col-span-4 md:row-span-2 bg-slate-900/30 border rounded-3xl p-6 flex items-center justify-between hover:border-slate-800 transition-all duration-300 group cursor-pointer active:scale-[0.98] w-full text-left disabled:opacity-50 ${
                      bubblerConfirm ? 'border-orange-500/40 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'border-slate-900'
                    }`}
                  >
                    <div className="flex flex-col justify-between h-full py-1">
                      <div>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-1 font-sans">Features</p>
                        <p className="text-xl font-semibold text-slate-300 font-sans">Bubbler Jets</p>
                      </div>
                      <div className="mt-4">
                        <p className="text-2xl font-bold text-white font-sans">
                          {toggling === "aux_3" ? "Updating..." : bubblerConfirm ? "Confirm?" : system.bubbler ? "Active" : "Standby"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {toggling === "aux_3" 
                            ? "Updating status..." 
                            : bubblerConfirm 
                              ? (system.bubbler ? "Tap card again to turn OFF" : "Tap card again to turn ON") 
                              : system.bubbler 
                                ? "Tap to turn off" 
                                : "Tap to turn on"}
                        </p>
                      </div>
                    </div>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      bubblerConfirm 
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 animate-pulse' 
                        : system.bubbler 
                          ? 'bg-cyan-500/20 text-cyan-400' 
                          : 'bg-slate-950 text-slate-600 border border-slate-900'
                    }`}>
                      <Droplets className={`w-7 h-7 ${system.bubbler ? 'animate-bounce' : ''}`} />
                    </div>
                  </button>
                )}

                {/* 8. Network Diagnostics */}
                {visibility.diagnostics && (
                  <div className="col-span-12 md:col-span-4 md:row-span-2 bg-slate-900/30 border border-slate-900 rounded-3xl p-6 flex flex-col justify-between hover:border-slate-800 transition-all duration-300 group">
                    <div className="flex items-center gap-3">
                      <div className="flex-grow h-1 bg-slate-950 rounded-full overflow-hidden border border-slate-900/30">
                        <div className="w-[88%] h-full bg-blue-400"></div>
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 font-bold">RSSI: -56dBm</span>
                    </div>
                    <div className="my-3">
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px] mb-1 font-sans">Local Network Protocol</p>
                      <p className="text-xs font-mono text-blue-400">iAquaLink Client API v0.6.0</p>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-[9px] text-slate-600 uppercase font-bold tracking-wider font-sans">Python Client Node</span>
                      <span className="text-[9px] text-slate-600 font-mono">v3.12.10</span>
                    </div>
                  </div>
                )}

              </main>
            ))}
          </>
        )}

        {/* Configuration Overlay Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setShowSettings(false)}>
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-fadeIn" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2 border-b border-slate-800 pb-4 font-sans">
                <Settings className="text-blue-400 w-6 h-6" />
                System Configuration
              </h2>
              
              <form onSubmit={handleSaveConfig} className="space-y-6">
                {/* 1. Credentials */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 font-sans">1. iAquaLink Cloud Credentials</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5 font-sans">Username (Email)</label>
                      <input 
                        type="email" 
                        required
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500 text-sm transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5 font-sans">Password</label>
                      <input 
                        type="password" 
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500 text-sm transition-all"
                        placeholder={config.hasPassword ? "********" : "Enter Password"}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. System Services */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 font-sans">2. Active Equipment (Server Level)</h3>
                  <p className="text-xs text-slate-500 mb-3 font-sans">Select the physical devices connected to your pool controller.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.keys(config.services || {}).map((service) => (
                      <label key={service} className="flex items-center gap-2 bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 cursor-pointer hover:border-slate-700 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={config.services[service]}
                          onChange={(e) => handleServiceChange(service, e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-800 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-sm text-slate-300 capitalize font-sans">{service}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 3. Screen Visibility */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 font-sans">3. Dashboard Card Visibility (Screen Level)</h3>
                  <p className="text-xs text-slate-500 mb-3 font-sans">Show or hide specific cards on this local screen (saved in local storage).</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.keys(visibility).map((feature) => (
                      <label key={feature} className="flex items-center gap-2 bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 cursor-pointer hover:border-slate-700 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={visibility[feature]}
                          onChange={(e) => handleVisibilityChange(feature, e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-800 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-sm text-slate-300 capitalize font-sans">{feature}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 4. Temperature Color Settings */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 font-sans">4. Temperature Color Settings (Screen Level)</h3>
                  <div className="space-y-4">
                    <label className="flex items-center gap-2 bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 cursor-pointer hover:border-slate-700 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={tempColorSettings.enabled}
                        onChange={(e) => handleTempColorSettingChange("enabled", e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-800 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-sm text-slate-300 font-sans">Enable dynamic pool temperature font colors</span>
                    </label>

                    {tempColorSettings.enabled && (
                      <div className="grid grid-cols-3 gap-3 bg-slate-950/20 p-4 border border-slate-900/80 rounded-2xl animate-fadeIn">
                        <div>
                          <label className="block text-[9px] uppercase font-bold tracking-widest text-slate-500 mb-1.5 font-sans">Warm Min (°F)</label>
                          <input 
                            type="number" 
                            min="50"
                            max="104"
                            value={tempColorSettings.warmMin}
                            onChange={(e) => handleTempColorSettingChange("warmMin", parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm transition-all font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold tracking-widest text-slate-500 mb-1.5 font-sans">Very Warm Min (°F)</label>
                          <input 
                            type="number" 
                            min="50"
                            max="104"
                            value={tempColorSettings.veryWarmMin}
                            onChange={(e) => handleTempColorSettingChange("veryWarmMin", parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm transition-all font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold tracking-widest text-slate-500 mb-1.5 font-sans">Hot Min (°F)</label>
                          <input 
                            type="number" 
                            min="50"
                            max="104"
                            value={tempColorSettings.hotMin}
                            onChange={(e) => handleTempColorSettingChange("hotMin", parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm transition-all font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Local Network Access */}
                {config.localIp && (
                  <div className="bg-blue-500/5 border border-blue-500/15 rounded-2xl p-5">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 mb-2 font-sans flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      Local Network Access
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans mb-3">
                      To open this dashboard on other devices (like iPads, tablets, or phones), connect them to your home Wi-Fi and navigate to:
                    </p>
                    <div className="space-y-2 font-mono text-xs bg-slate-950/60 p-3.5 border border-slate-950 rounded-xl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <span className="text-slate-500 font-sans">Modern Dashboard:</span>
                        <a href={`http://${config.localIp}:${config.port || 3000}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                          http://{config.localIp}:{config.port || 3000}
                        </a>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-2 border-t border-slate-900/50">
                        <span className="text-slate-500 font-sans">Legacy Dashboard (iOS 9+):</span>
                        <a href={`http://${config.localIp}:${config.port || 3000}/legacy`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                          http://{config.localIp}:{config.port || 3000}/legacy
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 justify-end border-t border-slate-800/80 pt-6">
                  <button 
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="px-4 py-2 bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl text-sm transition-all cursor-pointer font-sans"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={savingConfig}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 cursor-pointer font-sans"
                  >
                    {savingConfig ? "Saving..." : "Save Settings"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <footer className="mt-12 mb-2 flex flex-col sm:flex-row justify-between items-center text-[9px] text-slate-600 uppercase tracking-[0.2em] font-bold gap-3 border-t border-slate-900 pt-6 font-sans">
          <p>© {new Date().getFullYear()} Domestic Automation Hub</p>
          <p className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60"></span>
            Safety Protocol: Active • High Heat Limit: 104°F
          </p>
        </footer>

      </div>
    </div>
  );
}
