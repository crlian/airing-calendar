# Plan SEO y Crecimiento - AniSeason

## Estado Actual

### Problema Principal
AniSeason es una **SPA (Single Page Application)** sin Server-Side Rendering (SSR) ni rutas dinámicas. Google no puede indexar contenido individual de anime porque:

1. Todo el contenido se carga vía JavaScript después del montaje
2. No hay URLs únicas por anime (`/anime/solo-leveling-123`)
3. Los meta tags son estáticos para toda la aplicación
4. No hay sitemap.xml ni structured data

### Resultado
- **Tráfico orgánico**: 0 búsquedas específicas de anime llegan a tu sitio
- **Solo puedes ser encontrado** por búsquedas genéricas: "anime calendar", "anime schedule"
- **Jonathan (tu único usuario)** te encontró probablemente por redes sociales o referido directo

---

## FASE 1: Fundamentos SEO Técnicos (Semana 1)

### 1.1 Implementar Rutas Dinámicas por Anime

**Objetivo**: Crear URLs únicas y compartibles para cada anime.

**Implementación**:
```typescript
// src/App.tsx - Agregar router para rutas dinámicas
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';

// Componente de página individual de anime
function AnimePage() {
  const { animeId, slug } = useParams();
  
  // Cargar datos del anime
  // Renderizar meta tags dinámicos con react-helmet-async
  // Mostrar información detallada del anime
}

// Rutas:
// /anime/:id/:slug -> Página individual (ej: /anime/52991/solo-leveling)
// /season/:season/:year -> Página de temporada (ej: /season/winter/2026)
```

**Meta Tags Dinámicos**:
```html
<title>{animeTitle} - {day} at {time} {timezone} | AniSeason Calendar</title>
<meta name="description" content="{animeTitle} airs {day}s at {time} in your timezone. Track {animeTitle} and other seasonal anime with AniSeason's weekly calendar." />
<meta property="og:title" content="{animeTitle} - Weekly Schedule | AniSeason" />
<meta property="og:image" content="{animeImage}" />
```

### 1.2 Sitemap.xml Dinámico

**Objetivo**: Ayudar a Google a descubrir todas las páginas indexables.

**Implementación**:
```typescript
// scripts/generate-sitemap.ts
import { anilistClient } from '../src/lib/api/anilist';

async function generateSitemap() {
  // Obtener anime de la temporada actual
  const seasonalAnime = await anilistClient.getSeasonNow(1);
  
  const urls = seasonalAnime.data.map(anime => ({
    loc: `https://aniseason.com/anime/${anime.mal_id}/${slugify(anime.title)}`,
    lastmod: new Date().toISOString(),
    changefreq: 'daily',
    priority: 0.8,
  }));
  
  // Agregar páginas estáticas
  urls.unshift(
    { loc: 'https://aniseason.com/', priority: 1.0 },
    { loc: 'https://aniseason.com/season/winter-2026', priority: 0.9 },
    { loc: 'https://aniseason.com/season/spring-2026', priority: 0.9 }
  );
  
  // Generar XML y guardar en public/sitemap.xml
}
```

**Automatización**:
- Ejecutar `npm run generate-sitemap` en build
- Programar actualización diaria via GitHub Actions o Vercel Cron

### 1.3 Structured Data (Schema.org)

**Objetivo**: Dar contexto semántico a Google para rich snippets.

**Implementación en cada página de anime**:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "TVSeries",
  "name": "Solo Leveling",
  "image": "https://aniseason.com/images/anime-52991.jpg",
  "description": "In a world where hunters...",
  "numberOfEpisodes": 12,
  "episode": {
    "@type": "TVEpisode",
    "episodeNumber": 5,
    "airDate": "2026-01-30T17:30:00-08:00"
  },
  "broadcastSchedule": {
    "@type": "Schedule",
    "repeatFrequency": "P7D",
    "byDay": "Thursday",
    "startTime": "17:30:00",
    "scheduleTimezone": "America/Los_Angeles"
  }
}
</script>
```

**Beneficio**: Google puede mostrar horarios directamente en resultados de búsqueda.

### 1.4 Robots.txt y Canonical URLs

**Implementación**:
```
# public/robots.txt
User-agent: *
Allow: /

Sitemap: https://aniseason.com/sitemap.xml

# No indexar páginas de error o búsquedas
Disallow: /api/
Disallow: /*?search=
```

**Canonical dinámico**: Asegurar que `/anime/123/title` y `/anime/123` apunten al mismo canonical.

---

## FASE 2: Contenido Indexable (Semana 2)

### 2.1 Páginas de Temporada Estáticas

**Objetivo**: Capturar búsquedas tipo "winter 2026 anime schedule", "anime january 2026".

**URLs a crear**:
- `/season/winter-2026`
- `/season/spring-2026`
- `/season/summer-2026`
- `/season/fall-2026`
- `/season/winter-2026/action` (filtrado por género)

