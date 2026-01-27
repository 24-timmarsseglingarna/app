/* -*- js -*- */

import moment from "moment";
import {Pod} from "../src/js/pod.js";
import {LogBook} from "../src/js/logbook.js";
import {Regatta} from "../src/js/regatta.js";

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
                mkPoint("1", "Punkt A"),
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
                mkPoint("2", "Punkt B"),
                mkPoint("3", "Punkt C"),
                mkPoint("4", "Punkt D"),
                mkPoint("5", "Punkt E"),
                mkPoint("6", "Punkt F"),
                mkPoint("7", "Punkt G"),
                mkPoint("8", "Punkt H"),
                mkPoint("9", "Punkt I"),
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
                mkLeg("1", "2", 5),
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
                mkLeg("2", "3", 10),
                mkLeg("3", "4", 15),
                mkLeg("2", "4", 10),
                mkLeg("4", "5", 20),
                mkLeg("5", "1", 65),

                mkLeg("5", "6", 20),
                mkLeg("6", "7", 20),
                mkLeg("7", "8", 20),

                mkLeg("3", "9", 40),
                mkLeg("4", "9", 40),
                mkLeg("5", "9", 20),
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

const teamData = {
    id: 2,
    start_point: "1",
    sxk_handicap: 1.2
};

const raceData = {
    id: 3,
    terrain_id: 1,
    regatta_id: 4,
    period: 24,
    min_period: 23,
    start_from: moment("2025-04-01T12:00:00"),
    start_to: moment("2025-04-01T12:00:00"),
};

function mkRegatta() {
    return new Regatta(4, "test regatta", [raceData], mkPod());
};


export function mkLogBook() {
    var regatta = mkRegatta();
    var race = regatta.races[3];
    var logbook = new LogBook(teamData, race);
    var logEntry1 = {
        type: 'round',
        class: 'TeamLog',
        time: moment("2025-04-01T12:00:00"),
        point: "1",
    };
    var logEntry2 = {
        type: 'round',
        class: 'TeamLog',
        time: moment("2025-04-01T14:00:00"),
        point: "2",
    };
    logbook.saveToLog(logEntry1);
    logbook.saveToLog(logEntry2);
    return logbook;
};
