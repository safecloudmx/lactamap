# 02 - Estructura de los Endpoints de la API (REST)

Para este proyecto, utilizaremos el prefijo de versión `/api/v1`.

***

## 1. Módulo de Autenticación y Usuarios

Gestiona el acceso, los perfiles y el sistema de puntos para la gamificación.

| Método  | Endpoint         | Descripción                                 | Acceso      |
| ------- | ---------------- | ------------------------------------------- | ----------- |
| `POST`  | `/auth/register` | Registro de nuevas usuarias.                | Público     |
| `POST`  | `/auth/login`    | Inicio de sesión y entrega de JWT.          | Público     |
| `GET`   | `/users/me`      | Obtener perfil, rol y puntos acumulados.    | Autenticado |
| `PATCH` | `/users/me/sync` | Activar/desactivar sincronización de datos. | Autenticado |

***

## 2. Módulo de Lactarios (Core)

Controla la visualización, búsqueda y alta de los espacios de lactancia.

| Método  | Endpoint                | Descripción                                             | Acceso          |
| ------- | ----------------------- | ------------------------------------------------------- | --------------- |
| `GET`   | `/lactarios`            | Listar lactarios con filtros (lat/lng, servicios).      | Público         |
| `GET`   | `/lactarios/:id`        | Detalle completo de un lactario específico.             | Público         |
| `POST`  | `/lactarios`            | Crear un nuevo lactario (envía a cola de moderación).   | C. Distinguida+ |
| `POST`  | `/lactarios/:id/claim`  | Solicitar propiedad de un lactario (adjunta evidencia). | Propietario     |
| `PATCH` | `/lactarios/:id/verify` | Validar información de un lactario.                     | Elite           |

***

## 3. Módulo de Interacción y Comunidad

Maneja la carga de contenido y el feedback de las usuarias.

| Método | Endpoint                  | Descripción                                 | Acceso         |
| ------ | ------------------------- | ------------------------------------------- | -------------- |
| `POST` | `/lactarios/:id/reviews`  | Publicar calificación y comentario.         | Contribuidora+ |
| `POST` | `/lactarios/:id/photos`   | Subir fotos del lugar (envía a moderación). | Contribuidora+ |
| `GET`  | `/lactarios/:id/comments` | Listar dudas y respuestas de la comunidad.  | Público        |
| `POST` | `/comments/:id/reply`     | Responder a una duda de otra usuaria.       | Contribuidora+ |

***

## 4. Módulo de Logs de Lactancia (Sincronización)

Solo se utiliza si la usuaria activó la opción de sincronización en la nube.

| Método   | Endpoint    | Descripción                                           | Acceso         |
| -------- | ----------- | ----------------------------------------------------- | -------------- |
| `GET`    | `/logs`     | Obtener historial completo de tomas/extracciones.     | Dueño del dato |
| `POST`   | `/logs`     | Sincronizar una nueva sesión de lactancia/extracción. | Dueño del dato |
| `DELETE` | `/logs/:id` | Eliminar un registro del historial.                   | Dueño del dato |

***

## 5. Módulo de Reportes y Mantenimiento

Gestiona la comunicación con propietarios y reportes de seguridad.

| Método  | Endpoint               | Descripción                                       | Acceso         |
| ------- | ---------------------- | ------------------------------------------------- | -------------- |
| `POST`  | `/reports/maintenance` | Reportar falta de insumos o fallos en el lugar.   | Contribuidora+ |
| `POST`  | `/reports/incident`    | Reporte de discriminación o mal uso (va a admin). | Autenticado    |
| `GET`   | `/owner/reports`       | Listar reportes pendientes para un propietario.   | Propietario    |
| `PATCH` | `/reports/:id/resolve` | Marcar reporte de mantenimiento como resuelto.    | Propietario    |

***

### Consideraciones Técnicas de Seguridad

1. **JWT (JSON Web Tokens):** Todos los endpoints (excepto los de lectura pública y auth) requieren el encabezado `Authorization: Bearer <token>`.
2. **Rate Limiting:** Se debe implementar un límite de peticiones para evitar abusos en el alta de lugares y carga de fotos.
3. **Sanitización:** Los comentarios y descripciones deben ser limpiados en el backend para evitar inyecciones XSS.



Para que la aplicacion sea verdaderamente robusto y soporte miles de usuarios concurrentes y una expansión a nivel nacional (o gubernamental), debemos agregar los siguientes módulos y capas de infraestructura:

***

## 1. Módulo de Administración y Moderación (Backoffice)

Mencionaste una "cola de moderación", pero no definimos cómo interactúa el equipo interno con ella. Sin estos endpoints, el sistema se bloquea.

| Método | Endpoint                        | Descripción                                                 | Acceso |
| ------ | ------------------------------- | ----------------------------------------------------------- | ------ |
| `GET`  | `/admin/moderation/pending`     | Lista de fotos y lactarios esperando aprobación.            | Admin  |
| `POST` | `/admin/moderation/approve/:id` | Aprueba un registro o foto, haciéndolo público.             | Admin  |
| `POST` | `/admin/moderation/reject/:id`  | Rechaza un registro con un motivo (ej. "Foto inapropiada"). | Admin  |
| `GET`  | `/admin/claims/pending`         | Lista de solicitudes de propiedad de lactarios.             | Admin  |

***

## 2. Infraestructura de Escalabilidad (Background Tasks)

No todo debe suceder en el ciclo de solicitud/respuesta de la API. Para que sea robusta, necesitamos **Webhooks** y **Workers**.