**Contenido por página**:
- Lista completa de anime de la temporada
- Calendario visual semanal
- Filtros por día: "Anime airing on Thursdays"
- Metadata SEO específica:
  ```html
  <title>Winter 2026 Anime Schedule - Weekly Calendar | AniSeason</title>
  <meta name="description" content="Complete Winter 2026 anime airing schedule with exact times in your timezone. Track 50+ new series including Solo Leveling, Dr. Stone, and more." />
  ```

### 2.2 Páginas por Día de Emisión

**Objetivo**: Capturar búsquedas tipo "anime airing on thursday", "thursday anime schedule".

**URLs**:
- `/schedule/monday`
- `/schedule/tuesday`
- `/schedule/wednesday`
- `/schedule/thursday` (¡muy buscado!)
- `/schedule/friday`

### 2.3 Blog/Guía Minimalista

**Objetivo**: Contenido evergreen que atraiga tráfico educativo.

**Posts sugeridos**:
1. "How to Track Anime Air Times in Your Timezone"
2. "Understanding JST to Local Time Conversion"
3. "Winter 2026 Anime You Can't Miss" (curated list)
4. "How Anime Broadcast Schedules Work"

**Longitud**: 300-500 palabras, directo al punto.

---

## FASE 3: Performance y Core Web Vitals

### 3.1 Optimizaciones Críticas

**Largest Contentful Paint (LCP)**:
- Lazy load de imágenes de anime (intersection observer)
- Priorizar carga de anime en el viewport
- Usar `fetchpriority="high"` en imágenes visibles

**Cumulative Layout Shift (CLS)**:
- Reservar espacio para imágenes antes de cargar (`aspect-ratio`)
- Evitar layout jumps al cargar el calendario

**First Input Delay (FID)**:
- Dividir bundles de JavaScript
- Code-splitting por ruta
- Cargar FullCalendar solo cuando se necesite

### 3.2 Optimización de Imágenes

**Implementación**:
```typescript
// Usar AniList CDN con tamaños optimizados
const animeImage = anime.images.webp?.large_image_url || 
                   anime.images.jpg?.large_image_url;

// En componente:
<img 
  src={animeImage}
  loading="lazy"
  decoding="async"
  alt={`${anime.title} poster`}
  style={{ aspectRatio: '2/3' }}
/>
```

**Formatos**:
- Priorizar WebP
- Fallback a JPG
- Tamaños: 225x318 (thumbnail), 460x650 (detalle)

---

## FASE 4: Distribución y Adquisición

### 4.1 Reddit (Mayor potencial)

**Comunidades objetivo**:
- r/anime (10M+ miembros)
- r/Animesuggest
- r/animecalendar (si existe)

**Estrategia**:
1. **Post value-first**: "I made a tool to track Winter 2026 anime in your timezone"
2. **Timing**: Lunes o martes cuando empieza la semana de anime
3. **Contenido**: Screenshot del calendario + link
4. **Comentario inicial**: Explicar problema que resuelve, no features

**No hacer**:
- Spam en múltiples threads
- Language hype/marketing
- Postear en días de mucho tráfico (sábados)

### 4.2 MyAnimeList (MAL)

**Oportunidades**:
- Foros de "Anime Discussion" por temporada
- Clubes de calendarios/schedules
- Comentarios en páginas de anime populares (no spam)

### 4.3 Discord Communities

**Servers objetivo**:
- Servidores grandes de anime (anime servers con 10k+ miembros)
- Canales de #recommendations o #tools
- Preguntar permiso a mods antes de postear

### 4.4 Twitter/X (Estrategia de Contenido)

**Framework de posts (usando skill cargado)**:

**Tipo 1: Observación personal**
```
Spent 2 weeks building a small anime calendar because I kept missing episode drops.
Only got 1 user so far but he's given me 4 detailed bug reports.
Honestly, better than 100 passive users.
```

**Tipo 2: Aprendizaje técnico**
```
TIL: Converting JST to local timezones is surprisingly hard because anime broadcast strings are inconsistent.
Some say "Thursdays at 01:00 JST", others "Wednesday at 24:30 JST" (same thing).
Made a parser that handles both. Probably over-engineered it.
```

**Tipo 3: Progreso honesto**
```
Added watch time tracking to the anime calendar today.
User immediately reported 4 schedule errors with sources.
This is why you ship early and listen.
```

**Frecuencia**: 3-4 tweets por semana, variando tipos.

### 4.5 SEO de YouTube (Opcional)

**Idea**: Screencast de 60 segundos mostrando el producto.
- Título: "How I Track 20+ Anime Weekly (Simple Calendar Tool)"
- Descripción: Link a aniseason.com
- Tags: anime calendar, anime schedule tracker, seasonal anime

---

## FASE 5: Retención y Engagement

### 5.1 Analytics Mejorados

**Setup actual**:
- Vercel Analytics: OK
- Tracker.js: OK (notificaciones Telegram)

**Mejoras**:
- Agregar Google Analytics 4 para tracking de eventos
- Trackear: "anime agregado", "calendario visto", "búsqueda realizada"
- Identificar funnels de conversión

