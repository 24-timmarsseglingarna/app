#!/usr/bin/env python

# Converts a PoD XML file to a GeoJSON file.
#
# With the --javascript parameter, the generated file is a javascript
# file defining a variable 'basePodSpec'.
#
# Get the PoD XML file from http://dev.24-timmars.nu/PoD/xmlapi_app.php.

import xml.etree.ElementTree as etree
import argparse
import re
import json
import io
import sys
import os.path
import datetime
if sys.version < '3':
    import codecs

# points number 9000 and above are real points; they are used to mark
# area borders
MAXPOINT=8999

def run():
    parser = argparse.ArgumentParser()
    parser.add_argument("-i", "--infile", help="input file")
    parser.add_argument("-o", "--outfile", help="output file")
    parser.add_argument("--javascript", action="store_true")
    args = parser.parse_args()
    tree = etree.parse(args.infile)

    all_points, start_points, turning_points = get_points(tree)
    inshore_legs, offshore_legs = get_legs(tree, all_points)

    output_pod(args.outfile, args.javascript,
               [('startPoints', start_points),
                ('turningPoints', turning_points),
                ('inshoreLegs', inshore_legs),
                ('offshoreLegs', offshore_legs)])

def output_pod(fname, javascript, features):
    if sys.version < '3':
        fd = codecs.open(fname, "w", encoding="utf-8")
    else:
        fd = io.open(fname, "w", encoding="utf-8")
    if javascript:
        fd.write(u'var basePodSpec = {')
    else:
        fd.write(u'{')
    flen = len(features)
    i = 1
    for (name, obj) in features:
        fd.write(u'"%s": {"type": "FeatureCollection",'
                 '"crs": { "type": "name",'
                 '"properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },'
                 '"features":' % name)
        fd.write(json.dumps(obj, ensure_ascii=False))
        if i == flen:
            fd.write(u'}')
        else:
            i = i + 1
            fd.write(u'},\n')
    if javascript:
        fd.write(u'};\n')
    else:
        fd.write(u'}\n')

def get_points(tree):
    doc = tree.getroot()

    startnumbers = {}

    all_points = {}
    start_points = []
    turning_points = []

    for n in doc.findall("kretsar/krets/startpoints/number"):
        startnumbers[n.text] = True

    for p in doc.findall("points/point"):
        number = p.find("number").text
        if int(number) > MAXPOINT:
            continue

        name = p.find("name").text
        descr = p.find("descr").text
        lat = p.find("lat").text
        lng = p.find("long").text
        footnote = None
        footnoteelem = p.find("footnote")
        if footnoteelem is not None:
            footnote = footnoteelem.text

        properties = {"number": number,
                      "name": name,
                      "descr": descr}
        if footnote != None:
            properties["footnote"] = footnote
        coordinates = [float(lng), float(lat)]
        geometry = {"type": "Point",
                    "coordinates": coordinates}
        point = {"type": "Feature",
                 "properties": properties,
                 "geometry": geometry},

        if number in startnumbers:
            start_points.extend(point)
        else:
            turning_points.extend(point)
        all_points[number] = coordinates

    return all_points, start_points, turning_points

def get_legs(tree, all_points):
    doc = tree.getroot()

    coast = []
    offshore = []

    for p in doc.findall("legs/leg"):
        src = p.find("from").text
        dst = p.find("to").text
        if int(src) > MAXPOINT or int(dst) > MAXPOINT:
            continue

        dist = p.find("dist").text
        sea = p.find("sea").text
        addtime = p.find("addtime").text

        properties = {"src": src,
                      "dst": dst,
                      "dist": float(dist)}

        if properties["dist"] == 0 and addtime == "1":
            properties["addtime"] = True;

        src_coords = all_points[src]
        dst_coords = all_points[dst]

        geometry = {"type": "LineString",
                    "coordinates": [src_coords, dst_coords]}
        leg = {"type": "Feature",
               "properties": properties,
               "geometry": geometry},
        if sea == "0":
            coast.extend(leg)
        else:
            offshore.extend(leg)

    return coast, offshore

if __name__ == '__main__':
    run()
