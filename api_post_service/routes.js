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

// ==========================================
// CRUD CUENTAS
// ==========================================

// 1. CREATE (POST: Crear una nueva cuenta)
router.post('/api/deuna/cuentas', async (req, res) => {
  try {
    const { cliente_id, numero_cuenta, alias, saldo, estado_cuenta } = req.body;

    if (!numero_cuenta || alias === undefined) {
      return res.status(400).json({
        ok: false,
        error: 'Faltan campos requeridos: numero_cuenta, alias'
      });
    }

    const { cuentas } = await getCollections();

    // Auto-generar el ID incremental numérico
    let newId = req.body.id;
    if (!newId) {
      const last = await cuentas.find({}).sort({ id: -1 }).limit(1).toArray();
      newId = last.length > 0 && typeof last[0].id === 'number' ? last[0].id + 1 : 1;
    }

    const nuevaCuenta = {
      id: Number(newId),
      cliente_id: Number(cliente_id || 1),
      numero_cuenta: String(numero_cuenta),
      alias: String(alias),
      saldo: Number(saldo || 0),
      estado_cuenta: String(estado_cuenta || 'ACTIVA')
    };

    const result = await cuentas.insertOne(nuevaCuenta);

    res.status(201).json({
      ok: true,
      message: 'Cuenta creada exitosamente',
      cuenta: serialize({ ...nuevaCuenta, _id: result.insertedId })
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 2. UPDATE (PUT: Actualizar cuenta existente por ID)
router.put('/api/deuna/cuentas/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const { alias, saldo, estado_cuenta } = req.body;
    const { cuentas } = await getCollections();

    const updateFields = {};
    if (alias !== undefined) updateFields.alias = String(alias);
    if (saldo !== undefined) updateFields.saldo = Number(saldo);
    if (estado_cuenta !== undefined) updateFields.estado_cuenta = String(estado_cuenta);

    const update = { $set: updateFields };
    const options = { returnDocument: 'after' };
    let result = await cuentas.findOneAndUpdate(
      { numero_cuenta: param },
      update,
      options
    );
    if (!result && !Number.isNaN(Number(param))) {
      result = await cuentas.findOneAndUpdate(
        { id: Number(param) },
        update,
        options
      );
    }

    if (!result) {
      return res.status(404).json({ ok: false, error: 'Cuenta no encontrada' });
    }

    res.json({
      ok: true,
      message: 'Cuenta actualizada exitosamente',
      cuenta: serialize(result)
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 3. DELETE (DELETE: Eliminar una cuenta por ID)
router.delete('/api/deuna/cuentas/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const { cuentas } = await getCollections();

    let result = await cuentas.deleteOne({ numero_cuenta: param });
    if (result.deletedCount === 0 && !Number.isNaN(Number(param))) {
      result = await cuentas.deleteOne({ id: Number(param) });
    }

    if (result.deletedCount === 0) {
      return res.status(404).json({ ok: false, error: 'Cuenta no encontrada' });
    }

    res.json({
      ok: true,
      message: 'Cuenta eliminada exitosamente'
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
