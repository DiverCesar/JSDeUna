const dotenv = require('dotenv');

dotenv.config({ path: '.env.test' });
dotenv.config();

process.env.NODE_ENV = 'test';
process.env.IP_ADDRESS = process.env.IP_ADDRESS || '127.0.0.1';
process.env.DB_NAME = process.env.DB_NAME || 'deuna_test_db';
