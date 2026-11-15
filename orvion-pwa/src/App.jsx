// src/App.jsx
import { useState, useEffect } from 'react';
import MapComponent from './components/MapComponent';
import useGeolocation from './hooks/useGeolocation';
import { getCurrentWeather } from './services/weatherApi';
import { saveNasaCache, saveDroneData, getDroneData } from './db/indexeddb';
import './index.css';
import logo from './assets/orvion.png';

function App() {
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [loading, setLoading] = useState(false);
  const [nasaData, setNasaData] = useState(null);
  const [droneData, setDroneData] = useState(null);
  const [error, setError] = useState(null);
  
  // Nuevos estados para controlar el origen de los datos
  const [coordsSource, setCoordsSource] = useState('none'); // 'none' | 'gps' | 'drone' | 'manual'
  const [dataSource, setDataSource] = useState('none');
  
  const [currentWeather, setCurrentWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const { loaded, coordinates, error: geoError } = useGeolocation();

  // EFECTO 1: Solo actualiza las coordenadas con el GPS, SIN evaluar automáticamente
  useEffect(() => {
    if (loaded && coordinates.lat && coordinates.lng) {
      setLat(coordinates.lat);
      setLng(coordinates.lng);
      setCoordsSource('gps');
    }
  }, [loaded, coordinates]);

  // EFECTO 2: Obtener el clima cuando cambien las coordenadas
  useEffect(() => {
    if (lat === 0 && lng === 0) return;
    
    setWeatherLoading(true);
    getCurrentWeather(lat, lng)
      .then(data => {
        setCurrentWeather(data);
        setWeatherLoading(false);
      })
      .catch(err => {
        console.error("Error al obtener el clima:", err);
        setWeatherLoading(false);
      });
  }, [lat, lng]);

  // Función central de evaluación
  const ejecutarEvaluacion = async (evalLat, evalLng, dronePayload = null) => {
    setLoading(true);
    setError(null);
    setNasaData(null);
    setDataSource(dronePayload ? 'drone' : 'none');

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      let url = `${apiUrl}/api/v1/assessment?lat=${evalLat}&lon=${evalLng}`;
      
      if (dronePayload?.soilMoisture !== undefined) {
        url += `&drone_soil_moisture=${dronePayload.soilMoisture}`;
      }
      if (dronePayload?.soilTemp !== undefined) {
        url += `&drone_soil_temp=${dronePayload.soilTemp}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Error en API: ${response.status}`);
      
      const currentNasaData = await response.json();
      await saveNasaCache(evalLat, evalLng, 'general', currentNasaData);

      setNasaData(currentNasaData);
      setDataSource('nasa'); 

    } catch (err) {
      console.error("Error capturado:", err);
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Botón "Evaluar Terreno" principal
    const handleEvaluarClick = () => {
    
    if (coordsSource === 'gps') {
      alert("Generando análisis satelital con tu ubicación actual (GPS)...");
    }
    else if (coordsSource === 'drone') {
      alert("Generando análisis satelital con los datos del Dron...");
    }
    else if (coordsSource === 'manual') {
      alert("Generando análisis satelital con las coordenadas manuales...");
    }
    else {
      alert("No se ha definido un origen de coordenadas. Por favor, usa GPS, sube un JSON de dron o ingresa coordenadas manualmente.");
      return;
    }
    
    
    const payload = coordsSource === 'drone' ? droneData : null;
    ejecutarEvaluacion(lat, lng, payload);
  };

  // Carga del JSON del Dron
  const handleDroneUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      
      if (json.lat === undefined || json.lng === undefined) {
        alert("El JSON debe contener 'lat' y 'lng'.");
        return;
      }

      setLat(json.lat);
      setLng(json.lng);
      setDroneData(json);
      setCoordsSource('drone'); // Marcamos origen Dron
      setNasaData(null);
      
      await saveDroneData(json.lat, json.lng, json);
      
      // Aquí evaluamos automáticamente al subir el archivo
      alert("¡Datos del dron cargados! Consultando satélites para fusionar datos...");
      ejecutarEvaluacion(json.lat, json.lng, json);

    } catch (err) {
      alert("Error leyendo el archivo del dron.");
    }
  };

  // Función para forzar el uso de GPS y evaluar automáticamente
  const handleUsarGPS = () => {
    if (loaded && coordinates.lat && coordinates.lng) {
      const newLat = coordinates.lat;
      const newLng = coordinates.lng;

      // 1. Actualizamos la interfaz visual
      setLat(newLat);
      setLng(newLng);
      setDroneData(null); // Quitamos cualquier dato de dron que estuviera activo
      setCoordsSource('gps');
      
      // 2. Damos feedback visual al usuario
      alert("📍 Ubicación obtenida. Generando análisis satelital...");

      // 3. Disparamos la evaluación pasando las nuevas coordenadas directamente
      // (No usamos 'lat' o 'lng' del estado aquí porque React aún no las ha actualizado)
      ejecutarEvaluacion(newLat, newLng, null);
    } else {
      alert("No se ha podido obtener tu ubicación. Verifica los permisos de tu navegador.");
    }
  };

  // Inputs manuales
  const handleManualCoords = (newLat, newLng) => {
    setLat(newLat);
    setLng(newLng);
    setCoordsSource('manual');
    setDroneData(null); // Si escribe a mano, asumimos que no usa el dron
  };

  return (
    <>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img 
            src={logo} 
            alt="Orvion Logo" 
            style={{ height: '50px', width: 'auto', objectFit: 'contain' }} 
          />
          <h1 style={{ margin: 0 }}>ORVION</h1>
        </div>
        <p style={{ marginLeft: '65px' }}>AGRICULTURA INTELIGENTE</p>
      </header>

      <div className="dashboard">
        {/* CLIMA (HOY) */}
        <div className="card">
          <h3>CLIMA (HOY)</h3>
          <div className="weather-icon">
            {weatherLoading ? '⏳' : currentWeather ? '🌤️' : '⛅'}
          </div>
          <div className="weather-text">
            {weatherLoading ? 'Cargando...' :
             currentWeather ? `${currentWeather.temperature} °C` : 'Sin datos'}
          </div>
          <span className="hint">
            {currentWeather ? currentWeather.description : 'Temperatura Reciente'}
          </span>
          
          {/* NUEVA ETIQUETA: Indica de dónde viene el clima */}
          <div style={{ 
            marginTop: '10px', 
            fontSize: '11px', 
            fontWeight: 'bold',
            padding: '4px 8px',
            borderRadius: '12px',
            backgroundColor: 
              coordsSource === 'gps' ? '#e3f2fd' : 
              coordsSource === 'drone' ? '#e8f5e9' : 
              '#f5f5f5',
            color: 
              coordsSource === 'gps' ? '#1565c0' : 
              coordsSource === 'drone' ? '#2e7d32' : 
              '#555'
          }}>
            {coordsSource === 'gps' ? '📍 Clima en tu ubicación actual' :
             coordsSource === 'drone' ? '🚁 Clima en ubicación del Dron' :
             coordsSource === 'manual' ? '✍️ Clima en coordenadas manuales' : 
             'Sin ubicación'}
          </div>
        </div>

        {/* DATOS AMBIENTALES */}
        <div className="card">
          <h3>DATOS AMBIENTALES</h3>
          <div className="env-item">
            💧 <span>{nasaData ? `${nasaData.details.final_soil_moisture_percent} %` : (coordsSource === 'drone' && droneData ? `${droneData.soilMoisture} %` : '--')}</span>
          </div>
          <div className="env-item">
            🌡️ <span>{nasaData ? `${nasaData.details.final_temp_c} °C` : (coordsSource === 'drone' && droneData ? `${droneData.soilTemp} °C` : '--')}</span>
          </div>
          <div className="env-item">
            🌧️ <span>{nasaData ? `${nasaData.details.gpm_precipitation_mm} mm` : '--'}</span>
          </div>
          <div style={{ fontSize: '10px', marginTop: '10px', color: '#777' }}>
            {loading ? '🛰️ Calculando...' : 
             coordsSource === 'drone' && dataSource === 'nasa' ? 'Promedio Ponderado (NASA + Dron)' : 
             coordsSource === 'drone' && !nasaData ? '🚁 Datos del Dron' : 
             dataSource === 'nasa' ? '✅ Datos NASA (Satélite)' : ''}
          </div>
        </div>

        {/* MAPA */}
        <div className="card map-card">
          <MapComponent lat={lat} lng={lng} />
        </div>

        {/* COORDENADAS Y CONTROLES */}
        <div className="card coords-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h3 style={{ margin: 0 }}>COORDENADAS</h3>
            
            {/* Indicador visual del origen de datos */}
            <span style={{ 
              fontSize: '11px', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold',
              backgroundColor: coordsSource === 'gps' ? '#e3f2fd' : coordsSource === 'drone' ? '#e8f5e9' : '#f5f5f5',
              color: coordsSource === 'gps' ? '#1565c0' : coordsSource === 'drone' ? '#2e7d32' : '#555'
            }}>
              {coordsSource === 'gps' ? '📍 Ubicación GPS' : 
               coordsSource === 'drone' ? '🚁 Dron' : 
               coordsSource === 'manual' ? '✍️ Manual' : 'Sin definir'}
            </span>
          </div>

          <div className="inputs-row">
            <div className="input-group">
              <label>Latitud</label>
              <input type="number" step="any" value={lat} onChange={(e) => handleManualCoords(parseFloat(e.target.value) || 0, lng)} />
            </div>
            <div className="input-group">
              <label>Longitud</label>
              <input type="number" step="any" value={lng} onChange={(e) => handleManualCoords(lat, parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          
          {/* Botón Principal de Evaluación */}
          <button onClick={handleEvaluarClick} disabled={loading}>
            {loading ? 'ANALIZANDO...' : 'EVALUAR TERRENO'}
            
          </button>
          
          {error && <p className="error" style={{ marginTop: '10px' }}>{error}</p>}
          
          <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            
            {/* --- ZONA DE BOTONES O ANIMACIÓN DEL TRACTOR --- */}
            {loading ? (
              // Si está cargando, mostramos la animación del tractor
              <div style={{ width: '100%' }}>
                <div className="tractor-container">
                  <div className="tractor">🚜</div>
                  <div className="crops">
                    <span className="crop">🌱</span>
                    <span className="crop">🌱</span>
                    <span className="crop">🌱</span>
                    <span className="crop">🌱</span>
                    <span className="crop">🌱</span>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#2e7d32', marginTop: '8px', fontWeight: 'bold' }}>
                  Sembrando análisis satelital...
                </div>
              </div>
            ) : (
              // Si ya terminó, mostramos los botones normales
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  onClick={handleUsarGPS} 
                  style={{ backgroundColor: '#1565c0', fontSize: '12px', padding: '8px 15px' }}
                >
                  📍 Analizar mi ubicación actual
                </button>
                
                {(coordsSource === 'drone' || droneData) && (
                  <button 
                    onClick={handleUsarGPS} 
                    style={{ backgroundColor: '#d32f2f', fontSize: '12px', padding: '8px 15px' }}
                  >
                    ❌ Quitar Dron y usar GPS
                  </button>
                )}
              </div>
            )}

            <div style={{ marginTop: '5px' }}>
              <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '5px' }}>Subir datos del Dron (JSON): </label>
              <input type="file" accept=".json" onChange={handleDroneUpload} style={{ fontSize: '12px' }} />
            </div>
          </div>
        </div>

                {/* TARJETAS INFERIORES */}
        <div className="bottom-cards">
          
          {/* 1. SUGERENCIA DE CULTIVO */}
          <div className="card" style={{ border: '2px solid #2e7d32', background: '#e8f5e9' }}>
            <h3>SUGERENCIA DE CULTIVO</h3>
            <div className="crop-value" style={{ fontSize: '28px', color: '#1b5e20', textTransform: 'uppercase' }}>
              {nasaData ? nasaData.suggested_crop : '---'}
            </div>
            <p style={{ fontSize: '12px', marginTop: '10px', color: '#333', lineHeight: '1.4' }}>
              {nasaData ? nasaData.message : 'Sube un JSON o evalúa para obtener una sugerencia.'}
            </p>
          </div>
          
          {/* 2. ESTATUS DEL TERRENO Y PUNTAJES */}
          <div className="card">
            <h3>ESTATUS DEL TERRENO</h3>
            <div className="crop-value" style={{ 
              color: nasaData?.status === 'VERDE' ? '#2e7d32' : 
                     nasaData?.status === 'ROJO' ? '#d32f2f' : 
                     nasaData?.status === 'AMARILLO' ? '#f57c00' : '#555'
            }}>
              {nasaData ? nasaData.status : 'PENDIENTE'}
            </div>
            
            {/* Desglose de Puntajes */}
            {nasaData?.details?.scores && (
              <div style={{ 
                marginTop: '15px', 
                width: '100%', 
                backgroundColor: '#f5f5f5', 
                padding: '10px', 
                borderRadius: '8px',
                fontSize: '12px',
                textAlign: 'left'
              }}>
                <strong style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Puntaje de Aptitud:</strong>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', paddingBottom: '3px' }}>
                  <span>🍓 Fresa</span> <strong>{nasaData.details.scores.Fresa} pts</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', padding: '3px 0' }}>
                  <span>🫘 Frijol</span> <strong>{nasaData.details.scores.Frijol} pts</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '3px' }}>
                  <span>🌽 Maíz</span> <strong>{nasaData.details.scores.Maíz} pts</strong>
                </div>
              </div>
            )}
          </div>

          {/* 3. MODIS CON RANGO ÓPTIMO */}
                    {/* 3. MODIS CON BARRA DE COLORES CONTINUA */}
          <div className="card">
            <h3>SALUD VEGETAL (MODIS)</h3>
            <div className="crop-value" style={{ 
              color: nasaData?.details?.modis_ndvi < 0.2 ? '#d32f2f' : 
                     nasaData?.details?.modis_ndvi < 0.4 ? '#f57c00' : 
                     nasaData?.details?.modis_ndvi < 0.6 ? '#fbc02d' : '#2e7d32' 
            }}>
              {nasaData?.details?.modis_ndvi ? nasaData.details.modis_ndvi : '--'}
            </div>
            <div style={{ 
              fontSize: '14px', fontWeight: 'bold', marginTop: '5px',
              color: nasaData?.details?.modis_ndvi < 0.2 ? '#d32f2f' : 
                     nasaData?.details?.modis_ndvi < 0.4 ? '#f57c00' : 
                     nasaData?.details?.modis_ndvi < 0.6 ? '#fbc02d' : '#2e7d32'
            }}>
               {nasaData?.details?.modis_status || 'Sin datos'}
            </div>

            {/* BARRA DE PROGRESO DE COLORES */}
            <div style={{ width: '100%', marginTop: '20px', position: 'relative' }}>
              
              {/* Barra de gradiente */}
              <div style={{ 
                width: '100%', 
                height: '14px', 
                borderRadius: '7px',
                background: 'linear-gradient(to right, #d32f2f 0%, #f57c00 20%, #fbc02d 40%, #8bc34a 60%, #4caf50 80%, #2e7d32 100%)',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
                position: 'relative'
              }}>
                
                {/* Zona Óptima Resaltada (de 0.6 a 0.8) */}
                <div style={{
                  position: 'absolute',
                  left: '60%',
                  width: '20%',
                  height: '100%',
                  border: '2px solid white',
                  borderTop: 'none',
                  borderBottom: 'none',
                  boxSizing: 'border-box'
                }}></div>

                {/* Marcador de la posición actual */}
                {nasaData?.details?.modis_ndvi !== undefined && (
                  <div style={{
                    position: 'absolute',
                    // Convertimos el valor (0 a 1) a un porcentaje (0% a 100%)
                    left: `${Math.max(0, Math.min(100, nasaData.details.modis_ndvi * 100))}%`,
                    width: '18px', 
                    height: '18px', 
                    background: 'white', 
                    border: '3px solid #333',
                    top: '-2px', 
                    borderRadius: '50%', 
                    transform: 'translateX(-50%)',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                    zIndex: 10,
                    transition: 'left 0.5s ease-out'
                  }} title={`Valor actual: ${nasaData.details.modis_ndvi}`}></div>
                )}
              </div>

              {/* Etiquetas de la escala debajo de la barra */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#777', marginTop: '5px' }}>
                <span>0.0</span>
                <span>0.2</span>
                <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>0.6 (Óptimo)</span>
                <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>0.8</span>
                <span>1.0</span>
              </div>
            </div>
          </div>
          </div>
        </div>
    </>
  );

}

export default App;