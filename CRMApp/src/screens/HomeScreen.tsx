import React from 'react';
import { View, Text, StyleSheet, Button, FlatList } from 'react-native';

const HomeScreen = ({ navigation }) => {
  const activities = [
    { id: '1', activity: 'Logged in at 10:00 AM' },
    { id: '2', activity: 'Added new client: John Doe' },
    { id: '3', activity: 'Completed task: Follow up with Jane' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to CRM App!</Text>

      {/* כפתור למעבר למסך הלקוחות */}
      <Button
        title="Go to Clients"
        onPress={() => navigation.navigate('Clients')}
      />

      {/* סטטיסטיקות */}
      <View style={styles.statsContainer}>
        <Text style={styles.stats}>Total Clients: 150</Text>
        <Text style={styles.stats}>Open Tasks: 5</Text>
        <Text style={styles.stats}>Recent Activities:</Text>
      </View>

      {/* רשימת פעילויות אחרונות */}
      <FlatList
        data={activities}
        renderItem={({ item }) => <Text style={styles.activity}>{item.activity}</Text>}
        keyExtractor={item => item.id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  statsContainer: {
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  stats: {
    fontSize: 18,
    marginBottom: 5,
  },
  activity: {
    fontSize: 16,
    paddingVertical: 2,
  },
});

export default HomeScreen;