* **Procesamiento de Imágenes:** Al subir una foto, un worker debe redimensionarla, crear miniaturas y pasar un filtro de IA (como AWS Rekognition o Google Vision) para detectar rostros o contenido sensible antes de la moderación humana.
* **Notificaciones Asíncronas:** No queremos que la API espere a que se envíe un correo. Usaremos un sistema de colas (Redis/BullMQ).
  * `POST /internal/notifications/trigger`: Endpoint interno para disparar avisos de mantenimiento.

***

## 3. Optimización Geoespacial (PostGIS)

Para que la búsqueda de "lactarios cercanos" sea instantánea con miles de puntos, la base de datos debe usar extensiones espaciales.

> **Nota Técnica:** En lugar de calcular distancias con fórmulas matemáticas complejas en la CPU del servidor, delegaremos esto a la base de datos usando **PostGIS**.

\$\$\text{distancia} = \text{ST\\\_DistanceSphere(user\\\_location, lactario\\\_location)}\$\$

***

## 4. Módulo de Auditoría y Seguridad Avanzada

Para un proyecto que maneja datos sensibles y posibles convenios gubernamentales, la trazabilidad es obligatoria.

* **Logs de Auditoría (****`audit_logs`****):** Una tabla que registre cada cambio de rol, cada aprobación de lactario y quién accedió a datos sensibles.
* **Versioning de la API:** El uso de `/v1/` en la URL es vital para que, cuando lances una actualización importante en la App móvil, no rompas la compatibilidad con usuarias que no han actualizado su aplicación.
* **Gestión de Media (Presigned URLs):** Las fotos no deben subirse directamente al servidor de la API. La API debe generar una **URL firmada** (de AWS S3 o Google Cloud Storage) para que el teléfono suba la imagen directamente al almacenamiento en la nube, ahorrando ancho de banda y recursos en tu servidor.

***

## 5. Actualización del Esquema de Base de Datos (Robustez)

Agregamos estas tablas esenciales para el control de calidad:

### Tabla: `moderation_queue`

* `id` (PK)
* `entity_type` (Enum: 'photo', 'lactario', 'review')
* `entity_id` (UUID)
* `status` (Enum: 'pending', 'approved', 'rejected')
* `moderator_id` (FK, Nullable)
* `rejection_reason` (Text)

### Tabla: `app_config` (Para escalabilidad)

* `key` (String, Unique) - Ejemplo: `min_version_android`, `emergency_phone`.
* `value` (String)

***

##

## Diagrama de Flujo de Datos (Arquitectura de alto nivel)



## Arquitectura de Flujo de Datos y Sistema

Para que la aplicación sea escalable, separaremos las responsabilidades. El usuario no interactúa directamente con la base de datos, sino con una capa de servicios que gestiona la lógica, la seguridad y las tareas pesadas en segundo plano.

### 1. El Trayecto de la Información (Data Path)

1. **Capa de Cliente (Frontend):** La PWA o App móvil gestiona el estado local (especialmente el cronómetro y los registros de lactancia sin sincronizar).
2. **Capa de Entrada (API Gateway):** Recibe las peticiones, valida el token **JWT** y aplica el **Rate Limiting** para que nadie sature el sistema.
3. **Procesamiento Síncrono (API REST):** El servidor procesa la lógica de negocio (ej. "¿Este usuario tiene el rango de Contribuidora Distinguida para crear este lugar?").
4. **Capa de Persistencia:**
   * **PostgreSQL + PostGIS:** Guarda la información estructural y geográfica.
   * **Redis:** Almacena sesiones temporales y gestiona las colas de trabajo.
5. **Procesamiento Asíncrono (Workers):** Aquí es donde ocurre la magia de la escalabilidad. Si una mamá sube una foto, la API responde "Recibido" de inmediato, y un **Worker** en segundo plano se encarga de:
   * Redimensionar la imagen.
   * Pasar el filtro de IA para detectar rostros (Privacidad).
   * Subir el resultado final a un bucket de **S3** (Almacenamiento en la nube).

***

## 2. Flujo de Moderación y Validación

Es vital entender cómo un dato pasa de ser "propuesto" a ser "oficial".

| Evento             | Origen                    | Flujo de Datos                                                                      | Resultado Final                                         |
| ------------------ | ------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Nuevo Lactario** | Contribuidora Distinguida | `POST /lactarios` -> `moderation_queue` (Status: Pending) -> Notificación al Admin. | Aparece en el mapa tras aprobación manual.              |
| **Reclamar Lugar** | Usuario Propietario       | `POST /claim` -> Carga de evidencia a S3 -> Auditoría de Admin.                     | Sello Dorado y activación de Reportes de Mantenimiento. |
| **Sincronización** | Usuario (Manual)          | `POST /logs` -> Validación de Consentimiento -> Guardado en DB cifrada.             | Datos disponibles en cualquier dispositivo tras login.  |

***

## 3. Seguridad y Privacidad de Datos

Para cumplir con estándares internacionales de privacidad, el flujo de datos sensibles (logs de lactancia) sigue estas reglas:

* **Cifrado en Tránsito:** TLS 1.3 en todas las comunicaciones.
* **Aislamiento de Datos:** Los registros de salud de las usuarias están en una tabla separada con políticas de acceso a nivel de fila (**RLS - Row Level Security**), asegurando que ni siquiera un error de programación permita a un usuario ver los logs de otro.
