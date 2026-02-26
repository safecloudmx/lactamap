import { Amenity, Badge, GenderAccess, Lactario } from './types';

// Icons mapping for Lucide
// We will handle the actual Icon component in the rendering layer
export const AMENITY_LABELS: Record<Amenity, string> = {
  [Amenity.CHANGING_TABLE]: 'Cambiador',
  [Amenity.LACTATION_CHAIR]: 'Sillón',
  [Amenity.SINK]: 'Lavabo',
  [Amenity.MICROWAVE]: 'Microondas',
  [Amenity.ELECTRIC_OUTLET]: 'Enchufe',
  [Amenity.PRIVATE_ROOM]: 'Privado',
  [Amenity.REFRIGERATOR]: 'Refri',
  [Amenity.FREEZER]: 'Congelador',
  [Amenity.AC]: 'Clima'
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
    threshold: 1000,
    type: 'submission' 
  }
];

export const POINTS = {
  ADD_ROOM: 50,
  ADD_REVIEW: 15,
  ADD_PHOTO: 10
};

// Updated Mock Data using new types
export const MOCK_LACTARIOS: Lactario[] = [
    {
      id: '1',
      name: '[PRUEBA] - Titulo del Lactario 1',
      latitude: 25.6866,
      longitude: -100.3161,
      address: 'Av. Constitución 123, Centro',
      description: 'Lactario principal con todas las comodidades.',
      amenities: [Amenity.REFRIGERATOR, Amenity.LACTATION_CHAIR, Amenity.ELECTRIC_OUTLET, Amenity.SINK],
      rating: 5.0,
      reviews: [
        { id: 'r1', userId: 'u1', userName: 'Ana G.', rating: 5, comment: 'Muy limpio y privado.', date: '2023-10-15' }
      ],
      status: 'ACTIVE',
      access: GenderAccess.WOMEN,
      isVerified: true
    },
    {
      id: '2',
      name: '[PRUEBA] - Titulo del Lactario 2',
      latitude: 25.6579,
      longitude: -100.3658,
      address: 'Plaza San Pedro, Nivel 2',
      description: 'Espacio pequeño pero funcional.',
      amenities: [Amenity.LACTATION_CHAIR, Amenity.CHANGING_TABLE],
      rating: 4.2,
      reviews: [],
      status: 'ACTIVE',
      access: GenderAccess.NEUTRAL,
      isVerified: false
    },
    {
      id: '3',
      name: '[PRUEBA] - Titulo del Lactario 3',
      latitude: 25.7235,
      longitude: -100.3090,
      address: 'Universidad Autónoma de Nuevo León',
      description: 'Ubicado en la biblioteca central.',
      amenities: [Amenity.PRIVATE_ROOM, Amenity.MICROWAVE],
      rating: 4.8,
      reviews: [],
      status: 'ACTIVE',
      access: GenderAccess.WOMEN,
      isVerified: true
    },
    {
      id: '4',
      name: '[PRUEBA] - Titulo del Lactario 4',
      latitude: 25.6400,
      longitude: -100.2900,
      address: 'Tecnológico de Monterrey',
      description: 'Zona sur del campus.',
      amenities: [Amenity.AC, Amenity.LACTATION_CHAIR],
      rating: 4.9,
      reviews: [],
      status: 'ACTIVE',
      access: GenderAccess.WOMEN,
      isVerified: true
    },
    {
      id: '5',
      name: '[PRUEBA] - Titulo del Lactario 5',
      latitude: 25.6900,
      longitude: -100.3500,
      address: 'Hospital Universitario',
      description: 'Área de pediatría.',
      amenities: [Amenity.REFRIGERATOR, Amenity.LACTATION_CHAIR],
      rating: 4.5,
      reviews: [],
      status: 'ACTIVE',
      access: GenderAccess.WOMEN,
      isVerified: true
    },
  ];
