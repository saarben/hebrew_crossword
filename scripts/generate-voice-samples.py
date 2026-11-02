#!/usr/bin/env python3
"""Build a page that lets a person compare several free Hebrew voices.

usage: generate-voice-samples.py OUT_DIR   (writes OUT_DIR/index.html + mp3s)
Needs: pip install edge-tts gTTS   (gTTS is optional)
"""
import asyncio, html, pathlib, re, sys

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "voice-samples")
DRY = "--dry" in sys.argv
NIQQUD = re.compile(r"[֑-ׇ]")

SENTENCES = [
    "לחץ על האות בֵּית",
    "בֵּית כמו בָּנָנָה",
    "כל הכבוד! זו האות אָלֶף",
    "עם איזו אות מתחילה המילה דָּג?",
]
# id, label, engine, voice, rate, pitch, strip niqqud
VARIANTS = [
    ("A", "נוכחי: הילה, איטי, עם ניקוד", "edge", "he-IL-HilaNeural", "-12%", "+0Hz", False),
    ("B", "הילה, בלי ניקוד, כמעט רגיל", "edge", "he-IL-HilaNeural", "-5%", "+0Hz", True),
    ("C", "הילה, בלי ניקוד, איטי", "edge", "he-IL-HilaNeural", "-12%", "+0Hz", True),
    ("D", "הילה, בלי ניקוד, קצת גבוה וחי", "edge", "he-IL-HilaNeural", "-5%", "+6Hz", True),
    ("E", "אברי (קול גברי), בלי ניקוד", "edge", "he-IL-AvriNeural", "-5%", "+0Hz", True),
    ("F", "אברי (קול גברי), עם ניקוד", "edge", "he-IL-AvriNeural", "-5%", "+0Hz", False),
    ("G", "גוגל (gTTS), בלי ניקוד", "gtts", "iw", "", "", True),
]


async def edge(text, path, voice, rate, pitch):
    import edge_tts
    for attempt in range(3):
        try:
            await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(str(path))
            return True
        except Exception as e:
            print("edge retry", e, file=sys.stderr)
            await asyncio.sleep(1.5)
    return False


def gtts(text, path):
    try:
        from gtts import gTTS
        gTTS(text=text, lang="iw").save(str(path))
        return True
    except Exception as e:
        print("gtts failed", e, file=sys.stderr)
        return False


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for vid, label, engine, voice, rate, pitch, strip in VARIANTS:
        cells = []
        for i, sent in enumerate(SENTENCES):
            name = f"{vid}{i + 1}.mp3"
            text = NIQQUD.sub("", sent) if strip else sent
            ok = True
            if not DRY:
                ok = await edge(text, OUT / name, voice, rate, pitch) if engine == "edge" else gtts(text, OUT / name)
            cells.append(
                f'<div class="s"><div class="t">{html.escape(sent)}</div>'
                + (f'<audio controls preload="none" src="{name}"></audio>' if ok else "<em>לא נוצר</em>")
                + "</div>"
            )
        rows.append(f'<section><h2><b>{vid}</b> {html.escape(label)}</h2>{"".join(cells)}</section>')
    page = f"""<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>השוואת קולות</title>
<style>body{{font-family:Arial,sans-serif;margin:0;padding:16px;background:#f6f4ff;color:#222}}
h1{{font-size:22px}}section{{background:#fff;border-radius:16px;padding:12px 14px;margin:12px 0;box-shadow:0 1px 4px #0002}}
h2{{font-size:18px;margin:0 0 8px}}h2 b{{background:#4f46e5;color:#fff;border-radius:8px;padding:2px 9px;margin-left:6px}}
.s{{margin:8px 0}}.t{{font-size:15px;margin-bottom:2px}}audio{{width:100%}}</style></head><body>
<h1>איזה קול נשמע הכי טבעי? ספרו לי את האות (A–G)</h1>{"".join(rows)}</body></html>"""
    (OUT / "index.html").write_text(page, encoding="utf-8")
    print("wrote", OUT / "index.html")


asyncio.run(main())
