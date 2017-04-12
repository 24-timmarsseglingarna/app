#!/usr/bin/env python

# Converts a PoD KML file to a GeoJSON file.  In addition to the PoD
# KML file, this program also needs the starting points in a simple
# XML file.
#
# In order to get the starting points XML file, run 'get-start-points.sh'
# with the data in 'kretsar.txt' as input.

import xml.etree.ElementTree as etree
import argparse
import re
import json
import io
import sys
import os.path
if sys.version < '3':
    import codecs

kmlns= 'http://www.opengis.net/kml/2.2'
nsmap={'kml':kmlns}

def run():
    parser = argparse.ArgumentParser()
    parser.add_argument("-s", "--spfile", help="start points file")
    parser.add_argument("-i", "--infile", help="input file")
    parser.add_argument("-o", "--outfile", help="output file")
    parser.add_argument("--pod-version", dest="pod_version", help="version")
    args = parser.parse_args()
    sptree = etree.parse(args.spfile)
    tree = etree.parse(args.infile)

    version = get_pod_version(tree, args)

    fix_points(tree, sptree)

    start_points, turning_points = get_points(tree)
    inshore_legs, offshore_legs = get_legs(tree)

    output_pod(args.outfile,
               version,
               [('startPoints', start_points),
                ('turningPoints', turning_points),
                ('inshoreLegs', inshore_legs),
                ('offshoreLegs', offshore_legs)])

def get_pod_version(tree, args):
    if (args.pod_version):
        return args.pod_version
    else:
        doc = tree.getroot()[0]
        f = doc.find("kml:name", nsmap)
        name = f.text
        # parse the name which is on the form:
        #  PoD_XXX_YYYY-MM-DD
        # we use the date as version
        print 'name', name
        [d] = re.findall(".*(\d{4}-\d{2}-\d{2}).*", name)
        return d

# Some points in the kml file are duplicates.  This code removes the
# duplicate point.  If the kml generator is fixed, this function can
# be removed (but it is harmless in this case).
#
# Also, this code marks start points.
def fix_points(tree, sptree):
    spdoc = sptree.getroot()
    start_points = []
    for sp in spdoc.findall("nummer"):
        start_points.append(sp.text)
    doc = tree.getroot()[0]
    f = doc.find("kml:Folder[kml:name='Punkter']", nsmap)
    points = f.findall("kml:Placemark[kml:styleUrl='#rundpunkt']", nsmap)
    for i in range(1, len(points)):
        name = points[i].find("kml:name", nsmap).text
        prev = points[i-1].find("kml:name", nsmap).text
        if name == prev:
            f.remove(points[i-1])

        [(number, rest)] = re.findall("(\d+) (.*)", name)
        if number in start_points:
            points[i].find("kml:styleUrl", nsmap).text = '#startpunkt'

def output_pod(fname, version, features):
    if sys.version < '3':
        fd = codecs.open(fname, "w", encoding="utf-8")
    else:
        fd = io.open(fname, "w", encoding="utf-8")
    fd.write(u'var basePodSpec = {');
    fd.write(u'"version": "%s",\n' % version);
    for (name, obj) in features:
        fd.write(u'"%s": {"type": "FeatureCollection",'
                 '"crs": { "type": "name",'
                 '"properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },'
                 '"features":' % name)
        fd.write(json.dumps(obj, ensure_ascii=False))
        fd.write(u'},\n')
    fd.write(u'"dummy": null};\n')

def get_points(tree):
    doc = tree.getroot()[0]
    f = doc.find("kml:Folder[kml:name='Punkter']", nsmap)
    def get_points_by_style(style):
        points = []
        for p in f.findall("kml:Placemark[kml:styleUrl='%s']" % style, nsmap):
            d = p.find("kml:ExtendedData/kml:Data[@name='Beskrivning']/"
                       "kml:value", nsmap)
            [(number, name)] = re.findall("(\d+) (.*)",
                                          p.find("kml:name", nsmap).text)
            properties = {"number": number,
                          "name": name,
                          "descr": d.text}
            c = p.find("kml:Point/kml:coordinates", nsmap).text
            [lng, lat] = c.split(",")
            geometry = {"type": "Point",
                        "coordinates": [float(lng), float(lat)]}
            point = {"type": "Feature",
                     "properties": properties,
                     "geometry": geometry},
            points.extend(point)
        return points
    return (get_points_by_style('#startpunkt'),
            get_points_by_style('#rundpunkt'))

def get_legs(tree):
    points = get_leg_dict(tree)
    doc = tree.getroot()[0]
    def get_legs_by_style(style):
        legs = []
        f = doc.find("kml:Folder[kml:name='%s']" % style, nsmap)
        for p in f.findall("kml:Placemark", nsmap):
            name = p.find("kml:name", nsmap)
            [r] = re.findall("(\d+)-(\d+)", name.text)
            [src, dst] = r
            dist = points[int(src)][int(dst)]

            properties = {"src": src,
                          "dst": dst,
                          "dist": dist}
            c = p.find("kml:LineString/kml:coordinates", nsmap).text
            [a,b] = c.split(" ")
            [alng, alat] = a.split(",")
            [blng, blat] = b.split(",")
            geometry = {"type": "LineString",
                        "coordinates": [[float(alng), float(alat)],
                                        [float(blng), float(blat)]]}
            leg = {"type": "Feature",
                   "properties": properties,
                   "geometry": geometry},
            legs.extend(leg)
        return legs
    return (get_legs_by_style('Kustdistanser'),
            get_legs_by_style('Havsdistanser'))

# build a dict:  <point-number>, <legs>
# where <legs> is a dict: <target point-number>, <distance>
def get_leg_dict(tree):
    doc = tree.getroot()[0]
    points = {}
    f = doc.find("kml:Folder[kml:name='Punkter']", nsmap)
    for p in f.findall("kml:Placemark", nsmap):
        add_point(points, p)
    return points

def add_point(points, p):
    number = int(re.findall("^\d+", p.find("kml:name", nsmap).text)[0])
    legs = {}
    e = p.find("kml:ExtendedData", nsmap)
    for d in e.findall("kml:Data", nsmap):
        r = re.findall("Till (\d+)", d.attrib["name"])
        if r != []:
            dst = int(r[0])
            v = re.findall("([\d\.]+) M, ", d.find("kml:value", nsmap).text)
            legs[dst] = v[0]
    points[number] = legs

if __name__ == '__main__':
    run()
