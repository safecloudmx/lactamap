import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
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
              name="Resources"
              component={ResourcesScreen}
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