### 5.2 Mecanismo de Retorno

**Problema**: Usuarios olvidan volver.

**Soluciones**:
1. **Browser notifications**: "Solo Leveling starts in 30 minutes"
2. **PWA**: Installable, enviar push notifications
3. **Email reminders**: Opcional, semanal con próximos estrenos

### 5.3 Feature de "Share Schedule"

**Implementación**:
- Botón "Copy schedule link" con URL única hash-based
- `/share/:hash` que cargue el calendario del usuario
- Permite compartir selección personal con amigos

---

## Priorización por Impacto/Esfuerzo

### Alto Impacto, Bajo Esfuerzo (Hacer primero)
1. ✅ Sitemap.xml dinámico (2 horas)
2. ✅ Robots.txt (15 minutos)
3. ✅ Meta tags dinámicos básicos (2 horas)
4. ✅ Páginas de temporada (/winter-2026) (3 horas)

### Alto Impacto, Alto Esfuerzo (Planificar)
5. Rutas dinámicas por anime con SSR/SSG (8-12 horas)
6. Structured data Schema.org (2 horas)
7. Blog posts evergreen (4 horas cada uno)

### Bajo Impacto, Bajo Esfuerzo (Hacer si hay tiempo)
8. Páginas por día de emisión (/schedule/thursday)
9. Optimización de imágenes
10. Performance tweaks

### Experimentos (Validar después)
11. Reddit posts (medir tráfico referido)
12. Twitter threads (medir engagement)
13. Discord outreach

---

## Métricas de Éxito

### Corto plazo (2-4 semanas)
- [ ] Google indexa >50 páginas de anime
- [ ] Aparición en búsquedas: "{anime name} schedule"
- [ ] Tráfico orgánico: 10-50 visitas/día
- [ ] 1-3 usuarios activos semanales

### Medio plazo (2-3 meses)
- [ ] Tráfico orgánico: 100-500 visitas/día
- [ ] Ranking para "anime calendar" en top 20
- [ ] 10-50 usuarios activos semanales
- [ ] 1-5 menciones orgánicas en redes

### Largo plazo (6-12 meses)
- [ ] Tráfico orgánico: 1000+ visitas/día
- [ ] Top 10 para keywords principales
- [ ] 100+ usuarios activos
- [ ] Considerar monetización ligera (ads no-invasivos)

---

## Herramientas Recomendadas

### SEO
- **Google Search Console**: Monitorear indexación y queries
- **Ahrefs/SEMrush** (gratuito): Research de keywords
- **Screaming Frog**: Audit técnico
- **PageSpeed Insights**: Core Web Vitals

### Analytics
- **Google Analytics 4**: Event tracking
- **Vercel Analytics**: Performance real
- **Plausible** (alternativa privada): Simple analytics

### Desarrollo
- **Next.js** (migración futura): SSR/SSG nativo
- **React Helmet Async**: Meta tags dinámicos
- **React Router v6**: Rutas dinámicas

---

## Checklist de Implementación

### Semana 1: Fundamentos
- [ ] Instalar react-router-dom y react-helmet-async
- [ ] Crear componente AnimePage con meta tags dinámicos
- [ ] Crear script generate-sitemap.ts
- [ ] Agregar robots.txt
- [ ] Configurar Google Search Console
- [ ] Verificar indexación con `site:aniseason.com`

### Semana 2: Contenido
- [ ] Crear páginas de temporada (/season/winter-2026)
- [ ] Agregar Schema.org structured data
- [ ] Optimizar imágenes (lazy loading, WebP)
- [ ] Crear primera guía/blog post

### Semana 3: Distribución
- [ ] Post en r/anime (value-first)
- [ ] 3-4 tweets usando frameworks
- [ ] Unirse a 3 Discord servers relevantes
- [ ] Comentario constructivo en MAL forums

### Semana 4: Iteración
- [ ] Analizar métricas de Search Console
- [ ] Ajustar meta tags según performance
- [ ] Planear Fase 2 basado en datos

---

## Notas Finales

### Lo que NO hacer
- ❌ Comprar backlinks
- ❌ Keyword stuffing
- ❌ Cloaking o contenido oculto
- ❌ Spam en comunidades
- ❌ Hype/marketing language
- ❌ Rendirse antes de 3 meses

### Lo que SÍ hacer
- ✅ Focarse en resolver el problema real (tracking de anime)
- ✅ Priorizar contenido útil sobre trucos SEO
- ✅ Escuchar feedback de usuarios como Jonathan
- ✅ Medir todo antes de optimizar
- ✅ Ser paciente (SEO toma 3-6 meses)

### Recordatorio importante
Un producto que ayuda a 1 persona (Jonathan) es mejor que uno que no ayuda a nadie. El objetivo no es volverse viral, es **encontrar más personas como Jonathan** que tengan el mismo problema.

El SEO te ayuda a ser encontrado por esas personas cuando buscan activamente una solución.

---

*Última actualización: 30 de Enero 2026*
*Próxima revisión: 27 de Febrero 2026*
