import https from "https";
import fs from "fs";
import { exec } from "child_process";

async function runCommand(cmd) {
  return new Promise((resolve) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error, stderr });
      } else {
        resolve({ success: true, stdout });
      }
    });
  });
}

async function main() {
  console.log("Downloading get-pip.py...");
  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream("get-pip.py");
    https.get("https://bootstrap.pypa.io/get-pip.py", (response) => {
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        console.log("Download completed.");
        resolve(true);
      });
    }).on("error", (err) => {
      fs.unlink("get-pip.py", () => {});
      reject(err);
    });
  });

  // Determine Python command
  let pythonCmd = "python3";
  let check = await runCommand("python3 --version");
  if (!check.success) {
    pythonCmd = "python";
    check = await runCommand("python --version");
    if (!check.success) {
      console.error("Python is not installed or not in PATH.");
      process.exit(1);
    }
  }
  console.log(`Using python command: ${pythonCmd}`);

  // Run get-pip.py
  console.log("Running get-pip.py to install/update pip...");
  const installPip = await runCommand(`${pythonCmd} get-pip.py --break-system-packages`);
  if (!installPip.success) {
    console.log("Failed to install pip via get-pip.py, trying without break-system-packages...");
    const installPipAlt = await runCommand(`${pythonCmd} get-pip.py`);
    if (!installPipAlt.success) {
      console.warn("Could not install pip. If pip is already installed, we will proceed.");
    }
  }

  // Install iaqualink
  console.log("Installing iaqualink library...");
  const installLib = await runCommand(`${pythonCmd} -m pip install -t .python_lib iaqualink --break-system-packages`);
  if (installLib.success) {
    console.log("iaqualink installed successfully to .python_lib.");
  } else {
    console.log("Failed installing to .python_lib with break-system-packages, trying standard install...");
    const installLibAlt = await runCommand(`${pythonCmd} -m pip install -t .python_lib iaqualink`);
    if (installLibAlt.success) {
      console.log("iaqualink installed successfully to .python_lib.");
    } else {
      console.log("Failed installing to .python_lib, trying global/user install...");
      const installGlobal = await runCommand(`${pythonCmd} -m pip install iaqualink`);
      if (installGlobal.success) {
        console.log("iaqualink installed successfully globally/user.");
      } else {
        console.error("Failed to install iaqualink library.");
        console.error(installGlobal.error || installLibAlt.stderr);
        process.exit(1);
      }
    }
  }
}

main().catch(console.error);
