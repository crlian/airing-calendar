# Anime Weekly Calendar

Una aplicación de calendario semanal para anime que muestra los horarios de emisión de anime de la temporada actual, con conversión automática de zona horaria JST a tu hora local.

## Características

- 📅 **Vista de calendario semanal** con FullCalendar
- 🔍 **Búsqueda de anime** utilizando la API de Jikan (MyAnimeList)
- 🌐 **Conversión de zona horaria** de JST a tu hora local
- 💾 **Persistencia local** usando localStorage
- 🎨 **Diseño minimalista** con Tailwind CSS
- 🖼️ **Popover con detalles** al hacer hover sobre los eventos

## Tecnologías

- **React 18** + **TypeScript**
- **Vite** - Build tool
- **FullCalendar** - Calendario interactivo
- **Luxon** - Manejo de zonas horarias
- **Tailwind CSS** - Estilos
- **shadcn/ui** - Componentes UI
- **Jikan API v4** - Datos de anime (sin autenticación requerida)

## Instalación

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Build para producción
npm run build
```

## Uso

1. **Inicio**: Al abrir la aplicación, verás un mensaje de bienvenida y una sidebar con anime de la temporada actual.

2. **Buscar anime**:
   - Usa la barra de búsqueda en la sidebar
   - Los resultados se actualizan automáticamente después de 300ms (debounce)
   - Muestra solo anime actualmente en emisión con horarios de transmisión

3. **Agregar anime al calendario**:
   - Haz clic en el botón "Add" de cualquier anime
   - El anime aparecerá en el calendario en su horario convertido a tu zona horaria local
   - Los datos se guardan automáticamente en localStorage

4. **Ver detalles**:
   - Haz hover sobre cualquier evento en el calendario
   - Aparecerá un popover con imagen grande, sinopsis y enlace a MyAnimeList

5. **Eliminar anime**:
   - Haz clic en el botón "Added" de un anime ya agregado para eliminarlo

## Estructura del Proyecto

```
animeCalendar/
├── src/
│   ├── components/
│   │   ├── ui/              # Componentes shadcn/ui
│   │   ├── calendar/        # Componentes del calendario
│   │   │   ├── CalendarView.tsx
│   │   │   ├── AnimeEvent.tsx
│   │   │   └── AnimeEventPopover.tsx
│   │   └── sidebar/         # Componentes de la sidebar
│   │       ├── Sidebar.tsx
│   │       ├── SearchBar.tsx
│   │       └── AnimeCard.tsx
│   ├── hooks/               # React hooks personalizados
│   │   ├── useSeasonalAnime.ts
│   │   ├── useSelectedAnime.ts
│   │   └── useAnimeData.ts
│   ├── lib/
│   │   ├── api/jikan.ts     # Cliente de Jikan API con rate limiting
│   │   ├── utils/parser.ts  # Parser de strings de broadcast
│   │   ├── utils/timezone.ts # Conversión de zonas horarias
│   │   └── storage/localStorage.ts
│   ├── types/               # Definiciones de TypeScript
│   └── App.tsx              # Componente principal
```

## Características Técnicas

### Rate Limiting
La API de Jikan tiene un límite de 2 requests/segundo. El cliente implementa:
- Rate limiting automático (500ms entre requests)
- Cache de 10 minutos
- Manejo de errores

### Conversión de Zona Horaria
- Los horarios de broadcast vienen en JST (Japan Standard Time)
- Se convierten automáticamente a la zona horaria local del usuario
- Usa Luxon para manejo preciso de fechas y zonas horarias

### Persistencia
- Los anime seleccionados se guardan en localStorage
- Key: `anime-calendar:selected`
- Formato: Array de IDs numéricos

## Notas de Desarrollo

### TypeScript
El proyecto usa `verbatimModuleSyntax: true`, lo que requiere:
- Usar `import type` para importar tipos
- Imports explícitos de tipos en lugar de imports mixtos

### FullCalendar v6
- Los estilos están incluidos automáticamente en los componentes
- No se requiere importar CSS separado
- Usa el wrapper oficial `@fullcalendar/react`

### API de Jikan
- **Endpoint de temporada**: `GET /seasons/now`
- **Búsqueda**: `GET /anime?q={query}&status=airing`
- No requiere autenticación
- Filtrado: Solo anime con `broadcast.string` definido

## Servidor de Desarrollo

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

## Build de Producción

```bash
npm run build
```

Los archivos compilados estarán en el directorio `dist/`.

## Próximas Mejoras Posibles

- [ ] Agregar filtros por género/tipo
- [ ] Vista de calendario mensual
- [ ] Notificaciones de próximos estrenos
- [ ] Exportar calendario a .ics
- [ ] Sincronización entre dispositivos
- [ ] Modo oscuro
- [ ] Responsive design para móviles

## Licencia

MIT
