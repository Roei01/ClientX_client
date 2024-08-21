import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './screens/HomeScreen';
import ClientsScreen from './screens/ClientsScreen';
import LoginScreen from './screens/LoginScreen.tsx';
import SignupScreen from './screens/SignupScreen.tsx';

const Stack = createStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Clients" component={ClientsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
