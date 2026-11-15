# 🛰️ Orvion API (Backend)

API REST construida con **FastAPI** que actúa como el motor de datos e inteligencia de Orvion. Se encarga de conectarse a los servidores de la NASA, procesar formatos científicos complejos (HDF, NetCDF) y fusionar esos datos con la telemetría local (drones) para generar recomendaciones agrícolas.

---

## 🌟 Fuentes de Datos de la NASA y su Procesamiento

Uno de los mayores retos técnicos de esta API es la integración de 4 productos satelitales distintos, cada uno con diferentes formatos y resoluciones. Aquí se detalla cómo se obtienen y procesan:

### 1. 🌡️ NASA POWER (Clima y Radiación)
*   **Datos que extrae:** Temperatura a 2 metros (`T2M`) y Precipitación (`PRECTOTCORR`).
*   **Cómo se procesa:** Se realiza una petición HTTP directa a su API pública (no requiere token). Se extraen las series de tiempo diarias y se **calculan los promedios de temperatura y la suma total de lluvia**. Se aplica un filtro para ignorar valores nulos (`-999`) que devuelve la NASA cuando no hay datos para una coordenada.

### 2. 🌧️ GPM (Global Precipitation Measurement)
*   **Datos que extrae:** Precipitación satelital (Producto `GPM_3IMERGDL`).
*   **Cómo se procesa:** Utiliza `earthaccess` para descargar los archivos en formato NetCDF. Posteriormente, mediante `xarray` y el motor `h5netcdf`, se extrae la variable `precipitation`. Se filtran los valores negativos (que representan océano o falta de datos) y se calcula el acumulado de lluvia en el periodo.

### 3. 💧 SMAP (Soil Moisture Active Passive)
*   **Datos que extrae:** Humedad del suelo (Producto `SPL3SMP_E`).
*   **Cómo se procesa:** Se descargan los archivos HDF5. Para evitar colapsos de memoria (OOM), los archivos se procesan de forma **secuencial** (uno por uno) y solo se leen los últimos 5 días del rango. Se extrae el grupo `Soil_Moisture_Retrieval_Data_AM` y, debido a que SMAP usa una proyección geográfica especial, se calcula la distancia euclidiana entre la coordenada solicitada y la malla del satélite para encontrar el píxel exacto. El valor se convierte de `m3/m3` a porcentaje.

### 4. 🌿 MODIS (Vegetation Index)
*   **Datos que extrae:** NDVI (Índice de Vegetación de Diferencia Normalizada) (Producto `MOD13A2`).
*   **Cómo se procesa:** Los archivos vienen en formato HDF4 (que no es compatible con librerías geoespaciales estándar). Se descargan localmente y se leen usando `pyhdf`. Para ubicar el píxel, se utiliza `pyproj` para convertir las coordenadas Lat/Lon a la proyección Sinusoidal de MODIS, y se calcula matemáticamente el mosaico (tile) y la fila/columna exacta. El valor extraído se multiplica por su factor de escala (`0.0001`) y se traduce a un estado legible (Bueno, Regular, Malo).

---

## 📋 Requisitos Previos

1. **Credenciales de NASA Earthdata:**
   - Regístrate en [Earthdata Login](https://urs.earthdata.nasa.gov/).
   - Genera un Token de acceso (válido por 60 días).
   - Autoriza las aplicaciones **GES DISC** y **LP DAAC** en tu perfil.
2. **Variables de Entorno:**
   Crea un archivo `.env` en la raíz de `orvion-api` basado en el archivo `.env.example`:
   ```env
   EARTHDATA_TOKEN=tu_token_largo_aqui
   ````
## 🚀 Ejecución Local (Sin Docker)

Si deseas correr la API de forma nativa:
1. Instala uv: pip install uv
2. Sincroniza dependencias: uv sync
3. Ejecuta el servidor:
    ```bash
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    ````
## 🔌 Endpoints Principales

GET /api/v1/assessment

Evalúa un terreno basado en coordenadas y, opcionalmente, datos de un dron.

Parámetros:

    lat (float): Latitud.

    lon (float): Longitud.

    drone_soil_moisture (float, opcional): Humedad medida por el dron (%).

    drone_soil_temp (float, opcional): Temperatura del suelo medida por el dron (°C).

    start_date / end_date (YYYY-MM-DD, opcional): Rango de fechas (por defecto, mes anterior).

Respuesta: JSON con el estatus (VERDE, AMARILLO, ROJO), cultivo sugerido, y detalles de las 4 fuentes satelitales.

## 🧠 Lógica de Negocio (El Motor de Reglas)

La API no solo devuelve datos, sino que toma decisiones basadas en las siguientes reglas de negocio:

1. **Prioridad de Datos Locales (Dron):** Si el dron reporta una humedad < 15%, el estatus se vuelve ROJO automáticamente (sequía extrema), ignorando el resto de reglas.

2. **Fusión Ponderada (Data Fusion):** Para calcular la humedad y temperatura final del terreno, se aplica un promedio ponderado: (Dato NASA * 0.7) + (Dato Dron * 0.3). Le damos más peso a la NASA por su histórico de un mes, pero ajustamos con la precisión del dron.

3. **Recomendación Agronómica:** El sistema evalúa la temperatura y humedad final contra los rangos ideales de cada cultivo (Fresa: 15-22°C, Frijol: 18-25°C, Maíz: 18-33°C). El cultivo con mayor puntaje es el sugerido.

4. **Veto por MODIS (NDVI):** Si el índice de vegetación es menor a 0.2 (Estrés severo), el sistema fuerza un estatus ROJO o AMARILLO, ya que indica que el suelo o la vegetación existente está degradada y no apta para una nueva siembra sin tratamiento previo.
