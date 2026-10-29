import request from 'supertest';
import app from '../server.js'; // O la instancia de tu app Express
import { closeDatabase, getCollections } from '../db_service/database.js';

describe('CRUD Cuentas - Pruebas completas sobre la entidad Cuentas', () => {
  // Limpieza y cierre de la conexión después de todas las pruebas
  afterAll(async () => {
    await closeDatabase();
  });

  const cuentaPrueba = {
    id: 9999,
    cliente_id: 1, // Asumiendo un cliente existente
    numero_cuenta: 'TEST-CTA-9999',
    alias: 'cuenta_test_jest',
    saldo: 500.00,
    estado_cuenta: 'ACTIVA'
  };

  // Limpieza preventiva antes de empezar
  beforeAll(async () => {
    const { cuentas } = await getCollections();
    await cuentas.deleteOne({ numero_cuenta: cuentaPrueba.numero_cuenta });
    await cuentas.deleteOne({ id: cuentaPrueba.id });
  });

  // ----------------------------------------------------
  // 1. CREATE - Registrar una nueva cuenta (POST)
  // ----------------------------------------------------
  describe('POST /api/deuna/cuentas', () => {
    test('1. CREATE - Debe registrar una nueva cuenta con datos válidos', async () => {
      const response = await request(app)
        .post('/api/deuna/cuentas')
        .send(cuentaPrueba);

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('ok', true);
      expect(response.body.cuenta).toHaveProperty('_id');
      expect(response.body.cuenta.numero_cuenta).toBe(cuentaPrueba.numero_cuenta);
      expect(response.body.cuenta.alias).toBe(cuentaPrueba.alias);
      expect(Number(response.body.cuenta.saldo)).toBe(cuentaPrueba.saldo);

      // Confirmar inserción directa en la Base de Datos
      const { cuentas } = await getCollections();
      const enDb = await cuentas.findOne({ numero_cuenta: cuentaPrueba.numero_cuenta });
      expect(enDb).not.toBeNull();
      expect(enDb.alias).toBe(cuentaPrueba.alias);
    });

    test('2. CREATE NEGATIVO - Debe rechazar cuando faltan campos requeridos', async () => {
      const invalida = {
        cliente_id: 1,
        // numero_cuenta omitido intencionalmente
        alias: 'invalida_test'
      };

      const response = await request(app)
        .post('/api/deuna/cuentas')
        .send(invalida);

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('ok', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  // ----------------------------------------------------
  // 2. READ - Consultar cuentas (GET)
  // ----------------------------------------------------
  describe('GET /api/deuna/cuentas', () => {
    test('3. READ - Debe obtener el listado general de cuentas', async () => {
      const response = await request(app).get('/api/deuna/cuentas');

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('4. READ BY ID/NUMERO - Debe obtener una cuenta por su número de cuenta', async () => {
      const response = await request(app).get(`/api/deuna/cuentas/${cuentaPrueba.numero_cuenta}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.numero_cuenta).toBe(cuentaPrueba.numero_cuenta);
      expect(response.body.alias).toBe(cuentaPrueba.alias);
    });

    test('5. READ NEGATIVO - Debe retornar 404 para una cuenta inexistente', async () => {
      const response = await request(app).get('/api/deuna/cuentas/00000000000000');

      expect(response.statusCode).toBe(404);
      expect(response.body).toHaveProperty('ok', false);
      expect(response.body.error).toBe('Cuenta no encontrada');
    });
  });

  // ----------------------------------------------------
  // 3. UPDATE - Modificar cuenta (PUT)
  // ----------------------------------------------------
  describe('PUT /api/deuna/cuentas/:id', () => {
    test('6. UPDATE - Debe actualizar el alias y estado de la cuenta exitosamente', async () => {
      const datosActualizados = {
        alias: 'alias_modificado_jest',
        saldo: 750.50,
        estado_cuenta: 'ACTIVA'
      };

      const response = await request(app)
        .put(`/api/deuna/cuentas/${cuentaPrueba.numero_cuenta}`)
        .send(datosActualizados);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('ok', true);
      expect(response.body.cuenta.alias).toBe('alias_modificado_jest');
      expect(Number(response.body.cuenta.saldo)).toBe(750.50);
    });

    test('7. UPDATE NEGATIVO - Debe devolver 404 al intentar actualizar una cuenta inexistente', async () => {
      const response = await request(app)
        .put('/api/deuna/cuentas/9999999999999')
        .send({ alias: 'nuevo_alias' });

      expect(response.statusCode).toBe(404);
      expect(response.body).toHaveProperty('ok', false);
    });
  });

  // ----------------------------------------------------
  // 4. DELETE - Eliminar cuenta (DELETE)
  // ----------------------------------------------------
  describe('DELETE /api/deuna/cuentas/:id', () => {
    test('8. DELETE - Debe eliminar la cuenta creada exitosamente', async () => {
      const response = await request(app)
        .delete(`/api/deuna/cuentas/${cuentaPrueba.numero_cuenta}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('ok', true);
      expect(response.body.message).toBe('Cuenta eliminada exitosamente');

      // Verificación final en BD
      const { cuentas } = await getCollections();
      const verificacion = await cuentas.findOne({ numero_cuenta: cuentaPrueba.numero_cuenta });
      expect(verificacion).toBeNull();
    });

    test('9. DELETE NEGATIVO - Debe responder 404 al intentar eliminar una cuenta que no existe', async () => {
      const response = await request(app)
        .delete('/api/deuna/cuentas/00000000000000');

      expect(response.statusCode).toBe(404);
      expect(response.body).toHaveProperty('ok', false);
    });
  });
});