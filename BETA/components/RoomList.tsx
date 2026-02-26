import React from 'react';
import { LactationRoom, Amenity, GenderAccess } from '../types';
import { AMENITY_ICONS } from '../constants';
import { MapPin, Star } from 'lucide-react';

interface RoomListProps {
  rooms: LactationRoom[];
  onSelectRoom: (room: LactationRoom) => void;
  filterAccess: GenderAccess | 'ALL';
  setFilterAccess: (val: GenderAccess | 'ALL') => void;
  filterAmenity: Amenity | 'ALL';
  setFilterAmenity: (val: Amenity | 'ALL') => void;
}

export const RoomList: React.FC<RoomListProps> = ({ 
  rooms, 
  onSelectRoom, 
  filterAccess, 
  setFilterAccess,
  filterAmenity,
  setFilterAmenity
}) => {
  
  const filteredRooms = rooms.filter(room => {
    if (filterAccess !== 'ALL' && room.access !== filterAccess) return false;
    if (filterAmenity !== 'ALL' && !room.amenities.includes(filterAmenity)) return false;
    return true;
  });

  return (
    <div className="bg-slate-50 h-full flex flex-col">
      {/* Filters */}
      <div className="p-4 bg-white shadow-sm sticky top-0 z-10 space-y-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button 
            onClick={() => setFilterAccess('ALL')}
            className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap border ${filterAccess === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            Todos
          </button>
          {Object.values(GenderAccess).map(acc => (
            <button 
              key={acc}
              onClick={() => setFilterAccess(acc)}
              className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap border ${filterAccess === acc ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              {acc}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button 
            onClick={() => setFilterAmenity('ALL')}
            className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap border ${filterAmenity === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            Cualquier servicio
          </button>
          {Object.values(Amenity).map(am => (
            <button 
              key={am}
              onClick={() => setFilterAmenity(am)}
              className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap border ${filterAmenity === am ? 'bg-secondary text-white border-secondary' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              {AMENITY_ICONS[am]} {am}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {filteredRooms.length === 0 ? (
          <div className="text-center py-10 opacity-50">
            <p>No se encontraron lactarios con estos filtros.</p>
          </div>
        ) : filteredRooms.map(room => (
          <div 
            key={room.id}
            onClick={() => onSelectRoom(room)}
            className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden active:scale-95 transition-transform cursor-pointer"
          >
            <div className="h-32 bg-slate-200 relative">
              <img 
                src={room.imageUrl} 
                alt={room.name} 
                className="w-full h-full object-cover"
                onError={(e) => (e.currentTarget.src = 'https://picsum.photos/400/300?blur=2')}
              />
              <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                {room.rating > 0 ? room.rating.toFixed(1) : 'Nuevo'}
              </div>
            </div>
            <div className="p-4">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-slate-800">{room.name}</h3>
                {room.isVerified && (
                  <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Verificado</span>
                )}
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" /> {room.address}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-md border border-slate-200">
                  {room.access}
                </span>
                {room.amenities.slice(0, 3).map(am => (
                  <span key={am} className="px-2 py-0.5 bg-rose-50 text-rose-600 text-xs rounded-md border border-rose-100">
                    {AMENITY_ICONS[am]}
                  </span>
                ))}
                {room.amenities.length > 3 && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-md">
                    +{room.amenities.length - 3}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};