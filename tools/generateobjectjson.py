#!/usr/bin/python3

import argparse
import csv
import xml.etree.ElementTree as ET
import json
import sys
import re

def print_err(msg):
    print(msg, file=sys.stderr)

def warning(msg):
    warnings.append(msg)

parser = argparse.ArgumentParser(description='Generates object info json for the Kolkturm Viewer from CSV and SVG input data.'+
    ' The CSV data contains the information base for all objects. The coordinates and dimensions for the object areas is read from SVG input.')
parser.add_argument('f_csv', metavar='csv file', type=open, help='CSV input file')
parser.add_argument('f_svg', metavar='svg file', type=open, help='SVG input file')
args = parser.parse_args()

# args.mf is the file descriptor
csv_input = csv.reader(args.f_csv, delimiter=',', quotechar='"')

SVG_DPI = 96
objects = []
marker_ids = {}
svg_marker_ids = []
l = 0
warnings = []

regex = re.compile(r"^[a-zA-Z0-9-_]+$")

# Read CSV input line by line
for row in csv_input:
    # Line one is table header
    l = l + 1
    if (l == 1):
        continue

    if (len(row) != 5):
        warning(f"WARNING line {l} in CSV input data: Expected 5 rows found {len(row)}")
        continue

    # Add base attributes
    obj = {
        "name": row[0],
        "location": row[2],
        "distance": row[4],
        "areas": []
    }

    for mid in row[3].rsplit(","):
        if not regex.match(mid):
            warning(f"WARNING line {l} in CSV input data: Marker ID {mid} is no valid marker ID. Ignoring.")
            continue

        if (mid in marker_ids):
            warning(f"WARNING line {l} in CSV input data: Marker ID {mid} already used by object in line {marker_ids[mid]}")
        else:
            marker_ids[mid] = l - 2

    # Add optional attributes
    if (len(row[1]) > 0):
        obj['add_name'] = row[1]

    # Checks on CSV input data
    if (len(obj['name']) == 0):
        warning(f"WARNING line {l} in CSV input data: Object has no name")

    if (len(obj['location']) == 0):
        warning(f"WARNING line {l} in CSV input data: Object has no location")

    if (len(row[3]) == 0):
        warning(f"WARNING line {l} in CSV input data: Object has no marker IDs")
    
    if (len(obj['distance']) == 0):
        warning(f"WARNING line {l} in CSV input data: Object has no distance")

    objects.append(obj)

# Parse SVG input file
try:
    tree = ET.parse(args.f_svg)
except BaseException as e:
    print_err(f"Error while parsing SVG input file '{args.f_svg.name}': {e}")
    sys.exit(1)

root = tree.getroot()

for child in root.iter('{http://www.w3.org/2000/svg}rect'):
    child_id = child.get("id")

    if (child_id in svg_marker_ids):
        warning(f"WARNING in SVG input data: Duplicated object area rect id {child_id}")
        continue

    if (not child_id in marker_ids):
        warning(f"WARNING in SVG input data: Object area rect with id {child_id} has no corresponding entry in CSV input data")
    else:
        objects[marker_ids[child_id]]["areas"].append({
            "x": round(float(child.get("x")) / SVG_DPI),
            "y": round(float(child.get("y")) / SVG_DPI),
            "height":  round(float(child.get("height")) / SVG_DPI),
            "width": round(float(child.get("width")) / SVG_DPI)
        })

    svg_marker_ids.append(child_id)

# Additional sanity check
for mid in marker_ids:
    if (not mid in svg_marker_ids):
        warning(f"WARNING line {marker_ids[mid]+1} in CSV input data: Marker id {mid} has no corresponding object area rect in SVG input data")

# output the resulting json data
print(json.dumps(objects, indent=4))

# Print out all warnings
msg=f"{len(warnings)} warning(s) occurred during the process:"
print_err(f"\n\n{msg}")
print_err(f"{'=' * len(msg)}")

for msg in warnings:
    print_err(msg)