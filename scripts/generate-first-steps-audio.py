#!/usr/bin/env python3
"""Generate the Hebrew voice clips for the "first steps" game.

Uses Microsoft's free neural Hebrew voices through the `edge-tts` package
(pip install edge-tts). Output: public/audio/first-steps/*.mp3 + manifest.json
(sentence -> file). Existing clips are kept; use --force to regenerate.

CI runs this automatically (see .github/workflows/preview.yml).
"""
import argparse, asyncio, hashlib, json, pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "audio" / "first-steps"
NIQQUD = re.compile(r"[֑-ׇ]")


def phrases():
    raw = subprocess.check_output(["npx", "tsx", "scripts/list-first-steps-phrases.ts"], cwd=ROOT)
    return json.loads(raw)


async def make(sem, text, spoken, path, voice, rate, pitch):
    import edge_tts
    async with sem:
        for attempt in range(4):
            try:
                await edge_tts.Communicate(spoken, voice, rate=rate, pitch=pitch).save(str(path))
                if path.stat().st_size > 500:
                    return
            except Exception as e:  # network hiccup: retry
                print(f"  retry {attempt + 1} for {text!r}: {e}", file=sys.stderr)
            await asyncio.sleep(1.5 * (attempt + 1))
        raise SystemExit(f"failed to generate audio for {text!r}")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="he-IL-HilaNeural", help="he-IL-HilaNeural (female) or he-IL-AvriNeural (male)")
    ap.add_argument("--rate", default="-12%", help="speaking speed; slower is better for a small child")
    ap.add_argument("--pitch", default="+0Hz", help="e.g. +4Hz for a slightly brighter voice")
    ap.add_argument("--strip-niqqud", action="store_true", help="send plain letters (no vowel marks) to the voice")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    texts = phrases()
    manifest, jobs = {}, []
    sem = asyncio.Semaphore(4)
    for t in texts:
        name = hashlib.sha1(f"{a.voice}|{a.rate}|{a.pitch}|{a.strip_niqqud}|{t}".encode()).hexdigest()[:12] + ".mp3"
        manifest[t] = name
        path = OUT / name
        if a.force or not path.exists() or path.stat().st_size < 500:
            spoken = NIQQUD.sub("", t) if a.strip_niqqud else t
            jobs.append(make(sem, t, spoken, path, a.voice, a.rate, a.pitch))
    print(f"{len(texts)} phrases, generating {len(jobs)} new clips with {a.voice}")
    await asyncio.gather(*jobs)
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    # drop clips no longer referenced
    keep = set(manifest.values()) | {"manifest.json"}
    for f in OUT.iterdir():
        if f.name not in keep:
            f.unlink()
    print("done")


asyncio.run(main())
