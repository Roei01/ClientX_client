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
      {/* תפריט עליון */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CRM Dashboard</Text>
      </View>

      {/* כפתור למעבר למסך הלקוחות */}
      <View style={styles.navigation}>
        <Button
          title="Go to Clients"
          onPress={() => navigation.navigate('Clients')}
          color="#007bff"
        />
      </View>

      {/* קופסאות סטטיסטיקה */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>150</Text>
          <Text style={styles.statLabel}>Total Clients</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>5</Text>
          <Text style={styles.statLabel}>Open Tasks</Text>
        </View>
      </View>

      {/* פעילויות אחרונות */}
      <View style={styles.activitiesContainer}>
        <Text style={styles.sectionTitle}>Recent Activities</Text>
        <FlatList
          data={activities}
          renderItem={({ item }) => (
            <View style={styles.activityItem}>
              <Text style={styles.activityText}>{item.activity}</Text>
            </View>
          )}
          keyExtractor={item => item.id}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f4',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  header: {
    padding: 20,
    backgroundColor: '#007bff',
    marginBottom: 20,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 24,
    color: '#fff',
    textAlign: 'center',
  },
  navigation: {
    marginBottom: 20,
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 16,
    color: '#555',
  },
  activitiesContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  activityItem: {
    paddingVertical: 10,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
  },
  activityText: {
    fontSize: 16,
    color: '#555',
  },
});

export default HomeScreen;
