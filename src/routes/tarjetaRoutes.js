import { Router } from 'express';
import {
  createTarjeta,
  deleteTarjeta,
  getTarjeta,
  getTarjetasPaginated,
  listAllTarjetas,
  updateTarjeta
} from '../services/tarjetaService.js';

const router = Router();

/**
 * GET /api/deuna/tarjetas
 * Listar tarjetas registradas con soporte de paginación (page y limit).
 */
router.get('/api/deuna/tarjetas', async (req, res) => {
  try {
    if (req.query.all === 'true') {
      const data = await listAllTarjetas();
      return res.status(200).json(data);
    }

    let page = 1;
    if (req.query.page !== undefined) {
      const parsed = Number(req.query.page);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return res.status(400).json({ ok: false, error: 'El parámetro page debe ser un número entero mayor o igual a 1.' });
      }
      page = parsed;
    }

    let limit = 6;
    if (req.query.limit !== undefined) {
      const parsed = Number(req.query.limit);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        return res.status(400).json({ ok: false, error: 'El parámetro limit debe ser un número entero entre 1 y 100.' });
      }
      limit = parsed;
    }

    const data = await getTarjetasPaginated({ page, limit });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/deuna/tarjetas/:id
 * Consultar una tarjeta específica por id numérico, _id ObjectId o número de tarjeta.
 */
router.get('/api/deuna/tarjetas/:id', async (req, res) => {
  try {
    const tarjeta = await getTarjeta(req.params.id);
    if (!tarjeta) {
      return res.status(404).json({ ok: false, error: 'Tarjeta no encontrada' });
    }
    res.status(200).json(tarjeta);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/deuna/tarjetas
 * Registrar una nueva tarjeta.
 */
router.post('/api/deuna/tarjetas', async (req, res) => {
  try {
    const result = await createTarjeta(req.body);
    res.status(result.status).json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * PUT /api/deuna/tarjetas/:id
 * Actualizar los datos de una tarjeta existente.
 */
router.put('/api/deuna/tarjetas/:id', async (req, res) => {
  try {
    const result = await updateTarjeta(req.params.id, req.body);
    res.status(result.status).json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * DELETE /api/deuna/tarjetas/:id
 * Eliminar una tarjeta.
 */
router.delete('/api/deuna/tarjetas/:id', async (req, res) => {
  try {
    const result = await deleteTarjeta(req.params.id);
    res.status(result.status).json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
