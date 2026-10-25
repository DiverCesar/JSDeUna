import { Router } from 'express';
import { seedDatabase } from '../db_service/database.js';
import { createRecharge, createTransfer } from '../src/services/deunaService.js';

const router = Router();

router.post('/api/deuna/seed', async (_req, res) => {
  try {
    const result = await seedDatabase();
    res.status(200).json({ message: result.message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/deuna/transferencia', async (req, res) => {
  try {
    const result = await createTransfer(req.body, req.ip);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/deuna/recarga', async (req, res) => {
  try {
    const result = await createRecharge(req.body, req.ip);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
