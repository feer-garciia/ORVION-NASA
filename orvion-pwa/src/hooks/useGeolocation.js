// src/hooks/useGeolocation.js
import { useState, useEffect } from 'react';

const useGeolocation = () => {
  const [location, setLocation] = useState({
    loaded: false,
    coordinates: { lat: null, lng: null },
    error: null,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({
        loaded: true,
        coordinates: { lat: null, lng: null },
        error: 'La geolocalización no es soportada por este navegador',
      });
      return;
    }

    const onSuccess = (position) => {
      setLocation({
        loaded: true,
        coordinates: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
        error: null,
      });
    };

    const onError = (error) => {
      setLocation({
        loaded: true,
        coordinates: { lat: null, lng: null },
        error: error.message,
      });
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError);
  }, []);

  return location;
};

export default useGeolocation;