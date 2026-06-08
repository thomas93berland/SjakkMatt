/*
  The Chess Lounge - rolig lounge-musikk
  Ingen lydfiler. Musikken genereres med Web Audio API.
  Starter etter første trykk på siden, fordi mobilnettlesere krever brukerhandling.
*/

(() => {
  const STORAGE_KEY = "chessLoungeMusicEnabled";
  const VOLUME_KEY = "chessLoungeMusicVolume";

  let audioCtx = null;
  let masterGain = null;
  let padInterval = null;
  let noiseSource = null;
  let musicStarted = false;

  const defaultEnabled = localStorage.getItem(STORAGE_KEY) !== "off";
  const defaultVolume = Number(localStorage.getItem(VOLUME_KEY) || "0.16");

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createButton() {
    if (document.getElementById("loungeMusicButton")) return;

    const wrap = document.createElement("div");
    wrap.id = "loungeMusicControl";

    const button = document.createElement("button");
    button.id = "loungeMusicButton";
    button.type = "button";

    const slider = document.createElement("input");
    slider.id = "loungeMusicVolume";
    slider.type = "range";
    slider.min = "0";
    slider.max = "0.35";
    slider.step = "0.01";
    slider.value = String(clamp(defaultVolume, 0, 0.35));
    slider.title = "Musikkvolum";

    wrap.appendChild(button);
    wrap.appendChild(slider);
    document.body.appendChild(wrap);

    function refreshLabel() {
      const enabled = localStorage.getItem(STORAGE_KEY) !== "off";
      button.innerHTML = enabled ? "🎵 Lounge" : "🔇 Lounge";
      button.classList.toggle("music-off", !enabled);
      slider.disabled = !enabled;
    }

    button.addEventListener("click", async () => {
      const enabled = localStorage.getItem(STORAGE_KEY) !== "off";

      if (enabled) {
        localStorage.setItem(STORAGE_KEY, "off");
        stopMusic();
      } else {
        localStorage.setItem(STORAGE_KEY, "on");
        await startMusic();
      }

      refreshLabel();
    });

    slider.addEventListener("input", () => {
      const value = clamp(Number(slider.value || "0.16"), 0, 0.35);
      localStorage.setItem(VOLUME_KEY, String(value));

      if (masterGain && audioCtx) {
        masterGain.gain.setTargetAtTime(value, audioCtx.currentTime, 0.2);
      }
    });

    refreshLabel();
  }

  function getCtx() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;

    if (!audioCtx) {
      audioCtx = new AudioCtor();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = clamp(Number(localStorage.getItem(VOLUME_KEY) || "0.16"), 0, 0.35);
      masterGain.connect(audioCtx.destination);
    }

    return audioCtx;
  }

  function makeFilter(type, frequency, q = 0.7) {
    const ctx = getCtx();
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    return filter;
  }

  function playPadNote(freq, start, duration, gainValue = 0.045) {
    const ctx = getCtx();
    if (!ctx || !masterGain) return;

    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = makeFilter("lowpass", 850, 0.55);

    oscA.type = "sine";
    oscB.type = "triangle";

    oscA.frequency.setValueAtTime(freq, start);
    oscB.frequency.setValueAtTime(freq * 1.005, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 2.2);
    gain.gain.setValueAtTime(gainValue, start + duration - 2.8);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(filter);
    filter.connect(masterGain);

    oscA.start(start);
    oscB.start(start);
    oscA.stop(start + duration + 0.2);
    oscB.stop(start + duration + 0.2);
  }

  function playBell(freq, start) {
    const ctx = getCtx();
    if (!ctx || !masterGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = makeFilter("highpass", 450, 0.7);

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.018, start + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 4.2);

    osc.connect(gain);
    gain.connect(filter);
    filter.connect(masterGain);

    osc.start(start);
    osc.stop(start + 4.4);
  }

  function startSoftNoise() {
    const ctx = getCtx();
    if (!ctx || !masterGain || noiseSource) return;

    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.18;
    }

    noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.012;

    const filter = makeFilter("lowpass", 520, 0.5);

    noiseSource.connect(noiseGain);
    noiseGain.connect(filter);
    filter.connect(masterGain);
    noiseSource.start();
  }

  function scheduleChord() {
    const ctx = getCtx();
    if (!ctx) return;

    const now = ctx.currentTime + 0.08;

    const progression = [
      [146.83, 174.61, 220.00, 293.66], // Dm7
      [130.81, 164.81, 196.00, 261.63], // Cmaj-ish
      [110.00, 146.83, 174.61, 220.00], // Gm-ish
      [123.47, 155.56, 185.00, 246.94]  // B♭/F-ish
    ];

    scheduleChord.step = (scheduleChord.step || 0) % progression.length;
    const chord = progression[scheduleChord.step];
    scheduleChord.step += 1;

    chord.forEach((freq, index) => {
      playPadNote(freq, now + index * 0.08, 9.5, index === 0 ? 0.034 : 0.026);
    });

    if (Math.random() > 0.38) {
      const bellNotes = [440, 493.88, 587.33, 659.25, 783.99];
      const bell = bellNotes[Math.floor(Math.random() * bellNotes.length)];
      playBell(bell, now + 2.4 + Math.random() * 2.8);
    }
  }

  async function startMusic() {
    if (musicStarted) return;

    const ctx = getCtx();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    musicStarted = true;
    startSoftNoise();
    scheduleChord();

    padInterval = setInterval(scheduleChord, 8200);
  }

  function stopMusic() {
    musicStarted = false;

    if (padInterval) {
      clearInterval(padInterval);
      padInterval = null;
    }

    if (masterGain && audioCtx) {
      masterGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.35);
    }

    setTimeout(() => {
      if (noiseSource) {
        try {
          noiseSource.stop();
        } catch (error) {}
        noiseSource = null;
      }
    }, 500);
  }

  function armAutostart() {
    const enabled = localStorage.getItem(STORAGE_KEY) !== "off";
    if (!enabled) return;

    const startOnce = async () => {
      document.removeEventListener("pointerdown", startOnce);
      document.removeEventListener("keydown", startOnce);
      await startMusic();
    };

    document.addEventListener("pointerdown", startOnce, { once: true });
    document.addEventListener("keydown", startOnce, { once: true });
  }

  document.addEventListener("DOMContentLoaded", () => {
    createButton();
    armAutostart();
  });
})();
