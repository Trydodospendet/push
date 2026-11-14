"""Render two PUSH clips. Usage: python render.py PATH_TO_FFMPEG [--in-app]."""

import math
import os
from pathlib import Path
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
LIME, WHITE, MUTE = "#C6FF00", "#F8F9F1", "#B5B8A7"
HERE = Path(__file__).resolve().parent
FONTS = Path(os.environ["WINDIR"]) / "Fonts"
TITLE = ImageFont.truetype(str(FONTS / "arialbd.ttf"), 102)
HUGE = ImageFont.truetype(str(FONTS / "arialbd.ttf"), 172)
SMALL = ImageFont.truetype(str(FONTS / "arialbd.ttf"), 43)
IN_APP = "--in-app" in sys.argv
OUT = HERE.parents[1] / "assets" / "guide-videos" if IN_APP else HERE / "videos"
OUT.mkdir(parents=True, exist_ok=True)

# Each tuple defines an exclusive end time, headline, displayed value and payoff.
VIDEOS = {
    "eine-runde-noch": [
        (2.6, "Du wolltest\nnur kurz raus.", "POV", ""),
        (5.2, "Dann siehst du\ndein Schrittziel.", "800", "Schritte fehlen noch"),
        (8.8, "Okay. Eine\nRunde noch.", "+1", "Runde um den Block"),
        (11.5, "", "PUSH.", "Frühzugang über den Link im Profil"),
    ],
    "dein-schrittziel": [
        (2.6, "Wer sagt, es\nmüssen …", "10.000", "Schritte sein?"),
        (5.5, "Was passt\nzu deinem Tag?", "4.000", "Dein Ziel. Deine Zahl."),
        (8.8, "Setz dein\nSchrittziel.", "HEUTE", "Und sieh, wie weit du kommst."),
        (11.5, "", "PUSH.", "Frühzugang über den Link im Profil"),
    ],
}


def draw_frame(index, beats, alternate):
    t = index / FPS
    start = 0
    for end, headline, value, payoff in beats:
        if t < end:
            break
        start = end
    elapsed = t - start
    ease = 1 - (1 - min(elapsed / 0.32, 1)) ** 3
    offset = round(38 * (1 - ease))
    final = not headline
    image = Image.new("RGB", (W, H), "#10120D" if alternate else "#0B0F0C")
    draw = ImageDraw.Draw(image)
    # Running-track contours frame the type without passing behind the copy.
    for lane in range(5):
        inset = lane * 42
        slide = round(50 * math.sin(t / 2))
        draw.rounded_rectangle(
            (576 + inset + slide, -355 + inset, 1500 - inset + slide, 560 - inset),
            radius=230,
            outline="#363E20" if lane == 0 else "#232A17",
            width=3,
        )
    for y in range(1400, 1850, 32):
        shift = round(24 * math.sin(t + y / 145))
        draw.line((50 + shift, y, 595 + shift, y), fill="#202719", width=2)
    draw.text((102, 268), "PUSH.", font=SMALL, fill=LIME)
    if headline:
        draw.multiline_text((95, 420 + offset), headline, font=TITLE, fill=WHITE, spacing=1)
    y = 760 if final else 806
    draw.text((95, y + offset), value, font=HUGE, fill=LIME)
    if payoff:
        if final:
            payoff = (
                "Dein nächster Schritt:\nZiel setzen"
                if IN_APP
                else "Frühzugang über\nden Link im Profil"
            )
        draw.multiline_text((104, y + 218 + offset), payoff, font=SMALL, fill=MUTE, spacing=14)
    draw.rounded_rectangle((104, 1245, 869, 1257), radius=6, fill="#293021")
    draw.rounded_rectangle(
        (104, 1245, 104 + max(12, round(765 * t / beats[-1][0])), 1257),
        radius=6,
        fill=LIME,
    )
    return image


def render(ffmpeg, name, beats, alternate):
    duration = beats[-1][0]
    cues = [0] + [end for end, *_ in beats[:-1]]
    audio = "+".join(
        f"if(between(t,{cue},{cue + 0.26}),"
        f"0.38*sin(2*PI*(78*(t-{cue})+2*(1-exp(-18*(t-{cue})))))*"
        f"min(1,200*(t-{cue}))*exp(-20*(t-{cue})),0)"
        for cue in cues
    )
    output = OUT / f"{name}.mp4"
    args = [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
        "-r", str(FPS), "-i", "pipe:0", "-f", "lavfi", "-i",
        f"aevalsrc='{audio}':s=48000:d={duration}",
        "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "fast",
        "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", str(output),
    ]
    with subprocess.Popen(args, stdin=subprocess.PIPE) as process:
        try:
            for frame in range(round(duration * FPS)):
                process.stdin.write(draw_frame(frame, beats, alternate).tobytes())
        finally:
            process.stdin.close()
        if process.wait():
            raise RuntimeError(f"FFmpeg failed for {name}")


if __name__ == "__main__":
    for position, (name, beats) in enumerate(VIDEOS.items()):
        render(sys.argv[1], name, beats, bool(position))
