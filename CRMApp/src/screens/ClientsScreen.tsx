import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ClientsScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Clients</Text>
      {/* תוכן של דף הלקוחות */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});

export default ClientsScreen;
