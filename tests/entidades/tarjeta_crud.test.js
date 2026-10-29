import { afterAll, beforeAll, describe, test } from '@jest/globals';
import { closeDatabase, getCollections } from '../../db_service/database.js';
import {
  createTarjeta,
  deleteTarjeta,
  getTarjeta,
  getTarjetasPaginated,
  listAllTarjetas,
  updateTarjeta,
  validateTarjetaData
} from '../../src/services/tarjetaService.js';

let tarjetas;
let clientes;
const tarjetaFixtureNumbers = Array.from({ length: 10 }, (_, index) =>
  `888000000000${String(index + 1).padStart(4, '0')}`
);

const tarjetaPrueba = {
  id: 7777,
  cliente_id: 7770,
  numero_tarjeta: '7777888899990000',
  banco: 'Banco Pichincha',
  fecha_expiracion: '11/30'
};

beforeAll(async () => {
  ({ tarjetas, clientes } = await getCollections());
  await tarjetas.deleteMany({
    numero_tarjeta: { $in: [tarjetaPrueba.numero_tarjeta, ...tarjetaFixtureNumbers] }
  });
  await tarjetas.deleteMany({
    id: { $in: [tarjetaPrueba.id, ...tarjetaFixtureNumbers.map((_, index) => 7780 + index)] }
  });
  await clientes.deleteOne({ id: tarjetaPrueba.cliente_id });
  await clientes.insertOne({
    id: tarjetaPrueba.cliente_id,
    nombre: 'Cliente de prueba para tarjetas',
    email: 'cliente-tarjeta@deuna.test',
    telefono: '0999997770'
  });
  await tarjetas.insertMany(tarjetaFixtureNumbers.map((numero_tarjeta, index) => ({
    id: 7780 + index,
    cliente_id: tarjetaPrueba.cliente_id,
    numero_tarjeta,
    banco: 'Banco de Prueba',
    fecha_expiracion: '12/35'
  })));
});

afterAll(async () => {
  await tarjetas.deleteMany({
    numero_tarjeta: { $in: [tarjetaPrueba.numero_tarjeta, ...tarjetaFixtureNumbers] }
  });
  await tarjetas.deleteMany({
    id: { $in: [tarjetaPrueba.id, ...tarjetaFixtureNumbers.map((_, index) => 7780 + index)] }
  });
  await clientes.deleteOne({ id: tarjetaPrueba.cliente_id });
  await closeDatabase();
});

