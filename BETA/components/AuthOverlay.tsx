import React, { useState } from 'react';
import { createNewUser } from '../services/gamificationService';
import { User } from '../types';
import { User as UserIcon, Baby } from 'lucide-react';

interface AuthOverlayProps {
  onLogin: (user: User) => void;
  onGuest: () => void;
}

export const AuthOverlay: React.FC<AuthOverlayProps> = ({ onLogin, onGuest }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulation of auth
    const user = createNewUser(name || (isLogin ? 'Usuario' : 'Nuevo Usuario'), email);
    onLogin(user);
  };

  return (
    <div className="absolute inset-0 z-50 bg-rose-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden p-8">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white shadow-lg shadow-primary/30">
             <Baby className="w-8 h-8" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">
          {isLogin ? 'Bienvenido a LactaMap' : 'Crea tu cuenta'}
        </h1>
        <p className="text-center text-slate-500 mb-8 text-sm">
          Encuentra, califica y comparte espacios seguros para ti y tu bebé.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Nombre</label>
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Tu nombre"
              />
            </div>
          )}
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="nombre@ejemplo.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Contraseña</label>
            <input 
              type="password" 
              required
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/30 active:scale-95 transition-transform">
            {isLogin ? 'Iniciar Sesión' : 'Registrarse'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600 mb-4">
            {isLogin ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
            <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-bold hover:underline">
              {isLogin ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-slate-400">O continúa sin cuenta</span>
            </div>
          </div>

          <button 
            onClick={onGuest}
            className="mt-2 text-slate-500 text-sm font-medium hover:text-slate-800"
          >
            Entrar como Invitado
          </button>
        </div>
      </div>
    </div>
  );
};
