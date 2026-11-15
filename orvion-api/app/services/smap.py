# app/services/smap.py
import earthaccess
import xarray as xr
from datetime import date
import os
import numpy as np
from app.config import settings

os.environ["EARTHDATA_TOKEN"] = settings.earthdata_token

def get_smap_moisture(lat: float, lon: float, start_date: date, end_date: date):
    print("🔍 Buscando datos de humedad del suelo (SMAP)...")
    
    try:
        results = earthaccess.search_data(
            short_name="SPL3SMP_E",
            temporal=(start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")),
            bounding_box=(lon - 0.1, lat - 0.1, lon + 0.1, lat + 0.1)
        )

        if not results:
            print("❌ No se encontraron datos de SMAP para las fechas dadas.")
            return None

        # --- OPTIMIZACIÓN DE MEMORIA ---
        # No necesitamos 36 archivos. Con los últimos 5 días del rango es suficiente 
        # para tener un promedio representativo.
        files = earthaccess.open(results[-5:]) 
        print(f"✅ Procesando los últimos {len(files)} archivos SMAP (secuencialmente)...")
        
        valid_moistures = []

        # Procesamiento secuencial seguro (evita el crash de h5netcdf)
        for file in files:
            try:
                # Usamos 'with' para asegurar que el archivo se cierre y libere RAM
                with xr.open_dataset(file, engine="h5netcdf", group="Soil_Moisture_Retrieval_Data_AM", phony_dims="access") as ds:
                    lats_2d = ds['latitude'].values
                    lons_2d = ds['longitude'].values
                    
                    distances = (lats_2d - lat)**2 + (lons_2d - lon)**2
                    idx = np.unravel_index(np.argmin(distances), distances.shape)
                    
                    val = float(ds['soil_moisture'].values[idx[0], idx[1]])
                    
                    if 0.0 <= val <= 1.0:
                        valid_moistures.append(val)
            except Exception as e:
                print(f"⚠️ Saltando archivo SMAP por error: {str(e)[:50]}...")
                continue

        if not valid_moistures:
            print("⚠️ No se encontraron valores válidos de humedad en el rango.")
            return None

        avg_moisture = sum(valid_moistures) / len(valid_moistures)
        moisture_percent = avg_moisture * 100

        print(f"✅ Humedad promedio SMAP: {moisture_percent:.2f}% (basado en {len(valid_moistures)} días)")
        
        return {
            "smap_soil_moisture_m3m3": round(avg_moisture, 4),
            "smap_soil_moisture_percent": round(moisture_percent, 2),
            "smap_valid_days": len(valid_moistures)
        }
        
    except Exception as e:
        print(f"❌ Error crítico en SMAP: {e}")
        return None