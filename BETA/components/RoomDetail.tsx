import React, { useState } from 'react';
import { LactationRoom, Amenity } from '../types';
import { AMENITY_ICONS } from '../constants';
import { ArrowLeft, MapPin, Star, User, Navigation, Share2, Lock } from 'lucide-react';

interface RoomDetailProps {
  room: LactationRoom;
  onBack: () => void;
  isGuest: boolean;
  onRequireAuth: () => void;
  onSubmitReview: (roomId: string, comment: string, rating: number) => void;
}

export const RoomDetail: React.FC<RoomDetailProps> = ({ room, onBack, isGuest, onRequireAuth, onSubmitReview }) => {
  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState(5);
  
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: room.name,
        text: `Checa este lactario: ${room.name}`,
        url: window.location.href
      });
    } else {
      alert("Compartir no soportado en este navegador");
    }
  };

  const handleSubmit = () => {
    if (isGuest) {
      onRequireAuth();
      return;
    }
    if (!newComment) return;
    onSubmitReview(room.id, newComment, newRating);
    setNewComment('');
  };

  return (
    <div className="bg-white h-full flex flex-col animate-in slide-in-from-right duration-300 absolute inset-0 z-40">
      {/* Header Image */}
      <div className="relative h-64 shrink-0">
        <img 
          src={room.imageUrl} 
          alt={room.name}
          className="w-full h-full object-cover" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
        
        <button 
          onClick={onBack}
          className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        
        <div className="absolute bottom-0 left-0 p-6 text-white w-full">
          <h1 className="text-2xl font-bold leading-tight">{room.name}</h1>
          <div className="flex items-center gap-2 mt-2 text-white/90 text-sm">
            <MapPin className="w-4 h-4" />
            {room.address}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-white -mt-4 rounded-t-3xl relative z-10 p-6 space-y-6">
        
        {/* Actions */}
        <div className="flex gap-3">
          <button className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold shadow-lg shadow-primary/30 flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <Navigation className="w-5 h-5" />
            Cómo llegar
          </button>
          <button onClick={handleShare} className="bg-slate-100 text-slate-700 p-3 rounded-xl font-semibold active:scale-95 transition-transform">
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 border-b border-slate-100 pb-6">
          <div>
            <div className="text-3xl font-bold text-slate-800 flex items-center gap-1">
              {room.rating.toFixed(1)} <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
            </div>
            <div className="text-xs text-slate-500">Rating Promedio</div>
          </div>
          <div className="h-10 w-px bg-slate-200"></div>
          <div>
            <div className="text-lg font-semibold text-slate-800">{room.access}</div>
            <div className="text-xs text-slate-500">Tipo de Acceso</div>
          </div>
        </div>

        {/* Amenities */}
        <div>
          <h3 className="font-bold text-slate-800 mb-3">Servicios</h3>
          <div className="grid grid-cols-2 gap-3">
            {room.amenities.map(am => (
              <div key={am} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-2xl">{AMENITY_ICONS[am]}</span>
                <span className="text-sm font-medium text-slate-700">{am}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <h3 className="font-bold text-slate-800 mb-2">Descripción</h3>
          <p className="text-slate-600 leading-relaxed text-sm">
            {room.description}
          </p>
        </div>

        {/* Reviews */}
        <div className="pb-20">
          <h3 className="font-bold text-slate-800 mb-4">Reseñas ({room.reviews.length})</h3>
          
          <div className="space-y-4">
            {room.reviews.length > 0 ? room.reviews.map(review => (
              <div key={review.id} className="border-b border-slate-100 pb-4 last:border-0">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 font-bold text-xs">
                      {review.userName.charAt(0)}
                    </div>
                    <span className="font-semibold text-sm">{review.userName}</span>
                  </div>
                  <div className="flex text-yellow-400 text-xs">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-current' : 'text-slate-200 fill-slate-200'}`} />
                    ))}
                  </div>
                </div>
                <p className="text-slate-600 text-sm pl-10">{review.comment}</p>
              </div>
            )) : (
              <p className="text-sm text-slate-400 italic">Aún no hay reseñas. ¡Sé la primera!</p>
            )}
          </div>

          {/* Add Review Input */}
          <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h4 className="text-sm font-bold text-slate-800 mb-2">Escribe una reseña</h4>
            
            {isGuest ? (
              <button 
                onClick={onRequireAuth}
                className="w-full py-3 bg-slate-200 text-slate-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-300 transition-colors"
              >
                <Lock className="w-4 h-4" /> Inicia sesión para comentar
              </button>
            ) : (
              <>
                <div className="flex items-center gap-1 mb-3">
                   {[1,2,3,4,5].map(star => (
                     <button key={star} onClick={() => setNewRating(star)}>
                       <Star className={`w-6 h-6 ${star <= newRating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} />
                     </button>
                   ))}
                </div>
                <textarea 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Comparte tu experiencia..."
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 mb-2 bg-white"
                  rows={2}
                />
                <button 
                  onClick={handleSubmit}
                  disabled={!newComment}
                  className="w-full bg-slate-800 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  Publicar Reseña (+15 pts)
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
