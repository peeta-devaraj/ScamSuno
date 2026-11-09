"""Render an original instrumental bed. The pending voice slot is silent."""
from math import cos, exp, pi, sin
from pathlib import Path
import struct
import wave

sample_rate = 24000
duration = 60
chords = [
    (45, 52, 57, 60, 64),
    (41, 48, 53, 57, 60),
    (48, 55, 60, 64, 67),
    (43, 50, 55, 59, 62),
]
two_pi = 2 * pi
frequencies = [[440 * 2 ** ((note - 69) / 12) for note in chord] for chord in chords]
output = Path(__file__).with_name("assets") / "draft-score.wav"
pcm = bytearray()
for sample in range(sample_rate * duration):
    time = sample / sample_rate
    if 10 <= time < 36:
        pcm += b"\0\0\0\0"
        continue
    left = right = 0.0
    for i, frequency in enumerate(frequencies[int(time / 3.2) % 4]):
        beat = (time - .16 * i) % 3.2
        envelope = (1 - exp(-beat * 30)) * exp(-beat * (.63 + .13 * i))
        tone = sin(two_pi * frequency * time) + .14 * sin(two_pi * frequency * time * 2)
        note = tone * envelope / (1 + i * .30)
        pan = cos(i * 1.7) * .21
        left += note * (1 - pan)
        right += note * (1 + pan)
    gain = .055 * max(0, min(1, time / .8, (10 - time) / .9) if time < 10 else
                      min(1, (time - 36) / 1.2, (duration - time) / 1.7))
    pcm.extend(struct.pack("<hh", int(left * gain * 32767), int(right * gain * 32767)))

with wave.open(str(output), "wb") as audio:
    audio.setnchannels(2)
    audio.setsampwidth(2)
    audio.setframerate(sample_rate)
    audio.writeframes(pcm)

