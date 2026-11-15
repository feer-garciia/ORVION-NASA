import httpx
from datetime import date

async def get_weather_data(lat: float, lon: float, start_date: date, end_date: date):
    """
    Consulta la API de NASA POWER para un rango de fechas específico.
    """
    # La NASA requiere el formato YYYYMMDD, sin guiones
    start_str = start_date.strftime("%Y%m%d")
    end_str = end_date.strftime("%Y%m%d")

    url = "https://power.larc.nasa.gov/api/temporal/daily/point"
    
    params = {
        "parameters": "T2M,PRECTOTCORR",
        "community": "AG",
        "longitude": lon,
        "latitude": lat,
        "start": start_str,
        "end": end_str,
        "format": "JSON"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=15.0)
            response.raise_for_status()
            data = response.json()
            
            properties = data.get("properties", {}).get("parameter", {})
            
            temps_raw = list(properties.get("T2M", {}).values())
            lluvias_raw = list(properties.get("PRECTOTCORR", {}).values())

            # Filtramos valores inválidos (-999)
            temps = [t for t in temps_raw if t > -90]
            lluvias = [l for l in lluvias_raw if l >= 0]
            
            if not temps or not lluvias:
                return None

            avg_temp = sum(temps) / len(temps)
            total_rain = sum(lluvias)

            return {
                "avg_temp_c": round(avg_temp, 2),
                "total_rain_mm": round(total_rain, 2),
                "valid_days_analyzed": len(temps)
            }

        except httpx.HTTPError as e:
            print(f"Error consultando NASA POWER: {e}")
            return None