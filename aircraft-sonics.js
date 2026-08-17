// ==========================================================
// IIFE 1 — live flight data, via the Aircraft Sonics relay server.
// Connects to the relay over WebSocket and keeps window.FlightSim
// updated with real aircraft near central London. If the relay is
// unreachable (down, or Render's free tier still "waking up" after
// being idle), a local simulator — the same bounded random walk used
// before the relay existed — fills in so the piece is never silent,
// and hands off to real data the moment the connection succeeds.
// ==========================================================
(function () {
  var statusEl = document.getElementById("audioStatus");

  // must match whatever the relay server is actually deployed as on Render.
  var RELAY_URL = "wss://aircraft-sonics-relay.onrender.com";

  var RANGES = {
    altitude: { min: 2000, max: 35000, maxDelta: 15 },   // feet
    speed: { min: 80, max: 550, maxDelta: 1.5 },          // knots
    distance: { min: 0, max: 20, maxDelta: 0.05 }         // nautical miles — matches the relay's 20nm search radius
  };

  function randomInRange(range) {
    return range.min + Math.random() * (range.max - range.min);
  }

  function step(value, range) {
    var next = value + (Math.random() * 2 - 1) * range.maxDelta;
    if (next < range.min) next = range.min;
    if (next > range.max) next = range.max;
    return next;
  }

  function makeFallbackAircraft() {
    var aircraft = [];
    for (var i = 0; i < 4; i++) {
      aircraft.push({
        id: "AC" + (i + 1),
        altitude: randomInRange(RANGES.altitude),
        speed: randomInRange(RANGES.speed),
        distance: randomInRange(RANGES.distance)
      });
    }
    return aircraft;
  }

  window.FlightSim = { aircraft: makeFallbackAircraft(), ranges: RANGES };

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  // --- local fallback simulator — only actually moves the data while
  // we're not hearing from the live relay ---
  var fallbackInterval = null;

  function startFallback() {
    if (fallbackInterval) return;
    fallbackInterval = setInterval(function () {
      var aircraft = window.FlightSim.aircraft;
      for (var i = 0; i < aircraft.length; i++) {
        aircraft[i].altitude = step(aircraft[i].altitude, RANGES.altitude);
        aircraft[i].speed = step(aircraft[i].speed, RANGES.speed);
        aircraft[i].distance = step(aircraft[i].distance, RANGES.distance);
      }
    }, 200);
  }

  function stopFallback() {
    clearInterval(fallbackInterval);
    fallbackInterval = null;
  }

  // --- WebSocket connection to the relay ---
  var reconnectDelay = 2000;
  var connectTimer = null;

  function connect() {
    setStatus(fallbackInterval ? "Reconnecting..." : "Connecting...");
    startFallback();

    var socket = new WebSocket(RELAY_URL);

    socket.addEventListener("open", function () {
      reconnectDelay = 2000;
    });

    socket.addEventListener("message", function (event) {
      try {
        var payload = JSON.parse(event.data);
        window.FlightSim.aircraft = payload.aircraft;
        window.FlightSim.ranges = payload.ranges;
        stopFallback();
        setStatus("Live");
      } catch (err) {
        // ignore malformed messages
      }
    });

    socket.addEventListener("close", function () {
      startFallback();
      setStatus("Reconnecting...");
      clearTimeout(connectTimer);
      connectTimer = setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.5, 15000);
    });

    socket.addEventListener("error", function () {
      socket.close();
    });
  }

  connect();
})();

