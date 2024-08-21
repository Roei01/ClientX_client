import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const Header = () => {
  return (
    <View style={styles.header}>
      <Text style={styles.headerText}>Customer Service Workspace</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#0078d4',
    padding: 20,
  },
  headerText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default Header;
