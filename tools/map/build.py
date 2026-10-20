# Draws the map of Nigeria's old kingdoms for the title screen and the
# campaign: the 28 provinces of DESIGN.md (The Nigeria map), made by joining
# today's states, and splitting three of them, from Natural Earth's public
# domain map data. Writes js/campaign/geometry.js.
#
# Needs Python 3 with shapely, and the Natural Earth 1:10m GeoJSON files
# (ne_10m_admin_1_states_provinces, ne_10m_admin_0_countries,
# ne_10m_rivers_lake_centerlines, ne_10m_lakes) in the folder given:
#   python3 tools/map/build.py <natural-earth-folder>
# from https://github.com/nvkelso/natural-earth-vector (geojson/).

import json
import math
import sys
from pathlib import Path

from shapely.geometry import shape, box, mapping, Polygon, MultiPolygon, LineString, MultiLineString
from shapely.ops import unary_union, polylabel

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parents[2] / 'js/campaign/geometry.js'

# Province id → today's states it covers. Three states are split (below).
PROVINCES = {
    'kanem': ['Borno', 'Yobe'],
    'kano': ['Kano', 'Jigawa'],
    'katsina': ['Katsina'],
    'zazzau': ['Kaduna', 'Federal Capital Territory'],
    'gobir': ['Sokoto', 'Zamfara'],
    'kebbi': ['Kebbi'],
    'bauchi': ['Bauchi', 'Gombe'],
    'upperbenue': ['Adamawa'],
    'nupe': ['Niger:east'],
    'borgu': ['Niger:west', 'Kwara:north'],
    'kwararafa': ['Taraba', 'Nassarawa'],
    'tiv': ['Benue'],
    'plateau': ['Plateau'],
    'igala': ['Kogi'],
    'oyo': ['Oyo', 'Kwara:south'],
    'ife': ['Osun'],
    'ekiti': ['Ekiti'],
    'ondo': ['Ondo'],
    'ijebu': ['Ogun:east'],
    'egba': ['Ogun:west'],
    'eko': ['Lagos'],
    'benin': ['Edo'],
    'warri': ['Delta'],
    'delta': ['Rivers', 'Bayelsa'],
    'calabar': ['Cross River', 'Akwa Ibom'],
    'nri': ['Anambra'],
    'aro': ['Abia', 'Imo'],
    'igbonorth': ['Enugu', 'Ebonyi'],
}

# Where a state is cut in two (longitude and latitude, degrees). Borgu is the
# land west of the Niger in Niger State and the north of Kwara; Ìjẹ̀bú (with
# Rẹ́mọ) is the east of Ogun, the Ẹ̀gbá, Awori and Yewa towns its west.
BIG = 50
CUTS = {
    'Niger:west': box(0, 0, 4.8, BIG),
    'Kwara:north': box(0, 9.05, 4.45, BIG),
    'Ogun:east': box(3.55, 0, BIG, BIG),
}
for part, cut in list(CUTS.items()):
    state, side = part.split(':')
    other = {'west': 'east', 'east': 'west', 'north': 'south', 'south': 'north'}[side]
    CUTS[f'{state}:{other}'] = ('not', cut)

def load(name):
    return json.load(open(SRC / f'{name}.geojson'))['features']

states = {f['properties']['name']: shape(f['geometry']).buffer(0) for f in load('ne_10m_admin_1_states_provinces') if f['properties'].get('adm0_a3') == 'NGA'}

def part(name):
    if ':' not in name:
        return states[name]
    state = states[name.split(':')[0]]
    cut = CUTS[name]
    return state.difference(cut[1]) if isinstance(cut, tuple) else state.intersection(cut)

# The source states have hairline gaps between them: close them, so a
# province is one shape with no seams.
geoms = {pid: unary_union([part(s).buffer(0.004) for s in parts]).buffer(-0.004) for pid, parts in PROVINCES.items()}

# Projection: plain longitude and latitude, the longitude squeezed by the
# cosine of Nigeria's middle latitude, to an SVG of WIDTH units across.
LON0, LON1, LAT0, LAT1 = 2.4, 15.0, 3.9, 14.1
K = math.cos(math.radians(9))
WIDTH = 1000
SCALE = WIDTH / ((LON1 - LON0) * K)
HEIGHT = round((LAT1 - LAT0) * SCALE)

def xy(lon, lat):
    return ((lon - LON0) * K * SCALE, (LAT1 - lat) * SCALE)

