import { Platform } from 'react-native';
import MapComponentNative from './MapComponent.native';
import MapComponentWeb from './MapComponent.web';
export type { ZoomTarget } from './MapComponent.web';

// Choose implementation based on platform
const MapComponent = Platform.OS === 'web' ? MapComponentWeb : MapComponentNative;

export default MapComponent;
