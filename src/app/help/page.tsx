import { listProjects } from "@/lib/projects";
import { getUser } from "@/lib/supabase/auth";
import AppLayout from "@/components/AppLayout";

export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    id: "crear-proyecto",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
    color: "#5a3bdd",
    title: "Crear un proyecto",
    description: "Dos formas de empezar:",
    items: [
      { title: "Desde una URL", body: "Pega la URL raíz de cualquier sitio web (ej. https://miweb.com). Visual Sitemap detecta automáticamente el sitemap.xml o rastrea los enlaces para construir la estructura." },
      { title: "Desde un sitemap.xml", body: "Sube directamente un archivo sitemap.xml local. Ideal para sitios que no están publicados todavía o que requieren autenticación." },
      { title: "Nombre del proyecto", body: "Puedes personalizar el nombre del proyecto en cualquier momento desde la cabecera del editor." },
    ],
  },
  {
    id: "canvas",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
    color: "#7c5cf5",
    title: "Canvas interactivo",
    description: "El corazón de la herramienta. Un mapa visual de todas las páginas de tu sitio.",
    items: [
      { title: "Zoom y paneo", body: "Usa la rueda del ratón para hacer zoom y arrastra el fondo para moverte por el mapa. Los controles de zoom también aparecen en la esquina inferior izquierda." },
      { title: "Jerarquía automática", body: "Las páginas se organizan en árbol según su profundidad de URL. Puedes cambiar la dirección (vertical u horizontal) y el punto de quiebre desde el panel de ajustes." },
      { title: "Arrastrar nodos", body: "Mueve cualquier tarjeta de página libremente dentro del canvas. Las posiciones se guardan automáticamente." },
      { title: "Doble clic para editar", body: "Haz doble clic sobre el título de cualquier tarjeta para renombrarlo sin cambiar la URL real." },
      { title: "Clic derecho", body: "Menú contextual sobre cualquier tarjeta para añadir etiquetas o eliminar la página del mapa." },
      { title: "Añadir nodos personalizados", body: "Desde los ajustes puedes añadir tarjetas libres (sin URL de sitemap) para representar secciones pendientes o externas." },
    ],
  },
  {
    id: "screenshots",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    ),
    color: "#059669",
    title: "Screenshots automáticos",
    description: "Visual Sitemap captura una imagen de cada página de tu sitio.",
    items: [
      { title: "Captura inicial", body: "Al crear el proyecto puedes lanzar la captura de todas las páginas a la vez. El proceso corre en segundo plano y las imágenes aparecen progresivamente en el mapa." },
      { title: "Recapturar una página", body: "Abre el panel lateral de cualquier tarjeta (clic en la tarjeta) y pulsa «Recapturar» para actualizar solo esa página." },
      { title: "Recapturar todo", body: "Desde el menú de ajustes del canvas puedes lanzar una recaptura completa del proyecto." },
      { title: "Imagen personalizada", body: "Arrastra cualquier imagen desde tu ordenador directamente sobre una tarjeta o sobre el panel lateral para sustituir el screenshot automático por uno propio." },
      { title: "Thumbnail del proyecto", body: "La imagen de la página de inicio (/) se usa automáticamente como miniatura del proyecto en el dashboard. También puedes arrastrar una imagen directamente sobre la card del proyecto." },
    ],
  },
  {
    id: "seo-a11y",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: "#d97706",
    title: "Auditoría SEO y accesibilidad",
    description: "Cada página analizada recibe dos puntuaciones del 0 al 10.",
    items: [
      { title: "Puntuación SEO", body: "Evalúa: longitud del título y meta descripción, presencia de H1, Open Graph (título, descripción, imagen), canonical, imágenes sin alt, recuento de palabras y más. Aparece como badge verde/ámbar/rojo en la esquina de cada tarjeta." },
      { title: "Puntuación de accesibilidad (A11y)", body: "Analiza: imágenes sin alt, botones sin etiqueta, inputs sin label, idioma de la página, orden de headings, contraste, falta de landmark principal, elementos con autoplay y más." },
      { title: "Detalle en el panel lateral", body: "Al abrir el panel lateral de una página puedes ver el desglose completo de la puntuación SEO y A11y con cada criterio individual." },
      { title: "Informe PDF", body: "El informe exportable incluye las puntuaciones de todas las páginas junto con un resumen de páginas con issues en la portada." },
    ],
  },
  {
    id: "estados",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
      </svg>
    ),
    color: "#22c55e",
    title: "Estados de página",
    description: "Lleva el seguimiento del estado de revisión de cada página.",
    items: [
      { title: "4 estados disponibles", body: "Borrador (gris) · En revisión (ámbar) · Aprobado (verde) · Requiere cambios (rojo). El estado se muestra como badge en la tarjeta y tiñe el borde de la card con el color correspondiente." },
      { title: "Cambiar el estado", body: "Abre el panel lateral de cualquier página y usa los botones de estado en la sección superior. También puedes eliminar el estado pulsando «Sin estado»." },
      { title: "Filtrar por estado", body: "En el menú de ajustes del canvas encontrarás un filtro de estado que oculta las páginas que no coincidan, facilitando las revisiones por fases." },
    ],
  },
  {
    id: "anotaciones",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    ),
    color: "#ef4444",
    title: "Anotaciones",
    description: "Añade comentarios contextuales a cualquier página.",
    items: [
      { title: "Tipos de anotación", body: "Error (rojo): algo roto o incorrecto. Mejora (ámbar): propuesta de cambio. Nota (morado): información general o recordatorio." },
      { title: "Cómo añadir", body: "Abre el panel lateral de la página y escribe en el campo de anotaciones. Las anotaciones aparecen listadas bajo el screenshot con su tipo coloreado." },
      { title: "En el informe PDF", body: "Todas las anotaciones de cada página aparecen en las cards del informe exportado, junto con el conteo total en la portada." },
    ],
  },
  {
    id: "etiquetas",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
      </svg>
    ),
    color: "#0ea5e9",
    title: "Etiquetas",
    description: "Clasifica páginas con etiquetas de color personalizadas.",
    items: [
      { title: "Crear etiquetas", body: "Desde el panel de ajustes del canvas puedes crear etiquetas con nombre y color personalizado (ej. «Landing», «Blog», «Error 404»)." },
      { title: "Asignar etiquetas", body: "Haz clic derecho sobre cualquier tarjeta de página para abrir el menú contextual y marcar o desmarcar etiquetas." },
      { title: "Visualización", body: "Las etiquetas aparecen como chips de color bajo el título de cada tarjeta. Si hay más de 3 se muestra un contador «+N»." },
    ],
  },
  {
    id: "dibujo",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
    color: "#ec4899",
    title: "Panel de dibujo",
    description: "Superpón anotaciones visuales directamente sobre el screenshot de una página.",
    items: [
      { title: "Abrir el panel", body: "En el panel lateral de cualquier página, pulsa el botón «Dibujar» o el icono de lápiz para abrir el canvas de dibujo a pantalla completa." },
      { title: "Herramientas", body: "Lápiz libre, marcador, borrador y selector de color. Útil para marcar áreas problemáticas, proponer cambios de layout o anotar wireframes." },
      { title: "Guardado automático", body: "El dibujo se guarda como imagen transparente (PNG) superpuesta al screenshot. Puedes borrarlo y volver a dibujar en cualquier momento." },
    ],
  },
  {
    id: "compartir",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
    ),
    color: "#5a3bdd",
    title: "Compartir sitemap",
    description: "Genera un enlace público de solo lectura para tu sitemap.",
    items: [
      { title: "Activar compartir", body: "En el menú de ajustes del canvas, activa «Compartir sitemap». Se genera un enlace único del tipo /share/[token]." },
      { title: "Copiar enlace", body: "Pulsa el botón de copiar para llevar el enlace al portapapeles y enviárselo a clientes o colaboradores." },
      { title: "Vista de solo lectura", body: "Los visitantes ven el mapa completo con screenshots, estados y etiquetas pero no pueden editar nada. La vista incluye el nombre y dominio del proyecto y un header identificativo." },
      { title: "Desactivar compartir", body: "Vuelve a pulsar el botón en ajustes para revocar el token. El enlace anterior dejará de funcionar inmediatamente." },
    ],
  },
  {
    id: "pdf",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
    ),
    color: "#d97706",
    title: "Exportar a PDF",
    description: "Genera un informe profesional listo para imprimir o enviar.",
    items: [
      { title: "Cómo exportar", body: "En el menú de ajustes del canvas, pulsa «Exportar como PDF». Se abre una nueva pestaña con el informe renderizado." },
      { title: "Portada", body: "La portada incluye el nombre del proyecto, dominio, fecha de generación y cuatro métricas: páginas analizadas, páginas aprobadas, páginas con issues y total de anotaciones." },
      { title: "Grid de páginas", body: "Cada página aparece en una card con: screenshot, título, URL, estado, puntuaciones SEO y A11y, etiquetas y todas sus anotaciones." },
      { title: "Guardar como PDF", body: "En la pestaña del informe pulsa «Imprimir / Guardar PDF» y en el diálogo del navegador selecciona «Guardar como PDF». El formato es A4 optimizado para impresión." },
    ],
  },
  {
    id: "organizacion",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
    color: "#6b7072",
    title: "Organizar proyectos",
    description: "Gestiona tus proyectos desde el dashboard.",
    items: [
      { title: "Favoritos", body: "Pulsa la estrella en cualquier card de proyecto para marcarlo como favorito y acceder rápidamente desde el panel lateral o la vista «Favoritos»." },
      { title: "Archivar", body: "Desde el menú de la card (tres puntos) puedes archivar proyectos que ya no están activos. Se mueven a la vista «Archivo» sin eliminarse." },
      { title: "Eliminar", body: "También desde el menú de la card. La eliminación es permanente e irreversible." },
      { title: "Thumbnail", body: "Arrastra una imagen sobre cualquier card del dashboard para actualizarla como miniatura del proyecto." },
    ],
  },
];

