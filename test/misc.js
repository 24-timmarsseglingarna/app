import {Pod} from "../src/js/pod.js";

export function mkPod() {
    const terrain = {
        "id": 1,
        "startPoints": {
            "type": "FeatureCollection",
            "crs": {
                "type": "name",
                "properties": {
                    "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
                }
            },
            "features": [
            ]
        },
        "turningPoints": {
            "type": "FeatureCollection",
            "crs": {
                "type": "name",
                "properties": {
                    "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
                }
            },
            "features": [
                mkPoint("1", "Punkt A"),
                mkPoint("2", "Punkt B"),
                mkPoint("3", "Punkt C"),
                mkPoint("4", "Punkt D"),
                mkPoint("5", "Punkt E"),
            ]
        },
        "inshoreLegs": {
            "type": "FeatureCollection",
            "crs": {
                "type": "name",
                "properties": {
                    "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
                }
            },
            "features": [
            ]
        },
        "offshoreLegs": {
            "type": "FeatureCollection",
            "crs": {
                "type": "name",
                "properties": {
                    "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
                }
            },
            "features": [
                mkLeg("1", "2", 5),
                mkLeg("2", "3", 10),
                mkLeg("3", "4", 15),
                mkLeg("4", "5", 20),
                mkLeg("5", "1", 25),
            ]
        },
    };
    return new Pod(terrain);
};

function mkPoint(number, name) {
    return {
        "type": "Feature",
        "properties": {
            "number": number,
            "name": name,
            "descr": "descr"
        },
        "geometry": {
            "type": "Point",
            "coordinates": [
                11.841333333333,
                57.670833333333
            ]
        }
    };
};

function mkLeg(src, dst, dist) {
    return {
        "type": "Feature",
        "properties": {
            "src": src,
            "dst": dst,
            "dist": dist
        },
        "geometry": {
          "type": "LineString",
          "coordinates": [
            [
              11.458666666667,
              57.863666666667
            ],
            [
              11.552,
              57.8905
            ]
          ]
        }
    };
};

