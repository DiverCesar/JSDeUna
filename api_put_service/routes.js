import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../db_service/database.js';
import { serialize } from '../db_service/models.js';

const router = Router();

// PUT: Actualizar una tarjeta por id numérico, _id de Mongo o número de tarjeta
router.put('/api/deuna/tarjetas/:id', async (req, res) => {
  try {
    const { tarjetas } = await getCollections();
    const param = req.params.id;

    let query;
    if (!Number.isNaN(Number(param))) {
      query = { id: Number(param) };
    } else if (ObjectId.isValid(param)) {
      query = { _id: new ObjectId(String(param)) };
    } else {
      query = { numero_tarjeta: param };
    }

    const { banco, fecha_expiracion, cliente_id, numero_tarjeta } = req.body;
    const updateData = {};

    if (banco !== undefined) updateData.banco = banco;
    if (fecha_expiracion !== undefined) updateData.fecha_expiracion = fecha_expiracion;
    if (cliente_id !== undefined) updateData.cliente_id = Number(cliente_id);
    if (numero_tarjeta !== undefined) updateData.numero_tarjeta = String(numero_tarjeta);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ ok: false, error: 'No se enviaron campos para actualizar' });
    }

    const result = await tarjetas.findOneAndUpdate(
      query,
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ ok: false, error: 'Tarjeta no encontrada para actualizar' });
    }

    res.status(200).json({
      ok: true,
      message: 'Tarjeta actualizada exitosamente',
      tarjeta: serialize(result)
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
