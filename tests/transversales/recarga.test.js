import request from 'supertest';
import app from '../../server.js';
import { getCollections, closeDatabase } from '../../src/db/index.js';
import { closeDatabase as closeServiceDatabase } from '../../db_service/database.js';

describe('Pruebas Transversales: Flujo de Recarga con Tarjeta', () => {
  let dbCollections;

  const CLIENTE_TITULAR_ID = 910;
  const CLIENTE_AJENO_ID = 911;
  const CUENTA_RECARGA_NUM = 'TEST-CTA-RECARGA-01';
  const TARJETA_VALIDA_NUM = '9999111122223333';
  const TARJETA_EXPIRADA_NUM = '9999444455556666';
  const TARJETA_AJENA_NUM = '9999777788889999';

  beforeAll(async () => {
    dbCollections = await getCollections();
  });

  afterAll(async () => {
    await closeDatabase();
    await closeServiceDatabase();
  });

  beforeEach(async () => {
    const { clientes, cuentas, tarjetas, transacciones } = dbCollections;

    // Limpieza de datos de prueba
    await clientes.deleteMany({ id: { $in: [CLIENTE_TITULAR_ID, CLIENTE_AJENO_ID] } });
    await cuentas.deleteMany({ numero_cuenta: CUENTA_RECARGA_NUM });
    await tarjetas.deleteMany({
      numero_tarjeta: { $in: [TARJETA_VALIDA_NUM, TARJETA_EXPIRADA_NUM, TARJETA_AJENA_NUM] }
    });
    await transacciones.deleteMany({
      $or: [
        { destino: CUENTA_RECARGA_NUM },
        { origen: { $in: [TARJETA_VALIDA_NUM, TARJETA_EXPIRADA_NUM, TARJETA_AJENA_NUM] } }
      ]
    });

    // Sembrar entidades
    await clientes.insertMany([
      { id: CLIENTE_TITULAR_ID, nombre: 'Carla Titular', email: 'carla@email.com', telefono: '0995551111' },
      { id: CLIENTE_AJENO_ID, nombre: 'Daniel Ajeno', email: 'daniel@email.com', telefono: '0995552222' }
    ]);

    await cuentas.insertOne({
      id: 910,
      cliente_id: CLIENTE_TITULAR_ID,
      numero_cuenta: CUENTA_RECARGA_NUM,
      alias: 'carla_cuenta',
      banco: 'Banco Pichincha',
      saldo: 150.0,
      estado_cuenta: 'ACTIVA'
    });

    await tarjetas.insertMany([
      {
        id: 910,
        cliente_id: CLIENTE_TITULAR_ID,
        numero_tarjeta: TARJETA_VALIDA_NUM,
        banco: 'Banco Pichincha',
        fecha_expiracion: '12/32' // Vigente
      },
      {
        id: 911,
        cliente_id: CLIENTE_TITULAR_ID,
        numero_tarjeta: TARJETA_EXPIRADA_NUM,
        banco: 'Banco Pichincha',
        fecha_expiracion: '01/20' // Vencida
      },
      {
        id: 912,
        cliente_id: CLIENTE_AJENO_ID,
        numero_tarjeta: TARJETA_AJENA_NUM,
        banco: 'Banco Guayaquil',
        fecha_expiracion: '10/30' // Pertenece a otro cliente
      }
    ]);
  });

  afterEach(async () => {
    const { clientes, cuentas, tarjetas, transacciones } = dbCollections;
    await clientes.deleteMany({ id: { $in: [CLIENTE_TITULAR_ID, CLIENTE_AJENO_ID] } });
    await cuentas.deleteMany({ numero_cuenta: CUENTA_RECARGA_NUM });
    await tarjetas.deleteMany({
      numero_tarjeta: { $in: [TARJETA_VALIDA_NUM, TARJETA_EXPIRADA_NUM, TARJETA_AJENA_NUM] }
    });
    await transacciones.deleteMany({
      $or: [
        { destino: CUENTA_RECARGA_NUM },
        { origen: { $in: [TARJETA_VALIDA_NUM, TARJETA_EXPIRADA_NUM, TARJETA_AJENA_NUM] } }
      ]
    });
  });

  test('debe recargar el saldo de la cuenta con una tarjeta válida del titular y registrar la transacción confirmada', async () => {
    const montoRecarga = 80.0;

    const response = await request(app)
      .post('/api/deuna/recarga')
      .send({
        numero_cuenta: CUENTA_RECARGA_NUM,
        numero_tarjeta: TARJETA_VALIDA_NUM,
        monto: montoRecarga
      });

    // 1. Respuesta HTTP
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.message).toBe('Recarga realizada con éxito');
    expect(response.body.transaccion).toBeDefined();

    // 2. Verificación en base de datos: saldo aumentado
    const cuentaActualizada = await dbCollections.cuentas.findOne({ numero_cuenta: CUENTA_RECARGA_NUM });
    expect(cuentaActualizada.saldo).toBeCloseTo(150.0 + montoRecarga, 2);

    // 3. Verificación en base de datos: auditoría de transacción
    const transaccion = await dbCollections.transacciones.findOne({
      origen: TARJETA_VALIDA_NUM,
      destino: CUENTA_RECARGA_NUM,
      estado: 'CONFIRMADA'
    });
    expect(transaccion).toBeTruthy();
    expect(transaccion.quien).toBe('Carla Titular');
    expect(transaccion.monto).toBe(montoRecarga);
    expect(transaccion.tipo).toBe('recarga');
  });

  test('debe rechazar la recarga si la tarjeta está expirada, mantener el saldo intacto y registrar la transacción fallida', async () => {
    const montoRecarga = 50.0;

    const response = await request(app)
      .post('/api/deuna/recarga')
      .send({
        numero_cuenta: CUENTA_RECARGA_NUM,
        numero_tarjeta: TARJETA_EXPIRADA_NUM,
        monto: montoRecarga
      });

    // 1. Respuesta HTTP de error
    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.error).toBe('Tarjeta expirada');

    // 2. Verificación en base de datos: saldo NO se alteró
    const cuentaSinCambios = await dbCollections.cuentas.findOne({ numero_cuenta: CUENTA_RECARGA_NUM });
    expect(cuentaSinCambios.saldo).toBe(150.0);

    // 3. Verificación de transacción fallida en auditoría
    const transaccionFallida = await dbCollections.transacciones.findOne({
      origen: TARJETA_EXPIRADA_NUM,
      destino: CUENTA_RECARGA_NUM,
      estado: 'FALLIDA'
    });
    expect(transaccionFallida).toBeTruthy();
    expect(transaccionFallida.motivo).toBe('Tarjeta expirada');
  });

  test('debe rechazar la recarga si la tarjeta pertenece a otro cliente y no alterar el saldo', async () => {
    const response = await request(app)
      .post('/api/deuna/recarga')
      .send({
        numero_cuenta: CUENTA_RECARGA_NUM,
        numero_tarjeta: TARJETA_AJENA_NUM,
        monto: 30.0
      });

    // 1. Respuesta de error
    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.error).toBe('Tarjeta no encontrada o no pertenece al cliente de la cuenta');

    // 2. Saldo intacto
    const cuentaSinCambios = await dbCollections.cuentas.findOne({ numero_cuenta: CUENTA_RECARGA_NUM });
    expect(cuentaSinCambios.saldo).toBe(150.0);
  });
});
