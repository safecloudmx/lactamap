import React, { useRef, useCallback } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

const SCREEN_TITLES: Record<string, string> = {
  Login: 'Iniciar Sesión',
  Inicio: 'Inicio',
  Mapa: 'Mapa',
  Explorar: 'Explorar',
  Recursos: 'Recursos',
  Perfil: 'Mi Perfil',
  MyContributions: 'Mis Aportes',
  Leaderboard: 'Tabla de Líderes',
  Settings: 'Ajustes',
  About: 'Acerca de',
  RoomDetail: 'Detalle del Lugar',
  AddRoomModal: 'Agregar Lugar',
  EditRoom: 'Editar Lugar',
  AddFloor: 'Agregar Espacio',
  EditProfile: 'Editar Perfil',
  NursingTimer: 'Cronómetro de Lactancia',
  FeedingHistory: 'Historial de Alimentación',
  FeedingSessionDetail: 'Detalle de Sesión',
  PumpingLog: 'Registro de Extracción',
  PumpingHistory: 'Historial de Extracción',
  PumpingFolioDetail: 'Detalle del Folio',
  SleepTimer: 'Cronómetro de Sueño',
  SleepHistory: 'Historial de Sueño',
  SleepSessionDetail: 'Detalle de Sueño',
  DiaperLog: 'Registro de Pañales',
  DiaperHistory: 'Historial de Pañales',
  DiaperRecordDetail: 'Detalle del Pañal',
  RelaxingSounds: 'Sonidos Relajantes',
  BabyDetail: 'Detalle del Bebé',
  BabyEdit: 'Editar Bebé',
  GrowthAdd: 'Registrar Crecimiento',
  AdminReview: 'Revisión Admin',
  PublicFolioDetail: 'Folio Público',
  PartnerSync: 'Vincular Cuenta',
};

function getScreenTitle(routeName: string | undefined): string {
  if (!routeName) return 'LactaMap';
  const label = SCREEN_TITLES[routeName];
  return label ? `${label} | LactaMap` : 'LactaMap';
}

function getActiveRouteName(state: any): string | undefined {
  if (!state) return undefined;
  const route = state.routes[state.index];
  if (route?.state) return getActiveRouteName(route.state);
  return route?.name;
}

const linking: LinkingOptions<any> = {
  prefixes: [],
  config: {
    screens: {
      PublicFolioDetail: 'folio-publico',
      PartnerSync: 'vincular',
      Login: 'login',
      Main: {
        path: '',
        screens: {
          HomeTabs: {
            path: '',
            screens: {
              Inicio: 'inicio',
              Mapa: 'mapa',
              Explorar: 'explorar',
              Recursos: 'recursos',
              Perfil: 'perfil',
            },
          },
          MyContributions: 'mis-contribuciones',
          Leaderboard: 'leaderboard',
          Settings: 'ajustes',
          About: 'acerca',
        },
      },
      RoomDetail: 'room/:roomId?',
      AddRoomModal: 'agregar-lugar',
      AddFloor: 'agregar-espacio',
      EditRoom: 'editar-lugar',
      EditProfile: 'editar-perfil',
      NursingTimer: 'lactancia',
      FeedingHistory: 'historial-alimentacion',
      FeedingSessionDetail: 'sesion-alimentacion',
      AdminReview: 'admin-review',
      PumpingLog: 'extraccion',
      PumpingHistory: 'historial-extraccion',
      PumpingFolioDetail: 'folio-detalle',
      SleepTimer: 'sueno',
      SleepHistory: 'historial-sueno',
      SleepSessionDetail: 'sesion-sueno',
      DiaperLog: 'panales',
      DiaperHistory: 'historial-panales',
      DiaperRecordDetail: 'registro-panal',
      RelaxingSounds: 'sonidos',
      BabyDetail: 'bebe/:babyId',
      BabyEdit: 'bebe/:babyId/editar',
      GrowthAdd: 'bebe/:babyId/crecimiento',
    },
  },
};

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import HomeScreen from '../screens/HomeScreen';
import ExploreScreen from '../screens/ExploreScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RoomDetailScreen from '../screens/RoomDetailScreen';
import AddRoomScreen from '../screens/AddRoomScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import MyContributionsScreen from '../screens/MyContributionsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AboutScreen from '../screens/AboutScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import NursingTimerScreen from '../screens/NursingTimerScreen';
import ResourcesScreen from '../screens/ResourcesScreen';
import FeedingHistoryScreen from '../screens/FeedingHistoryScreen';
import FeedingSessionDetailScreen from '../screens/FeedingSessionDetailScreen';
import AdminReviewScreen from '../screens/AdminReviewScreen';
import EditRoomScreen from '../screens/EditRoomScreen';
import PumpingLogScreen from '../screens/PumpingLogScreen';
import PumpingHistoryScreen from '../screens/PumpingHistoryScreen';
import SleepTimerScreen from '../screens/SleepTimerScreen';
import SleepHistoryScreen from '../screens/SleepHistoryScreen';
import SleepSessionDetailScreen from '../screens/SleepSessionDetailScreen';
import DiaperLogScreen from '../screens/DiaperLogScreen';
import DiaperHistoryScreen from '../screens/DiaperHistoryScreen';
import DiaperRecordDetailScreen from '../screens/DiaperRecordDetailScreen';
import RelaxingSoundsScreen from '../screens/RelaxingSoundsScreen';
import AddFloorScreen from '../screens/AddFloorScreen';
import BabyDetailScreen from '../screens/BabyDetailScreen';
import BabyEditScreen from '../screens/BabyEditScreen';
import GrowthAddScreen from '../screens/GrowthAddScreen';
import PumpingFolioDetailScreen from '../screens/PumpingFolioDetailScreen';
import PartnerSyncScreen from '../screens/PartnerSyncScreen';

