"""Enumerate fonts installed on the local machine (stdlib only)."""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Any

_SUFFIX_RE = re.compile(
    r"\s*\((?:TrueType|OpenType|TTC|PostScript|All res(?:\.[^)]*)?)\)$",
    re.IGNORECASE,
)

# Longest-first so "Bold Italic" wins over "Bold" / "Italic".
_STYLE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(rf"^(.*?)\s+{re.escape(label)}$", re.IGNORECASE), canonical)
    for label, canonical in (
        ("Bold Italic", "Bold Italic"),
        ("Bold Oblique", "Bold Oblique"),
        ("SemiBold Italic", "SemiBold Italic"),
        ("Semi Bold Italic", "SemiBold Italic"),
        ("DemiBold Italic", "DemiBold Italic"),
        ("Demi Bold Italic", "DemiBold Italic"),
        ("ExtraBold Italic", "ExtraBold Italic"),
        ("Extra Bold Italic", "ExtraBold Italic"),
        ("ExtraLight Italic", "ExtraLight Italic"),
        ("Extra Light Italic", "ExtraLight Italic"),
        ("Light Italic", "Light Italic"),
        ("Medium Italic", "Medium Italic"),
        ("Black Italic", "Black Italic"),
        ("Thin Italic", "Thin Italic"),
        ("Heavy Italic", "Heavy Italic"),
        ("Extra Light", "ExtraLight"),
        ("Ultra Light", "ExtraLight"),
        ("ExtraLight", "ExtraLight"),
        ("UltraLight", "ExtraLight"),
        ("Extra Bold", "ExtraBold"),
        ("Ultra Bold", "ExtraBold"),
        ("ExtraBold", "ExtraBold"),
        ("UltraBold", "ExtraBold"),
        ("Semi Bold", "SemiBold"),
        ("Demi Bold", "SemiBold"),
        ("Semibold", "SemiBold"),
        ("Demibold", "SemiBold"),
        ("SemiBold", "SemiBold"),
        ("DemiBold", "SemiBold"),
        ("Bold", "Bold"),
        ("Black", "Black"),
        ("Heavy", "Heavy"),
        ("Medium", "Medium"),
        ("Light", "Light"),
        ("Thin", "Thin"),
        ("Hairline", "Thin"),
        ("Italic", "Italic"),
        ("Oblique", "Oblique"),
        ("Regular", "Regular"),
        ("Book", "Regular"),
        ("Roman", "Regular"),
        ("Normal", "Regular"),
    )
]

_STYLE_ORDER = [
    "Thin",
    "ExtraLight",
    "Light",
    "Regular",
    "Medium",
    "SemiBold",
    "Bold",
    "ExtraBold",
    "Black",
    "Heavy",
    "Italic",
    "Oblique",
    "Light Italic",
    "Medium Italic",
    "SemiBold Italic",
    "DemiBold Italic",
    "Bold Italic",
    "Bold Oblique",
    "ExtraBold Italic",
    "ExtraLight Italic",
    "Black Italic",
    "Thin Italic",
    "Heavy Italic",
]


def list_system_font_families() -> list[str]:
    return [item["family"] for item in list_system_fonts()]


def list_system_fonts() -> list[dict[str, Any]]:
    """Return grouped local fonts: [{family, styles:[{style, fullName}]}]."""
    faces = _collect_face_names()
    grouped: dict[str, dict[str, str]] = {}

    for face in faces:
        family, style = split_family_style(face)
        if not family:
            continue
        bucket = grouped.setdefault(family, {})
        # Prefer the shorter / cleaner fullName when duplicates exist.
        previous = bucket.get(style)
        if previous is None or len(face) < len(previous):
            bucket[style] = face

    families: list[dict[str, Any]] = []
    for family in sorted(grouped.keys(), key=lambda value: value.casefold()):
        styles_map = grouped[family]
        if "Regular" not in styles_map:
            # If only styled faces exist, keep them; otherwise ensure Regular.
            styles_map.setdefault("Regular", family)
        styles = [
            {"style": style, "fullName": styles_map[style]}
            for style in _sorted_styles(styles_map.keys())
        ]
        families.append({"family": family, "styles": styles})
    return families


