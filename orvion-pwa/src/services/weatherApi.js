// src/services/weatherApi.js

// Mapeo de códigos de tiempo de Open-Meteo a descripciones legibles
// (Puedes encontrar la lista completa en su documentación)
const weatherCodeMap = {
  0: 'Cielo despejado',
  1: 'Principalmente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Niebla',
  48: 'Niebla con escarcha',
  51: 'Llovizna ligera',
  53: 'Llovizna moderada',
  55: 'Llovizna densa',
  61: 'Lluvia ligera',
  63: 'Lluvia moderada',
  65: 'Lluvia fuerte',
  71: 'Nevada ligera',
  73: 'Nevada moderada',
  75: 'Nevada fuerte',
  80: 'Chubascos ligeros',
  81: 'Chubascos moderados',
  82: 'Chubascos violentos',
  95: 'Tormenta eléctrica',
};

export const getCurrentWeather = async (lat, lng) => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('No se pudo obtener el clima actual');
  }

  const data = await response.json();
  const current = data.current;

  return {
    temperature: current.temperature_2m,
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    description: weatherCodeMap[current.weather_code] || 'Condición desconocida',
    weatherCode: current.weather_code,
  };
};