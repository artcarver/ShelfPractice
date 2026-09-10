#!/usr/bin/env python3
"""Turn a folder of exam screenshots into legible, de-duplicated item images.

Each item is captured as one or more shots (stem in the first, explanation
after a scroll in the next). This script crops the app chrome off every shot,
removes the band the scroll duplicated, then re-slices the result into tiles
short enough to stay sharp when they are read back.

    python3 pack.py --in shots --out packed --expect 50

See README.md for the capture side.
"""

import argparse
import json
import os
import re
import sys

try:
    import numpy as np
    from PIL import Image
except ImportError:
    sys.exit("Needs Pillow and numpy:  pip3 install pillow numpy")

SHOT_RE = re.compile(r"i(\d+)[-_]p(\d+)", re.I)
EXTS = (".png", ".jpg", ".jpeg", ".PNG", ".JPG", ".JPEG")

BAND_SIZES = (48, 96, 192, 384)   # rows of signature tried when locating the overlap
COL_STEP = 4       # column stride when building row signatures
MATCH_MAX = 7.0    # mean abs grey difference still counted as the same band
BLANK_MIN = 246    # a row this pale across the content width is whitespace


def load_shots(indir, per_item):
    """Return {item_number: [path, ...]} in capture order."""
    files = sorted(
        (e.path for e in os.scandir(indir) if e.name.endswith(EXTS)),
        key=lambda p: (os.path.getmtime(p), p),
    )
    if not files:
        sys.exit("No images in %s" % indir)

    groups = {}
    tagged = [f for f in files if SHOT_RE.search(os.path.basename(f))]
    if len(tagged) == len(files):
        for f in files:
            m = SHOT_RE.search(os.path.basename(f))
            groups.setdefault(int(m.group(1)), []).append((int(m.group(2)), f))
        return {k: [f for _, f in sorted(v)] for k, v in sorted(groups.items())}

    if not per_item:
        sys.exit(
            "Shots are not named iNN-pN, so I cannot tell where one item ends.\n"
            "Either capture with ./shot, or pass --per-item N if every item got\n"
            "the same number of shots."
        )
    for i, f in enumerate(files):
        groups.setdefault(i // per_item + 1, []).append(f)
    return groups


def to_grey(img):
    return np.asarray(img.convert("L"), dtype=np.int16)


def crop(img, spec):
    if not spec:
        return img
    t, b, l, r = spec
    w, h = img.size
    box = (l, t, max(l + 1, w - r), max(t + 1, h - b))
    return img.crop(box)


def first_content_row(grey, start=0):
    """First row at or after `start` that is not blank."""
    rows = grey[start:, ::COL_STEP]
    busy = np.where(rows.min(axis=1) < BLANK_MIN)[0]
    return start + int(busy[0]) if busy.size else None


def _match_band(prev_grey, next_grey, b0, height):
    """Best position of next_grey's band inside prev_grey, and how clear it was."""
    band = next_grey[b0:b0 + height, ::COL_STEP]
    hay = prev_grey[:, ::COL_STEP]
    if hay.shape[0] < height + 1:
        return None
    energy = float(np.abs(255 - band).mean())
    if energy < 0.5:                      # blank band, nothing to match on
        return None

    windows = np.lib.stride_tricks.sliding_window_view(hay, height, axis=0)
    diff = np.abs(windows - band.T[None, :, :]).mean(axis=(1, 2))
    best = int(diff.argmin())
    score = float(diff[best])
    if score > MATCH_MAX or score > 0.25 * energy:
        return None

    masked = diff.copy()
    masked[max(0, best - height):best + height] = np.inf
    runner_up = float(masked.min()) if np.isfinite(masked).any() else float("inf")

    overlap = prev_grey.shape[0] - (best - b0)
    if overlap < b0 + height or overlap > next_grey.shape[0]:
        return None                       # band would run past the shared band
    unique = runner_up > max(2.5 * score, 0.35 * energy)
    return overlap, unique


def _verify(prev_grey, next_grey, overlap):
    """Score the whole claimed overlap, not just the band it was found with."""
    a = prev_grey[-overlap:, ::COL_STEP]
    b = next_grey[:overlap, ::COL_STEP]
    score = float(np.abs(a - b).mean())
    energy = float(np.abs(255 - b).mean())
    return score, energy


def find_overlap(prev_grey, next_grey):
    """Rows of `next_grey` already present at the bottom of `prev_grey`.

    Returns (overlap_rows, confidence) where confidence is 'ok', 'weak' or
    'none'. A weak or absent match means the two shots are stitched with a
    visible rule instead, and the item is flagged in the report.
    """
    b0 = first_content_row(next_grey)
    if b0 is None:
        return 0, "none"

    # Try a few band sizes: a short band can match inside a small overlap, a
    # long one carries more ink and is harder to fool. Keep the best verified.
    best = None
    for height in BAND_SIZES:
        if b0 + height >= next_grey.shape[0]:
            break
        hit = _match_band(prev_grey, next_grey, b0, height)
        if not hit:
            continue
        overlap, unique = hit
        score, energy = _verify(prev_grey, next_grey, overlap)
        if score > MATCH_MAX or score > 0.15 * max(energy, 1.0):
            continue
        rank = (score, -height)
        if best is None or rank < best[0]:
            best = (rank, overlap, unique)

    if best is None:
        return 0, "none"
    _, overlap, unique = best
    return overlap, "ok" if unique else "weak"


def stitch(paths, crop_first, crop_rest):
    imgs, notes = [], []
    for i, p in enumerate(paths):
        img = crop(Image.open(p).convert("RGB"), crop_first if i == 0 else crop_rest)
        imgs.append(img)

    width = min(im.width for im in imgs)
    imgs = [im if im.width == width else im.crop((0, 0, width, im.height)) for im in imgs]

    out = imgs[0]
    out_grey = to_grey(out)
    for i, img in enumerate(imgs[1:], start=1):
        grey = to_grey(img)
        overlap, how = find_overlap(out_grey, grey)
        if how == "none":
            notes.append("part %d: no overlap found, joined with a rule" % (i + 1))
            keep = img
            rule = Image.new("RGB", (width, 6), (200, 60, 60))
            joined = Image.new("RGB", (width, out.height + 6 + keep.height), "white")
            joined.paste(out, (0, 0))
            joined.paste(rule, (0, out.height))
            joined.paste(keep, (0, out.height + 6))
        else:
            if how == "weak":
                notes.append("part %d: overlap match was weak (%d px)" % (i + 1, overlap))
            if overlap >= img.height - 4:
                notes.append("part %d: duplicate shot, dropped" % (i + 1))
                continue
            keep = img.crop((0, overlap, width, img.height))
            joined = Image.new("RGB", (width, out.height + keep.height), "white")
            joined.paste(out, (0, 0))
            joined.paste(keep, (0, out.height))
        out = joined
        out_grey = to_grey(out)
    return out, notes


def trim(img):
    """Drop uniform margins on all four sides, keeping a little padding."""
    grey = to_grey(img)
    busy_rows = np.where(grey.min(axis=1) < BLANK_MIN)[0]
    busy_cols = np.where(grey.min(axis=0) < BLANK_MIN)[0]
    if not busy_rows.size or not busy_cols.size:
        return img
    pad = 12
    t = max(0, int(busy_rows[0]) - pad)
    b = min(img.height, int(busy_rows[-1]) + pad)
    l = max(0, int(busy_cols[0]) - pad)
    r = min(img.width, int(busy_cols[-1]) + pad)
    return img.crop((l, t, r, b))


def cut_points(img, tile_h):
    """Tile boundaries, pulled back to a blank band so no line is sliced."""
    grey = to_grey(img)
    blank = grey[:, ::COL_STEP].min(axis=1) >= BLANK_MIN
    cuts, y = [], 0
    while img.height - y > tile_h:
        target = y + tile_h
        c = None
        for probe in range(target, y + tile_h // 2, -1):
            if blank[probe - 3:probe + 3].all():
                c = probe
                break
        cuts.append(c or target)
        y = cuts[-1]
    return cuts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="indir", required=True, help="folder of raw shots")
    ap.add_argument("--out", dest="outdir", default="packed")
    ap.add_argument("--crop", default="0,0,0,0",
                    help="pixels to cut off every shot as top,bottom,left,right")
    ap.add_argument("--crop-rest", default=None,
                    help="different crop for the 2nd and later shots of an item")
    ap.add_argument("--width", type=int, default=1400, help="output width in px")
    ap.add_argument("--tile-h", type=int, default=1500, help="max tile height in px")
    ap.add_argument("--per-item", type=int, default=0,
                    help="group untagged shots N at a time")
    ap.add_argument("--expect", type=int, default=0, help="how many items there should be")
    args = ap.parse_args()

    spec = lambda s: tuple(int(x) for x in s.split(",")) if s else None
    crop_first = spec(args.crop)
    crop_rest = spec(args.crop_rest) if args.crop_rest else crop_first

    groups = load_shots(args.indir, args.per_item)
    os.makedirs(args.outdir, exist_ok=True)

    manifest, warnings = [], []
    for item, paths in sorted(groups.items()):
        img, notes = stitch(paths, crop_first, crop_rest)
        img = trim(img)
        if img.width > args.width:
            h = round(img.height * args.width / img.width)
            img = img.resize((args.width, h), Image.LANCZOS)

        cuts = cut_points(img, args.tile_h)
        bounds = [0] + cuts + [img.height]
        names = []
        for i in range(len(bounds) - 1):
            suffix = chr(ord("a") + i) if len(bounds) > 2 else ""
            name = "item-%02d%s.png" % (item, ("-" + suffix) if suffix else "")
            img.crop((0, bounds[i], img.width, bounds[i + 1])).save(
                os.path.join(args.outdir, name), optimize=True)
            names.append(name)

        manifest.append({"item": item, "shots": len(paths), "tiles": names,
                         "height": img.height, "notes": notes})
        for n in notes:
            warnings.append("item %02d: %s" % (item, n))

    got = {m["item"] for m in manifest}
    missing = [n for n in range(1, args.expect + 1) if n not in got] if args.expect else []

    with open(os.path.join(args.outdir, "manifest.json"), "w") as fh:
        json.dump({"items": manifest, "missing": missing}, fh, indent=2)

    total = sum(len(m["tiles"]) for m in manifest)
    print("%d items -> %d tiles in %s" % (len(manifest), total, args.outdir))
    if missing:
        print("MISSING items: %s" % ", ".join(str(n) for n in missing))
    for w in warnings:
        print("check %s" % w)
    if not missing and not warnings:
        print("Every item stitched cleanly.")


if __name__ == "__main__":
    main()
