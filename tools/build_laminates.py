#!/usr/bin/env python3
"""
build_laminates.py - turn a folder of Wilsonart swatch images into the configurator's laminate library.

WHAT IT MAKES (all inside the configurator folder):
    textures/thumb/<number>.jpg   256 px square thumbnail for the picker grid
    textures/full/<number>.jpg    up to 1024 px texture that is wrapped onto the 3D board
    data/laminates.json           the list the picker reads (number, name, categories, image paths)

HOW TO USE
    1. Put the swatch images in a folder, for example  my_swatches/
       Name each file with the design number first:   5075.jpg
       or the number + name:                          5075_Ivory_Terrene.jpg
       (Wilsonart's own download names like 5075_8x8-Ivory-Terrene.jpg work too.)
    2. OPTIONAL: add a spreadsheet saved as CSV with these column headings (any order, extras ignored):
           number, name, design_type, color, shade, cut, match
       Filling this in is what makes the filters work. Without it the laminates still show up and can be
       found by number or name, but they will not appear under any filter.
    3. Run:
           python tools/build_laminates.py my_swatches --csv my_swatches/laminates.csv
    4. Commit the new textures/ and data/ folders to GitHub.

You can run it again later with new images. It ADDS to what is already there (same number = replaced).
Needs the Pillow library:   pip install pillow
"""
import argparse, csv, json, re, sys
from datetime import date
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("This tool needs Pillow. Install it with:  pip install pillow")

EXTS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff"}
THUMB_PX = 256
FULL_PX = 1024


def parse_filename(stem: str):
    """'5075_8x8-Ivory-Terrene' -> ('5075', 'Ivory Terrene'); '5075' -> ('5075', '')"""
    if "_" in stem:
        number, rest = stem.split("_", 1)
    else:
        number, rest = stem, ""
    rest = re.sub(r"^\d+x\d+[-_ ]*", "", rest)           # drop an '8x8' size tag
    name = re.sub(r"[-_]+", " ", rest).strip()
    # drop file-type tags Wilsonart adds to download names ("... Candy Apple PRINT tif")
    name = re.sub(r"(?:\s+(?:tif|tiff|jpg|jpeg|png|print))+$", "", name, flags=re.I).strip()
    return number.strip(), name


def read_csv(path: Path):
    rows = {}
    with path.open(newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            r = {(k or "").strip().lower().replace(" ", "_"): (v or "").strip() for k, v in r.items()}
            num = r.get("number") or r.get("design_number") or r.get("sku")
            if num:
                rows[num] = r
    return rows


def avg_hex(img: Image.Image) -> str:
    small = img.convert("RGB").resize((1, 1), Image.LANCZOS)
    r, g, b = small.getpixel((0, 0))
    return "#{:02x}{:02x}{:02x}".format(r, g, b)


def process_image(src: Path, thumb_dst: Path, full_dst: Path):
    img = Image.open(src)
    img = ImageOps.exif_transpose(img).convert("RGB")
    # full texture: keep aspect, cap the longest side
    full = img.copy()
    full.thumbnail((FULL_PX, FULL_PX), Image.LANCZOS)
    full.save(full_dst, "JPEG", quality=82, optimize=True, progressive=True)
    # thumbnail: centered square crop
    thumb = ImageOps.fit(img, (THUMB_PX, THUMB_PX), Image.LANCZOS, centering=(0.5, 0.5))
    thumb.save(thumb_dst, "JPEG", quality=78, optimize=True, progressive=True)
    return avg_hex(img)


def main():
    ap = argparse.ArgumentParser(description="Build the COBO configurator laminate library from swatch images.")
    ap.add_argument("input", help="folder containing the swatch images")
    ap.add_argument("--csv", help="optional CSV with number,name,design_type,color,shade,cut,match")
    ap.add_argument("--site", default=str(Path(__file__).resolve().parent.parent),
                    help="configurator folder (default: the folder above tools/)")
    ap.add_argument("--reset", action="store_true", help="start the library from scratch instead of adding to it")
    args = ap.parse_args()

    site = Path(args.site)
    src_dir = Path(args.input)
    if not src_dir.is_dir():
        sys.exit(f"Input folder not found: {src_dir}")
    thumb_dir, full_dir = site / "textures" / "thumb", site / "textures" / "full"
    data_file = site / "data" / "laminates.json"
    for d in (thumb_dir, full_dir, data_file.parent):
        d.mkdir(parents=True, exist_ok=True)

    meta = read_csv(Path(args.csv)) if args.csv else {}

    existing = {}
    if data_file.exists() and not args.reset:
        existing = {it["n"]: it for it in json.loads(data_file.read_text(encoding="utf-8")).get("items", [])}

    images = sorted(p for p in src_dir.rglob("*") if p.suffix.lower() in EXTS)
    if not images:
        sys.exit(f"No images found in {src_dir}")

    added, problems, real_added = 0, [], 0
    for p in images:
        number, fname_name = parse_filename(p.stem)
        if not number:
            problems.append(f"{p.name}: could not read a design number from the file name")
            continue
        m = meta.get(number, {})
        safe = re.sub(r"[^A-Za-z0-9._-]+", "-", number)
        try:
            avg = process_image(p, thumb_dir / f"{safe}.jpg", full_dir / f"{safe}.jpg")
        except Exception as e:                                   # a bad file should not stop the batch
            problems.append(f"{p.name}: {e}")
            continue
        is_demo = m.get("demo", "").lower() in ("1", "true", "yes")
        existing[number] = {
            "n": number,
            "name": m.get("name") or fname_name,
            "type": m.get("design_type") or m.get("type") or "",
            "color": m.get("color", ""),
            "shade": m.get("shade", ""),
            "cut": m.get("cut", ""),
            "match": m.get("match", ""),
            "avg": avg,
            "thumb": f"textures/thumb/{safe}.jpg",
            "full": f"textures/full/{safe}.jpg",
            **({"demo": True} if is_demo else {}),
        }
        added += 1
        real_added += 0 if is_demo else 1
        if number not in meta and args.csv:
            problems.append(f"{p.name}: number {number} is not in the CSV (it will not show under any filter)")

    if real_added:                                               # real swatches replace the demo ones
        for k, v in list(existing.items()):
            if v.get("demo"):
                for key in ("thumb", "full"):                    # also remove the demo image files
                    (site / v[key]).unlink(missing_ok=True)
                del existing[k]

    items = sorted(existing.values(), key=lambda it: (it["name"].lower(), it["n"]))
    data_file.write_text(json.dumps({"updated": date.today().isoformat(), "count": len(items), "items": items},
                                    ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"Processed {added} image(s). Library now holds {len(items)} laminate(s).")
    print(f"  thumbnails: {thumb_dir}\n  textures:   {full_dir}\n  data file:  {data_file}")
    if problems:
        print(f"\n{len(problems)} thing(s) to look at:")
        for pr in problems:
            print("  - " + pr)


if __name__ == "__main__":
    main()
