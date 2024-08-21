import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const Sidebar = ({ navigation }) => {
  return (
    <View style={styles.sidebar}>
      <TouchableOpacity onPress={() => navigation.navigate('Dashboard')}>
        <Text style={styles.menuItem}>Dashboard</Text>
      </TouchableOpacity>
      {/* הוסף פריטים נוספים לתפריט */}
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    backgroundColor: '#333',
    padding: 20,
  },
  menuItem: {
    fontSize: 18,
    color: '#fff',
    paddingVertical: 10,
  },
});

export default Sidebar;
