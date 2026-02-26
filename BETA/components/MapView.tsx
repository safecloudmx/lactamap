import React, { useMemo } from 'react';
import { LactationRoom } from '../types';
import { MapPin, Navigation } from 'lucide-react';

interface MapViewProps {
  rooms: LactationRoom[];
  userLocation: { lat: number; lng: number };
  onMarkerClick: (room: LactationRoom) => void;
}

export const MapView: React.FC<MapViewProps> = ({ rooms, userLocation, onMarkerClick }) => {
  // Since we don't have a real map tile server key, we simulate a radar/relative map view
  // We plot points relative to the user in a normalized 100x100 coordinate box
  
  const markers = useMemo(() => {
    // Simple Mercator-ish projection for small distances
    // Scale factor to fit nearby points on screen
    const SCALE = 5000; // Arbitrary scale for demo
    
    return rooms.map(room => {
      const dx = (room.lng - userLocation.lng) * SCALE;
      const dy = (userLocation.lat - room.lat) * SCALE; // Flip Y for screen coords
      
      // Clamp to view box (approximate) to keep on screen or indicate direction
      // 50,50 is center
      const x = 50 + dx;
      const y = 50 + dy;
      
      return { ...room, x, y };
    });
  }, [rooms, userLocation]);

  return (
    <div className="relative w-full h-full bg-slate-100 overflow-hidden">
      {/* Map Background Grid/Texture */}
      <div className="absolute inset-0 opacity-10" 
           style={{ 
             backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', 
             backgroundSize: '20px 20px' 
           }}>
      </div>
      
      {/* Simulated Streets (Decorative) */}
      <div className="absolute top-1/2 left-0 w-full h-2 bg-white/50 -translate-y-1/2"></div>
      <div className="absolute left-1/2 top-0 h-full w-2 bg-white/50 -translate-x-1/2"></div>

      {/* User Location Pulse */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <span className="relative flex h-6 w-6">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-6 w-6 bg-blue-500 border-2 border-white shadow-md items-center justify-center">
            <Navigation className="w-3 h-3 text-white fill-current transform rotate-45" />
          </span>
        </span>
      </div>

      {/* Markers */}
      {markers.map((room) => (
        <button
          key={room.id}
          onClick={() => onMarkerClick(room)}
          style={{ 
            left: `${Math.min(Math.max(room.x, 5), 95)}%`, 
            top: `${Math.min(Math.max(room.y, 5), 95)}%` 
          }}
          className="absolute -translate-x-1/2 -translate-y-full group z-20"
        >
          <div className="relative flex flex-col items-center transition-transform transform hover:scale-110 hover:-translate-y-1">
            <div className={`p-1.5 rounded-full shadow-lg text-white ${room.rating >= 4 ? 'bg-rose-500' : 'bg-amber-500'}`}>
               <MapPin className="w-5 h-5 fill-current" />
            </div>
            <div className="absolute top-full mt-1 px-2 py-1 bg-white text-xs font-bold text-slate-700 rounded shadow-md opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-30">
              {room.name}
            </div>
            {/* Triangle pointer for tooltip */}
            <div className="absolute top-full w-2 h-2 bg-white transform rotate-45 -translate-y-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
        </button>
      ))}

      <div className="absolute bottom-24 right-4 bg-white/90 backdrop-blur p-2 rounded-lg shadow-sm text-xs text-slate-500 max-w-[150px] text-center">
        Mapa Simulado (Modo Demo)
      </div>
    </div>
  );
};