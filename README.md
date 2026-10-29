# JSDeUna

Aplicación de simulación de transferencias y recargas bancarias, reescrita desde la versión original en Python y migrada a Node.js con Express y MongoDB.

## Stack tecnológico

- Node.js 22+
- Express
- MongoDB
- Vue 3 para el frontend SPA
- Tailwind CSS

## Funcionalidades

- Dashboard con cuentas, tarjetas y actividad reciente
- Transferencias entre cuentas con validación de saldo y comisión
- Recarga de saldo usando tarjeta con validación de vencimiento
- Base de datos semilla para poblar datos iniciales

## Requisitos

- Node.js 18 o superior
- MongoDB corriendo localmente o una URL válida de MongoDB Atlas

## Instalación

1. Entra a la carpeta del proyecto.
2. Instala las dependencias:

```bash
npm install
```

3. Crea el archivo de entorno a partir del ejemplo:

```bash
cp .env.example .env
```

4. Ajusta la conexión a MongoDB si es necesario en el archivo `.env`.

## Ejecutar la aplicación

Modo producción:

```bash
npm start
```

Modo desarrollo:

```bash
npm run dev
```

La aplicación estará disponible en:

```bash
http://localhost:5000
```

## Endpoints principales

- `GET /api/deuna/cuentas`
- `GET /api/deuna/tarjetas`
- `GET /api/deuna/transacciones`
- `GET /api/deuna/transacciones/:id`
- `POST /api/deuna/transacciones`
- `PUT /api/deuna/transacciones/:id`
- `DELETE /api/deuna/transacciones/:id`
- `POST /api/deuna/seed`
- `POST /api/deuna/transferencia`
- `POST /api/deuna/recarga`

## Ejemplo de uso

### Población inicial de datos

```bash
curl -X POST http://localhost:5000/api/deuna/seed
```

### Transferencia

```bash
curl -X POST http://localhost:5000/api/deuna/transferencia \
  -H "Content-Type: application/json" \
  -d '{"origen":"0991234567","destino":"0987654321","monto":25}'
```

### Recarga

```bash
curl -X POST http://localhost:5000/api/deuna/recarga \
  -H "Content-Type: application/json" \
  -d '{"numero_cuenta":"0991234567","numero_tarjeta":"4111222233334444","monto":50}'
```

## Nota

Esta versión mantiene la lógica funcional original de la app Python, pero reescrita para funcionar en Node.js y MongoDB con el mismo flujo de negocio y la misma UI del dashboard.
