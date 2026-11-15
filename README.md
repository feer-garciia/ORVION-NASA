# 🌱 Orvion - Agricultura Inteligente

Orvion es una plataforma de agricultura de precisión que fusiona datos satelitales de la NASA con telemetría local (drones) para evaluar la aptitud del terreno, predecir sequías/inundaciones y recomendar el mejor cultivo a sembrar.

## 🏗️ Arquitectura del Proyecto

El proyecto está construido como un monorepositorio dividido en dos servicios principales, orquestados mediante Docker:

- **`/orvion-api`**: Backend en Python (FastAPI) que consume las APIs de la NASA.
- **`/orvion-pwa`**: Frontend en React (Vite) configurado como PWA (Progressive Web App) con almacenamiento local (IndexedDB).

## 🚀 Inicio Rápido (Docker)

La forma más sencilla de levantar todo el ecosistema es usando Docker Compose.

1. Clona el repositorio.
2. Asegúrate de tener configuradas las variables de entorno (revisa los README de cada carpeta).
3. En la raíz del proyecto, ejecuta:
   ```bash
   docker compose up --build
4. Abre el Frontend en http://localhost:5173 y la documentación de la API en http://localhost:8000/docs.

## 🛠️ Tecnologías Principales

    Backend: Python, FastAPI, Uvicorn, Earthaccess, Xarray, Pyhdf, Uv.

    Frontend: React, Vite, Vite-PWA, OpenLayers (Mapas), IDB (IndexedDB).

    Datos (NASA): POWER (Clima), GPM (Precipitación), SMAP (Humedad del suelo), MODIS (NDVI).

## ✨ Características Principales

    Fusión de Datos: Ponderación inteligente entre datos históricos satelitales (70%) y mediciones locales del dron (30%).

    Recomendación de Cultivos: Algoritmo que evalúa temperatura y humedad para sugerir Fresa, Frijol o Maíz.

    Modo Offline: Capacidad de consultar evaluaciones previas sin conexión gracias a IndexedDB y Service Workers.

    Geolocalización: Obtención automática de coordenadas y clima en tiempo real.