import earthaccess
import xarray as xr
from datetime import date
import os
from app.config import settings

os.environ["EARTHDATA_TOKEN"] = settings.earthdata_token

def get_gpm_precipitation(lat: float, lon: float, start_date: date, end_date: date):
    try:
        earthaccess.login(strategy="environment")
        print("✅ Autenticación con Earthdata exitosa.")
    except Exception as e:
        print(f"❌ Error de autenticación Earthdata: {e}")
        return None

    print("🔍 Buscando datos de GPM IMERG...")
    results = earthaccess.search_data(
        short_name="GPM_3IMERGDL",
        temporal=(start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")),
        bounding_box=(lon - 0.1, lat - 0.1, lon + 0.1, lat + 0.1)
    )

    if not results:
        print("❌ No se encontraron resultados para los criterios de búsqueda.")
        return None

    print(f"✅ Se encontraron {len(results)} archivos. Descargando y procesando...")

    try:
        files = earthaccess.open(results[-7:])
        
        # Abrimos todos los archivos. Como ya sabemos que NO hay grupo "Grid",
        # simplemente lo omitimos.
        ds = xr.open_mfdataset(
            files, 
            combine="by_coords", 
            engine="h5netcdf"
        )
        
        # Extraemos la variable. 
        # Usamos .where() para filtrar los valores negativos (como -9999.9 que significa "sin datos")
        precip_data = ds['precipitation'].where(ds['precipitation'] >= 0)
        
        # Extraemos el valor más cercano a la lat/lon
        precip_value = precip_data.sel(lat=lat, lon=lon, method="nearest").values
        
        # Sumamos la precipitación de todos los días. 
        # Si no hay datos (NaN), los tratamos como 0 para la suma.
        total_mm = float(precip_value.sum())
        
        return {
            "gpm_precipitation_mm": round(total_mm, 2)
        }
    except Exception as e:
        print(f"❌ Error procesando datos GPM: {e}")
        return None