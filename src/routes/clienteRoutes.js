import { Router } from 'express';
import {
  createCliente,
  deleteCliente,
  getCliente,
  getClientesPaginated,
  listAllClientes,
  updateCliente
} from '../services/clienteService.js';

const router = Router();

/**
 * GET /api/deuna/clientes
 * Listar clientes registrados con soporte de paginación (page y limit).
 */
router.get('/api/deuna/clientes', async (req, res) => {
  try {
    if (req.query.all === 'true') {
      const data = await listAllClientes();
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

    const data = await getClientesPaginated({ page, limit });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/deuna/clientes/:id
 * Consultar un cliente específico por id numérico, _id ObjectId, email o teléfono.
 */
router.get('/api/deuna/clientes/:id', async (req, res) => {
  try {
    const cliente = await getCliente(req.params.id);
    if (!cliente) {
      return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });
    }
    res.status(200).json(cliente);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/deuna/clientes
 * Registrar un nuevo cliente.
 */
router.post('/api/deuna/clientes', async (req, res) => {
  try {
    const result = await createCliente(req.body);
    res.status(result.status).json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * PUT /api/deuna/clientes/:id
 * Actualizar los datos de un cliente existente.
 */
router.put('/api/deuna/clientes/:id', async (req, res) => {
  try {
    const result = await updateCliente(req.params.id, req.body);
    res.status(result.status).json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * DELETE /api/deuna/clientes/:id
 * Eliminar un cliente asegurando integridad referencial.
 */
router.delete('/api/deuna/clientes/:id', async (req, res) => {
  try {
    const result = await deleteCliente(req.params.id);
    res.status(result.status).json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