export default async function HelpPage() {
  const user = await getUser();
  const allProjects = await listProjects();
  const projects = user ? allProjects.filter((p) => p.userId === user.id) : allProjects;

  return (
    <AppLayout projects={projects} userEmail={user?.email}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: "linear-gradient(135deg, #5a3bdd 0%, #7c5cf5 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 16px rgba(90,59,221,0.3)",
            }}>
              <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ec-on-surface,#1a1c1e)", letterSpacing: "-0.02em" }}>
                Centro de ayuda
              </h1>
              <p style={{ fontSize: 13, color: "var(--ec-on-surface-variant,#6b7072)", marginTop: 2 }}>
                Todo lo que puedes hacer con Visual Sitemap
              </p>
            </div>
          </div>
        </div>

        {/* Quick nav */}
        <div style={{
          background: "#fff",
          border: "1px solid var(--ec-surface-container-high,#e5e7eb)",
          borderRadius: 16, padding: "18px 20px", marginBottom: 28,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ec-on-surface-variant,#6b7072)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
            Ir a sección
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 9999,
                  fontSize: 12, fontWeight: 600, textDecoration: "none",
                  background: `${s.color}12`, color: s.color,
                  border: `1px solid ${s.color}30`,
                  transition: "all 0.15s",
                }}
              >
                {s.icon}
                {s.title}
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {SECTIONS.map((section) => (
            <div
              key={section.id}
              id={section.id}
              style={{
                background: "#fff",
                border: "1px solid var(--ec-surface-container-high,#e5e7eb)",
                borderRadius: 20, overflow: "hidden",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              {/* Section header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "18px 24px",
                borderBottom: "1px solid var(--ec-surface-container-high,#f3f4f6)",
                background: `${section.color}08`,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: `${section.color}18`, color: section.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {section.icon}
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ec-on-surface,#1a1c1e)", marginBottom: 2 }}>
                    {section.title}
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--ec-on-surface-variant,#6b7072)" }}>
                    {section.description}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div style={{ padding: "6px 0" }}>
                {section.items.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 14,
                      padding: "14px 24px",
                      borderBottom: i < section.items.length - 1
                        ? "1px solid var(--ec-surface-container-high,#f9fafb)"
                        : "none",
                    }}
                  >
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: section.color, flexShrink: 0, marginTop: 7,
                    }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ec-on-surface,#1a1c1e)", marginBottom: 3 }}>
                        {item.title}
                      </p>
                      <p style={{ fontSize: 13, color: "var(--ec-on-surface-variant,#6b7072)", lineHeight: 1.6 }}>
                        {item.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          textAlign: "center", padding: "40px 0 20px",
          color: "var(--ec-on-surface-variant,#6b7072)", fontSize: 13,
        }}>
          ¿Algo que no está aquí? Escríbenos y lo añadimos.
        </div>
      </div>
    </AppLayout>
  );
}