def ring(coords):
    pts = [xy(x, y) for x, y in coords]
    out = []
    for x, y in pts:
        p = f'{x:.1f},{y:.1f}'
        if not out or out[-1] != p:
            out.append(p)
    return 'M' + 'L'.join(out) + 'Z' if len(out) > 2 else ''

def path(g, tol=0.012):
    g = g.simplify(tol, preserve_topology=True)
    polys = [g] if isinstance(g, Polygon) else list(g.geoms) if isinstance(g, MultiPolygon) else []
    parts = []
    for p in polys:
        if p.area < 0.002:
            continue
        parts.append(ring(p.exterior.coords))
        for hole in p.interiors:
            parts.append(ring(hole.coords))
    return ''.join(parts)

def line(g, tol=0.015):
    g = g.simplify(tol)
    lines = [g] if isinstance(g, LineString) else list(g.geoms) if isinstance(g, MultiLineString) else []
    out = []
    for ln in lines:
        pts = [xy(x, y) for x, y in ln.coords]
        if len(pts) > 1:
            out.append('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in pts))
    return ''.join(out)

frame = box(LON0, LAT0, LON1, LAT1)
nigeria = unary_union(list(geoms.values()))
countries = {f['properties']['ADM0_A3']: shape(f['geometry']).buffer(0) for f in load('ne_10m_admin_0_countries') if f['properties']['ADM0_A3'] in ('NGA', 'BEN', 'NER', 'TCD', 'CMR', 'TGO', 'GNQ')}
land = unary_union([g.intersection(frame) for g in countries.values()])

# The Niger, the Benue and their big tributaries, and Lake Chad.
RIVERS = {'Niger', 'Benue', 'Kaduna', 'Sokoto', 'Komadugu Yobe', 'Gongola', 'Cross', 'Ogun', 'Osun', 'Hadejia', 'Katsina Ala', 'Anambra'}
rivers = []
for f in load('ne_10m_rivers_lake_centerlines'):
    name = f['properties'].get('name') or ''
    if name not in RIVERS:
        continue
    g = shape(f['geometry']).intersection(frame)
    if not g.is_empty:
        rivers.append({'name': name, 'path': line(g), 'major': name in ('Niger', 'Benue')})
lakes = []
for f in load('ne_10m_lakes'):
    g = shape(f['geometry']).buffer(0)
    if g.intersects(frame) and g.area > 0.01:
        lakes.append({'name': f['properties'].get('name') or '', 'path': path(g.intersection(frame), 0.01)})

# Two provinces are neighbours if they share a border, not just a corner.
def touching(a, b):
    shared = geoms[a].buffer(0.015).intersection(geoms[b].buffer(0.015))
    return shared.area > 0.0004

out = {
    'width': WIDTH,
    'height': HEIGHT,
    # x = (lon - lon0) * k * scale, y = (lat1 - lat) * scale
    'projection': {'lon0': LON0, 'lat1': LAT1, 'k': round(K, 6), 'scale': round(SCALE, 4)},
    'nigeria': path(nigeria, 0.01),
    'land': path(land, 0.02),
    'rivers': rivers,
    'lakes': lakes,
    'provinces': {},
}
ids = list(PROVINCES)
for pid in ids:
    g = geoms[pid]
    biggest = max(g.geoms, key=lambda p: p.area) if isinstance(g, MultiPolygon) else g
    lx, ly = xy(*polylabel(biggest, 0.01).coords[0])
    out['provinces'][pid] = {
        'path': path(g),
        'label': [round(lx, 1), round(ly, 1)],
        'neighbours': [o for o in ids if o != pid and touching(pid, o)],
    }

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(
    '// Generated by tools/map/build.py from Natural Earth (public domain): the\n'
    '// outline of Nigeria, its rivers and Lake Chad, and the 28 provinces of the\n'
    '// old kingdoms as SVG paths, with where to put each label and who borders\n'
    '// whom. Do not edit by hand; see js/campaign/provinces.js for the rest.\n\n'
    f'export const GEOMETRY = {json.dumps(out, ensure_ascii=False, separators=(",", ":"))};\n'
)
print('wrote', OUT, OUT.stat().st_size, 'bytes', HEIGHT, 'high')
for pid in ids:
    print(pid, len(out['provinces'][pid]['path']), out['provinces'][pid]['neighbours'])
print('rivers', [(r['name'], len(r['path'])) for r in rivers], 'lakes', [(l['name'], len(l['path'])) for l in lakes])
