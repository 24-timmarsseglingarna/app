#!/usr/bin/env python

# Converts a PoD KML file to a GeoJSON file.  In addition to the PoD
# KML file, this program also needs the starting points in a simple
# XML file.
#
# In order to get the starting points XML file, run 'get-start-points.sh'
# with the data in 'kretsar.txt' as input.
#
# NOTE, as of 2018, the kml file contains info about the starting points, so the
# get-start-points thingie is not needed anymore.

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

# Temporary code: this should be read from the PoD.
zeroDistsWithNoTime = [('11','13'),
                       ('12','41'),
                       ('25','27'),
                       ('1028','1029')]

def run():
    parser = argparse.ArgumentParser()
    parser.add_argument("-i", "--infile", help="input file")
    parser.add_argument("-o", "--outfile", help="output file")
    parser.add_argument("--pod-version", dest="pod_version", help="version")
    args = parser.parse_args()
    tree = etree.parse(args.infile)

    version = get_pod_version(tree, args)

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
    def add_point_(points, p):
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

    def get_points_by_name(name):
        points = []
        f = doc.find("kml:Folder[kml:name='%s']" % name, nsmap)
        for p in f.findall("kml:Placemark", nsmap):
            add_point_(points, p)
        return points

    return (get_points_by_name('Startpunkter'),
            get_points_by_name('Rundpunkter'))

def get_legs(tree):
    points = get_leg_dict(tree)
    doc = tree.getroot()[0]
    def get_legs_by_name(name):
        legs = []
        f = doc.find("kml:Folder[kml:name='%s']" % name, nsmap)
        for p in f.findall("kml:Placemark", nsmap):
            name = p.find("kml:name", nsmap)
            [r] = re.findall("(\d+)-(\d+)", name.text)
            [src, dst] = r
            dist = points[int(src)][int(dst)]

            properties = {"src": src,
                          "dst": dst,
                          "dist": float(dist)}
            if properties["dist"] == 0:
                if (src,dst) not in zeroDistsWithNoTime:
                    properties["addtime"] = True;
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
    return (get_legs_by_name('Kustdistanser'),
            get_legs_by_name('Havsdistanser'))

# build a dict:  <point-number>, <legs>
# where <legs> is a dict: <target point-number>, <distance>
def get_leg_dict(tree):
    doc = tree.getroot()[0]
    points = {}
    f = doc.find("kml:Folder[kml:name='Startpunkter']", nsmap)
    for p in f.findall("kml:Placemark", nsmap):
        add_point(points, p)
    f = doc.find("kml:Folder[kml:name='Rundpunkter']", nsmap)
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
