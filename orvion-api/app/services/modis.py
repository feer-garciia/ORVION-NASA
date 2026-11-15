# app/services/modis.py
import earthaccess
from pyhdf.SD import SD, SDC
from pyproj import Proj
from datetime import date
import os
import re
import numpy as np
import tempfile
from app.config import settings

os.environ["EARTHDATA_TOKEN"] = settings.earthdata_token

def get_modis_ndvi(lat: float, lon: float, start_date: date, end_date: date):
    print("🔍 Buscando datos de vegetación (MODIS NDVI)...")
    
    try:
        results = earthaccess.search_data(
            short_name="MOD13A2",
            temporal=(start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")),
            bounding_box=(lon - 0.05, lat - 0.05, lon + 0.05, lat + 0.05)
        )

        if not results:
            print("❌ No se encontraron datos de MODIS para las fechas dadas.")
            return None

        results_to_process = results[-2:]
        print(f"✅ Procesando {len(results_to_process)} archivos MODIS (usando pyhdf puro)...")
        
        valid_ndvi_values = []

        # Proyección Sinusoidal de MODIS
        modis_proj = Proj("+proj=sinu +lon_0=0 +x_0=0 +y_0=0 +a=6371007.181 +b=6371007.181 +units=m +no_defs")
        x, y = modis_proj(lon, lat)

        with tempfile.TemporaryDirectory() as tmpdir:
            downloaded_files = earthaccess.download(results_to_process, tmpdir)

            for local_path in downloaded_files:
                try:
                    file_str = str(local_path)
                    
                    # Extraer el tile (hXXvYY) del nombre del archivo para saber qué pedazo del mapa es
                    match = re.search(r'h(\d{2})v(\d{2})', file_str)
                    if not match:
                        print("⚠️ No se pudo identificar el tile en el archivo.")
                        continue
                    
                    h, v = int(match.group(1)), int(match.group(2))
                    
                    # 1. Abrimos el HDF4
                    hdf = SD(file_str, SDC.READ)
                    ndvi_sds = hdf.select('1 km 16 days NDVI')
                    raw_data = ndvi_sds.get()
                    attrs = ndvi_sds.attributes()
                    
                    # 2. Calcular los límites superior izquierdo del tile
                    # Cada tile de MODIS mide 10 grados (aprox 1,111,970 metros en la proyección)
                    tile_size = 1111970.019
                    x_ul = -20015109.354 + (h * tile_size)
                    y_ul = 10007554.677 - (v * tile_size)
                    
                    # 3. Convertir coordenadas X,Y a índices de fila y columna dentro de ESTE tile
                    res = 926.625 # Resolución de 1km en metros
                    col = int((x - x_ul) / res)
                    row = int((y_ul - y) / res)
                    
                    # 4. Validar que estemos dentro del tile y extraer el dato
                    if 0 <= row < raw_data.shape[0] and 0 <= col < raw_data.shape[1]:
                        raw_val = float(raw_data[row, col])
                        fill_value = attrs.get('_FillValue', -3000)
                        
                        # Ignorar valores de relleno (nubes, agua, etc)
                        if raw_val != fill_value and raw_val > -2000:
                            scaled_ndvi = raw_val * 0.0001
                            if -1.0 <= scaled_ndvi <= 1.0:
                                valid_ndvi_values.append(scaled_ndvi)
                    else:
                        print(f"⚠️ El punto cae fuera del tile h{h}v{v}.")
                    
                    hdf.end()
                except Exception as e:
                    print(f"⚠️ Error procesando MODIS: {str(e)[:80]}...")
                    continue

        if not valid_ndvi_values:
            print("⚠️ No se encontraron valores válidos de NDVI en el rango (posible nubosidad).")
            return None

        avg_ndvi = sum(valid_ndvi_values) / len(valid_ndvi_values)
        print(f"✅ NDVI promedio MODIS: {avg_ndvi:.4f} (basado en {len(valid_ndvi_values)} compuestos)")
        
        return {
            "modis_ndvi": round(avg_ndvi, 4),
            "modis_valid_composites": len(valid_ndvi_values)
        }
        
    except Exception as e:
        print(f"❌ Error crítico en MODIS: {e}")
        return None