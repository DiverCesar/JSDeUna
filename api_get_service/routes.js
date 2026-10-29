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

// GET: Obtener una cuenta específica por ID o número de cuenta
router.get('/api/deuna/cuentas/:id', async (req, res) => {
  try {
    const { cuentas } = await getCollections();
    const param = req.params.id;
    let query;

    if (!Number.isNaN(Number(param))) {
      query = { id: Number(param) };
    } else {
      query = { numero_cuenta: param };
    }

    const cuenta = await cuentas.findOne(query);
    if (!cuenta) {
      return res.status(404).json({ ok: false, error: 'Cuenta no encontrada' });
    }

    res.json(serialize(cuenta));
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
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

router.get('/api/deuna/tarjetas/:id', async (req, res) => {
  try {
    const { tarjetas } = await getCollections();
    const param = req.params.id;
    let query;
    if (!Number.isNaN(Number(param))) {
      query = { id: Number(param) };
    } else {
      query = { numero_tarjeta: param };
    }
    const card = await tarjetas.findOne(query);
    if (!card) {
      return res.status(404).json({ ok: false, error: 'Tarjeta no encontrada' });
    }
    res.json(serialize(card));
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
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
