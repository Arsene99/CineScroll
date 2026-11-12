export interface BackgroundPreset {
  id: string;
  name: string;
  gradient: string;
  previewColor: string;
  accent: string;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'deep-space',
    name: 'Espace Profond',
    gradient: 'linear-gradient(180deg, #050508 0%, #0c0d1b 50%, #020204 100%)',
    previewColor: '#0a0b16',
    accent: '#6366f1',
  },
  {
    id: 'golden-noir',
    name: 'Noir & Or',
    gradient: 'linear-gradient(180deg, #120f0a 0%, #1c150c 50%, #0a0805 100%)',
    previewColor: '#17120a',
    accent: '#d97706',
  },
  {
    id: 'cyber-neon',
    name: 'Cyberpunk',
    gradient: 'linear-gradient(180deg, #090314 0%, #19082d 50%, #05010b 100%)',
    previewColor: '#120521',
    accent: '#ec4899',
  },
  {
    id: 'emerald-cinematic',
    name: 'Émeraude 35mm',
    gradient: 'linear-gradient(180deg, #030d0a 0%, #091c16 50%, #020705 100%)',
    previewColor: '#061611',
    accent: '#10b981',
  },
  {
    id: 'minimal-slate',
    name: 'Studio Ardoise',
    gradient: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #020617 100%)',
    previewColor: '#141d2e',
    accent: '#38bdf8',
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
