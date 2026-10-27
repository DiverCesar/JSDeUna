import { Router } from 'express';
import { getCollections, seedDatabase } from '../db_service/database.js';
import { serialize } from '../db_service/models.js';
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

// POST: Crear una nueva tarjeta en la colección
router.post('/api/deuna/tarjetas', async (req, res) => {
  try {
    const { cliente_id, numero_tarjeta, banco, fecha_expiracion } = req.body;

    if (!numero_tarjeta || !banco || !fecha_expiracion) {
      return res.status(400).json({
        ok: false,
        error: 'Faltan campos requeridos: numero_tarjeta, banco, fecha_expiracion'
      });
    }

    const { tarjetas } = await getCollections();

    // Auto-generar id numérico incremental si no se proporciona
    let newId = req.body.id;
    if (!newId) {
      const last = await tarjetas.find({}).sort({ id: -1 }).limit(1).toArray();
      newId = last.length > 0 && typeof last[0].id === 'number' ? last[0].id + 1 : 1;
    }

    const nuevaTarjeta = {
      id: Number(newId),
      cliente_id: Number(cliente_id || 1),
      numero_tarjeta: String(numero_tarjeta),
      banco: String(banco),
      fecha_expiracion: String(fecha_expiracion)
    };

    const result = await tarjetas.insertOne(nuevaTarjeta);

    res.status(201).json({
      ok: true,
      message: 'Tarjeta creada exitosamente',
      tarjeta: serialize({ ...nuevaTarjeta, _id: result.insertedId })
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
