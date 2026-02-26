import React from 'react';
import { User } from '../types';
import { BADGES } from '../constants';
import { Trophy, Award, LogOut } from 'lucide-react';

interface UserProfileProps {
  user: User;
  onLogout: () => void;
  onClose: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, onLogout, onClose }) => {
  const nextLevelPoints = user.level * 100;
  const progress = (user.points % 100); // Assuming 100 pts per level

  return (
    <div className="bg-slate-50 h-full flex flex-col animate-in slide-in-from-right">
      {/* Header Card */}
      <div className="bg-white p-6 rounded-b-3xl shadow-sm border-b border-slate-100">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Mi Perfil</h2>
          <button onClick={onLogout} className="p-2 text-slate-400 hover:text-rose-500">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-rose-400 to-orange-400 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-800">{user.name}</h3>
            <p className="text-sm text-slate-500">Nivel {user.level}</p>
            
            {/* XP Bar */}
            <div className="mt-2 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-400 mt-1 text-right">{user.points} / {nextLevelPoints} pts</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
            <div className="text-2xl font-bold text-primary">{user.stats.roomsAdded}</div>
            <div className="text-xs text-slate-500">Lactarios</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
            <div className="text-2xl font-bold text-secondary">{user.stats.reviewsWritten}</div>
            <div className="text-xs text-slate-500">Reseñas</div>
          </div>
        </div>
      </div>

      {/* Badges Section */}
      <div className="flex-1 overflow-y-auto p-6">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Insignias
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {BADGES.map(badge => {
            const isUnlocked = user.badges.includes(badge.id);
            return (
              <div 
                key={badge.id}
                className={`p-4 rounded-xl border flex flex-col items-center text-center transition-all ${
                  isUnlocked 
                    ? 'bg-white border-yellow-200 shadow-sm' 
                    : 'bg-slate-100 border-transparent opacity-60 grayscale'
                }`}
              >
                <div className="text-3xl mb-2">{badge.icon}</div>
                <div className="font-bold text-sm text-slate-800">{badge.name}</div>
                <div className="text-[10px] text-slate-500 mt-1 leading-tight">{badge.description}</div>
                {isUnlocked && (
                   <div className="mt-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] rounded-full font-bold">
                     ¡Conseguido!
                   </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
