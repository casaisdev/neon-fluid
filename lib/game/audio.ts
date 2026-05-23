const MUSIC_ROOTS = [110, 123.5, 130.8, 146.8, 164.8, 174.6, 185, 196];
const MAJOR_RATIOS = [1, 1.25, 1.5];
const MINOR_RATIOS = [1, 1.189, 1.5];
const PENTA_MAJOR = [1, 1.125, 1.25, 1.5, 1.6875];
const PENTA_MINOR = [1, 1.189, 1.333, 1.5, 1.778];
const MUSIC_ASSET_SRC = "/audio/theme.mp3";
const MUSIC_ASSET_VOLUME = 0.42;
const MUSIC_ASSET_FADE_IN = 1.4;
const MUSIC_ASSET_FADE_OUT = 0.8;
const PROCEDURAL_MUSIC_FADE_IN = 1.5;
const PROCEDURAL_MUSIC_FADE_OUT = 0.8;
const MENU_AMBIENCE_VOLUME = 0.3;
const MENU_AMBIENCE_FADE_IN = 1.8;
const MENU_AMBIENCE_FADE_OUT = 0.8;

export function getMusicParams(levelIndex: number) {
  const root = MUSIC_ROOTS[levelIndex % 8];
  const isMajor = levelIndex % 2 === 0;
  const chordRatios = isMajor ? MAJOR_RATIOS : MINOR_RATIOS;
  const pentaRatios = isMajor ? PENTA_MAJOR : PENTA_MINOR;
  const tempo = 60 + (levelIndex % 40);
  const beat = 60 / tempo;
  const arpPatterns = [beat, beat * 0.75, beat / 3, beat * 1.5];
  const arpStepTime = arpPatterns[levelIndex % 4];
  const chordNotes = chordRatios.map((r) => root * r);
  const arpNotes = pentaRatios.map((r) => root * r);
  return { root, chordNotes, arpNotes, arpStepTime };
}

export class GameAudio {
  private enabled = true;
  private context: AudioContext | null = null;
  private unavailable = false;
  private barrierDroneOsc: OscillatorNode | null = null;
  private barrierDroneGain: GainNode | null = null;
  private playerBarrierTouchLastTime = 0;
  private boxBoxLastTime = 0;
  private boxLandLastTime = 0;
  private blowerLastTime = 0;
  private droneOscA: OscillatorNode | null = null;
  private droneOscB: OscillatorNode | null = null;
  private droneOscC: OscillatorNode | null = null;
  private droneNoise: AudioBufferSourceNode | null = null;
  private droneGain: GainNode | null = null;
  private menuShimmerTimer: ReturnType<typeof setTimeout> | null = null;
  private menuShimmerStep = 0;
  private menuAmbienceWanted = false;
  private menuAmbiencePending = false;

  // Music layer nodes
  private musicMaster: GainNode | null = null;
  private bassOsc: OscillatorNode | null = null;
  private bassLFO: OscillatorNode | null = null;
  private bassLFOGain: GainNode | null = null;
  private padOscs: OscillatorNode[] = [];
  private padGain: GainNode | null = null;
  private arpBus: GainNode | null = null;
  private arpDelay: DelayNode | null = null;
  private arpFeedback: GainNode | null = null;
  private arpActive = false;
  private arpTimer: ReturnType<typeof setTimeout> | null = null;
  private arpNextTime = 0;
  private arpStep = 0;
  private arpNotes: number[] = [];
  private arpStepTime = 0;
  private proceduralLevelIndex: number | null = null;
  private assetMusic: HTMLAudioElement | null = null;
  private assetMusicFailed = false;
  private assetFadeTimer: ReturnType<typeof setInterval> | null = null;
  private musicBackend: "asset" | "procedural" | null = null;

