/**
 * Web Audio API synthesizer for cinematic ambient scores and audio track manager.
 * Self-contained: works offline and in any browser environment without external network latency.
 */

export interface AudioTrackPreset {
  id: string;
  name: string;
  description: string;
  iconName: string;
  bpm: number;
}

export const AUDIO_PRESETS: AudioTrackPreset[] = [
  { id: 'cinema-epic', name: 'Épique Cinéma', description: 'Nappe dramatique orchestrale', iconName: 'Drama', bpm: 72 },
  { id: 'noir-mystery', name: 'Noir Mystère', description: 'Atmosphère sombre & cordes', iconName: 'Compass', bpm: 60 },
  { id: 'retro-synth', name: 'Synthwave 80s', description: 'Basse analogique et arpège', iconName: 'Radio', bpm: 90 },
  { id: 'zen-piano', name: 'Piano & Nappes', description: 'Mélodie douce et contemplative', iconName: 'Sparkles', bpm: 64 },
  { id: 'none', name: 'Muet', description: 'Sans fond sonore', iconName: 'VolumeX', bpm: 0 },
];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private currentPresetId = 'cinema-epic';
  private customAudio: HTMLAudioElement | null = null;
  private customSourceNode: MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private destNode: MediaStreamAudioDestinationNode | null = null;
  private synthTimer: number | null = null;

  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.gainNode = this.ctx.createGain();
      this.destNode = this.ctx.createMediaStreamDestination();
      this.gainNode.connect(this.ctx.destination);
      this.gainNode.connect(this.destNode);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(val: number) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, val)), this.ctx.currentTime);
    }
    if (this.customAudio) {
      this.customAudio.volume = Math.max(0, Math.min(1, val));
    }
  }

  public setPreset(id: string) {
    this.currentPresetId = id;
    if (this.isPlaying) {
      this.stop();
      this.play(0);
    }
  }

  public setCustomAudio(url: string) {
    this.init();
    if (this.customAudio) {
      this.customAudio.pause();
      this.customAudio.src = '';
    }
    this.customAudio = new Audio(url);
    this.customAudio.loop = true;
    if (this.ctx && this.gainNode) {
      try {
        this.customSourceNode = this.ctx.createMediaElementSource(this.customAudio);
        this.customSourceNode.connect(this.gainNode);
      } catch {
        // already connected or fallback
      }
    }
    this.currentPresetId = 'custom';
  }

  public play(startTimeSec = 0) {
    this.init();
    if (!this.ctx) return;
    this.isPlaying = true;

    if (this.currentPresetId === 'custom' && this.customAudio) {
      this.customAudio.currentTime = startTimeSec % (this.customAudio.duration || 100);
      this.customAudio.play().catch(() => {});
      return;
    }

    if (this.currentPresetId === 'none') {
      return;
    }

    // Play synthesized preset sequence
    this.startSynthLoop(this.currentPresetId);
  }

  public pause() {
    this.isPlaying = false;
    if (this.customAudio) {
      this.customAudio.pause();
    }
    this.stopSynthLoop();
  }

  public stop() {
    this.pause();
    if (this.customAudio) {
      this.customAudio.currentTime = 0;
    }
  }

  public seek(timeSec: number) {
    if (this.customAudio) {
      this.customAudio.currentTime = timeSec % (this.customAudio.duration || 100);
    }
  }

  public getAudioStreamDestination(): MediaStreamAudioDestinationNode | null {
    this.init();
    return this.destNode;
  }

  private stopSynthLoop() {
    if (this.synthTimer) {
      window.clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
  }

  private startSynthLoop(presetId: string) {
    this.stopSynthLoop();
    if (!this.ctx || !this.gainNode) return;

    let step = 0;
    const notesByPreset: Record<string, number[][]> = {
      'cinema-epic': [
        [130.81, 196.0, 261.63], // C3, G3, C4
        [110.0, 164.81, 220.0],  // A2, E3, A3
        [146.83, 220.0, 293.66], // D3, A3, D4
        [98.0, 146.83, 196.0],   // G2, D3, G3
      ],
      'noir-mystery': [
        [123.47, 185.0, 246.94], // B2, F#3, B3
        [110.0, 164.81, 220.0],  // A2, E3, A3
        [98.0, 146.83, 196.0],   // G2, D3, G3
        [116.54, 174.61, 233.08],// Bb2, F3, Bb3
      ],
      'retro-synth': [
        [130.81, 261.63, 392.0], // C3, C4, G4
        [155.56, 311.13, 466.16],// Eb3, Eb4, Bb4
        [174.61, 349.23, 523.25],// F3, F4, C5
        [116.54, 233.08, 349.23],// Bb2, Bb3, F4
      ],
      'zen-piano': [
        [174.61, 261.63, 349.23], // F3, C4, F4
        [196.0, 293.66, 392.0],   // G3, D4, G4
        [220.0, 329.63, 440.0],   // A3, E4, A4
        [164.81, 246.94, 329.63], // E3, B3, E4
      ],
    };

    const chords = notesByPreset[presetId] || notesByPreset['cinema-epic'];
    const chordDuration = 3.2; // seconds per chord

    const triggerChord = () => {
      if (!this.isPlaying || !this.ctx || !this.gainNode) return;
      const currentChord = chords[step % chords.length];
      const now = this.ctx.currentTime;

      // Play pad chord with gentle attack and long decay
      currentChord.forEach((freq, idx) => {
        if (!this.ctx || !this.gainNode) return;
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();

        // Waveform
        osc.type = presetId === 'retro-synth' ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(freq, now);

        // Filter for warmth
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(presetId === 'retro-synth' ? 1200 : 800, now);

        // Envelope
        noteGain.gain.setValueAtTime(0.0001, now);
        noteGain.gain.exponentialRampToValueAtTime(0.18 / (idx + 1), now + 0.6);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + chordDuration + 0.4);

        osc.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(this.gainNode);

        osc.start(now);
        osc.stop(now + chordDuration + 0.5);
      });

      step++;
    };

    triggerChord();
    this.synthTimer = window.setInterval(triggerChord, chordDuration * 1000);
  }
}

export const globalAudioEngine = new AudioEngine();
