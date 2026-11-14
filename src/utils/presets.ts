import { GradientConfig } from '../types';

export interface BackgroundPreset {
  id: string;
  name: string;
  gradient: string;
  previewColor: string;
  accent: string;
  gradientConfig?: GradientConfig;
}

export const QUICK_COLOR_SWATCHES: string[] = [
  '#ffffff',
  '#050508',
  '#ec4899', // Rose vif
  '#f472b6', // Rose pastel
  '#8b5cf6', // Violet
  '#4c1d95', // Pourpre sombre
  '#6366f1', // Indigo
  '#38bdf8', // Cyan
  '#10b981', // Émeraude
  '#fbbf24', // Doré
  '#fb7185', // Corail
  '#ef4444', // Rouge cinéma
];

export const GRADIENT_PRESETS: Array<{ id: string; name: string; gradient: GradientConfig }> = [
  {
    id: 'velvet-purple',
    name: 'Velours Pourpre',
    gradient: { colors: ['#2e1065', '#7e22ce', '#ec4899'], angle: 135, animated: true, animationSpeed: 1 },
  },
  {
    id: 'neon-rose',
    name: 'Rose Néon',
    gradient: { colors: ['#f472b6', '#a855f7', '#6366f1'], angle: 120, animated: true, animationSpeed: 1 },
  },
  {
    id: 'aurora',
    name: 'Aurore Boréale',
    gradient: { colors: ['#042f2e', '#0d9488', '#6366f1'], angle: 150, animated: true, animationSpeed: 1 },
  },
  {
    id: 'sunset-film',
    name: 'Coucher de Soleil',
    gradient: { colors: ['#7c2d12', '#db2777', '#4c1d95'], angle: 145, animated: false, animationSpeed: 1 },
  },
  {
    id: 'gold-obsidian',
    name: 'Or & Obsidienne',
    gradient: { colors: ['#fbbf24', '#f59e0b', '#fef3c7'], angle: 90, animated: false, animationSpeed: 1 },
  },
  {
    id: 'cyber-ocean',
    name: 'Océan Cyber',
    gradient: { colors: ['#090d16', '#1e3a8a', '#06b6d4'], angle: 165, animated: true, animationSpeed: 1 },
  },
];

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'deep-space',
    name: 'Espace Profond',
    gradient: 'linear-gradient(180deg, #050508 0%, #14163b 50%, #020204 100%)',
    previewColor: '#0a0b16',
    accent: '#6366f1',
    gradientConfig: { colors: ['#050508', '#14163b', '#020204'], angle: 180, animated: false, animationSpeed: 1 },
  },
  {
    id: 'velvet-violet',
    name: 'Nuit Pourpre',
    gradient: 'linear-gradient(135deg, #1e0b36 0%, #581c87 50%, #11051f 100%)',
    previewColor: '#2e1065',
    accent: '#c084fc',
    gradientConfig: { colors: ['#1e0b36', '#581c87', '#11051f'], angle: 135, animated: false, animationSpeed: 1 },
  },
  {
    id: 'cyber-neon',
    name: 'Néon Rose',
    gradient: 'linear-gradient(135deg, #1b0529 0%, #701a75 50%, #090314 100%)',
    previewColor: '#3b0764',
    accent: '#ec4899',
    gradientConfig: { colors: ['#1b0529', '#701a75', '#090314'], angle: 135, animated: true, animationSpeed: 1 },
  },
  {
    id: 'golden-noir',
    name: 'Noir & Or',
    gradient: 'linear-gradient(180deg, #120f0a 0%, #2d1f0d 50%, #0a0805 100%)',
    previewColor: '#17120a',
    accent: '#d97706',
    gradientConfig: { colors: ['#120f0a', '#2d1f0d', '#0a0805'], angle: 180, animated: false, animationSpeed: 1 },
  },
  {
    id: 'emerald-cinematic',
    name: 'Émeraude 35mm',
    gradient: 'linear-gradient(180deg, #030d0a 0%, #0a2e23 50%, #020705 100%)',
    previewColor: '#061611',
    accent: '#10b981',
    gradientConfig: { colors: ['#030d0a', '#0a2e23', '#020705'], angle: 180, animated: false, animationSpeed: 1 },
  },
  {
    id: 'pure-black',
    name: 'Noir Pur',
    gradient: 'linear-gradient(180deg, #000000 0%, #000000 100%)',
    previewColor: '#000000',
    accent: '#ffffff',
  },
];

export interface FontOption {
  id: string;
  name: string;
  family: string;
  category: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { id: 'cinzel', name: 'Cinzel', family: 'Cinzel', category: 'Cinéma classique' },
  { id: 'montserrat', name: 'Montserrat', family: 'Montserrat', category: 'Moderne fort' },
  { id: 'bebas', name: 'Bebas Neue', family: 'Bebas Neue', category: 'Titres percutants' },
  { id: 'playfair', name: 'Playfair', family: 'Playfair Display', category: 'Élégant & Roman' },
  { id: 'courier', name: 'Courier', family: 'Courier Prime', category: 'Scénario & Script' },
  { id: 'space', name: 'Space Grotesk', family: 'Space Grotesk', category: 'Futuriste' },
  { id: 'inter', name: 'Inter', family: 'Inter', category: 'Neutre & Minimal' },
];

export interface TextPresetTemplate {
  id: string;
  name: string;
  text: string;
}

export const CREDIT_TEMPLATES: TextPresetTemplate[] = [
  {
    id: 'film-cinema',
    name: 'Cinéma Long-Métrage',
    text: `# LES OMBRES DU DESTIN

UN FILM DE
Jean-Luc Vasseur

SCÉNARIO & DIALOGUES
Sophie Bernard
Marc Delorme

DISTRIBUTION
La Détective : Camille Laurent
Le Fugitif : Antoine Moreau
Le Témoin : Sarah Benali
L'Inspecteur : Thomas Roux

IMAGE & LUMIÈRE
Directeur de la photographie : Paul Éluard
Cadreur : Lucas Martin
Étalonneur : Julien Perrot

SON & MUSIQUE
Compositeur : Gabriel Fauré
Ingénieur du son : Élodie Faure
Mixage audio : Studio Horizon

EFFETS SPÉCIAUX
Superviseur VFX : David Cohen
Artistes 3D : Studio Apex

PRODUCTION
Producteur délégué : Pierre Valois
Production exécutive : Nova Films Paris

TOURNÉ EN 35MM
PARIS & NORMANDIE

FIN`,
  },
  {
    id: 'youtube-creator',
    name: 'Créateur Vidéo / Vlog',
    text: `# EXPLORATION SAUVAGE
Épisode 42

RÉALISÉ PAR
Alexandre Studio

IMAGES DRONE & 4K
Alexandre & Léa

MONTAGE & ÉTALONNAGE
Alexandre Studio

MUSIQUE ORIGINALE
Par Neon Wave Music

REMERCIEMENTS
Parc National des Écrins
La communauté Discord
Tous les contributeurs Patreon

ABONNEZ-VOUS & ACTIVEZ LA CLOCHE
À la semaine prochaine !`,
  },
  {
    id: 'music-clip',
    name: 'Clip Musical',
    text: `# ECLIPSE TOTALE
Artiste : NOVA SOUND

Réalisatrice : Clara Diaz
Producteur : Velvet Music
Chef Opérateur : Romain Blanc

Stylisme : Atelier Marais
Chorégraphie : Maya Chen
Danseurs : Maya, Lucas, Tariq

Enregistré à Paris
Tous droits réservés 2026`,
  },
];
