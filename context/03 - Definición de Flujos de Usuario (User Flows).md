# 03 - Definición de Flujos de Usuario (User Flows)

## 1. Flujo de Descubrimiento y Urgencia (Visitante)

*Este es el flujo crítico para una madre que necesita un lactario en el momento.*

1. **Entrada:** El usuario abre la PWA/App.
2. **Permisos:** El sistema solicita acceso a la ubicación.
   * *Si acepta:* El mapa se centra en su posición y muestra los pines de lactarios cercanos.
   * *Si rechaza:* El mapa muestra una vista general y un buscador por ciudad/CP.
3. **Exploración:** El usuario toca un "pin" en el mapa.
4. **Vista Previa:** Se despliega una tarjeta inferior (Bottom Sheet) con:
   * Nombre del lugar, foto principal y calificación (estrellas).
   * Distancia en km y tiempo estimado.
   * Sellos de verificación (Dorado/Azul) si existen.
5. **Detalle Extendido:** Al deslizar hacia arriba, se muestran los filtros (iconos de refrigerador, silla, etc.) y comentarios.
6. **Acción:** El usuario presiona "Cómo llegar" y la app lanza la intención nativa (Google Maps/Apple Maps).

***

## 2. Flujo del "Diario de Lactancia" (Herramienta de Acompañamiento)

*Diseñado para ser usado con una sola mano (ergonomía móvil).*

1. **Acceso:** Botón central persistente en la barra de navegación: "Mi Sesión".
2. **Inicio de Toma:** La usuaria elige "Lado Izquierdo", "Lado Derecho" o "Ambos".
3. **Cronómetro:** Al presionar "Iniciar", comienza el conteo.
   * *Estado:* La pantalla no debe bloquearse (Wake Lock API).
   * *Funcionalidad:* Opción de "Pausar" o "Cambiar de lado" (detiene uno, inicia otro).
4. **Finalización y Registro:** Al presionar "Detener", el sistema pregunta: "¿Deseas registrar extracción?".
   * Si acepta: Aparece un selector numérico para ingresar mililitros/onzas por lado.
5. **Guardado Local:** Los datos se guardan en el dispositivo.
6. **Sincronización (Opcional):** Si la usuaria no ha iniciado sesión, aparece un banner sutil: *"¿Quieres respaldar tus datos? Crea una cuenta"*.

***

## 3. Flujo de Contribución y Gamificación (Contribuidora)

*El motor que alimenta la base de datos.*

1. **Registro:** La usuaria crea una cuenta para subir al rango de "Contribuidora".
2. **Calificación:** Tras visitar un lactario, selecciona "Escribir Reseña".
   * *Validación:* Debe marcar obligatoriamente los atributos (limpieza, privacidad, recursos).
3. **Carga de Multimedia:** Selecciona "Subir Foto".
   * *Regla de Negocio:* El sistema muestra un recordatorio: "Por seguridad, evita fotos donde aparezcan personas".
   * *Backend:* La foto entra en la cola de moderación.
4. **Evolución de Rango:** Al llegar a X puntos, el sistema lanza una notificación: *"¡Felicidades! Ahora eres Contribuidora Distinguida. Ya puedes dar de alta nuevos lugares"*.
5. **Alta de Lugar (Distinguida):** Formulario extenso con geolocalización por pin, horarios y lista de amenidades.

***

## 4. Flujo de Verificación de Propiedad (Dueño)

*Para establecer la responsabilidad formal del espacio.*

1. **Selección:** El usuario busca su lactario en el mapa y presiona "Reclamar propiedad".
2. **Formulario de Evidencia:**
   * Ingresa Datos Fiscales/Corporativos.
   * Sube foto de identificación oficial y documento que acredite la administración del espacio.
3. **Validación:** El estado del lactario cambia a "En Proceso de Verificación".
4. **Aprobación:** Una vez que el Admin aprueba, el usuario recibe el Rol "Propietario" y el lactario obtiene el **Sello Dorado**.
5. **Gestión:** Se habilita un panel de "Mis Lugares" donde puede responder reportes de mantenimiento.

***

## 5. Flujo de Reportes y Emergencias

*Prioridad en la seguridad y el mantenimiento.*

1. **Reporte de Mantenimiento:**
   * En la vista del lactario, presiona "Reportar un problema".
   * Selecciona categoría (Falta de higiene, equipo dañado, sin insumos).
   * Enví&#x6F;*:* El sistema notifica al Propietario por email/push.
2. **Botón de Emergencia (911):**
   * Visible en la pantalla de "Mi Sesión" y en el detalle del lactario.
   * Requiere confirmación doble para evitar llamadas accidentales.
3. **Reporte de Incidente:**
   * Formulario confidencial que se envía directamente al administrador de LactaMap para casos de discriminación o incidentes graves.

***

### Análisis de Robustez para la IA de Desarrollo:

* **Manejo de Estados:** La IA debe considerar el estado "Offline". Si una mamá está en un lactario en un sótano sin señal, el cronómetro y el registro deben funcionar y sincronizarse cuando recupere conexión (Service Workers).
* **Permisos Dinámicos:** Los flujos deben manejar los rechazos de permisos de cámara o GPS con mensajes claros y alternas (búsqueda manual).
