import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/';
const dbName = process.env.DB_NAME || 'deuna_db';

let client;
let db;

export async function connectToDatabase() {
  if (db) return db;

  client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

export async function closeDatabase() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export async function getCollections() {
  const connectedDb = await connectToDatabase();
  return {
    clientes: connectedDb.collection('clientes'),
    cuentas: connectedDb.collection('cuentas'),
    tarjetas: connectedDb.collection('tarjetas'),
    transacciones: connectedDb.collection('transacciones')
  };
}

export function serializeCollection(doc) {
  if (!doc) return null;
  const serialized = { ...doc };
  if (serialized._id) serialized._id = String(serialized._id);
  return serialized;
}

export async function seedDatabase() {
  const { clientes, cuentas, tarjetas, transacciones } = await getCollections();

  if ((await clientes.countDocuments()) === 0) {
    await clientes.insertMany([
      { id: 1, nombre: 'Carlos Rivera', email: 'carlos.rivera@email.com', telefono: '0991234567' },
      { id: 2, nombre: 'Maria Torres', email: 'maria.torres@email.com', telefono: '0987654321' },
      { id: 3, nombre: 'Juan Perez', email: 'juan.perez@email.com', telefono: '0971112223' },
      { id: 4, nombre: 'Ana Gomez', email: 'ana.gomez@email.com', telefono: '0963334445' },
      { id: 5, nombre: 'Luis Fernandez', email: 'luis.fernandez@email.com', telefono: '0955556667' },
      { id: 6, nombre: 'Sofia Luna', email: 'sofia.luna@email.com', telefono: '0947778889' },
      { id: 7, nombre: 'Pedro Ramirez', email: 'pedro.ramirez@email.com', telefono: '0939990001' },
      { id: 8, nombre: 'Lucia Castro', email: 'lucia.castro@email.com', telefono: '0921112222' },
      { id: 9, nombre: 'Jorge Medina', email: 'jorge.medina@email.com', telefono: '0913334444' },
      { id: 10, nombre: 'Elena Suarez', email: 'elena.suarez@email.com', telefono: '0905556666' }
    ]);
  }

  if ((await cuentas.countDocuments()) === 0) {
    await cuentas.insertMany([
      { id: 1, cliente_id: 1, numero_cuenta: '0991234567', alias: 'carlosr', estado_cuenta: 'ACTIVA', banco: 'Banco Pichincha', saldo: 500.0 },
      { id: 2, cliente_id: 2, numero_cuenta: '0987654321', alias: 'mariate', estado_cuenta: 'ACTIVA', banco: 'Banco Guayaquil', saldo: 1200.5 },
      { id: 3, cliente_id: 3, numero_cuenta: '0971112223', alias: 'juanp', estado_cuenta: 'ACTIVA', banco: 'Produbanco', saldo: 300.0 },
      { id: 4, cliente_id: 4, numero_cuenta: '0963334445', alias: 'anag', estado_cuenta: 'BLOQUEADA', banco: 'Banco Pichincha', saldo: 80.0 },
      { id: 5, cliente_id: 5, numero_cuenta: '0955556667', alias: 'luisf', estado_cuenta: 'ACTIVA', banco: 'Banco Bolivariano', saldo: 950.0 },
      { id: 6, cliente_id: 6, numero_cuenta: '0947778889', alias: 'sofial', estado_cuenta: 'ACTIVA', banco: 'Banco Internacional', saldo: 150.25 },
      { id: 7, cliente_id: 7, numero_cuenta: '0939990001', alias: 'pedror', estado_cuenta: 'ACTIVA', banco: 'Banco Pichincha', saldo: 430.75 },
      { id: 8, cliente_id: 8, numero_cuenta: '0921112222', alias: 'luciac', estado_cuenta: 'ACTIVA', banco: 'Banco Guayaquil', saldo: 0.0 },
      { id: 9, cliente_id: 9, numero_cuenta: '0913334444', alias: 'jorgem', estado_cuenta: 'ACTIVA', banco: 'Produbanco', saldo: 2100.0 },
      { id: 10, cliente_id: 10, numero_cuenta: '0905556666', alias: 'elenas', estado_cuenta: 'ACTIVA', banco: 'Banco Bolivariano', saldo: 55.5 }
    ]);
  }

  if ((await tarjetas.countDocuments()) === 0) {
    await tarjetas.insertMany([
      { id: 1, cliente_id: 1, numero_tarjeta: '4111222233334444', banco: 'Banco Pichincha', fecha_expiracion: '12/28' },
      { id: 2, cliente_id: 2, numero_tarjeta: '5555666677778888', banco: 'Banco Guayaquil', fecha_expiracion: '05/25' },
      { id: 3, cliente_id: 3, numero_tarjeta: '4222333344445555', banco: 'Produbanco', fecha_expiracion: '10/29' },
      { id: 4, cliente_id: 4, numero_tarjeta: '5111222233334444', banco: 'Banco Bolivariano', fecha_expiracion: '01/22' },
      { id: 5, cliente_id: 5, numero_tarjeta: '4555666677778888', banco: 'Banco Internacional', fecha_expiracion: '11/27' },
      { id: 6, cliente_id: 6, numero_tarjeta: '5222333344445555', banco: 'Banco Pichincha', fecha_expiracion: '08/26' },
      { id: 7, cliente_id: 7, numero_tarjeta: '4111111122223333', banco: 'Banco Guayaquil', fecha_expiracion: '03/30' },
      { id: 8, cliente_id: 8, numero_tarjeta: '5555555566667777', banco: 'Produbanco', fecha_expiracion: '07/24' },
      { id: 9, cliente_id: 9, numero_tarjeta: '4222222233334444', banco: 'Banco Bolivariano', fecha_expiracion: '09/31' },
      { id: 10, cliente_id: 10, numero_tarjeta: '5111111122223333', banco: 'Banco Internacional', fecha_expiracion: '04/28' }
    ]);
  }

  if ((await transacciones.countDocuments()) === 0) {
    await transacciones.insertOne({
      id: 1,
      quien: 'Carlos Rivera',
      origen: '0991234567',
      destino: '0987654321',
      monto: 25,
      comision: 0.4,
      cuando: new Date().toISOString(),
      desde_donde: process.env.IP_ADDRESS,
      estado: 'CONFIRMADA',
      tipo: 'transferencia'
    });
  }

  return { message: 'Database seeded successfully' };
}
