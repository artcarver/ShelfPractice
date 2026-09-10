# shotpack

Turns a pile of exam screenshots into a small set of legible per-item images,
ready to be read back and converted into `exams/<slug>/data.js`.

Use it when the exam only exists inside an app you cannot export from. If the
source is a PDF, or the app can print to PDF, skip all of this — a PDF is
faster and reads more accurately than any screenshot.

Needs Python 3 with Pillow and numpy:

    pip3 install pillow numpy

## Capturing

    ./shot start medicine-form5     # shots land in shots/medicine-form5/
    ./shot region                   # optional: capture just the front window

Then bind two keys and use them as you page through the exam:

| key | command | when |
| --- | --- | --- |
| hotkey 1 | `./shot new` | the question is on screen — first shot of an item |
| hotkey 2 | `./shot add` | after each scroll — more of the same item |

So a typical item is one press of the first key, then two of the second (the
explanation usually needs two screens). `./shot back` undoes a misfire and
`./shot at 23` moves the counter if you jump around.

To bind the keys on macOS, make a Shortcut per command (Run Shell Script →
`cd /path/to/tools/shotpack && ./shot new`) and give it a keyboard shortcut in
the shortcut's details pane. Automator's Quick Action route works the same way.
Whichever app runs the script needs Screen Recording permission in System
Settings → Privacy & Security; `./shot region` also needs Accessibility.

You do not have to aim: full-screen shots are fine, since the app's chrome gets
cropped off in the next step.

## Packing

    ./shot done --crop 150,90,0,0 --expect 50

`--crop` is `top,bottom,left,right` in pixels — how much of every shot is
toolbar rather than exam. Add `--crop-rest` when the app keeps a sticky header
in view while you scroll, so it is trimmed from the second and later shots of
an item. Run the pack after a couple of items, look at the output, and adjust
the numbers before capturing all 50.

For each item the packer crops the chrome, removes the band the scroll
duplicated, trims the margins, and slices the result into tiles short enough
to stay sharp. Output lands in `packed/<name>/` as `item-01-a.png`,
`item-01-b.png`, … alongside a `manifest.json`.

It reports anything that needs a human eye:

    50 items -> 96 tiles in packed/medicine-form5
    MISSING items: 37
    check item 12: part 2: no overlap found, joined with a rule

"No overlap" means the two shots did not share a band — usually a scroll that
went too far, so a slice of the item is missing. Recapture that item.

Other options: `--width` (output width, default 1400), `--tile-h` (max tile
height, default 1500), `--per-item N` (group shots that were not named by
`./shot`).

`pack.py` runs standalone too:

    python3 pack.py --in some/folder --out packed --crop 150,90,0,0 --expect 50

## Handing it over

Send the `packed/<name>/` folder plus the answer key as plain text, one line
per item (`1 C`, `2 D`, …). That is enough to build the exam: the tiles carry
the stems, choices and explanations, and the key is checked against what the
explanations themselves argue, the same way every other form in this repo was
verified.

`shots/`, `packed/` and the run's state file are gitignored — raw captures are
large and belong on your machine, not in the site.
