const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

// טוען את משתני הסביבה מקובץ .env
dotenv.config();

const app = express();

// שימוש במודול CORS כדי לאפשר גישה מכל המקורות
app.use(cors()); // אפשר גם להגדיר גישה לדומיינים מסוימים בלבד

app.use(express.json());

// חיבור ל-MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('Could not connect to MongoDB', err));

// מסלולים
const authRoute = require('./routes/auth');
const clientsRoute = require('./routes/clients');

app.use('/api/auth', authRoute);
app.use('/api/clients', clientsRoute);

// הפעלת השרת
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