describe('CRUD Tarjetas - Pruebas completas sobre la entidad tarjetas y tarjetaService', () => {
  test('1. CREATE - Debe registrar una nueva tarjeta con datos válidos', async () => {
    const response = await createTarjeta(tarjetaPrueba);
    expect(response.ok).toBe(true);
    expect(response.status).toBe(201);
    expect(response.tarjeta._id).toBeTruthy();
    expect(response.tarjeta.banco).toBe(tarjetaPrueba.banco);
    expect(response.tarjeta.numero_tarjeta).toBe(tarjetaPrueba.numero_tarjeta);
    expect(response.tarjeta.fecha_expiracion).toBe(tarjetaPrueba.fecha_expiracion);

    // Confirmación directa en BD
    const enDb = await tarjetas.findOne({ id: tarjetaPrueba.id });
    expect(enDb).toBeTruthy();
    expect(enDb.numero_tarjeta).toBe(tarjetaPrueba.numero_tarjeta);
  });

  test('2. CREATE NEGATIVO - Debe rechazar tarjetas duplicadas o con datos inválidos', async () => {
    // Duplicado de número de tarjeta
    const dupNumero = await createTarjeta({
      id: 7778,
      cliente_id: tarjetaPrueba.cliente_id,
      numero_tarjeta: tarjetaPrueba.numero_tarjeta,
      banco: 'Banco Guayaquil',
      fecha_expiracion: '05/31'
    });
    expect(dupNumero.ok).toBe(false);
    expect(dupNumero.status).toBe(409);

    // Cliente inexistente
    const clienteInexistente = await createTarjeta({
      cliente_id: 999999,
      numero_tarjeta: '1111222233334444',
      banco: 'Produbanco',
      fecha_expiracion: '08/30'
    });
    expect(clienteInexistente.ok).toBe(false);
    expect(clienteInexistente.status).toBe(400);

    // Formato inválido de tarjeta (menos de 16 dígitos)
    const tarjetaInvalida = await createTarjeta({
      cliente_id: 1,
      numero_tarjeta: '1234',
      banco: 'Produbanco',
      fecha_expiracion: '08/30'
    });
    expect(tarjetaInvalida.ok).toBe(false);
    expect(tarjetaInvalida.status).toBe(400);
  });

  test('3. READ - Debe listar tarjetas y consultar por ID numérico o número de tarjeta', async () => {
    const listado = await listAllTarjetas();
    expect(Array.isArray(listado)).toBe(true);
    const encontrada = listado.find(t => t.id === tarjetaPrueba.id);
    expect(encontrada).toBeTruthy();

    // Por id numérico
    const porId = await getTarjeta(tarjetaPrueba.id);
    expect(porId).toBeTruthy();
    expect(porId.numero_tarjeta).toBe(tarjetaPrueba.numero_tarjeta);

    // Por número de tarjeta
    const porNumero = await getTarjeta(tarjetaPrueba.numero_tarjeta);
    expect(porNumero).toBeTruthy();
    expect(porNumero.id).toBe(tarjetaPrueba.id);
  });

  test('4. UPDATE - Debe actualizar los datos de la tarjeta correctamente', async () => {
    const response = await updateTarjeta(tarjetaPrueba.id, {
      banco: 'Banco Internacional',
      fecha_expiracion: '12/35'
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(response.tarjeta.banco).toBe('Banco Internacional');
    expect(response.tarjeta.fecha_expiracion).toBe('12/35');

    // Confirmación en BD
    const enDb = await tarjetas.findOne({ id: tarjetaPrueba.id });
    expect(enDb.banco).toBe('Banco Internacional');
    expect(enDb.fecha_expiracion).toBe('12/35');
  });

  test('5. DELETE - Debe eliminar exitosamente la tarjeta de prueba', async () => {
    const response = await deleteTarjeta(tarjetaPrueba.id);
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    // Confirmar que ya no existe
    const enDb = await tarjetas.findOne({ id: tarjetaPrueba.id });
    expect(enDb).toBeNull();

    // Intentar eliminar nuevamente debe retornar 404
    const repetido = await deleteTarjeta(tarjetaPrueba.id);
    expect(repetido.ok).toBe(false);
    expect(repetido.status).toBe(404);
  });

  test('6. VALIDACIÓN DE CAMPOS - Reglas de formato', () => {
    // Banco muy corto
    const errBanco = validateTarjetaData({
      cliente_id: 1,
      numero_tarjeta: '1234567890123456',
      banco: 'B',
      fecha_expiracion: '10/28'
    });
    expect(errBanco.length).toBeGreaterThan(0);

    // Formato fecha inválido
    const errFecha = validateTarjetaData({
      cliente_id: 1,
      numero_tarjeta: '1234567890123456',
      banco: 'Banco Pichincha',
      fecha_expiracion: '13/28'
    });
    expect(errFecha.length).toBeGreaterThan(0);

    // En una actualización solo se validan los campos enviados
    expect(validateTarjetaData({ banco: 'Banco Pichincha' }, true)).toEqual([]);
    expect(validateTarjetaData({ numero_tarjeta: null }, true).length).toBeGreaterThan(0);
  });

  test('7. PAGINACIÓN - Debe paginar tarjetas de 6 en 6 con total y páginas', async () => {
    const resP1 = await getTarjetasPaginated({ page: 1, limit: 6 });
    expect(Array.isArray(resP1.tarjetas)).toBe(true);
    expect(resP1.currentPage).toBe(1);
    expect(resP1.limit).toBe(6);
    expect(resP1.total).toBeGreaterThanOrEqual(10);
    expect(resP1.totalPages).toBe(Math.ceil(resP1.total / 6));
    expect(resP1.tarjetas.length).toBe(6);

    const resP2 = await getTarjetasPaginated({ page: 2, limit: 6 });
    expect(Array.isArray(resP2.tarjetas)).toBe(true);
    expect(resP2.currentPage).toBe(2);
    const idsP1 = new Set(resP1.tarjetas.map(t => t.id));
    const haySolapamiento = resP2.tarjetas.some(t => idsP1.has(t.id));
    expect(haySolapamiento).toBe(false);
  });
});
