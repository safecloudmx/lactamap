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
              name="EditRoom"
              component={EditRoomScreen}
              options={{ presentation: 'modal' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
