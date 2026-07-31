"""Extract clean single-path SVGs (keychain outline, print zone) for Blender import."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "frontend" / "public" / "catalog"
OUT = Path(__file__).resolve().parent


def first_path_d(svg_text: str) -> str:
    m = re.search(r'<path[^>]*d="([^"]+)"[^>]*/?>', svg_text)
    if not m:
        raise ValueError("no path found")
    return m.group(1)


def viewbox(svg_text: str) -> str:
    m = re.search(r'viewBox="([^"]+)"', svg_text)
    if not m:
        raise ValueError("no viewBox")
    return m.group(1)


def write_clean(src: Path, dst: Path) -> None:
    text = src.read_text(encoding="utf-8")
    d = first_path_d(text)
    vb = viewbox(text)
    _, _, w, h = (float(x) for x in vb.split())
    clean = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{h}">\n'
        f'  <path d="{d}" fill="black" stroke="none"/>\n'
        '</svg>\n'
    )
    dst.write_text(clean, encoding="utf-8")
    print(f"wrote {dst.name}: viewBox {vb}")


if __name__ == "__main__":
    write_clean(CATALOG / "budl.svg", OUT / "keychain_outline.svg")
    write_clean(CATALOG / "budapest-mask.svg", OUT / "print_zone.svg")
