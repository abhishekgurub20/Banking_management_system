const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/loans', require('./routes/loans'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/banker', require('./routes/banker'));

const path = require('path');
app.use(express.static(path.join(__dirname, '../')));

// Default route for any unknown requests (could redirect to index or send 404)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Kingsley Bank Backend running on port ${PORT}`);
});