  unlock() {
    if (!this.enabled) return undefined;
    const ctx = this.getContext();
    if (!ctx) return undefined;
    if (ctx.state === "suspended") {
      return ctx.resume();
    }
    return undefined;
  }

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.barrierHitStop();
      this.ambientDroneOff();
      this.stopLevelMusic(true);
    }
  }

  isEnabled() {
    return this.enabled;
  }

  jump() {
    this.playTone("sine", 760, 1180, 0.045, 0.07, 0.9);
  }

  land() {
    this.playTone("triangle", 170, 92, 0.045, 0.09, 0.8);
  }

  switchOn() {
    this.playTone("triangle", 520, 980, 0.03, 0.085, 0.9);
  }

  barrierHitStart() {
    const ctx = this.getContext();
    if (!ctx || ctx.state === "closed" || this.barrierDroneOsc || this.barrierDroneGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(260, now);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(320, now);
    filter.Q.setValueAtTime(3, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.03);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    this.barrierDroneOsc = osc;
    this.barrierDroneGain = gain;
  }

  barrierHitStop() {
    const ctx = this.getContext();
    if (!ctx || ctx.state === "closed" || !this.barrierDroneOsc || !this.barrierDroneGain) return;
    const now = ctx.currentTime;
    const osc = this.barrierDroneOsc;
    const gain = this.barrierDroneGain;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.stop(now + 0.1);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      this.barrierDroneOsc = null;
      this.barrierDroneGain = null;
    };
  }

  barrierBreak() {
    const ctx = this.getContext();
    if (!ctx || ctx.state === "closed") return;
    const now = ctx.currentTime;
    // low thud
    const osc1 = ctx.createOscillator();
    const env1 = ctx.createGain();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(220, now);
    osc1.frequency.exponentialRampToValueAtTime(40, now + 0.18);
    env1.gain.setValueAtTime(0.0001, now);
    env1.gain.exponentialRampToValueAtTime(0.07, now + 0.01);
    env1.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc1.connect(env1);
    env1.connect(ctx.destination);
    osc1.start(now); osc1.stop(now + 0.22);
    osc1.onended = () => { osc1.disconnect(); env1.disconnect(); };
    // high crack
    const osc2 = ctx.createOscillator();
    const env2 = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = "highpass"; filt.frequency.value = 1800;
    osc2.type = "square";
    osc2.frequency.setValueAtTime(1400, now);
    osc2.frequency.exponentialRampToValueAtTime(600, now + 0.12);
    env2.gain.setValueAtTime(0.0001, now);
    env2.gain.exponentialRampToValueAtTime(0.055, now + 0.005);
    env2.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc2.connect(filt); filt.connect(env2); env2.connect(ctx.destination);
    osc2.start(now); osc2.stop(now + 0.15);
    osc2.onended = () => { osc2.disconnect(); filt.disconnect(); env2.disconnect(); };
  }

  gateOpen() {
    this.playTone("sine", 340, 900, 0.028, 0.12, 0.75);
  }

  goal() {
    this.playRichChord(0.045, 1, 0.8, false);
  }

  fall() {
    this.playTone("triangle", 250, 120, 0.04, 0.11, 0.75);
  }

  complete() {
    this.playTone("sine", 440, 880, 0.04, 0.25);
    this.playRichChord(0.07, 1.06, 1.4, true, 0.05);
  }

  menuNavigate() {
    this.playTone("sine", 600, 720, 0.05, 0.04);
  }

  menuConfirm() {
    this.playTone("sine", 520, 780, 0.045, 0.09, 1, 0);
    this.playTone("sine", 780, 1040, 0.04, 0.09, 1, 0.04);
  }

  menuDenied() {
    this.playTone("triangle", 220, 130, 0.04, 0.12, 0.75);
  }

  pause() {
    this.playTone("triangle", 520, 200, 0.05, 0.16);
    this.pauseLevelMusic();
  }

  resume() {
    this.playTone("triangle", 200, 520, 0.05, 0.12);
    this.resumeLevelMusic();
  }

  levelStart() {
    this.playTone("sine", 320, 640, 0.04, 0.1, 1, 0);
    this.playTone("sine", 480, 960, 0.03, 0.1, 1, 0.06);
  }

  playerBarrierTouch() {
    const ctx = this.getContext();
    if (!ctx || ctx.state === "closed") return;
    if (ctx.currentTime - this.playerBarrierTouchLastTime < 0.15) return;
    this.playerBarrierTouchLastTime = ctx.currentTime;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.055);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(600, now);
    filter.Q.setValueAtTime(4, now);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    osc.connect(filter);
    filter.connect(env);
    env.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.085);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      env.disconnect();
    };
  }

  boxBoxCollide(speed: number) {
    const ctx = this.getContext();
    if (!ctx || ctx.state === "closed") return;
    if (ctx.currentTime - this.boxBoxLastTime < 0.08) return;
    this.boxBoxLastTime = ctx.currentTime;
    const now = ctx.currentTime;
    const clamped = Math.min(1, speed / 250);
    const gainAmt = 0.03 + clamped * 0.05;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "square";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.095);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, now);
    filter.Q.setValueAtTime(0.6, now);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(gainAmt, now + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
    osc.connect(filter);
    filter.connect(env);
    env.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.125);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      env.disconnect();
    };
  }

  boxLand(speed: number) {
    const ctx = this.getContext();
    if (!ctx || ctx.state === "closed") return;
    if (ctx.currentTime - this.boxLandLastTime < 0.12) return;
    this.boxLandLastTime = ctx.currentTime;
    const now = ctx.currentTime;
    const clamped = Math.min(1, speed / 420);
    const gainAmt = 0.05 + clamped * 0.06;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.13);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(700, now);
    filter.Q.setValueAtTime(0.5, now);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(gainAmt, now + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    osc.connect(filter);
    filter.connect(env);
    env.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      env.disconnect();
    };
  }

  blowerFire() {
    const ctx = this.getContext();
    if (!ctx || ctx.state === "closed") return;
    if (ctx.currentTime - this.blowerLastTime < 0.2) return;
    this.blowerLastTime = ctx.currentTime;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.2);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(400, now);
    filter.Q.setValueAtTime(0.5, now);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.03, now + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    osc.connect(filter);
    filter.connect(env);
    env.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      env.disconnect();
    };
  }

  ambientDroneOn() {
    this.startMenuAmbience();
  }

  startMenuAmbience() {
    const ctx = this.getContext();
    if (!ctx || ctx.state === "closed" || this.droneOscA || this.droneOscB || this.droneOscC || this.droneGain) return;
    this.menuAmbienceWanted = true;
    if (ctx.state === "suspended") {
      if (this.menuAmbiencePending) return;
      this.menuAmbiencePending = true;
      void ctx.resume().then(() => {
        this.menuAmbiencePending = false;
        if (this.menuAmbienceWanted) this.createMenuAmbience(ctx);
      }).catch(() => {
        this.menuAmbiencePending = false;
      });
      return;
    }
    this.createMenuAmbience(ctx);
  }

  private createMenuAmbience(ctx: AudioContext) {
    if (ctx.state === "closed" || this.droneOscA || this.droneOscB || this.droneOscC || this.droneGain) return;
    const now = ctx.currentTime;
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const oscC = ctx.createOscillator();
    const noise = ctx.createBufferSource();
    const noiseFilter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    const gainA = ctx.createGain();
    const gainB = ctx.createGain();
    const gainC = ctx.createGain();
    const gain = ctx.createGain();
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 2)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    noise.loop = true;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(1800, now);
    noiseFilter.Q.setValueAtTime(0.7, now);
    noiseGain.gain.setValueAtTime(0.0045, now);
    oscA.type = "sine";
    oscB.type = "sine";
    oscC.type = "triangle";
    // Mid/high pad voicing for dreamy menu ambience (avoid sub-bass hum).
    oscA.frequency.setValueAtTime(220, now);
    oscB.frequency.setValueAtTime(277.2, now);
    oscC.frequency.setValueAtTime(329.6, now);
    gainA.gain.setValueAtTime(0.012, now);
    gainB.gain.setValueAtTime(0.01, now);
    gainC.gain.setValueAtTime(0.0075, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(MENU_AMBIENCE_VOLUME, now + MENU_AMBIENCE_FADE_IN);
    oscA.connect(gainA);
    oscB.connect(gainB);
    oscC.connect(gainC);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    gainA.connect(gain);
    gainB.connect(gain);
    gainC.connect(gain);
    noiseGain.connect(gain);
    gain.connect(ctx.destination);
    oscA.start(now);
    oscB.start(now);
    oscC.start(now);
    noise.start(now);
    this.droneOscA = oscA;
    this.droneOscB = oscB;
    this.droneOscC = oscC;
    this.droneNoise = noise;
    this.droneGain = gain;
    this.menuShimmerStep = 0;
    this.scheduleMenuShimmer(ctx);
  }

  ambientDroneOff() {
    this.menuAmbienceWanted = false;
    if (this.menuShimmerTimer !== null) {
      clearTimeout(this.menuShimmerTimer);
      this.menuShimmerTimer = null;
    }
    const ctx = this.context;
    if (!ctx || ctx.state === "closed" || !this.droneOscA || !this.droneOscB || !this.droneOscC || !this.droneGain) return;
    const now = ctx.currentTime;
    const oscA = this.droneOscA;
    const oscB = this.droneOscB;
    const oscC = this.droneOscC;
    const noise = this.droneNoise;
    const gain = this.droneGain;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + MENU_AMBIENCE_FADE_OUT);
    oscA.stop(now + MENU_AMBIENCE_FADE_OUT + 0.05);
    oscB.stop(now + MENU_AMBIENCE_FADE_OUT + 0.05);
    oscC.stop(now + MENU_AMBIENCE_FADE_OUT + 0.05);
    noise?.stop(now + MENU_AMBIENCE_FADE_OUT + 0.05);
    let ended = 0;
    const expectedEnds = noise ? 4 : 3;
    const onEnded = () => {
      ended += 1;
      if (ended < expectedEnds) return;
      oscA.disconnect();
      oscB.disconnect();
      oscC.disconnect();
      noise?.disconnect();
      gain.disconnect();
      this.droneOscA = null;
      this.droneOscB = null;
      this.droneOscC = null;
      this.droneNoise = null;
      this.droneGain = null;
    };
    oscA.onended = onEnded;
    oscB.onended = onEnded;
    oscC.onended = onEnded;
    if (noise) noise.onended = onEnded;
  }

  private scheduleMenuShimmer(ctx: AudioContext) {
    if (!this.menuAmbienceWanted || !this.droneGain || ctx.state === "closed") return;
    const notes = [523.25, 659.25, 587.33, 783.99];
    const note = notes[this.menuShimmerStep % notes.length];
    this.menuShimmerStep++;

    const t = ctx.currentTime + 0.02;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(note, t);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.08, t + 0.08);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(env);
    env.connect(this.droneGain);
    osc.start(t);
    osc.stop(t + 0.95);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };

    const nextMs = 1400 + (this.menuShimmerStep % 2) * 500;
    this.menuShimmerTimer = setTimeout(() => this.scheduleMenuShimmer(ctx), nextMs);
  }

  startLevelMusic(levelIndex: number) {
    const ctx = this.getContext();
    if (!ctx || ctx.state === "closed") return;

    if (!this.assetMusicFailed && this.startAssetLevelMusic(ctx, levelIndex)) {
      return;
    }

    this.startProceduralLevelMusic(ctx, levelIndex);
  }

  private startProceduralLevelMusic(ctx: AudioContext, levelIndex: number) {
    if (this.musicBackend === "procedural" && this.musicMaster) return;
    this.stopAssetMusic(true, false);

    const now = ctx.currentTime;
    const params = getMusicParams(levelIndex);

    // Master gain for level music
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(1, now + PROCEDURAL_MUSIC_FADE_IN);
    master.connect(ctx.destination);
    this.musicMaster = master;
    this.musicBackend = "procedural";
    this.proceduralLevelIndex = levelIndex;

    // --- Bass layer ---
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    const bassLFO = ctx.createOscillator();
    const bassLFOGain = ctx.createGain();
    bassOsc.type = "sine";
    bassOsc.frequency.setValueAtTime(params.root, now);
    bassLFO.type = "sine";
    bassLFO.frequency.setValueAtTime(0.06, now);
    bassLFOGain.gain.setValueAtTime(params.root * 0.3, now); // ±30% depth
    bassGain.gain.setValueAtTime(0.022, now);
    bassLFO.connect(bassLFOGain);
    bassLFOGain.connect(bassOsc.frequency);
    bassOsc.connect(bassGain);
    bassGain.connect(master);
    bassLFO.start(now);
    bassOsc.start(now);
    this.bassOsc = bassOsc;
    this.bassLFO = bassLFO;
    this.bassLFOGain = bassLFOGain;

    // --- Pad layer ---
    const padGain = ctx.createGain();
    padGain.gain.setValueAtTime(0.016, now);
    padGain.connect(master);
    this.padGain = padGain;
    this.padOscs = [];
    for (const freq of params.chordNotes) {
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      const noteEnv = ctx.createGain();
      oscA.type = "sine";
      oscB.type = "sine";
      // Detune ±4 cents for chorus thickness
      oscA.frequency.setValueAtTime(freq * 1.00023, now);
      oscB.frequency.setValueAtTime(freq * 0.99977, now);
      noteEnv.gain.setValueAtTime(0.0001, now);
      noteEnv.gain.exponentialRampToValueAtTime(1, now + 2); // slow 2s attack
      oscA.connect(noteEnv);
      oscB.connect(noteEnv);
      noteEnv.connect(padGain);
      oscA.start(now);
      oscB.start(now);
      this.padOscs.push(oscA, oscB);
    }

    // --- Arpeggio layer ---
    const arpBus = ctx.createGain();
    const arpDelay = ctx.createDelay(1);
    const arpFeedback = ctx.createGain();
    arpBus.gain.setValueAtTime(0.018, now);
    arpDelay.delayTime.setValueAtTime(params.arpStepTime * 0.5, now);
    arpFeedback.gain.setValueAtTime(0.38, now);
    arpBus.connect(master);
    arpBus.connect(arpDelay);
    arpDelay.connect(arpFeedback);
    arpFeedback.connect(arpBus);
    this.arpBus = arpBus;
    this.arpDelay = arpDelay;
    this.arpFeedback = arpFeedback;
    this.arpNotes = params.arpNotes;
    this.arpStepTime = params.arpStepTime;
    this.arpStep = 0;
    this.arpNextTime = now + PROCEDURAL_MUSIC_FADE_IN * 0.6;
    this.arpActive = true;
    this.scheduleArp();
  }

  stopLevelMusic(immediate = false) {
    this.stopAssetMusic(immediate, true);

    this.arpActive = false;
    if (this.arpTimer !== null) {
      clearTimeout(this.arpTimer);
      this.arpTimer = null;
    }

    const ctx = this.context;
    if (!ctx || ctx.state === "closed") {
      this.clearMusicRefs();
      return;
    }

    const now = ctx.currentTime;
    const master = this.musicMaster;
    const bassOsc = this.bassOsc;
    const bassLFO = this.bassLFO;
    const padOscs = this.padOscs;
    const arpBus = this.arpBus;
    const arpDelay = this.arpDelay;
    const arpFeedback = this.arpFeedback;
    this.clearMusicRefs();

    if (!master) return;
    const fadeOut = immediate ? 0.02 : PROCEDURAL_MUSIC_FADE_OUT;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + fadeOut);

    const stopAt = now + fadeOut + 0.05;
    bassOsc?.stop(stopAt);
    bassLFO?.stop(stopAt);
    for (const osc of padOscs) osc.stop(stopAt);

    setTimeout(() => {
      master.disconnect();
      bassOsc?.disconnect();
      bassLFO?.disconnect();
      this.bassLFOGain?.disconnect();
      for (const osc of padOscs) osc.disconnect();
      arpBus?.disconnect();
      arpDelay?.disconnect();
      arpFeedback?.disconnect();
    }, (fadeOut + 0.1) * 1000);
  }

  private pauseLevelMusic() {
    if (this.musicBackend === "asset" && this.assetMusic) {
      this.clearAssetFade();
      this.assetMusic.pause();
      return;
    }
    if (this.musicBackend === "procedural") {
      const levelIndex = this.proceduralLevelIndex;
      this.stopLevelMusic();
      this.proceduralLevelIndex = levelIndex;
    }
  }

  private resumeLevelMusic() {
    if (this.assetMusicFailed && this.musicBackend === null && this.proceduralLevelIndex !== null) {
      const ctx = this.getContext();
      if (ctx && ctx.state !== "closed") {
        this.startProceduralLevelMusic(ctx, this.proceduralLevelIndex);
      }
      return;
    }
    if (this.musicBackend !== "asset" || !this.assetMusic) return;
    const audio = this.assetMusic;
    audio.onerror = () => {
      this.assetMusicFailed = true;
      this.stopAssetMusic(true, false);
      this.startLevelMusic(this.proceduralLevelIndex ?? 0);
    };
    const playPromise = audio.play();
    if (playPromise === undefined) {
      this.fadeAssetMusic(MUSIC_ASSET_VOLUME, MUSIC_ASSET_FADE_IN);
    } else {
      void playPromise.then(() => {
        if (this.musicBackend === "asset") {
          this.fadeAssetMusic(MUSIC_ASSET_VOLUME, MUSIC_ASSET_FADE_IN);
        }
      }).catch(() => {
        this.assetMusicFailed = true;
        this.stopAssetMusic(true, false);
        this.startLevelMusic(this.proceduralLevelIndex ?? 0);
      });
    }
  }

  private startAssetLevelMusic(ctx: AudioContext, levelIndex: number) {
    const audio = this.getAssetMusic();
    if (!audio) return false;
    if (this.musicBackend === "procedural") {
      this.stopLevelMusic(true);
    }
    this.proceduralLevelIndex = levelIndex;

    let fallbackStarted = false;
    const fallbackToProcedural = () => {
      if (fallbackStarted || this.musicBackend !== "asset") return;
      fallbackStarted = true;
      this.assetMusicFailed = true;
      this.stopAssetMusic(true, false);
      this.startProceduralLevelMusic(ctx, levelIndex);
    };

    this.clearAssetFade();
    audio.onerror = fallbackToProcedural;
    audio.loop = true;
    this.musicBackend = "asset";
    if (audio.paused && audio.currentTime === 0) {
      audio.volume = 0;
    }

    try {
      const playPromise = audio.play();
      if (playPromise === undefined) {
        this.fadeAssetMusic(MUSIC_ASSET_VOLUME, MUSIC_ASSET_FADE_IN);
      } else {
        void playPromise
          .then(() => {
            if (this.musicBackend === "asset") {
              this.fadeAssetMusic(MUSIC_ASSET_VOLUME, MUSIC_ASSET_FADE_IN);
            }
          })
          .catch(fallbackToProcedural);
      }
      return true;
    } catch {
      fallbackToProcedural();
      return true;
    }
  }

  private getAssetMusic() {
    if (typeof Audio === "undefined") return null;
    if (this.assetMusic) return this.assetMusic;
    const audio = new Audio(MUSIC_ASSET_SRC);
    audio.preload = "auto";
    audio.loop = true;
    audio.volume = 0;
    this.assetMusic = audio;
    return audio;
  }

  private stopAssetMusic(immediate: boolean, resetTime: boolean) {
    const audio = this.assetMusic;
    if (!audio) return;
    this.clearAssetFade();
    audio.onerror = null;

    if (immediate) {
      audio.pause();
      audio.volume = 0;
      if (resetTime) audio.currentTime = 0;
      this.musicBackend = this.musicBackend === "asset" ? null : this.musicBackend;
      return;
    }

    if (this.musicBackend === "asset") {
      this.musicBackend = null;
      this.fadeAssetMusic(0, MUSIC_ASSET_FADE_OUT, () => {
        audio.pause();
        audio.volume = 0;
        if (resetTime) audio.currentTime = 0;
      });
    }
  }

  private fadeAssetMusic(targetVolume: number, durationSec: number, onDone?: () => void) {
    const audio = this.assetMusic;
    if (!audio) return;
    this.clearAssetFade();

    const startVolume = audio.volume;
    const startedAt = performance.now();
    const durationMs = Math.max(1, durationSec * 1000);
    this.assetFadeTimer = setInterval(() => {
      const t = Math.min(1, (performance.now() - startedAt) / durationMs);
      audio.volume = startVolume + (targetVolume - startVolume) * t;
      if (t < 1) return;
      this.clearAssetFade();
      onDone?.();
    }, 16);
  }

  private clearAssetFade() {
    if (this.assetFadeTimer === null) return;
    clearInterval(this.assetFadeTimer);
    this.assetFadeTimer = null;
  }

  private clearMusicRefs() {
    if (this.musicBackend === "procedural") {
      this.musicBackend = null;
    }
    this.proceduralLevelIndex = null;
    this.musicMaster = null;
    this.bassOsc = null;
    this.bassLFO = null;
    this.bassLFOGain = null;
    this.padOscs = [];
    this.padGain = null;
    this.arpBus = null;
    this.arpDelay = null;
    this.arpFeedback = null;
  }

  private scheduleArp() {
    if (!this.arpActive) return;
    const ctx = this.context;
    if (!ctx || ctx.state === "closed" || !this.arpBus) return;

    const LOOKAHEAD = 0.1; // seconds
    const now = ctx.currentTime;

    while (this.arpNextTime < now + LOOKAHEAD) {
      const freq = this.arpNotes[this.arpStep % this.arpNotes.length];
      const t = this.arpNextTime;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(1, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t + this.arpStepTime * 0.7);
      osc.connect(env);
      env.connect(this.arpBus);
      osc.start(t);
      osc.stop(t + this.arpStepTime * 0.8);
      osc.onended = () => { osc.disconnect(); env.disconnect(); };
      this.arpStep++;
      this.arpNextTime += this.arpStepTime;
    }

    this.arpTimer = setTimeout(() => this.scheduleArp(), 50);
  }

  private getContext() {
    if (!this.enabled) return null;
    if (this.unavailable) return null;
    if (this.context) return this.context;
    const Ctor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) {
      this.unavailable = true;
      return null;
    }
    try {
      this.context = new Ctor();
    } catch {
      this.unavailable = true;
      return null;
    }
    return this.context;
  }

  private finishNode(
    osc: OscillatorNode,
    filter: BiquadFilterNode,
    env: GainNode,
  ) {
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      env.disconnect();
    };
  }

  private playTone(
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    gain: number,
    duration: number,
    accent = 1,
    delayOffset = 0,
  ) {
    const ctx = this.getContext();
    if (!ctx || ctx.state === "closed") return;
    const now = ctx.currentTime + delayOffset;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400 * accent, now);
    filter.Q.setValueAtTime(0.7, now);
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, endFreq),
      now + duration,
    );
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(filter);
    filter.connect(env);
    env.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
    this.finishNode(osc, filter, env);
  }

  private playRichChord(
    gain: number,
    spread: number,
    sustainSec: number,
    addOctave: boolean,
    delayOffset = 0,
  ) {
    const ctx = this.getContext();
    if (!ctx || ctx.state === "closed") return;
    const now = ctx.currentTime + delayOffset;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const oscMain = ctx.createOscillator();
      const oscWarm = ctx.createOscillator();
      const env = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const delay = ctx.createDelay();
      const feedback = ctx.createGain();
      const reverbLP = ctx.createBiquadFilter();
      const start = now + i * 0.045;
      const noteGain = Math.max(0.0001, gain * (i === 0 ? 1 : 0.82));
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2600 * spread, start);
      filter.Q.setValueAtTime(0.6, start);
      oscMain.type = "sine";
      oscWarm.type = "triangle";
      oscMain.frequency.setValueAtTime(freq, start);
      oscWarm.frequency.setValueAtTime(freq, start);
      oscMain.frequency.exponentialRampToValueAtTime(freq * (1.08 + i * 0.03), start + sustainSec);
      oscWarm.frequency.exponentialRampToValueAtTime(freq * (1.08 + i * 0.03), start + sustainSec);
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(noteGain, start + 0.015);
      env.gain.setValueAtTime(noteGain, start + sustainSec);
      env.gain.exponentialRampToValueAtTime(0.0001, start + sustainSec + 0.35);
      delay.delayTime.setValueAtTime(0.14, start);
      feedback.gain.setValueAtTime(0.28, start);
      reverbLP.type = "lowpass";
      reverbLP.frequency.setValueAtTime(1800, start);
      oscMain.connect(filter);
      oscWarm.connect(filter);
      filter.connect(env);
      env.connect(ctx.destination);
      env.connect(delay);
      delay.connect(reverbLP);
      reverbLP.connect(ctx.destination);
      delay.connect(feedback);
      feedback.connect(delay);
      oscMain.start(start);
      oscWarm.start(start);
      oscMain.stop(start + sustainSec + 0.45);
      oscWarm.stop(start + sustainSec + 0.45);
      oscMain.onended = () => {
        oscMain.disconnect();
        oscWarm.disconnect();
        filter.disconnect();
        env.disconnect();
        delay.disconnect();
        feedback.disconnect();
        reverbLP.disconnect();
      };
    });
    if (addOctave) {
      this.playTone("sine", 261.63, 261.63, 0.025, 0.6, 1, delayOffset);
    }
  }
}
