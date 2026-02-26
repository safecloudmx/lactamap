import React, { useState, useRef } from 'react';
import { Amenity, GenderAccess, LactationRoom } from '../types';
import { analyzeRoomImage } from '../services/geminiService';
import { Camera, Upload, Loader2, Check, X, Sparkles } from 'lucide-react';

interface AddRoomProps {
  onSave: (room: LactationRoom) => void;
  onCancel: () => void;
  currentLocation: { lat: number; lng: number };
}

export const AddRoom: React.FC<AddRoomProps> = ({ onSave, onCancel, currentLocation }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [access, setAccess] = useState<GenderAccess>(GenderAccess.NEUTRAL);
  const [selectedAmenities, setSelectedAmenities] = useState<Amenity[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      
      // Trigger AI Analysis
      setIsAnalyzing(true);
      const cleanBase64 = base64.split(',')[1];
      try {
        const analysis = await analyzeRoomImage(cleanBase64);
        setDescription(analysis.description);
        setSelectedAmenities(analysis.amenities);
        setAccess(analysis.accessType);
      } catch (err) {
        console.error(err);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleAmenity = (amenity: Amenity) => {
    setSelectedAmenities(prev => 
      prev.includes(amenity) 
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    );
  };

  const handleSave = () => {
    if (!name) return;

    const newRoom: LactationRoom = {
      id: Date.now().toString(),
      name,
      address: 'Ubicación actual', // Simplified for demo
      lat: currentLocation.lat,
      lng: currentLocation.lng,
      description,
      rating: 0,
      reviews: [],
      amenities: selectedAmenities,
      access,
      imageUrl: imagePreview || undefined,
      isVerified: false
    };
    onSave(newRoom);
  };

  return (
    <div className="bg-white h-full flex flex-col animate-in slide-in-from-bottom duration-300">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-700">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-bold text-slate-800">Nuevo Lactario</h2>
        <button 
          onClick={handleSave} 
          disabled={!name}
          className={`font-semibold ${!name ? 'text-gray-300' : 'text-primary'}`}
        >
          Guardar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
        {/* Image Section */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Foto del lugar</label>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="relative aspect-video rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden transition-colors"
          >
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white p-3 rounded-full flex items-center gap-2 shadow-lg">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-xs font-medium text-primary">Analizando con IA...</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center p-4">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2 text-primary">
                  <Camera className="w-6 h-6" />
                </div>
                <p className="text-sm text-slate-500">Toca para tomar foto o subir</p>
              </div>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            className="hidden" 
            onChange={handleImageUpload}
          />
          {imagePreview && !isAnalyzing && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 p-2 rounded-lg">
              <Sparkles className="w-3 h-3" />
              IA detectó servicios automáticamente
            </div>
          )}
        </div>

        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del lugar</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Sala de lactancia Liverpool"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿Está limpio? ¿Es cómodo? (La IA puede llenar esto por ti)"
              rows={3}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ubicación del baño</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(GenderAccess).map((type) => (
                <button
                  key={type}
                  onClick={() => setAccess(type)}
                  className={`p-2 text-xs font-medium rounded-lg border transition-all ${
                    access === type 
                      ? 'bg-primary text-white border-primary' 
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Amenities */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Servicios disponibles</label>
          <div className="flex flex-wrap gap-2">
            {Object.values(Amenity).map((amenity) => (
              <button
                key={amenity}
                onClick={() => toggleAmenity(amenity)}
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-all ${
                  selectedAmenities.includes(amenity)
                    ? 'bg-primary/10 text-primary border border-primary/20 font-medium'
                    : 'bg-slate-100 text-slate-500 border border-transparent hover:bg-slate-200'
                }`}
              >
                {selectedAmenities.includes(amenity) && <Check className="w-3 h-3" />}
                {amenity}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
