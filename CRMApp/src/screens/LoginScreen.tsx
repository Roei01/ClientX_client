import axios from 'axios';
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ImageBackground, Image } from 'react-native';

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    if (!username || !password) {
      setErrorMessage('נא למלא את כל השדות');
      return;
    }

    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        username,
        password,
      });

      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        navigation.navigate('Home');
      } else {
        setErrorMessage(response.data.message || 'התחברות נכשלה');
      }
    } catch (error) {
      setErrorMessage('אירעה שגיאה, נסה שוב.');
    }
  };

  return (
    <ImageBackground
      source={require('../image/1.jpg')}
      style={styles.background}
      imageStyle={{ opacity: 0.1 }}
    >
      <View style={styles.logoContainer}>
        <Image source={require('../image/1.jpg')} style={styles.logo} />
        <Text style={styles.headerText}>התחברויות אחרונות</Text>
      </View>
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          placeholder="מייל"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="סיסמא"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {errorMessage ? <Text style={styles.errorMessage}>{errorMessage}</Text> : null}
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>התחברות</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.linkText}>שכחת את הסיסמא?</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.newAccountButton} onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.newAccountButtonText}>צור חשבון חדש</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.footerText}>צור/י דף לילדך, מותג או עסק.</Text>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  container: {
    width: '90%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 15,
    paddingLeft: 10,
    borderRadius: 8,
    backgroundColor: '#f2f2f2',
  },
  errorMessage: {
    color: 'red',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#0066cc',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  link: {
    marginBottom: 15,
  },
  linkText: {
    color: '#0066cc',
    fontSize: 16,
  },
  newAccountButton: {
    backgroundColor: '#28a745',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
  },
  newAccountButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footerText: {
    marginTop: 20,
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default LoginScreen;
