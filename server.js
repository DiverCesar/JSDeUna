import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import getRoutes from './api_get_service/routes.js';
import postRoutes from './api_post_service/routes.js';
import putRoutes from './api_put_service/routes.js';
import deleteRoutes from './api_delete_service/routes.js';
import clienteRoutes from './src/routes/clienteRoutes.js';
import { connectToDatabase, seedDatabase } from './db_service/database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(getRoutes);
app.use(postRoutes);
app.use(putRoutes);
app.use(deleteRoutes);
app.use(clienteRoutes);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startApp() {
  try {
    await connectToDatabase();
    await seedDatabase();
    app.listen(port, () => {
      console.log(`Deuna API running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start app:', error.message);
    process.exit(1);
  }
}

startApp();
