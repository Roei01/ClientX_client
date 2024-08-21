import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  sidebar: {
    width: 250,
    backgroundColor: '#333',
    padding: 20,
  },
  menuItem: {
    fontSize: 18,
    color: '#fff',
    paddingVertical: 10,
  },
  header: {
    backgroundColor: '#0078d4',
    padding: 20,
  },
  headerText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
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