def split_family_style(full_name: str) -> tuple[str, str]:
    cleaned = _clean_font_name(full_name)
    if not cleaned:
        return "", "Regular"
    for pattern, canonical in _STYLE_PATTERNS:
        match = pattern.match(cleaned)
        if match:
            family = match.group(1).strip(" -_")
            if family:
                return family, canonical
    return cleaned, "Regular"


def resolve_font_face(family: str, style: str, catalog: list[dict[str, Any]] | None = None) -> str:
    family_name = str(family or "").strip() or "Microsoft YaHei"
    style_name = canonicalize_style(style)
    if catalog:
        for item in catalog:
            if str(item.get("family", "")).casefold() != family_name.casefold():
                continue
            for entry in item.get("styles", []):
                if canonicalize_style(entry.get("style", "")) == style_name:
                    return str(entry.get("fullName") or family_name)
            break
    if style_name == "Regular":
        return family_name
    return f"{family_name} {style_name}"


def canonicalize_style(style: str | None) -> str:
    raw = str(style or "Regular").strip()
    if not raw:
        return "Regular"
    lowered = raw.casefold()
    legacy = {
        "normal": "Regular",
        "regular": "Regular",
        "book": "Regular",
        "roman": "Regular",
        "italic": "Italic",
        "oblique": "Oblique",
        "bold": "Bold",
        "light": "Light",
        "medium": "Medium",
        "black": "Black",
        "thin": "Thin",
        "heavy": "Heavy",
        "semibold": "SemiBold",
        "semi bold": "SemiBold",
        "demibold": "SemiBold",
        "extrabold": "ExtraBold",
        "extra bold": "ExtraBold",
        "extralight": "ExtraLight",
        "extra light": "ExtraLight",
        "bold italic": "Bold Italic",
        "bolditalic": "Bold Italic",
    }
    if lowered in legacy:
        return legacy[lowered]
    for _pattern, canonical in _STYLE_PATTERNS:
        if canonical.casefold() == lowered:
            return canonical
    # Title-case unknown multi-word styles: "foo bar" -> "Foo Bar"
    return " ".join(part[:1].upper() + part[1:] for part in raw.split())


def _sorted_styles(styles: set[str] | list[str]) -> list[str]:
    known = {name: index for index, name in enumerate(_STYLE_ORDER)}
    return sorted(
        styles,
        key=lambda name: (known.get(name, len(_STYLE_ORDER)), name.casefold()),
    )


def _collect_face_names() -> set[str]:
    families: set[str] = set()
    if sys.platform == "win32":
        families.update(_fonts_from_winreg())
        if not families:
            windir = Path(os.environ.get("WINDIR", r"C:\Windows"))
            families.update(_fonts_from_dir(windir / "Fonts"))
    else:
        for directory in (
            Path("/usr/share/fonts"),
            Path("/usr/local/share/fonts"),
            Path.home() / ".fonts",
            Path.home() / ".local/share/fonts",
            Path("/Library/Fonts"),
            Path("/System/Library/Fonts"),
            Path.home() / "Library/Fonts",
        ):
            families.update(_fonts_from_dir(directory))

    return {name for name in (_clean_font_name(item) for item in families) if name}


def _clean_font_name(name: str) -> str:
    cleaned = _SUFFIX_RE.sub("", str(name).strip())
    return cleaned.strip(" &")


def _fonts_from_winreg() -> set[str]:
    try:
        import winreg
    except ImportError:
        return set()

    fonts: set[str] = set()
    for root in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
        try:
            key = winreg.OpenKey(root, r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts")
        except OSError:
            continue

        index = 0
        while True:
            try:
                name, _value, _type = winreg.EnumValue(key, index)
            except OSError:
                break
            index += 1
            cleaned = _clean_font_name(name)
            if " & " in cleaned:
                for part in cleaned.split(" & "):
                    part = part.strip()
                    if part:
                        fonts.add(part)
            elif cleaned:
                fonts.add(cleaned)
        winreg.CloseKey(key)
    return fonts


def _fonts_from_dir(directory: Path) -> set[str]:
    if not directory.is_dir():
        return set()

    fonts: set[str] = set()
    extensions = {".ttf", ".otf", ".ttc", ".otc"}
    try:
        entries = directory.iterdir()
    except OSError:
        return set()

    for entry in entries:
        if not entry.is_file() or entry.suffix.lower() not in extensions:
            continue
        stem = entry.stem.strip()
        if stem:
            fonts.add(stem)
    return fonts
