const express = require('express');
const router = express.Router();

// דוגמה למסלול לקבלת רשימת לקוחות
router.get('/', (req, res) => {
  res.send('Get all clients');
});

// דוגמה למסלול להוספת לקוח חדש
router.post('/', (req, res) => {
  res.send('Add new client');
});

module.exports = router;
