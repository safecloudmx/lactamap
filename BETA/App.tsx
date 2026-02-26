import React, { useState, useEffect } from 'react';
import { ViewState, LactationRoom, GenderAccess, Amenity, User } from './types';
import { MOCK_ROOMS, POINTS } from './constants';
import { MapView } from './components/MapView';
import { RoomList } from './components/RoomList';
import { RoomDetail } from './components/RoomDetail';
import { AddRoom } from './components/AddRoom';
import { AuthOverlay } from './components/AuthOverlay';
import { UserProfile } from './components/UserProfile';
import { findNearbyLactationRooms } from './services/geminiService';
import { addPoints } from './services/gamificationService';
import { Map as MapIcon, List, PlusCircle, User as UserIcon, Search } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.MAP);
  const [rooms, setRooms] = useState<LactationRoom[]>(MOCK_ROOMS);
  const [selectedRoom, setSelectedRoom] = useState<LactationRoom | null>(null);
  const [userLocation, setUserLocation] = useState({ lat: 19.4326, lng: -99.1332 }); 
  
  // Auth & User State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [showAuthOverlay, setShowAuthOverlay] = useState(true);
  
  // Filters
  const [filterAccess, setFilterAccess] = useState<GenderAccess | 'ALL'>('ALL');
  const [filterAmenity, setFilterAmenity] = useState<Amenity | 'ALL'>('ALL');

  // Load user from local storage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('lactamap_user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
      setShowAuthOverlay(false);
    }
  }, []);

  // Save user to local storage when changed
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('lactamap_user', JSON.stringify(currentUser));
    }
  }, [currentUser]);

  // Get Location on Mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn("Geolocation error", error);
        }
      );
    }
  }, []);

  // --- Auth Handlers ---
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setShowAuthOverlay(false);
    setIsGuest(false);
  };

  const handleGuestAccess = () => {
    setIsGuest(true);
    setShowAuthOverlay(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('lactamap_user');
    setShowAuthOverlay(true);
    setView(ViewState.MAP);
  };

  const checkAuthOrPrompt = () => {
    if (!currentUser && isGuest) {
      setShowAuthOverlay(true);
      return false;
    }
    return true;
  };

  // --- Action Handlers with Gamification ---

  const handleAddRoom = (newRoom: LactationRoom) => {
    // 1. Add Room
    setRooms(prev => [{ ...newRoom, createdBy: currentUser?.id }, ...prev]);
    
    // 2. Award Points
    if (currentUser) {
      const { user, newBadges } = addPoints(currentUser, POINTS.ADD_ROOM, 'ROOM');
      setCurrentUser(user);
      
      if (newBadges.length > 0) {
        alert(`¡Felicidades! Desbloqueaste la insignia: ${newBadges[0].name}`);
      }
    }

    setView(ViewState.LIST);
  };

  const handleAddReview = (roomId: string, comment: string, rating: number) => {
     // 1. Update Room Data
     setRooms(prev => prev.map(r => {
       if (r.id === roomId) {
         return {
           ...r,
           rating: (r.rating * r.reviews.length + rating) / (r.reviews.length + 1),
           reviews: [{
             id: Date.now().toString(),
             userId: currentUser?.id || 'guest',
             userName: currentUser?.name || 'Invitado',
             rating,
             comment,
             date: new Date().toISOString().split('T')[0]
           }, ...r.reviews]
         };
       }
       return r;
     }));

     // 2. Award Points
     if (currentUser) {
      const { user, newBadges } = addPoints(currentUser, POINTS.ADD_REVIEW, 'REVIEW');
      setCurrentUser(user);
      
      if (newBadges.length > 0) {
        alert(`¡Felicidades! Desbloqueaste la insignia: ${newBadges[0].name}`);
      }
     }
  };

  const handleSelectRoom = (room: LactationRoom) => {
    setSelectedRoom(room);
  };

  const handleBackFromDetail = () => {
    setSelectedRoom(null);
  };

  const handleGeminiSearch = async () => {
    const results = await findNearbyLactationRooms(userLocation.lat, userLocation.lng);
    if (results.length > 0) {
       const newRooms = results.map((r, idx) => ({
         id: `ai-${Date.now()}-${idx}`,
         name: r.name,
         address: r.address,
         lat: userLocation.lat + (Math.random() * 0.002 - 0.001), 
         lng: userLocation.lng + (Math.random() * 0.002 - 0.001),
         description: "Detectado por Gemini Maps Grounding",
         rating: r.rating,
         reviews: [],
         amenities: [Amenity.CHANGING_TABLE],
         access: GenderAccess.NEUTRAL,
         imageUrl: `https://picsum.photos/400/300?random=${idx + 10}`,
         isVerified: false
       }));
       setRooms(prev => [...prev, ...newRooms]);
       alert(`¡Gemini encontró ${results.length} lugares cercanos!`);
    } else {
       alert("Gemini no encontró resultados específicos, pero prueba agregando uno.");
    }
  };

  return (
    <div className="h-full flex flex-col bg-white max-w-md mx-auto shadow-2xl relative overflow-hidden">
      
      {showAuthOverlay && (
        <AuthOverlay onLogin={handleLogin} onGuest={handleGuestAccess} />
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden">
        {view === ViewState.MAP && (
          <>
            <MapView 
              rooms={rooms} 
              userLocation={userLocation}
              onMarkerClick={(room) => {
                setSelectedRoom(room);
              }}
            />
            <button 
               onClick={handleGeminiSearch}
               className="absolute top-4 right-4 bg-white/90 backdrop-blur p-2 rounded-full shadow-lg text-primary border border-primary/20 active:scale-90 transition-transform z-30"
               title="Buscar con IA"
            >
               <Search className="w-6 h-6" />
            </button>
          </>
        )}
        
        {view === ViewState.LIST && (
          <RoomList 
            rooms={rooms} 
            onSelectRoom={handleSelectRoom}
            filterAccess={filterAccess}
            setFilterAccess={setFilterAccess}
            filterAmenity={filterAmenity}
            setFilterAmenity={setFilterAmenity}
          />
        )}
        
        {view === ViewState.PROFILE && currentUser && (
          <UserProfile 
            user={currentUser} 
            onLogout={handleLogout}
            onClose={() => setView(ViewState.MAP)} 
          />
        )}

        {/* Modals / Full Screen Views */}
        {view === ViewState.ADD && (
          <div className="absolute inset-0 z-40">
             <AddRoom 
               onSave={handleAddRoom} 
               onCancel={() => setView(ViewState.MAP)}
               currentLocation={userLocation}
             />
          </div>
        )}

        {selectedRoom && (
          <RoomDetail 
            room={selectedRoom} 
            onBack={handleBackFromDetail}
            isGuest={isGuest}
            onRequireAuth={() => setShowAuthOverlay(true)}
            onSubmitReview={handleAddReview}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      {!showAuthOverlay && (
        <nav className="h-16 bg-white border-t border-slate-100 flex justify-around items-center z-30 shrink-0 pb-safe">
          <button 
            onClick={() => setView(ViewState.MAP)}
            className={`flex flex-col items-center gap-1 w-16 ${view === ViewState.MAP ? 'text-primary' : 'text-slate-400'}`}
          >
            <MapIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium">Mapa</span>
          </button>

          <button 
            onClick={() => {
              if (checkAuthOrPrompt()) {
                setView(ViewState.ADD);
              }
            }}
            className="flex flex-col items-center -mt-6"
          >
            <div className="w-14 h-14 bg-primary rounded-full shadow-lg shadow-primary/40 flex items-center justify-center text-white border-4 border-white">
              <PlusCircle className="w-8 h-8" />
            </div>
            <span className="text-[10px] font-medium text-slate-500 mt-1">Agregar</span>
          </button>

          <button 
            onClick={() => setView(ViewState.LIST)}
            className={`flex flex-col items-center gap-1 w-16 ${view === ViewState.LIST ? 'text-primary' : 'text-slate-400'}`}
          >
            <List className="w-6 h-6" />
            <span className="text-[10px] font-medium">Lista</span>
          </button>

          {/* Profile or Guest Login Trigger */}
          <button 
            onClick={() => {
              if (isGuest) {
                setShowAuthOverlay(true);
              } else {
                setView(ViewState.PROFILE);
              }
            }}
            className={`flex flex-col items-center gap-1 w-16 ${view === ViewState.PROFILE ? 'text-primary' : 'text-slate-400'}`}
          >
            <UserIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium">{isGuest ? 'Entrar' : 'Perfil'}</span>
          </button>
        </nav>
      )}
    </div>
  );
};

export default App;
