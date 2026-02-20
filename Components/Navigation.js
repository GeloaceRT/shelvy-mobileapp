import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DashboardScreen from './DashboardScreen';
import DeviceManagerScreen from './DeviceManagerScreen';
import ReadingsScreen from './ReadingsScreen';
import LogsScreen from './LogsScreen';
import SettingsScreen from './SettingsScreen';

const Tab = createBottomTabNavigator();

export default function Navigation({ user, onLogout }) {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => {
          let iconName = 'home';
          if (route.name === 'Devices') iconName = 'router-wireless';
          else if (route.name === 'Monitoring') iconName = 'monitor';
          else if (route.name === 'History') iconName = 'timeline-text';
          else if (route.name === 'Settings') iconName = 'cog';

          return {
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name={iconName} size={size} color={color} />,
            tabBarActiveTintColor: '#E67E22',
            tabBarInactiveTintColor: '#A0522D',
            headerShown: true,
            headerStyle: {
              backgroundColor: '#E67E22',
            },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            headerRight: () => (
              <Pressable onPress={onLogout} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>Logout</Text>
              </Pressable>
            ),
            headerRightContainerStyle: {
              paddingRight: 16,
            },
          };
        }}
      >
        <Tab.Screen name="Dashboard">
          {() => <DashboardScreen user={user} />}
        </Tab.Screen>
        <Tab.Screen name="Devices" component={DeviceManagerScreen} />
        <Tab.Screen name="Monitoring" component={ReadingsScreen} />
        <Tab.Screen name="History" component={LogsScreen} />
        <Tab.Screen name="Settings">
          {() => <SettingsScreen user={user} onLogout={onLogout} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    backgroundColor: '#3D2914',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerButtonText: {
    color: '#FBD6A4',
    fontSize: 14,
    fontWeight: '600',
  },
});
