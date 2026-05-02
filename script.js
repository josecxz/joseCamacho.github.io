// Edición orientada a automatización
const DEFAULTS = {
    accentHue: 200, // Cian tecnológico
    starDensity: 3500,
    starTwinkle: true,
    ships: true, // Mantener los "flybys" como paquetes de datos
    shipSpeed: 1.5, // Más rápido para simular eficiencia
    parallax: true,
    scrollAnimations: true,
    hoverGlow: true,
    gridOverlay: true,
};

// ... (Resto del código original de Francisco Granda para el canvas) ...

// Modificación estética: Cambiar los nombres de los elementos en el panel de Tweaks
function applyGlobalTweaks() {
    document.documentElement.style.setProperty('--hue', tweaks.accentHue);
    // Cambiamos el color de fondo a un tono más de "consola de automatización"
    document.documentElement.style.setProperty('--void', 'oklch(0.05 0.01 250)');
    body.classList.toggle('glow-on', !!tweaks.hoverGlow);
}