# 01 - Resumen Ejecutivo

# Resumen Ejecutivo: Proyecto "LactaMap"

## 1. Visión del Proyecto

**LactaMap** es una plataforma híbrida (PWA y App Móvil) diseñada para empoderar a las madres lactantes mediante la geolocalización de espacios seguros, cómodos y equipados. A diferencia de un mapa estático, LactaMap es un ecosistema de comunidad y gestión donde la información es validada por las propias usuarias y los administradores de los espacios, garantizando datos reales y actualizados.

***

## 2. Roles de Usuario y Gamificación

El sistema utiliza un modelo de confianza progresiva. Los títulos son formales y estandarizados.

| Rol                           | Requisitos          | Permisos y Capacidades                                                                  |
| ----------------------------- | ------------------- | --------------------------------------------------------------------------------------- |
| **Visitante**                 | Sin registro        | Consulta de mapa, horarios, servicios y recursos informativos.                          |
| **Contribuidora**             | Registro básico     | Calificar lactarios, escribir reseñas, subir fotos y responder dudas.                   |
| **Contribuidora Distinguida** | Rango por puntos    | **Alta de nuevos lactarios**, edición de información básica y reporte de cierres.       |
| **Elite**                     | Validación avanzada | Sello azul de validación de datos. Su verificación otorga confianza inmediata al lugar. |
| **Propietario**               | Validación legal    | Gestión de reportes de mantenimiento y sello dorado de propiedad verificada.            |

**Acciones que otorgan puntos:**

* Subir fotos del entorno (sin personas).
* Responder preguntas de la comunidad.
* Calificar y detallar servicios (limpieza, insumos, etc.).
* Reportar desactualización de horarios o cierres.

***

## 3. Módulos de la Aplicación

### A. Geolocalización e Interfaz de Mapa

* **Mapa Interactivo:** Integración con APIs nativas (Google/Apple Maps).
* **Filtros de Disponibilidad:**
  * Privacidad (Cerrado/Abierto).
  * Equipamiento (Refrigerador, contactos eléctricos, lavabo).
  * Confort (Sillón vs. Silla, cambiador).
  * Clima y Accesibilidad (AC, rampas, espacio para carriola).

### B. Herramienta de Acompañamiento (Companion Tool)

* **Cronómetro de Lactancia:** Medición independiente para pecho izquierdo y derecho.
* **Registro de Extracción:** Historial de mililitros/onzas por lado y suma total por sesión.
* **Biblioteca de Recursos:** Reproductor de música relajante, ruido blanco y cápsulas informativas.

### C. Sistema de Reportes y Seguridad

* **Canal de Mantenimiento:** Solo disponible en lactarios con propietario. Reporte de falta de jabón, papel, fallas eléctricas, etc.
* **Botón de Emergencia:** Acceso rápido al 911.
* **Formulario de Incidentes:** Denuncias por discriminación, mal uso del espacio o falta de higiene.

***

## 4. Esquema de Base de Datos (Relacional)

Este esquema está diseñado para ser robusto, escalable y permitir la sincronización opcional que mencionamos.

### Tabla: `users`

* `id` (UUID, PK)
* `email` (String, Unique)
* `password_hash` (String)
* `role` (Enum: Visitor, Contributor, Distinguished, Elite, Owner)
* `points` (Integer)
* `sync_enabled` (Boolean, Default: False)
* `created_at` (Timestamp)

### Tabla: `lactarios`

* `id` (UUID, PK)
* `name` (String)
* `latitude` (Decimal)
* `longitude` (Decimal)
* `address` (Text)
* `description` (Text)
* `owner_id` (UUID, FK, Nullable)
* `is_verified_owner` (Boolean) - *Sello Dorado*
* `is_verified_elite` (Boolean) - *Sello Azul*
* `status` (Enum: Active, Pending, Closed)

### Tabla: `lactario_attributes` (Relación N:M para Filtros)

* `id` (PK)
* `lactario_id` (FK)
* `has_fridge` (Boolean)
* `has_power_outlets` (Boolean)
* `has_sink` (Boolean)
* `has_nursing_chair` (Boolean)
* `has_changing_table` (Boolean)
* `has_ac` (Boolean)
* `has_stroller_access` (Boolean)

### Tabla: `reviews_and_photos`

* `id` (PK)
* `user_id` (FK)
* `lactario_id` (FK)
* `rating` (Integer 1-5)
* `comment` (Text)
* `photo_url` (String)
* `is_moderated` (Boolean, Default: False)

### Tabla: `nursing_logs` (Sincronización Opcional)

* `id` (PK)
* `user_id` (FK)
* `start_time` (Timestamp)
* `end_time` (Timestamp)
* `side` (Enum: Left, Right, Both)
* `amount_ml` (Decimal)
* `session_total` (Decimal)

### Tabla: `maintenance_reports`

* `id` (PK)
* `lactario_id` (FK)
* `user_id` (FK)
* `issue_type` (String)
* `description` (Text)
* `status` (Enum: Open, Resolved)

***

## 5. Arquitectura y Seguridad

1. **Enfoque Hybrid/Mobile First:** Desarrollo en Flutter o React Native para máxima compatibilidad.
2. **Privacidad:** La sincronización de datos de salud (`nursing_logs`) es **manual y bajo consentimiento**. Si no se activa, los datos residen únicamente en el almacenamiento local (SQLite/IndexedDB).
3. **Moderación de Contenido:** Todas las fotos y nuevos registros pasan por una cola de aprobación manual antes de ser públicos.
4. **Seguridad de Fotos:** IA o moderación humana para asegurar que no se suban imágenes con rostros o personas, protegiendo la privacidad del entorno.

