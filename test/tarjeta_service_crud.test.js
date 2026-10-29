import assert from 'node:assert/strict';
import test from 'node:test';
import { closeDatabase, getCollections } from '../db_service/database.js';
import {
  createTarjeta,
  deleteTarjeta,
  getTarjeta,
  getTarjetasPaginated,
  listAllTarjetas,
  updateTarjeta,
  validateTarjetaData
} from '../src/services/tarjetaService.js';

test('CRUD Tarjetas - Pruebas completas sobre la entidad tarjetas y tarjetaService', async (t) => {
  t.after(async () => {
    await closeDatabase();
  });

  const { tarjetas } = await getCollections();

  const tarjetaPrueba = {
    id: 7777,
    cliente_id: 1,
    numero_tarjeta: '7777888899990000',
    banco: 'Banco Pichincha',
    fecha_expiracion: '11/30'
  };

  // Limpieza preventiva
  await tarjetas.deleteOne({ numero_tarjeta: tarjetaPrueba.numero_tarjeta });
  await tarjetas.deleteOne({ id: tarjetaPrueba.id });

  await t.test('1. CREATE - Debe registrar una nueva tarjeta con datos válidos', async () => {
    const response = await createTarjeta(tarjetaPrueba);
    assert.equal(response.ok, true, 'La creación debe responder ok: true');
    assert.equal(response.status, 201, 'El código HTTP debe ser 201');
    assert.ok(response.tarjeta._id, 'Debe generarse un _id de MongoDB');
    assert.equal(response.tarjeta.banco, tarjetaPrueba.banco);
    assert.equal(response.tarjeta.numero_tarjeta, tarjetaPrueba.numero_tarjeta);
    assert.equal(response.tarjeta.fecha_expiracion, tarjetaPrueba.fecha_expiracion);

    // Confirmación directa en BD
    const enDb = await tarjetas.findOne({ id: tarjetaPrueba.id });
    assert.ok(enDb, 'La tarjeta debe existir en la base de datos');
    assert.equal(enDb.numero_tarjeta, tarjetaPrueba.numero_tarjeta);
  });

  await t.test('2. CREATE NEGATIVO - Debe rechazar tarjetas duplicadas o con datos inválidos', async () => {
    // Duplicado de número de tarjeta
    const dupNumero = await createTarjeta({
      id: 7778,
      cliente_id: 1,
      numero_tarjeta: tarjetaPrueba.numero_tarjeta,
      banco: 'Banco Guayaquil',
      fecha_expiracion: '05/31'
    });
    assert.equal(dupNumero.ok, false);
    assert.equal(dupNumero.status, 409);

    // Cliente inexistente
    const clienteInexistente = await createTarjeta({
      cliente_id: 999999,
      numero_tarjeta: '1111222233334444',
      banco: 'Produbanco',
      fecha_expiracion: '08/30'
    });
    assert.equal(clienteInexistente.ok, false);
    assert.equal(clienteInexistente.status, 400);

    // Formato inválido de tarjeta (menos de 16 dígitos)
    const tarjetaInvalida = await createTarjeta({
      cliente_id: 1,
      numero_tarjeta: '1234',
      banco: 'Produbanco',
      fecha_expiracion: '08/30'
    });
    assert.equal(tarjetaInvalida.ok, false);
    assert.equal(tarjetaInvalida.status, 400);
  });

  await t.test('3. READ - Debe listar tarjetas y consultar por ID numérico o número de tarjeta', async () => {
    const listado = await listAllTarjetas();
    assert.ok(Array.isArray(listado), 'Debe retornar un array');
    const encontrada = listado.find(t => t.id === tarjetaPrueba.id);
    assert.ok(encontrada, 'La tarjeta de prueba debe estar en el listado');

    // Por id numérico
    const porId = await getTarjeta(tarjetaPrueba.id);
    assert.ok(porId);
    assert.equal(porId.numero_tarjeta, tarjetaPrueba.numero_tarjeta);

    // Por número de tarjeta
    const porNumero = await getTarjeta(tarjetaPrueba.numero_tarjeta);
    assert.ok(porNumero);
    assert.equal(porNumero.id, tarjetaPrueba.id);
  });

  await t.test('4. UPDATE - Debe actualizar los datos de la tarjeta correctamente', async () => {
    const response = await updateTarjeta(tarjetaPrueba.id, {
      banco: 'Banco Internacional',
      fecha_expiracion: '12/35'
    });

    assert.equal(response.ok, true);
    assert.equal(response.status, 200);
    assert.equal(response.tarjeta.banco, 'Banco Internacional');
    assert.equal(response.tarjeta.fecha_expiracion, '12/35');

    // Confirmación en BD
    const enDb = await tarjetas.findOne({ id: tarjetaPrueba.id });
    assert.equal(enDb.banco, 'Banco Internacional');
    assert.equal(enDb.fecha_expiracion, '12/35');
  });

  await t.test('5. DELETE - Debe eliminar exitosamente la tarjeta de prueba', async () => {
    const response = await deleteTarjeta(tarjetaPrueba.id);
    assert.equal(response.ok, true);
    assert.equal(response.status, 200);

    // Confirmar que ya no existe
    const enDb = await tarjetas.findOne({ id: tarjetaPrueba.id });
    assert.equal(enDb, null, 'La tarjeta eliminada no debe existir en MongoDB');

    // Intentar eliminar nuevamente debe retornar 404
    const repetido = await deleteTarjeta(tarjetaPrueba.id);
    assert.equal(repetido.ok, false);
    assert.equal(repetido.status, 404);
  });

  await t.test('6. VALIDACIÓN DE CAMPOS - Reglas de formato', () => {
    // Banco muy corto
    const errBanco = validateTarjetaData({
      cliente_id: 1,
      numero_tarjeta: '1234567890123456',
      banco: 'B',
      fecha_expiracion: '10/28'
    });
    assert.ok(errBanco.length > 0);

    // Formato fecha inválido
    const errFecha = validateTarjetaData({
      cliente_id: 1,
      numero_tarjeta: '1234567890123456',
      banco: 'Banco Pichincha',
      fecha_expiracion: '13/28'
    });
    assert.ok(errFecha.length > 0);
  });

  await t.test('7. PAGINACIÓN - Debe paginar tarjetas de 6 en 6 con total y páginas', async () => {
    const resP1 = await getTarjetasPaginated({ page: 1, limit: 6 });
    assert.ok(Array.isArray(resP1.tarjetas));
    assert.equal(resP1.currentPage, 1);
    assert.equal(resP1.limit, 6);
    assert.ok(resP1.total >= 10);
    assert.equal(resP1.totalPages, Math.ceil(resP1.total / 6));
    assert.equal(resP1.tarjetas.length, 6);

    const resP2 = await getTarjetasPaginated({ page: 2, limit: 6 });
    assert.ok(Array.isArray(resP2.tarjetas));
    assert.equal(resP2.currentPage, 2);
    const idsP1 = new Set(resP1.tarjetas.map(t => t.id));
    const haySolapamiento = resP2.tarjetas.some(t => idsP1.has(t.id));
    assert.equal(haySolapamiento, false, 'No debe haber tarjetas duplicadas entre páginas');
  });
});
