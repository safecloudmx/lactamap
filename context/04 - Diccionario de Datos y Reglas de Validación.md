# 04 - Diccionario de Datos y Reglas de Validación

## 1. Núcleo de Usuarios y Gamificación (`users`)

| Campo          | Tipo      | Validación / Regla                                   | Notas                                         |
| -------------- | --------- | ---------------------------------------------------- | --------------------------------------------- |
| `id`           | UUID      | Único, Autogenerado                                  | Clave Primaria.                               |
| `email`        | String    | Formato email, Único                                 | Obligatorio.                                  |
| `role`         | Enum      | \[Visitor, Contributor, Distinguished, Elite, Owner] | Default: `Visitor`.                           |
| `points`       | Integer   | \$\ge 0\$                                            | Se incrementa según tabla de méritos.         |
| `sync_enabled` | Boolean   | Default: `False`                                     | Solo `True` si acepta términos y condiciones. |
| `last_login`   | Timestamp | ISO 8601                                             | Para métricas de retención.                   |

> **Regla de Promoción:** Un usuario sube a `Distinguished` automáticamente al alcanzar los 500 puntos. El rol `Elite` es asignado manualmente por administración tras auditoría de veracidad.

***

## 2. Entidad Lactarios (`lactarios`)

| Campo           | Tipo          | Validación / Regla                      | Notas                                        |
| --------------- | ------------- | --------------------------------------- | -------------------------------------------- |
| `name`          | String        | Min 5, Max 100 chars                    | Nombre comercial o institucional.            |
| `location`      | PostGIS Point | Lat: -90 a 90, Lng: -180 a 180          | Indexado espacialmente.                      |
| `status`        | Enum          | \[Pending, Active, Closed, Maintenance] | `Pending` requiere aprobación de admin.      |
| `avg_rating`    | Decimal       | 0.0 a 5.0                               | Calculado mediante trigger de base de datos. |
| `verified_type` | Enum          | \[None, Elite, Owner]                   | Define el color del sello (Azul/Dorado).     |

***

## 3. Atributos y Comodidades (`lactario_amenities`)

Todos estos campos son **Booleanos** y se utilizan para el motor de filtrado.

* `has_fridge`: ¿Tiene refrigerador para conservación?
* `has_power`: ¿Tiene contactos para extractores eléctricos?
* `has_sink`: ¿Tiene tarja para lavado de manos/utensilios?
* `has_privacy`: ¿Es un cubículo cerrado o área compartida?
* `has_nursing_chair`: ¿Cuenta con sillón ergonómico?
* `is_accessible`: ¿Rampas y espacio para carriolas?

***

## 4. Diario de Lactancia (`nursing_logs`)

*Este módulo debe cumplir con alta precisión de datos.*

| Campo           | Tipo      | Validación           | Notas                       |
| --------------- | --------- | -------------------- | --------------------------- |
| `start_time`    | Timestamp | Obligatorio          | Inicio de la sesión.        |
| `end_time`      | Timestamp | \$> start\\\_time\$  | Duración de la toma.        |
| `side`          | Enum      | \[Left, Right, Both] | Lado utilizado.             |
| `volume_ml`     | Decimal   | \$\ge 0\$, Max 500.0 | Cantidad extraída por lado. |
| `total_session` | Decimal   | Suma de `volume_ml`  | Calculado por la app.       |

***

## 5. Gestión de Multimedia y Reseñas (`reviews_photos`)

* **Imágenes:**
  * `file_size`: Máximo 5MB por imagen.
  * `format`: \[JPEG, PNG, WEBP].
  * `moderation_status`: \[Pending, Approved, Flagged].
* **Comentarios:**
  * `content`: Mínimo 10 caracteres para evitar spam.
  * `sentiment_score`: (Opcional) Para destacar reseñas positivas.

***

## 6. Validación de Reclamo de Propiedad (`ownership_claims`)

Para que Claude o Antigravity construyan el sistema de verificación, el objeto de reclamación debe contener:

1. **Documento de Identidad:** URL de imagen (cifrada).
2. **Prueba de Administración:** PDF o imagen de contrato, nombramiento o recibo de servicios a nombre de la entidad.
3. **Teléfono de Verificación:** Formato internacional (+52...).
4. **Correo Corporativo:** Validación de dominio (ej. `@empresa.com`).

***

## Lógica de Sincronización (Data Sync Policy)

Para asegurar la robustez que buscas, la aplicación debe seguir el patrón **Offline-First**:

1. La App escribe en **SQLite** (Móvil) o **IndexedDB** (Web) inmediatamente.
2. Si `sync_enabled == True` y hay conexión, un Background Worker envía los datos a la API.
3. El servidor responde con un `last_sync_timestamp` para evitar duplicados.
