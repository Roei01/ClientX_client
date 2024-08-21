import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Header from './Header';

const Dashboard = () => {
  return (
    <View style={styles.container}>
      <Header />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current Dashboard</Text>
          <View style={styles.table}>
            {/* כאן תהיה הטבלה שלך */}
            <Text>No data available</Text>
          </View>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>My Open Activities</Text>
          <View style={styles.table}>
            {/* כאן תהיה טבלה נוספת */}
            <Text>No data available</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  table: {
    borderTopWidth: 1,
    borderColor: '#ccc',
    paddingTop: 10,
  },
});

export default Dashboard;