// ==========================================================
// IIFE 2 — Tone.js granular audio engine + UI wiring.
// Reads window.FlightSim.aircraft continuously and uses it to reshape
// 4 granular voices in real time. Each voice runs continuously once
// started; nothing is manually "triggered" per grain (fragile to
// schedule reliably) — instead, parameters are smoothly modulated,
// which is the standard, robust way to do this in Tone.js.
// ==========================================================
(function () {
  var toggleButton = document.getElementById("toggleAudio");
  var statusEl = document.getElementById("audioStatus");
  if (!toggleButton || !statusEl || typeof Tone === "undefined") return;

  var SAMPLE_URLS = [
    "Assets/Aircraft-Sonics/web/sample-a.wav?v=2",
    "Assets/Aircraft-Sonics/web/sample-b.wav",
    "Assets/Aircraft-Sonics/web/sample-c.wav"
  ];

  function clamp01(n) {
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }

  // shared "glitch bus" — every voice runs through this same chain, which
  // keeps the four voices reading as one instrument rather than four
  // independent synths, and concentrates the overall glitch/energy
  // character in one place.
  var bitCrusher = new Tone.BitCrusher(12).toDestination();
  var delay = new Tone.FeedbackDelay("16n", 0.2);
  var distortion = new Tone.Distortion(0.1);
  delay.connect(distortion);
  distortion.connect(bitCrusher);

  var voices = [];
  for (var i = 0; i < 4; i++) {
    var player = new Tone.GrainPlayer({
      url: SAMPLE_URLS[i % SAMPLE_URLS.length],
      loop: true
    });
    var filter = new Tone.Filter(2000, "lowpass");
    player.connect(filter);
    filter.connect(delay);
    voices.push({ player: player, filter: filter });
  }

  var loop = new Tone.Loop(function () {
    var aircraft = window.FlightSim.aircraft;
    var ranges = window.FlightSim.ranges;
    var totalSpeed = 0;

    for (var i = 0; i < voices.length; i++) {
      var ac = aircraft[i];
      var voice = voices[i];

      var altNorm = clamp01((ac.altitude - ranges.altitude.min) / (ranges.altitude.max - ranges.altitude.min));
      voice.player.playbackRate = 0.5 * Math.pow(4, altNorm); // 0.5x (low) – 2x (high)

      var speedNorm = clamp01((ac.speed - ranges.speed.min) / (ranges.speed.max - ranges.speed.min));
      voice.player.grainSize = 0.2 - speedNorm * (0.2 - 0.02); // large/slow – tiny/fast grains
      voice.player.overlap = 0.1 + speedNorm * (0.5 - 0.1);    // sparse – dense
      totalSpeed += ac.speed;

      var distNorm = clamp01(ac.distance / ranges.distance.max); // 0 = near, 1 = far
      voice.filter.frequency.value = 8000 * Math.pow(300 / 8000, distNorm); // bright (near) – dull (far)

      var baseDb = -6 + distNorm * (-24 - -6); // -6dB (near) – -24dB (far)
      // far aircraft are mostly quiet with occasional swells, rather than
      // constantly audible at a fixed low volume — a simple, robust stand-in
      // for "trigger probability" that doesn't rely on fragile note-scheduling.
      var swellCut = Math.random() < distNorm ? -15 : 0;
      voice.player.volume.value = baseDb + swellCut;
    }

    var avgSpeed = totalSpeed / voices.length;
    var avgNorm = clamp01((avgSpeed - ranges.speed.min) / (ranges.speed.max - ranges.speed.min));
    bitCrusher.bits = Math.round(12 - avgNorm * (12 - 4)); // cleaner (slow scene) – grittier (fast scene)
  }, "16n");

  // --- scattered readout labels — for each aircraft, show its 3 raw data
  // values next to the live sound parameter each one is currently driving
  // (read straight off the same voice objects the loop above just set, so
  // the readout can never drift out of sync with what's actually playing) ---
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function updateReadoutRows() {
    var aircraft = window.FlightSim.aircraft;
    for (var i = 0; i < aircraft.length; i++) {
      var ac = aircraft[i];
      var voice = voices[i];
      if (!voice) continue;

      setText(ac.id + "-altitude", Math.round(ac.altitude).toLocaleString() + "ft");
      setText(ac.id + "-pitch", voice.player.playbackRate.toFixed(2) + "x");

      setText(ac.id + "-speed", Math.round(ac.speed) + "kt");
      setText(ac.id + "-grain", Math.round(voice.player.grainSize * 1000) + "ms");

      setText(ac.id + "-distance", ac.distance.toFixed(1) + "nm");
      setText(ac.id + "-filter", Math.round(voice.filter.frequency.value) + "Hz");
    }
  }

  var readoutInterval = null;
  var started = false;

  toggleButton.addEventListener("click", function () {
    if (!started) {
      statusEl.textContent = "Starting...";
      Tone.start().then(function () {
        return Tone.loaded();
      }).then(function () {
        voices.forEach(function (voice) {
          voice.player.start();
        });
        loop.start(0);
        Tone.Transport.start();
        readoutInterval = setInterval(updateReadoutRows, 200);
        started = true;
        toggleButton.textContent = "Stop";
        statusEl.textContent = "Running";
      });
    } else {
      voices.forEach(function (voice) {
        voice.player.stop();
      });
      loop.stop();
      Tone.Transport.stop();
      clearInterval(readoutInterval);
      started = false;
      toggleButton.textContent = "Start";
      statusEl.textContent = "Stopped";
    }
  });
})();
