import { Router } from 'express';
import { getCollections } from '../db_service/database.js';
import { serialize } from '../db_service/models.js';

const router = Router();

router.get('/api/deuna/cuentas', async (_req, res) => {
  try {
    const { cuentas } = await getCollections();
    const data = await cuentas.find({}).toArray();
    res.json(data.map(serialize));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/deuna/tarjetas', async (_req, res) => {
  try {
    const { tarjetas } = await getCollections();
    const data = await tarjetas.find({}).toArray();
    res.json(data.map(serialize));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/deuna/transacciones', async (_req, res) => {
  try {
    const { transacciones } = await getCollections();
    const data = await transacciones.find({}).sort({ cuando: -1 }).toArray();
    res.json(data.map(serialize));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
