import asyncio
import os
import sys
import json
import traceback
from iaqualink.client import AqualinkClient

USERNAME = os.environ.get("IAQUALINK_USERNAME")
PASSWORD = os.environ.get("IAQUALINK_PASSWORD")

async def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: python toggle_device.py <device_key_or_label> <on|off>"}))
        return

    target = sys.argv[1].lower()
    action = sys.argv[2].lower()

    if not USERNAME or not PASSWORD:
        print(json.dumps({"success": False, "error": "Missing credentials in environment"}))
        return

    try:
        async with AqualinkClient(USERNAME, PASSWORD) as client:
            systems = await client.get_systems()
            for serial, system in systems.items():
                await system.update()
                devices = await system.get_devices()
                
                target_dev = None
                for key, dev in devices.items():
                    if key.lower() == target or getattr(dev, 'label', '').lower() == target:
                        target_dev = dev
                        break
                
                if not target_dev:
                    continue
                
                if action == "on":
                    await target_dev.turn_on()
                elif action == "off":
                    await target_dev.turn_off()
                elif action in ["set_color", "set_light_color"]:
                    if not hasattr(target_dev, "set_effect_by_name"):
                        print(json.dumps({"success": False, "error": f"Device '{target_dev.label}' does not support color setting."}))
                        return
                    color = sys.argv[3] if len(sys.argv) > 3 else None
                    if not color:
                        print(json.dumps({"success": False, "error": "Missing color parameter for set_color action."}))
                        return
                    try:
                        effects = target_dev.supported_effects
                        matched_key = None
                        for k in effects.keys():
                            if k.lower().replace("!", "").replace(" ", "") == color.lower().replace("!", "").replace(" ", ""):
                                matched_key = k
                                break
                        if not matched_key:
                            if color.isdigit():
                                await target_dev.set_effect_by_id(int(color))
                            else:
                                print(json.dumps({"success": False, "error": f"Invalid color '{color}'. Supported: {list(effects.keys())}"}))
                                return
                        else:
                            await target_dev.set_effect_by_name(matched_key)
                    except Exception as e:
                        print(json.dumps({"success": False, "error": f"Error setting color: {str(e)}"}))
                        return
                else:
                    print(json.dumps({"success": False, "error": f"Unknown action: {action}"}))
                    return
                
                # Verify state update
                await system.update()
                devices = await system.get_devices()
                new_state = None
                for key, dev in devices.items():
                    if dev.name == target_dev.name:
                        new_state = dev.state
                        break
                
                # Return standard success response
                print(json.dumps({
                    "success": True, 
                    "device": target_dev.name, 
                    "label": target_dev.label, 
                    "action": action, 
                    "state": new_state
                }))
                return
            
            print(json.dumps({"success": False, "error": f"Device '{target}' not found in any system"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e), "trace": traceback.format_exc()}))

if __name__ == "__main__":
    asyncio.run(main())
