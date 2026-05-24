import asyncio
import os
import json
import traceback
from iaqualink.client import AqualinkClient

USERNAME = os.environ.get("IAQUALINK_USERNAME")
PASSWORD = os.environ.get("IAQUALINK_PASSWORD")

async def main():
    if not USERNAME or not PASSWORD:
        print(json.dumps({"error": "Missing IAQUALINK_USERNAME or IAQUALINK_PASSWORD"}))
        return

    try:
        async with AqualinkClient(USERNAME, PASSWORD) as client:
            systems = await client.get_systems()
            
            results = []
            for serial, system in systems.items():
                await system.update()
                devices = await system.get_devices()
                
                # Fetch various potential temperature sensors and controllers
                pool_temp = devices.get("pool_temp")
                spa_temp = devices.get("spa_temp")
                air_temp = devices.get("air_temp")
                pool_set_point = devices.get("pool_set_point")
                spa_set_point = devices.get("spa_set_point")
                pool_pump = devices.get("pool_pump")
                spa_pump = devices.get("spa_pump")
                pool_heater = devices.get("pool_heater")
                spa_heater = devices.get("spa_heater")
                freeze_protection = devices.get("freeze_protection")
                
                # Find device labeled "Cleaner" or fallback to "aux_1"
                cleaner = None
                for dev in devices.values():
                    if getattr(dev, 'label', None) == "Cleaner" or getattr(dev, 'name', None) == "cleaner":
                        cleaner = dev
                        break
                if cleaner is None:
                    cleaner = devices.get("aux_1")

                # Find device labeled "Pool Light" or fallback to "aux_2"
                pool_light = None
                for dev in devices.values():
                    if getattr(dev, 'label', None) == "Pool Light" or getattr(dev, 'name', None) == "pool_light":
                        pool_light = dev
                        break
                if pool_light is None:
                    pool_light = devices.get("aux_2")

                # Find device labeled "Bubbler" or fallback to "aux_3"
                bubbler = None
                for dev in devices.values():
                    if getattr(dev, 'label', None) == "Bubbler" or getattr(dev, 'name', None) == "bubbler":
                        bubbler = dev
                        break
                if bubbler is None:
                    bubbler = devices.get("aux_3")
                
                def clean_state(device, is_bool=False):
                    if not device or device.state is None or device.state == "":
                        return None
                    if is_bool:
                        return device.state in [1, "1", True, "true", "on", "active"]
                    try:
                        return int(device.state)
                    except ValueError:
                        try:
                            return float(device.state)
                        except ValueError:
                            return device.state
                
                supported_colors = None
                if pool_light and hasattr(pool_light, "supported_effects"):
                    supported_colors = [k for k in pool_light.supported_effects.keys() if k.lower() != "off"]
                else:
                    # Fallback to Jandy LED WaterColors options from the screenshot
                    supported_colors = [
                        "Alpine White", "Sky Blue", "Cobalt Blue", "Caribbean Blue",
                        "Spring Green", "Emerald Green", "Emerald Rose", "Magenta",
                        "Violet", "Slow Splash", "Fast Splash", "USA!", "Fat Tuesday", "Disco Tech"
                    ]

                sys_data = {
                    "name": system.name,
                    "serial": serial,
                    "pool_temp": clean_state(pool_temp),
                    "spa_temp": clean_state(spa_temp),
                    "air_temp": clean_state(air_temp),
                    "pool_set_point": clean_state(pool_set_point),
                    "spa_set_point": clean_state(spa_set_point),
                    "pool_pump": clean_state(pool_pump, is_bool=True),
                    "spa_pump": clean_state(spa_pump, is_bool=True),
                    "pool_heater": clean_state(pool_heater, is_bool=True),
                    "spa_heater": clean_state(spa_heater, is_bool=True),
                    "freeze_protection": clean_state(freeze_protection, is_bool=True),
                    "cleaner": clean_state(cleaner, is_bool=True),
                    "pool_light": clean_state(pool_light, is_bool=True),
                    "pool_light_colors": supported_colors,
                    "bubbler": clean_state(bubbler, is_bool=True),
                }
                
                results.append(sys_data)
                
            print(json.dumps({"success": True, "systems": results}))
    except Exception as e:
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()}))

asyncio.run(main())
