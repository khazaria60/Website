"""
Generates 3 short placeholder audio samples for the "Aircraft Sonics" piece.

These are temporary stand-ins until real recorded samples are provided —
each one is colored noise layered with a few slowly-shifting sine tones,
so the granular synth engine (Tone.GrainPlayer) has real texture and pitch
content to reveal when its parameters are modulated by flight data. A flat
tone or plain white noise wouldn't show off pitch/grain-size/filter changes
nearly as clearly.

Run with: python3 generate_samples.py
Outputs 3 mono 16-bit WAV files into web/.
"""

import numpy as np
import wave

SAMPLE_RATE = 44100
DURATION = 3.0  # seconds
N = int(SAMPLE_RATE * DURATION)


def colored_noise(alpha=0.02):
    """White noise passed through a simple one-pole lowpass filter to
    give it a warmer, less harsh character (brown/pink-ish noise)."""
    white = np.random.normal(0, 1, N)
    colored = np.zeros(N)
    for i in range(1, N):
        colored[i] = colored[i - 1] + alpha * (white[i] - colored[i - 1])
    return colored


def tonal_layer(freqs, amp=0.15):
    """A few sine partials with a slow, wandering amplitude envelope each,
    so the tonal content drifts in and out rather than droning constantly."""
    t = np.linspace(0, DURATION, N, endpoint=False)
    layer = np.zeros(N)
    for f in freqs:
        lfo_rate = np.random.uniform(0.2, 0.6)
        lfo_phase = np.random.uniform(0, 2 * np.pi)
        envelope = 0.5 + 0.5 * np.sin(2 * np.pi * lfo_rate * t + lfo_phase)
        layer += amp * envelope * np.sin(2 * np.pi * f * t)
    return layer


def overall_envelope():
    """Short attack, longer decay, so the sample isn't a flat block —
    gives GrainPlayer natural variation to scan across positionally."""
    t = np.linspace(0, DURATION, N, endpoint=False)
    attack = 0.05
    release = 0.4
    env = np.ones(N)
    attack_samples = int(attack * SAMPLE_RATE)
    release_samples = int(release * SAMPLE_RATE)
    env[:attack_samples] = np.linspace(0, 1, attack_samples)
    env[-release_samples:] = np.linspace(1, 0, release_samples)
    return env


def make_sample(path, noise_alpha, freqs, noise_amp, tonal_amp, drive=0.0):
    noise = colored_noise(noise_alpha) * noise_amp
    tonal = tonal_layer(freqs, amp=tonal_amp)
    mix = noise + tonal
    if drive > 0:
        mix = np.tanh(mix * (1 + drive))  # mild waveshaping for a harsher sample
    mix *= overall_envelope()
    mix = mix / np.max(np.abs(mix)) * 0.9  # normalize, avoid clipping
    pcm = (mix * 32767).astype(np.int16)

    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SAMPLE_RATE)
        f.writeframes(pcm.tobytes())
    print("wrote", path)


if __name__ == "__main__":
    # Sample A: darker, low-end, gentle — smoother/browner noise, low partials
    make_sample("web/sample-a.wav", noise_alpha=0.01, freqs=[80, 160], noise_amp=0.5, tonal_amp=0.25)

    # Sample B: brighter, mid-range — pinker noise, mid partials
    make_sample("web/sample-b.wav", noise_alpha=0.04, freqs=[220, 440, 660], noise_amp=0.45, tonal_amp=0.2)

    # Sample C: harsher/noisier, with a bit of drive — for grittier grains
    make_sample("web/sample-c.wav", noise_alpha=0.08, freqs=[110, 330], noise_amp=0.6, tonal_amp=0.15, drive=1.5)
