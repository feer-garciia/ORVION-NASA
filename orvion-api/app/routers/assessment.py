import gc # Garbage Collector
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import date, timedelta
from app.services.nasa_power import get_weather_data
from app.services.gpm import get_gpm_precipitation
from app.services.smap import get_smap_moisture
from app.services.modis import get_modis_ndvi

router = APIRouter()

class AssessmentResponse(BaseModel):
    status: str
    message: str
    suggested_crop: str
    details: dict = {}

# Función que evalúa qué cultivo es el mejor
def recomendar_cultivo(temp_actual, humedad_actual, lluvia_mm):
    scores = {"Fresa": 0, "Frijol": 0, "Maíz": 0}
    
    # --- REGLAS DE EVALUACIÓN ---
    
    # 1. Fresa (Ideal: 18-20°C, Humedad Moderada-Alta, Sensible a excesos)
    if 15 <= temp_actual <= 22: scores["Fresa"] += 3
    elif 10 <= temp_actual <= 25: scores["Fresa"] += 1
    if 25 <= humedad_actual <= 40: scores["Fresa"] += 3 # Adaptado a % de suelo
    if lluvia_mm > 150: scores["Fresa"] -= 2 # Se pudre fácilmente
    
    # 2. Frijol (Ideal: 18-25°C, Humedad Media, Odia encharcamientos)
    if 18 <= temp_actual <= 25: scores["Frijol"] += 3
    elif 15 <= temp_actual <= 28: scores["Frijol"] += 1
    if 20 <= humedad_actual <= 35: scores["Frijol"] += 3
    if lluvia_mm > 180: scores["Frijol"] -= 2 # Evitar encharcamientos
    
    # 3. Maíz (Ideal: 18-33°C, Tolera más variaciones, necesita buena humedad)
    if 18 <= temp_actual <= 33: scores["Maíz"] += 3
    elif 15 <= temp_actual <= 35: scores["Maíz"] += 1
    if 20 <= humedad_actual <= 45: scores["Maíz"] += 2
    if lluvia_mm > 200: scores["Maíz"] -= 1 # Tolera un poco más el agua

    # Encontrar el cultivo con el puntaje más alto
    mejor_cultivo = max(scores, key=scores.get)
    return mejor_cultivo, scores

@router.get("/api/v1/assessment", response_model=AssessmentResponse)
async def evaluate_terrain(
    lat: float = Query(...),
    lon: float = Query(...),
    drone_soil_moisture: Optional[float] = Query(None),
    drone_soil_temp: Optional[float] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None)
):
    if not start_date or not end_date:
        today = date.today()
        first_day_current = today.replace(day=1)
        last_day_prev = first_day_current - timedelta(days=1)
        first_day_prev = last_day_prev.replace(day=1)
        start_date = first_day_prev
        end_date = last_day_prev

    # 1. Consultas
    weather = await get_weather_data(lat, lon, start_date, end_date)
    gpm_data = get_gpm_precipitation(lat, lon, start_date, end_date)
    smap_data = get_smap_moisture(lat, lon, start_date, end_date)
    modis_data = get_modis_ndvi(lat, lon, start_date, end_date)

    if not weather:
        raise HTTPException(status_code=503, detail="No hay datos de NASA POWER disponibles")

    # 2. Calcular datos ponderados
    smap_moisture = smap_data["smap_soil_moisture_percent"] if smap_data else 25.0 # 25% default
    final_moisture = smap_moisture
    if drone_soil_moisture is not None:
        final_moisture = (smap_moisture * 0.7) + (drone_soil_moisture * 0.3)

    final_temp = weather["avg_temp_c"]
    if drone_soil_temp is not None:
        final_temp = (weather["avg_temp_c"] * 0.7) + (drone_soil_temp * 0.3)

    lluvia_total = gpm_data["gpm_precipitation_mm"] if gpm_data else 0.0

    # 3. Obtener Recomendación
    cultivo_sugerido, scores = recomendar_cultivo(final_temp, final_moisture, lluvia_total)

    # 4. Generar detalles
    details = {
        "period_analyzed": f"{start_date} al {end_date}",
        "final_temp_c": round(final_temp, 2),
        "final_soil_moisture_percent": round(final_moisture, 2),
        "gpm_precipitation_mm": round(lluvia_total, 2),
        "scores": scores,
        "recent_temp_c": round(final_temp, 2)
    }
    
    if modis_data:
        ndvi = modis_data["modis_ndvi"]
        details["modis_ndvi"] = ndvi
        if ndvi < 0.2: details["modis_status"] = "Malo (Estrés severo)"
        elif ndvi < 0.4: details["modis_status"] = "Regular (Estrés moderado)"
        elif ndvi < 0.6: details["modis_status"] = "Bueno (Vegetación sana)"
        else: details["modis_status"] = "Excelente (Vegetación densa)"

    # 5. Evaluar Estatus General (CON PRIORIDAD EN MODIS)
    status = "VERDE"
    message = f"Condiciones óptimas para iniciar un cultivo de {cultivo_sugerido}."

    # Prioridad 1: Problemas críticos de agua o temperatura
    if final_moisture < 15.0:
        status, message = "ROJO", "Sequía extrema. El suelo está demasiado seco, se requiere riego urgente."
    elif final_temp > 35.0:
        status, message = "ROJO", "Calor extremo. Las temperaturas son demasiado altas para la siembra."
    elif lluvia_total > 200.0:
        status, message = "ROJO", "Riesgo de inundación. Lluvias excesivas en la zona."
    
    # Prioridad 2: El estado de la vegetación (MODIS)
    elif modis_data and modis_data["modis_ndvi"] < 0.2:
        status, message = "ROJO", f"Alerta MODIS: Estrés severo en la vegetación (NDVI: {modis_data['modis_ndvi']}). El terreno podría estar degradado."
    elif modis_data and modis_data["modis_ndvi"] < 0.4:
        status, message = "AMARILLO", f"Precaución MODIS: Estrés moderado (NDVI: {modis_data['modis_ndvi']}). Revisar estado del suelo."
        
    # Prioridad 3: Advertencias leves
    elif final_moisture > 50.0:
        status, message = "AMARILLO", "Exceso de humedad. Cuidado con hongos en las raíces."
    else:
        status, message = "VERDE", f"Condiciones óptimas para iniciar un cultivo de {cultivo_sugerido}."

    gc.collect()

    return AssessmentResponse(
        status=status,
        message=message,
        suggested_crop=cultivo_sugerido,
        details=details
    )