import CustomTabBar from '../components/CustomTabBar';
import DrawerContent from './DrawerContent';
import MapLayout from './MapLayout';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

function MapScreenWithFAB() {
  return (
    <MapLayout>
      <HomeScreen />
    </MapLayout>
  );
}

function HomeTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Inicio" component={DashboardScreen} />
      <Tab.Screen name="Mapa" component={MapScreenWithFAB} />
      <Tab.Screen name="Explorar" component={ExploreScreen} />
      <Tab.Screen name="Recursos" component={ResourcesScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: { width: 300 },
      }}
    >
      <Drawer.Screen name="HomeTabs" component={HomeTabs} />
      <Drawer.Screen name="MyContributions" component={MyContributionsScreen} />
      <Drawer.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
      <Drawer.Screen name="About" component={AboutScreen} />
    </Drawer.Navigator>
  );
}

export const AppNavigator = () => {
  const { user, loading } = useAuth();
  const navigationRef = useRef<any>(null);

  const updateTitle = useCallback((state: any) => {
    if (Platform.OS !== 'web') return;
    document.title = getScreenTitle(getActiveRouteName(state));
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={Platform.OS === 'web' ? linking : undefined}
      documentTitle={{ enabled: false }}
      onReady={() => updateTitle(navigationRef.current?.getRootState())}
      onStateChange={updateTitle}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { flex: 1 } }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={DrawerNavigator} />
            <Stack.Screen
              name="AddRoomModal"
              component={AddRoomScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="RoomDetail"
              component={RoomDetailScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="NursingTimer"
              component={NursingTimerScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="FeedingHistory"
              component={FeedingHistoryScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="FeedingSessionDetail"
              component={FeedingSessionDetailScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="AdminReview"
              component={AdminReviewScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="PumpingLog"
              component={PumpingLogScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="PumpingHistory"
              component={PumpingHistoryScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="PumpingFolioDetail"
              component={PumpingFolioDetailScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="SleepTimer"
              component={SleepTimerScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="SleepHistory"
              component={SleepHistoryScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="SleepSessionDetail"
              component={SleepSessionDetailScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="DiaperLog"
              component={DiaperLogScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="DiaperHistory"
              component={DiaperHistoryScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="DiaperRecordDetail"
              component={DiaperRecordDetailScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="RelaxingSounds"
              component={RelaxingSoundsScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="AddFloor"
              component={AddFloorScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="BabyDetail"
              component={BabyDetailScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="BabyEdit"
              component={BabyEditScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="GrowthAdd"
              component={GrowthAddScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="EditRoom"
              component={EditRoomScreen}
              options={{ presentation: 'modal' }}
            />
          </>
        )}
        {/* Public route — accessible without auth */}
        <Stack.Screen
          name="PublicFolioDetail"
          component={PumpingFolioDetailScreen}
          options={{ presentation: 'card' }}
        />
        {/* Partner sync — accessible without auth so email link works before/after login */}
        <Stack.Screen
          name="PartnerSync"
          component={PartnerSyncScreen}
          options={{ presentation: 'card' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
