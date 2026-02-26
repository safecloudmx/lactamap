import { Amenity, GenderAccess, LactationRoom, Badge } from './types';

export const MOCK_ROOMS: LactationRoom[] = [
  {
    id: '1',
    name: 'Centro Comercial Plaza',
    address: 'Av. Principal 123, 2do Piso',
    lat: 19.4326,
    lng: -99.1332,
    description: 'Sala de lactancia amplia y limpia junto a los baños de mujeres.',
    rating: 4.5,
    reviews: [
      { id: 'r1', userId: 'u1', userName: 'Ana G.', rating: 5, comment: 'Muy limpio y privado.', date: '2023-10-15' }
    ],
    amenities: [Amenity.CHANGING_TABLE, Amenity.LACTATION_CHAIR, Amenity.SINK, Amenity.ELECTRIC_OUTLET, Amenity.AC],
    access: GenderAccess.WOMEN,
    imageUrl: 'https://picsum.photos/400/300?random=1',
    isVerified: true
  },
  {
    id: '2',
    name: 'Parque Central - Baños Familiares',
    address: 'Entrada Norte',
    lat: 19.4340,
    lng: -99.1350,
    description: 'Baño familiar con cambiador, un poco ruidoso.',
    rating: 3.2,
    reviews: [],
    amenities: [Amenity.CHANGING_TABLE, Amenity.SINK],
    access: GenderAccess.NEUTRAL,
    imageUrl: 'https://picsum.photos/400/300?random=2',
    isVerified: false
  },
  {
    id: '3',
    name: 'Biblioteca Municipal',
    address: 'Calle de los Libros 45',
    lat: 19.4300,
    lng: -99.1300,
    description: 'Pequeño rincón habilitado, básico pero funcional.',
    rating: 4.0,
    reviews: [],
    amenities: [Amenity.LACTATION_CHAIR, Amenity.PRIVATE_ROOM, Amenity.REFRIGERATOR],
    access: GenderAccess.WOMEN,
    imageUrl: 'https://picsum.photos/400/300?random=3',
    isVerified: true
  }
];

export const AMENITY_ICONS: Record<Amenity, string> = {
  [Amenity.CHANGING_TABLE]: '👶',
  [Amenity.LACTATION_CHAIR]: '💺',
  [Amenity.SINK]: '🚰',
  [Amenity.MICROWAVE]: '🔌',
  [Amenity.ELECTRIC_OUTLET]: '⚡',
  [Amenity.PRIVATE_ROOM]: '🚪',
  [Amenity.REFRIGERATOR]: '❄️',
  [Amenity.FREEZER]: '🧊',
  [Amenity.AC]: '🌬️'
};

export const BADGES: Badge[] = [
  {
    id: 'badge_first_room',
    name: 'Primer Aporte',
    description: 'Documentaste tu primer lactario.',
    icon: '🌱',
    threshold: 1,
    type: 'submission'
  },
  {
    id: 'badge_explorer',
    name: 'Explorador de la Zona',
    description: 'Documentaste 5 lactarios.',
    icon: '🗺️',
    threshold: 5,
    type: 'submission'
  },
  {
    id: 'badge_expert_critic',
    name: 'Crítico Experto',
    description: 'Escribiste 10 reseñas detalladas.',
    icon: '✍️',
    threshold: 10,
    type: 'review'
  },
  {
    id: 'badge_community_hero',
    name: 'Héroe de la Comunidad',
    description: 'Alcanzaste 1000 puntos.',
    icon: '🏆',
    threshold: 1000, // Special case logic
    type: 'submission' 
  }
];

// Points Configuration
export const POINTS = {
  ADD_ROOM: 50,
  ADD_REVIEW: 15,
  ADD_PHOTO: 10
};
