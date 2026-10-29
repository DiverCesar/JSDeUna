import { Router } from 'express';
import {
  createTransaccion,
  deleteTransaccion,
  getTransaccion,
  listAllTransacciones,
  updateTransaccion
} from '../services/transaccionService.js';

const router = Router();

router.get('/api/deuna/transacciones', async (_req, res) => {
  try {
    res.status(200).json(await listAllTransacciones());
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/api/deuna/transacciones/:id', async (req, res) => {
  try {
    const transaccion = await getTransaccion(req.params.id);
    if (!transaccion) {
      return res.status(404).json({ ok: false, error: 'Transacción no encontrada' });
    }
    res.status(200).json(transaccion);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/api/deuna/transacciones', async (req, res) => {
  try {
    const result = await createTransaccion(req.body);
    res.status(result.status).json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.put('/api/deuna/transacciones/:id', async (req, res) => {
  try {
    const result = await updateTransaccion(req.params.id, req.body);
    res.status(result.status).json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.delete('/api/deuna/transacciones/:id', async (req, res) => {
  try {
    const result = await deleteTransaccion(req.params.id);
    res.status(result.status).json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
