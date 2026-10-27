import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../db_service/database.js';

const router = Router();

// DELETE: Eliminar una tarjeta por id numérico, _id de Mongo o número de tarjeta
router.delete('/api/deuna/tarjetas/:id', async (req, res) => {
  try {
    const { tarjetas } = await getCollections();
    const param = req.params.id;

    let query;
    if (!isNaN(Number(param))) {
      query = { id: Number(param) };
    } else if (ObjectId.isValid(param)) {
      query = { _id: new ObjectId(param) };
    } else {
      query = { numero_tarjeta: param };
    }

    const result = await tarjetas.deleteOne(query);

    if (result.deletedCount === 0) {
      return res.status(404).json({ ok: false, error: 'Tarjeta no encontrada para eliminar' });
    }

    res.status(200).json({ ok: true, message: 'Tarjeta eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
