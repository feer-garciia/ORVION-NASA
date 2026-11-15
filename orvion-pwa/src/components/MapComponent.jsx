// src/components/MapComponent.jsx
import { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ'; // <-- Importamos XYZ para el satélite
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Icon, Style } from 'ol/style';

export default function MapComponent({ lat, lng }) {
  const mapElement = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) return;

    const initialCoord = fromLonLat([lng, lat]);

    // 1. CREAMOS EL NUEVO ICONO (Pin verde en formato SVG)
    // Usamos un Data URI para no depender de imágenes externas
    const pinSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%232e7d32" width="36" height="36"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;

    markerRef.current = new Feature({
      geometry: new Point(initialCoord),
    });
    
    markerRef.current.setStyle(
      new Style({
        image: new Icon({
          anchor: [0.5, 1], // El ancla está en la punta del pin
          src: pinSvg,
          scale: 0.8, // Ajustamos el tamaño para que no sea gigante
        }),
      })
    );

    const vectorSource = new VectorSource({
      features: [markerRef.current],
    });

    mapRef.current = new Map({
      target: mapElement.current,
      layers: [
        // 2. CAMBIO A MODO SATÉLITE (ESRI World Imagery)
        new TileLayer({
          source: new XYZ({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attributions: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          }),
        }),
        new VectorLayer({ source: vectorSource }),
      ],
      view: new View({
        center: initialCoord,
        zoom: 15, // Un poco más de zoom para ver bien los surcos
      }),
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;

    const newCoord = fromLonLat([lng, lat]);
    
    mapRef.current.getView().animate({
      center: newCoord,
      zoom: 16,
      duration: 800,
    });

    markerRef.current.getGeometry().setCoordinates(newCoord);
  }, [lat, lng]);

  return <div id="map" ref={mapElement} style={{ width: '100%', height: '100%', minHeight: '360px', borderRadius: '12px' }}></div>;
}