#!/usr/bin/env python3
"""Generate the app icon sources: app-icon.svg (prod) and app-icon-dev.svg.

A Vespa velutina, traced after a photo of a pinned specimen, in a target on
the yellow of the Vedrin s'Abeille logo, with the VSAB hive bars as a faint
watermark. The dev icon is purple with a red "DEV" band, so the two installed
PWAs cannot be mistaken for one another.

The icons are full bleed (no transparent corners): iOS and Android apply their
own mask. Everything that matters stays inside the maskable safe zone, the
central circle of 80 % of the side (W3C "maskable" icons).

No dependencies. Run from anywhere, then render the PNG/ICO files with
build.sh (see README.md):
    python3 frontend/icons/app-icon.py
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent

# --- Hornet -----------------------------------------------------------------
# Drawn in the coordinates of the reference photo (2000 x 1365 px, body axis
# at x = 1040). The left appendages are drawn, the right ones mirrored.
AXIS = 1040
LEG_OUTLINE = 16  # dark contour of the legs, ~4.5 px on the 512 px icon

HORNET = dict(
    body="#221C1A", outline="#120D0B", face="#D08A45", eye="#7C6C64", eye_hi="#A8988E",
    leg_dark="#2C2522", leg="#E2A446", band="#E2AA3C",
    wing="rgba(255,246,222,.82)", wing_edge="#7A4E1E", vein="#A8742E",
)


def mirror(svg):
    return f'{svg}<g transform="translate({2 * AXIS} 0) scale(-1 1)">{svg}</g>'


def appendages(c):
    """Left wings, legs and antenna."""
    fore = ("M885,492 C760,452 520,370 300,318 C200,296 90,292 40,330 C18,352 40,395 95,430 "
            "C170,480 290,540 420,556 C600,560 760,540 885,532 Z")
    hind = ("M885,562 C760,560 560,560 420,572 C385,578 375,602 392,624 C420,652 520,664 620,656 "
            "C730,642 830,612 885,590 Z")
    wings = (
        f'<path d="{hind}" fill="{c["wing"]}" stroke="{c["wing_edge"]}" stroke-width="10" stroke-linejoin="round"/>'
        f'<path d="M880,575 C720,578 560,590 430,600" fill="none" stroke="{c["vein"]}" stroke-width="7"/>'
        f'<path d="{fore}" fill="{c["wing"]}" stroke="{c["wing_edge"]}" stroke-width="10" stroke-linejoin="round"/>'
        f'<path d="M880,512 C700,470 480,420 200,420" fill="none" stroke="{c["vein"]}" stroke-width="7"/>'
        f'<path d="M880,524 C700,520 520,500 330,470" fill="none" stroke="{c["vein"]}" stroke-width="7"/>'
        # Costa: the dark leading edge
        f'<path d="M880,494 C760,454 520,372 300,320" fill="none" stroke="{c["wing_edge"]}" stroke-width="22" stroke-linecap="round"/>'
    )

    def leg(dark, light, wd, wl):
        """Dark femur, yellow tibia and tarsus, all on a dark contour (visible on yellow)."""
        d = "M" + " L".join(f"{x},{y}" for x, y in dark)
        l = "M" + " L".join(f"{x},{y}" for x, y in light)
        stroke = 'fill="none" stroke-linecap="round" stroke-linejoin="round"'
        return (f'<path d="{l}" {stroke} stroke="{c["outline"]}" stroke-width="{wl + LEG_OUTLINE}"/>'
                f'<path d="{d}" {stroke} stroke="{c["outline"]}" stroke-width="{wd + LEG_OUTLINE}"/>'
                f'<path d="{l}" {stroke} stroke="{c["leg"]}" stroke-width="{wl}"/>'
                f'<path d="{d}" {stroke} stroke="{c["leg_dark"]}" stroke-width="{wd}"/>')

    legs = (leg([(882, 440), (790, 385)], [(790, 385), (690, 300), (600, 245)], 34, 26)
            + leg([(906, 652), (740, 712)], [(740, 712), (600, 760), (462, 800)], 32, 24)
            + leg([(936, 680), (845, 795), (700, 910)], [(700, 910), (560, 1040), (395, 1205)], 34, 24))
    antenna = (f'<path d="M1005,240 C960,190 880,140 800,98 C765,78 735,66 718,72" fill="none" '
               f'stroke="{c["body"]}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>')
    return wings + legs + antenna


def body(c):
    """Thorax, abdomen and head (seen from below, as on the photo)."""
    thorax = ("M1040,405 C1130,405 1215,425 1225,470 C1240,540 1215,640 1170,680 C1130,712 1080,716 1040,716 "
              "C1000,716 950,712 910,680 C865,640 840,540 855,470 C865,425 950,405 1040,405 Z")
    abdomen = ("M1040,722 C1110,722 1165,760 1178,840 C1192,930 1175,1030 1140,1100 C1110,1150 1070,1185 1040,1205 "
               "C1010,1185 970,1150 940,1100 C905,1030 888,930 902,840 C915,760 970,722 1040,722 Z")
    head = ("M1040,232 C1110,232 1165,250 1170,295 C1174,340 1150,385 1110,400 C1085,410 995,410 970,400 "
            "C930,385 906,340 910,295 C915,250 970,232 1040,232 Z")
    # Frons: orange dome between the antennae
    frons = ("M982,306 C976,270 1000,244 1040,244 C1080,244 1104,270 1098,306 "
             "C1078,301 1058,303 1040,310 C1022,303 1002,301 982,306 Z")
    # Compound eye: rounded triangle, its lower edge cut by the mandible
    eye = ("M978,254 C950,244 918,256 908,284 C902,302 905,320 914,328 "
           "C936,316 962,304 986,296 C985,280 983,266 978,254 Z")
    # Mandible: large orange plate under the frons, dark cheek outside it
    mandible = ("M1034,314 C1010,306 984,306 958,318 C954,340 960,356 972,364 "
                "C990,370 1014,378 1034,388 Z")
    head_half = (f'<path d="{mandible}" fill="{c["face"]}"/>'
                 f'<path d="{eye}" fill="{c["eye"]}" stroke="{c["outline"]}" stroke-width="7" stroke-linejoin="round"/>'
                 f'<path d="M950,266 C938,270 928,280 924,292" fill="none" stroke="{c["eye_hi"]}" stroke-width="9" stroke-linecap="round"/>')
    return f'''
  <g transform="translate(1040 540) scale(.9) translate(-1040 -540)">
    <path d="{thorax}" fill="{c['body']}" stroke="{c['outline']}" stroke-width="11"/>
  </g>
  <g transform="translate(0 704) scale(1 1.075) translate(0 -722)">
    <clipPath id="abdomen"><path d="{abdomen}"/></clipPath>
    <path d="{abdomen}" fill="{c['body']}"/>
    <g clip-path="url(#abdomen)">
      <rect x="880" y="795" width="320" height="10" fill="#6B625C"/>
      <path d="M880,902 L1200,902 L1200,985 C1120,975 960,975 880,985 Z" fill="{c['band']}"/>
      <path d="M880,1010 C960,1000 1120,1000 1200,1010 L1200,1026 C1120,1016 960,1016 880,1026 Z" fill="{c['band']}" opacity=".85"/>
      <path d="M880,1080 C960,1070 1120,1070 1200,1080 L1200,1092 C1120,1082 960,1082 880,1092 Z" fill="#8A6A40"/>
    </g>
    <path d="{abdomen}" fill="none" stroke="{c['outline']}" stroke-width="10"/>
  </g>
  <path d="{head}" fill="{c['body']}" stroke="{c['outline']}" stroke-width="10"/>
  <path d="{frons}" fill="{c['face']}"/>
  {mirror(head_half)}
  <path d="M1035,312 L1045,312 L1052,378 L1040,396 L1028,378 Z" fill="{c['outline']}"/>'''


def hornet(c=HORNET):
    """Appendages, then the body with a light halo that detaches it from the target."""
    return f'{mirror(appendages(c))}<g filter="url(#halo)">{body(c)}</g>'


# --- VSAB watermark -----------------------------------------------------------
# Hive bars of the Vedrin s'Abeille emblem, measured on vsab-logo-transparent.png
# (2000 px wide preview), centred on (1000, 647).
VSAB_BARS = [(910, 1090, 469, 517), (861, 1022, 547, 594), (1062, 1139, 547, 594),
             (813, 909, 626, 673), (949, 1187, 626, 673), (861, 1049, 702, 749),
             (1089, 1139, 702, 749), (910, 1008, 778, 825), (1048, 1090, 778, 825)]


def watermark(opacity):
    bars = "".join(f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}"/>' for x0, x1, y0, y1 in VSAB_BARS)
    return (f'<g fill="#FFFFFF" opacity="{opacity}" '
            f'transform="translate(256 256) scale(1.35) translate(-1000 -647)">{bars}</g>')


# --- "DEV" as paths, independent of the fonts installed where it is rendered -
DEV_GLYPHS = (
    # D (counter cut with evenodd)
    '<path fill-rule="evenodd" d="M0,0 H18 C34,0 44,10 44,22 C44,34 34,44 18,44 H0 Z '
    'M11,10 H17 C27,10 33,15 33,22 C33,29 27,34 17,34 H11 Z"/>'
    # E
    '<path d="M52,0 H84 V10 H63 V17 H81 V27 H63 V34 H84 V44 H52 Z"/>'
    # V
    '<path d="M90,0 H102 L111,31 L120,0 H132 L117,44 H105 Z"/>'
)
DEV_WIDTH = 132


# --- Icon ---------------------------------------------------------------------
PROD = dict(bg=("#FFC933", "#F5A800"), ring="#3A2A1E", halo="#FFF6DC", watermark=.28)
DEV = dict(bg=("#8E6BD8", "#5B3BA6"), ring="#F4E6C4", halo="#FFF6DC", watermark=.28, band="#C62828")


def icon(p, dev=False):
    bg1, bg2 = p["bg"]
    ring = p["ring"]
    # The dev artwork is a little smaller and higher, to leave room for the band
    art = 'transform="translate(256 226) scale(.86) translate(-256 -256)"' if dev else ""
    band = ""
    if dev:
        band = (f'<rect x="0" y="378" width="512" height="66" fill="{p["band"]}"/>'
                f'<g fill="#FFFFFF" transform="translate({256 - DEV_WIDTH / 2} 389)">{DEV_GLYPHS}</g>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<title>Velutina{" DEV" if dev else ""}</title>
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{bg1}"/><stop offset="1" stop-color="{bg2}"/>
  </linearGradient>
  <filter id="halo" x="-20%" y="-10%" width="140%" height="120%">
    <feMorphology in="SourceAlpha" operator="dilate" radius="20" result="grown"/>
    <feFlood flood-color="{p["halo"]}"/>
    <feComposite in2="grown" operator="in" result="halo"/>
    <feMerge><feMergeNode in="halo"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>
<rect width="512" height="512" fill="url(#bg)"/>
{watermark(p["watermark"])}
<g {art}>
  <circle cx="256" cy="256" r="192" fill="none" stroke="{ring}" stroke-width="16"/>
  <circle cx="256" cy="256" r="118" fill="none" stroke="{ring}" stroke-width="14"/>
  <g stroke="{ring}" stroke-width="10" stroke-linecap="round">
    <line x1="256" y1="40" x2="256" y2="110"/><line x1="256" y1="402" x2="256" y2="472"/>
    <line x1="40" y1="256" x2="110" y2="256"/><line x1="402" y1="256" x2="472" y2="256"/>
  </g>
  <g transform="translate(256 262) scale(.28) translate(-1040 -632)">{hornet()}
  </g>
</g>
{band}
</svg>
'''


if __name__ == "__main__":
    (HERE / "app-icon.svg").write_text(icon(PROD))
    (HERE / "app-icon-dev.svg").write_text(icon(DEV, dev=True))
    print("Wrote app-icon.svg and app-icon-dev.svg")
