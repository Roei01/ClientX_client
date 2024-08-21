import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Button } from 'react-native';
import HomeScreen from './screens/HomeScreen';
import ClientsScreen from './screens/ClientsScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import styles from './styles'; // ייבוא הסגנונות

const Stack = createStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen 
          name="Clients" 
          component={ClientsScreen} 
          options={({ navigation }) => ({
            headerLeft: () => (
              <Button
                onPress={() => navigation.navigate('Home')}
                title="Menu"
                color="#000"
              />
            ),
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
