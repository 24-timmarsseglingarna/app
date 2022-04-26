/* -*- js -*- */

import {pushPage, popPage} from './pageui.js';
import {Map, View} from 'ol';
import {defaults as defaultControls} from 'ol/control.js';
import {defaults as defaultInteractions, Pointer} from 'ol/interaction.js';
import {XYZ, Vector as VectorSource} from 'ol/source.js';
import {Tile, Vector as VectorLayer} from 'ol/layer.js';
import {Style,Circle,Fill,Text,Stroke} from 'ol/style.js';
import {GeoJSON} from 'ol/format.js';
import {transform} from 'ol/proj.js';

import {Popup} from './ol-popup.js';

import {Regatta} from './regatta.js';
import {alert, alertUpgrade} from './alertui.js';
import {curState, setupLoginP, setupContinue} from './state.js';
import {getRegattaLogsP, getRegattaTeamsP, getPodP,
        getRegattaRacesP} from './serverdata.js';
import {openLogEntry} from './logentryui.js';
import {openLogBook} from './logbookui.js';
import {openPage as openAddLogEntryPage} from './addlogentryui.js';
import {openPage as openBoatsPage} from './boatsui.js';
import {openPage as openPlanMenuPage} from './planmenuui.js';
import {openPage as openActivateRacePage} from './activateraceui.js';
import {openPage as openSettingsPage} from './settingsui.js';
import {openPage as openLoginPage} from './loginui.js';
import {isTouch, isCordova} from './util.js';
import {URL} from './serverapi.js';
import {dbg} from './debug.js';

/**
 * Font for point labels on zoom levels 1-3
 * @const {string}
 */
var POINT_LABEL_FONT_ZOOM_MIN = 'bold 13px sans-serif';

/**
 * Font for point labels on zoom levels 4-5.
 * @const {string}
 */
var POINT_LABEL_FONT_ZOOM_MED = 'bold 15px sans-serif';

/**
 * Font for leg labels on zoom levels 1-4.
 * @const {string}
 */
var LEG_LABEL_FONT_ZOOM_MED = 'bold 13px sans-serif';

/**
 * Font for leg labels on zoom level 5.
 * @const {string}
 */
var LEG_LABEL_FONT_ZOOM_MAX = 'bold 15px sans-serif';

/**
 * Radius of visible circle around point
 * @const {number}
 */
var POINT_RADUIS = 5;
var POINT_RADUIS_ZOOM_MIN = 4;

/**
 * Radius of circle that accepts taps around point
 * @const {number}
 */
var TAP_RADUIS = 16;

/**
 * Width of leg line on MIN zoom levels.
 * @const {number}
 */
var LEG_WIDTH_MIN = 1;

/**
 * Width of next possible leg line on MIN zoom levels.
 * @const {number}
 */
var NEXT_LEG_WIDTH_MIN = LEG_WIDTH_MIN + 2;

/**
 * Width of leg line on MED and MAX zoom levels.
 * @const {number}
 */
var LEG_WIDTH_MED = 2;

/**
 * Width of next possible leg line on MED and MAX zoom levels.
 * @const {number}
 */
var NEXT_LEG_WIDTH_MED = LEG_WIDTH_MED + 2;

/**
 * Width of leg line that has been logged once.
 * @const {number}
 */
var LOGGED_1_LEG_WIDTH = 3;

/**
 * Width of leg line that has been logged twice.
 * @const {number}
 */
var LOGGED_2_LEG_WIDTH = 5;

/**
 * Color of leg line that has been logged.
 * @const {string}
 */
var LOGGED_LEG_COLOR = '#000000';

/**
 * Color of start point
 * @const {string}
 */
var START_POINT_COLOR = '#e31a1c'; // red

/**
 * Color of turning point
 * @const {string}
 */
var TURN_POINT_COLOR = '#000000';

/**
 * Color of inshore leg
 * @const {string}
 */
var INSHORE_LEG_COLOR = '#0113e6'; // blue

/**
 * Color of offshore leg
 * @const {string}
 */
var OFFSHORE_LEG_COLOR = '#f31b1f'; // some-other-red

/**
 * Initialize ui ephemeral state variables
 */

var showLegs = true;
var dragState = null;
var initialCenterChanged = false;

var inshoreLegsLayer;
var offshoreLegsLayer;
var turningPointsLayer;
var startPointsLayer;

var view;

/**
 * We define 5 zoom levels; 5 is max zoomed in (small area)
 * and 1 is max zoomed out (large area).
 */
function getZoomLevel(resolution) {
    if (resolution > 650) {
        return 1;
    } else if (resolution > 300) {
        return 2;
    } else if (resolution > 100) {
        return 3;
    } else if (resolution > 50) {
        return 4;
    } else {
        return 5;
    }
};

/**
 * Define the Map
 */

var map;

function initMap() {
    map = new Map({
        target: 'map',
        /*
         * Increase moveTolerance in order to detect taps correctly on
         * Sony Xperia Z3 Compact and Z4 Tablet.
         */
        moveTolerance: 1.5,
        loadTilesWhileInteracting: true,
        //loadTilesWhileAnimating: true,
        controls: defaultControls({
            attribution: false,
            rotate: false,
            zoom: !(isTouch) // no zoom on touch screen
        }),
        interactions: defaultInteractions({
            altShiftDragRotate: false,
            pinchRotate: false,
            doubleClickZoom: false
        }).extend([new Pointer({
            handleDownEvent: function(event) {
                return handleMapPointerDown(event);
            },
            handleUpEvent: function(event) {
                return handleMapPointerUp(event);
            }
        })])
    });
};

var mapURL = 'tiles/{z}/{x}/{y}.png';

/**
 * Our map has *lots* of plain yellow tiles (representing land) and
 * plain blue tiles (representing sea).  In order to optimize the size
 * of the map, we run a script that removes all such tiles.
 *
 * NEW SOLUTION:
 * We remove all these redundant tiles, except for zoom layer 7.  Then
 * we pre-load zoom level 7.  Since OL3 will scale what it has if it
 * zooms and can't find a tile, the map still looks good, but we use
 * much less tiles, and we avoid the special map.
 *
 * OLD SOLUTION:
 * The script creates a javascript file with an object with properties:
 *   <filename>: <number>
 * where <number> 1 means yellow and 2 means blue.
 * The script also creates two special files (one yellow and one blue tile).
 *
 * When we're asked to create a tile url, we run the normal algorithm to
 * produce a filename.  Then we check if this filename is present in the
 * tilesmap; if it is, then we return one of the two special filenames.
 * This is taken care of by patchTileUrls below.
 */

function mkMapLayer() {
    var mapSource = new XYZ({
        url: mapURL
    });
    return new Tile({
        source: mapSource,
        preload: 7
    });
};

/**
 * A cache for all ol.style.Styles we create, so that we don't create
 * unnecessary garbage.
 */
var styleCache = {};

/**
 * Point Popup handling
 */

var pointPopup;
var plannedPointPopup;

function mkPointPopupHTML(number, name, descr, footnote, times) {
    var s = '<p><b>' + number + ' ' + name + '</b></p>' +
        '<p>' + descr + '</p>';
    if (footnote) {
        s += '<p class="font-italic">' + footnote + '</p>';
    }
    for (var i = 0; i < times.length; i++) {
        if (times[i].eta) {
            s += '<p>Planerad rundningstid:<br/>' +
                times[i].eta.format('HH:mm D MMM') + '</p>';
        }
        if (times[i].rta) {
            s += '<p>Rundning för målgång i tid:<br/>' +
                times[i].rta.format('HH:mm D MMM') + '</p>';
        }
    }
    var curLogBook = curState.curLogBook.get();
    if (curLogBook && !curLogBook.isReadOnly()) {
        // we use a tabindex b/c bootstrap v4 styles a's w/o tabindex
        // and w/o href in a bad way
        s += '<p><a class="log-point-button" tabindex="0"' +
            ' onclick="window.tfUiLogPoint(\'' + number + '\')">' +
            'Logga denna punkt</a></p>';
    }
    return s;
};

window.tfUiLogPoint = function(number) {
    pointPopup.hide();
    openLogEntry({point: number,
                  type: 'round',
                  logBook: curState.curLogBook.get()});
};

function mkPlannedPointPopupHTML(number, name) {
    var s = '<p><b>' + number + ' ' + name + '</b></p>' +
        '<p><a class="log-point-button" tabindex="0"' +
        ' onclick="window.tfUiDelPlannedPoint(\'' + number + '\')">' +
        'Tag bort denna punkt</a></p>' +
        '<p><a class="log-point-button" tabindex="0"' +
        ' onclick="window.tfUiDelTailPlan(\'' + number + '\')">' +
        'Tag bort resten av planen</a></p>' +
        '<p><a class="log-point-button" tabindex="0"' +
        ' onclick="window.tfUiDelPlan()">' +
        'Tag bort hela planen</a></p>';
    return s;
};

window.tfUiDelPlannedPoint = function(number) {
    plannedPointPopup.hide();
    curState.curPlan.get().delPoint(number);
};

window.tfUiDelTailPlan = function(number) {
    plannedPointPopup.hide();
    curState.curPlan.get().delTail(number);
};

window.tfUiDelPlan = function() {
    plannedPointPopup.hide();
    curState.curPlan.get().delAllPoints();
};

function handleMapClick(event) {
    map.forEachFeatureAtPixel(
        event.pixel,
        function(feature) {
            var geom = feature.getGeometry();
            // Only popup when Points are clicked
            if (geom.getType() == 'Point') {
                var number = feature.get('number');
                var name = feature.get('name');
                var descr = feature.get('descr');
                var coord;
                if (descr) {
                    if (curState.planMode.get()) {
                        /*
                         * In plan mode:
                         *   single click - add to plan
                         *   double click on planned point - popup
                         *     to select to remove plan or point
                         *   long press on planned point - change plan by
                         *     dragging to new point
                         */
                        if (event.type === 'click') {
                            // do no react directly to the click; wait
                            // for the other event (single/dbl).
                            return;
                        }
                        if (curState.curPlan.get().isPointPlanned(number)) {
                            if (event.type === 'singleclick') {
                                curState.curPlan.get().addPoint(number);
                            } else if (event.type === 'dblclick') {
                                coord = geom.getCoordinates();
                                plannedPointPopup.show(
                                    coord,
                                    mkPlannedPointPopupHTML(number, name));
                            }
                        } else {
                            if (event.type === 'singleclick') {
                                curState.curPlan.get().addPoint(number);
                            }
                        }
                    } else {
                        /*
                         * In normal mode:
                         *   single click - show point popup
                         */
                        if (event.type !== 'click') {
                            // react directly to the click
                            return;
                        }
                        var times = [];
                        if (curState.curPlan.get()) {
                            times = curState.curPlan.get().getTimes(number);
                        }
                        // show the popup from the center of the point
                        coord = geom.getCoordinates();
                        var footnote = feature.get('footnote');
                        pointPopup.show(
                            coord,
                            mkPointPopupHTML(number, name, descr,
                                             footnote, times));
                    }
                }
            }
        });
};

function handleMapPointerDown(event) {
    if (!curState.planMode.get() || dragState != null) {
        return false;
    }
    return map.forEachFeatureAtPixel(
        event.pixel,
        function(feature) {
            var geom = feature.getGeometry();
            // Only popup when Points are clicked
            if (geom.getType() == 'Point') {
                var number = feature.get('number');
                var p = curState.curPlan;
                if (p && p.get().isPointPlanned(number)) {
                    dragState = number;
                    return true;
                }
            }
        }
    );
};

function handleMapPointerUp (event) {
    if (dragState != null) {
        map.forEachFeatureAtPixel(
            event.pixel,
            function(feature) {
                var geom = feature.getGeometry();
                // Only popup when Points are clicked
                if (geom.getType() == 'Point') {
                    var number = feature.get('number');
                    if (number != dragState) {
                        curState.curPlan.get().rePlan(dragState, number);
                    }
                }
            }
        );
        dragState = null;
    }
    return false;
};

function initPopup() {
    pointPopup = new Popup();
    plannedPointPopup = new Popup();

    map.on('click', handleMapClick);
    map.on('singleclick', handleMapClick);
    map.on('dblclick', handleMapClick);
/*
    map.addInteraction(
        new ol.interaction.LongTouch({
            handleLongTouchEvent: handleMapClick
        })
    );
*/
};

/**
 * Points handling
 */

function mkPointStyleFunc(color) {
    var basicPointStyle = styleCache['basicPoint' + color];
    var zoomMinPointStyle = styleCache['zoomMinPoint' + color];
    // The tapPointStyle is a larger, invisible circle, that makes
    // it easier to tap on the point on a touch screen.
    var tapPointStyle = styleCache['tapPoint'];
    if (!basicPointStyle) {
        basicPointStyle =
            new Style({
                image: new Circle({
                    radius: POINT_RADUIS,
                    fill: new Fill({
                        color: color,
                        opacity: 1
                    })
                })
            });
        styleCache['basicPoint' + color] = basicPointStyle;
    }
    if (!zoomMinPointStyle) {
        zoomMinPointStyle =
            new Style({
                image: new Circle({
                    radius: POINT_RADUIS_ZOOM_MIN,
                    fill: new Fill({
                        color: color,
                        opacity: 1
                    })
                })
            });
        styleCache['zoomMinPoint' + color] = zoomMinPointStyle;
    }
    if (!tapPointStyle) {
        tapPointStyle =
            new Style({
                image: new Circle({
                    radius: TAP_RADUIS
                })
            });
        styleCache['tapPoint'] = tapPointStyle;
    }

    var pointStyleFunction =
        function(feature, resolution) {
            var number = feature.get('number');
            var label = number + ' ' + feature.get('name');
            var styleName = number + '1';
            var font = POINT_LABEL_FONT_ZOOM_MIN;
            var pointStyle = zoomMinPointStyle;
            if (getZoomLevel(resolution) > 3) {
                font = POINT_LABEL_FONT_ZOOM_MED;
                styleName = number + '2';
                pointStyle = basicPointStyle;
            } else if (getZoomLevel(resolution) < 3) {
                styleName = number + '3';
                label = number;
            }
            var labelStyle = styleCache[styleName];
            if (!labelStyle) {
                labelStyle = new Style({
                    text: new Text({
                        font: font,
                        text: label,
                        offsetY: -10
                    })
                });
                styleCache[styleName] = labelStyle;
            }
            if (getZoomLevel(resolution) < 2) {
                return [pointStyle, tapPointStyle];
            }
            return [pointStyle, tapPointStyle, labelStyle];
        };
    return pointStyleFunction;
};

function mkPointsLayer(points, title, color) {
    var format = new GeoJSON();
    var features = format.readFeatures(points,
                                       {dataProjection: 'EPSG:4326',
                                        featureProjection: 'EPSG:3857'});
    var source = new VectorSource();
    source.addFeatures(features);

    return new VectorLayer({
        source: source,
        style: mkPointStyleFunc(color),
        title: title,
        //updateWhileAnimating: true,
        updateWhileInteracting: true,
        visible: true
    });
};

/**
 * Legs handling
 */

/*
  forceLegDistances
    1: always show leg distance
    0: show if resolution permits
    -1: never show leg distance
 */
var forceLegDistances = 0;

function getLegStyle(name, strokeOpts) {
    var style = styleCache[name];
    if (!style) {
        style =
            new Style({
                stroke: new Stroke(strokeOpts)
            });
        styleCache[name] = style;
    }
    return style;
};

function mkLegStyleFunc(color) {
    // used for zoomed out maps
    var basicLegStyle0 =
        getLegStyle('basicLeg0' + color,
                    {width: LEG_WIDTH_MIN,
                     color: color});
    // used for next possible leg in zoomed out maps
    var nextLegStyle0 =
        getLegStyle('nextLeg0' + color,
                    {width: NEXT_LEG_WIDTH_MIN,
                     color: color});
    // used for zoom min and med maps
    var basicLegStyle1 =
        getLegStyle('basicLeg1' + color,
                    {width: LEG_WIDTH_MED,
                     color: color});
    // used for next possible leg in zoom min and med maps
    var nextLegStyle1 =
        getLegStyle('nextLeg1' + color,
                    {width: NEXT_LEG_WIDTH_MED,
                     color: color});
    // used when a leg is logged once
    var loggedLeg1Style =
        getLegStyle('loggedLeg1Style',
                    {width: LOGGED_1_LEG_WIDTH,
                     color: LOGGED_LEG_COLOR});
    // used when a leg is logged twice
    var loggedLeg2Style =
        getLegStyle('loggedLeg2Style',
                    {width: LOGGED_2_LEG_WIDTH,
                     color: LOGGED_LEG_COLOR});
    // used when a leg is planned once
    var plannedLeg1Style =
        getLegStyle('plannedLeg1Style',
                    {width: 4,
                     lineDash: [4, 10],
                     color: LOGGED_LEG_COLOR});
    // used when a leg is planned twice
    var plannedLeg2Style =
        getLegStyle('plannedLeg2Style',
                    {width: 7,
                     lineDash: [4, 15],
                     color: LOGGED_LEG_COLOR});
    // used when a leg is logged once and planned
    // FIXME: in order to do this, we need to keep track of the leg's
    // direction ('580-581' vs '581-580') in the logbook and in the plan,
    // and use this style iff one direction is logged, and the other planned.
/*
    var plannedAndloggedLegStyle =
        getLegStyle('plannedAndloggedLegStyle',
                         {width: 8,
                          lineDash: [2, 15],
                          color: LOGGED_LEG_COLOR});
*/
    var legStyleFunction =
        function(feature, resolution) {
            var legStyle = basicLegStyle1;
            var nextLegStyle = nextLegStyle1;
            var labelNo = '1';
            if (getZoomLevel(resolution) > 4) {
                labelNo = '2';
            } else if (getZoomLevel(resolution) < 4) {
                legStyle = basicLegStyle0;
                nextLegStyle = nextLegStyle0;
            }
            var src = feature.get('src');
            var dst = feature.get('dst');
            var logged = 0;
            var curLogBook = curState.curLogBook.get();
            if (curLogBook) {
                logged = curLogBook.getLegSailed(src, dst);
            }
            var planned = 0;
            var curPlan = curState.curPlan.get();
            if (curPlan) {
                planned = curPlan.isLegPlanned(src, dst);
            }
            if (logged) {
                if (logged == 1) {
                    /*
                    if (planned && planned >= 1) {
                        legStyle = plannedAndloggedLegStyle;
                    } else {
                        legStyle = loggedLeg1Style;
                    }
                    */
                    legStyle = loggedLeg1Style;
                } else {
                    legStyle = loggedLeg2Style;
                }
            } else if (planned) {
                if (planned == 1) {
                    legStyle = plannedLeg1Style;
                } else {
                    legStyle = plannedLeg2Style;
                }
            } else {
                // neither logged nor planned
                var p;
                if (curState.planMode.get() && curPlan) {
                    p = curPlan.getLastPoint();
                    if (p == src || p == dst) {
                        legStyle = nextLegStyle;
                    }
                } else if (curLogBook &&
                           !(curLogBook.hasFinished() ||
                             curLogBook.isReadOnly())) {
                    p = curLogBook.getLastPoint();
                    if (p == src || p == dst) {
                        legStyle = nextLegStyle;
                    }
                }
            }
            if (showLegs &&
                (forceLegDistances == 1 ||
                 (forceLegDistances == 0 &&
                  getZoomLevel(resolution) > 3))) {
                // If zoomed in - show the distance as a text string
                var label = src + '-' + dst + labelNo;
                var labelStyle = styleCache[label];
                if (!labelStyle) {
                    var descr = feature.get('dist') + ' M';
                    var geometry = feature.getGeometry();
                    var rotation;
                    var offsetX;
                    var offsetY;
                    var font = LEG_LABEL_FONT_ZOOM_MED;
                    if (getZoomLevel(resolution) > 4) {
                        font = LEG_LABEL_FONT_ZOOM_MAX;
                    }
                    geometry.forEachSegment(function(start, end) {
                        var dx;
                        var dy;
                        if (end[0] > start[0]) {
                            dx = end[0] - start[0];
                            dy = end[1] - start[1];
                        } else {
                            dx = start[0] - end[0];
                            dy = start[1] - end[1];
                        }
                        rotation = Math.atan2(dy, dx);
                        // FIXME: do intelligent offset calculation
                        offsetX = 0;
                        offsetY = -10;
                    });
                    labelStyle = new Style({
                        text: new Text({
                            font: font,
                            text: descr,
                            rotation: -rotation,
                            offsetY: offsetY,
                            offsetX: offsetX
                        })
                    });
                    styleCache[label] = labelStyle;
                }
                return [legStyle, labelStyle];
            } else if (showLegs || logged || planned) {
                return [legStyle];
            } else {
                return [];
            }
        };
    return legStyleFunction;
};

function mkLegsLayer(legs, title, color) {
    var format = new GeoJSON();
    var features = format.readFeatures(legs,
                                       {dataProjection: 'EPSG:4326',
                                        featureProjection: 'EPSG:3857'});
    var source = new VectorSource();
    source.addFeatures(features);

    return new VectorLayer({
        source: source,
        style: mkLegStyleFunc(color),
        title: title,
        //updateWhileAnimating: true,
        updateWhileInteracting: true,
        visible: true
    });
};

/**
 * Buttonbar handling
 */

function planModeActivate(active) {
    if (active) {
        $('#tf-nav-plan-mode').addClass('tf-plan-active');
    } else {
        $('#tf-nav-plan-mode').removeClass('tf-plan-active');
    }
    if (inshoreLegsLayer) {
        inshoreLegsLayer.changed();
        offshoreLegsLayer.changed();
    }
    updateStatusBar();
};

function showLegsActivate(active) {
    // We don't call the layer's setVisible() function, since
    // the logged and planned legs are just styles in these layers;
    // if we made the layer invisible, we wouldn't see the plan.
    showLegs = active;
    if (inshoreLegsLayer) {
        inshoreLegsLayer.changed();
        offshoreLegsLayer.changed();
    }
};

function initNavbar() {
    // initiate the checkboxes according to default state
    $('#tf-nav-show-legs').prop('checked', showLegs);

    $('#tf-status-interrupt').on('click', function() {
        alert('<p>Du har ett pågående avbrott</p>');
        return false;
    });

    $('#tf-nav-show-legs').change(function(event) {
        showLegsActivate(event.target.checked);
    });

    $('.tf-nav-distances').change(function(event) {
        switch (event.target.value) {
        case 'auto':
            forceLegDistances = 0;
            break;
        case 'show':
            forceLegDistances = 1;
            break;
        case 'hide':
            forceLegDistances = -1;
            break;
        }
        if (inshoreLegsLayer) {
            inshoreLegsLayer.changed();
            offshoreLegsLayer.changed();
        }
    });

    $('#tf-nav-boats').on('click', function() {
        var curRegatta = curState.curRegatta.get();
        if (!curRegatta) {
            alertNoRace('se deltagande båtar');
            return false;
        }
        var opts = {regatta: curRegatta};
        if (curState.mode.get() == 'showRegatta') {
            opts['adminView'] = true;
        }
        openBoatsPage(opts);
        return false;
    });

    $('#tf-nav-log').on('click', function() {
        var curLogBook = curState.curLogBook.get();
        if (!curLogBook) {
            alertNoRace('göra en loggboksanteckning');
            return false;
        } else if (curLogBook.isReadOnly()) {
            alert('<p>När loggboken är signerad går det inte att' +
                  ' göra en loggboksanteckning.</p>');
            return false;
        }
        openAddLogEntryPage({
            logBook: curLogBook
        });
        return false;
    });

    $('#tf-nav-logbook').on('click', function() {
        var curLogBook = curState.curLogBook.get();
        if (!curLogBook) {
            alertNoRace('öppna loggboken');
        } else {
            openLogBook({
                logBook: curLogBook
            });
        }
        return false;
    });

    $('#tf-nav-plan-mode').on('click', function() {
        /*
        if (!curState.curRace.get()) {
            alertNoRace('planera en rutt');
            return false;
        }
        */
        openPlanMenuPage();
        return false;
    });

    $('#tf-nav-show-activate-race').on('click', function() {
        // close the dropdown
        $('#tf-nav-more').dropdown('toggle');
        if (!curState.loggedInPersonId.get()) {
            alert('<p>Du behöver logga in för att kunna ' +
                  'aktivera en segling.</p>');
            return false;
        }
        openActivateRacePage();
        return false;
    });

    $('#tf-nav-show-settings').on('click', function() {
        // close the dropdown
        $('#tf-nav-more').dropdown('toggle');
        openSettingsPage();
        return false;
    });

    $('#tf-nav-show-help').on('click', function() {
        // close the dropdown
        $('#tf-nav-more').dropdown('toggle');
        pushPage(
            function() { $('#help-page').modal({backdrop: 'static'}); },
            function() { $('#help-page').modal('hide'); });
        document.activeElement.blur();
        return false;
    });

    $('#tf-nav-show-info').on('click', function() {
        // close the dropdown
        $('#tf-nav-more').dropdown('toggle');
        pushPage(
            function() { $('#info-page').modal({backdrop: 'static'}); },
            function() { $('#info-page').modal('hide'); });
        document.activeElement.blur();
        return false;
    });

};

function alertNoRace(w) {
    var s = '<p>Du behöver ';
    if (!curState.loggedInPersonId.get()) {
        s += 'logga in och ';
    }
    s += 'aktivera en segling för att kunna ' + w + '.</p>';
    alert(s);
};

/**
 * Status bar handling
 */

function updateStatusBar() {
    if (!curState.curRace.get()) {
        $('#tf-status-time').text('--:--');
    }

    if (curState.boatState.lanterns) {
        $('#tf-status-lanterns-on').show();
    } else {
        $('#tf-status-lanterns-on').hide();
    }
    if (curState.boatState.engine) {
        $('#tf-status-engine-on').show();
    } else {
        $('#tf-status-engine-on').hide();
    }
    if (curState.activeInterrupt) {
        $('#tf-status-interrupt').show();
    } else {
        $('#tf-status-interrupt').hide();
    }

    var dist = 0;
    var curLogBook = curState.curLogBook.get();
    if (curLogBook) {
        var start = curLogBook.getStartTime();
        var speed = curLogBook.getAverageSpeed();
        var finished = curLogBook.hasFinished();
        dist = curLogBook.getSailedDistance();
        var netDist = curLogBook.getNetDistance();

        $('#tf-status-boat').text(curLogBook.teamData.boat_name);

        if (start) {
            if (!headerTimer && !finished) {
                updateStatusBarTime();
                headerTimer =
                    window.setInterval(updateStatusBarTime, 60000);
            } else if (finished && headerTimer) {
                window.clearInterval(headerTimer);
                headerTimer = null;
            }
            if (finished) {
                $('#tf-status-time').text('--:--');
            }
        } else {
            $('#tf-status-time').text('--:--');
            if (headerTimer) {
                window.clearInterval(headerTimer);
                headerTimer = null;
            }
        }
        $('#tf-status-speed').text(speed.toFixed(1) + ' kn');
        $('#tf-status-distance').text(dist.toFixed(1) + ' M');
        $('#tf-status-net-distance').text(netDist.toFixed(1) + ' M');
        if (curLogBook.hasConflict()) {
            $('#tf-nav-logbook-badge').show();
        } else {
            $('#tf-nav-logbook-badge').hide();
        }
    } else {
        $('#tf-status-distance').text('-.- M');
        $('#tf-status-net-distance').text('-.- M');
        $('#tf-status-speed').text('-.- kn');
        $('#tf-status-boat').text('');
        $('.tf-status-plan').hide();
        if (headerTimer) {
            window.clearInterval(headerTimer);
            headerTimer = null;
        }
        $('#tf-nav-logbook-badge').hide();
    }

    var curPlan = curState.curPlan.get();
    if (curPlan) {
        var planDist = curPlan.getPlannedDistance();
        var planSpeed = curPlan.getPlannedSpeed();
        var totalDist = planDist + dist;
        if (finished || planSpeed == -1) {
            $('#tf-status-planned-speed').text('-.- kn');
        } else {
            $('#tf-status-planned-speed').text(planSpeed.toFixed(1) + ' kn');
        }
        $('#tf-status-planned-distance').text(totalDist.toFixed(1) + ' M');
        $('.tf-status-plan').show();
    } else {
        $('.tf-status-plan').hide();
    }

    var curRegatta = curState.curRegatta.get();
    if (curRegatta && curRegatta.log_updated) {
        $('#tf-nav-boats-badge').show();
    } else {
        $('#tf-nav-boats-badge').hide();
    }

};

function updateStatusBarTime() {
    var sign = '';
    function p(num) {
        return (num < 10 ? '0' : '') + num;
    }
    var curLogBook = curState.curLogBook.get();
    if (curLogBook) {
        var raceLeft = curLogBook.getRaceLeftMinutes();
        if (raceLeft < 0) {
            sign = '-';
            raceLeft = -raceLeft;
        }
        var hr = Math.floor(raceLeft / 60);
        var mi = Math.floor(raceLeft % 60);
        $('#tf-status-time').text(sign + p(hr) + ':' + p(mi));
    } else {
        $('#tf-status-time').text('--:--');
    }
};

var headerTimer = null;

export function updateAll() {
    updateStatusBar();
    if (inshoreLegsLayer) {
        inshoreLegsLayer.changed();
        offshoreLegsLayer.changed();
    }
};

function setFontSize(val) {
    $('#tf-html').removeClass('tf-small');
    $('#tf-html').removeClass('tf-normal');
    $('#tf-html').removeClass('tf-large');
    $('#tf-html').removeClass('tf-x-large');
    $('.tf-nav-icon').removeClass('tf-nav-large');
    $('.tf-status-icon').removeClass('tf-status-large');
    switch (val) {
    case 'small':
        $('#tf-html').addClass('tf-small');
        break;
    case 'normal':
        $('#tf-html').addClass('tf-normal');
        break;
    case 'large':
        $('#tf-html').addClass('tf-large');
        $('.tf-nav-icon').addClass('tf-nav-large');
        $('.tf-status-icon').addClass('tf-status-large');
        break;
    case 'x-large':
        $('#tf-html').addClass('tf-x-large');
        $('.tf-nav-icon').addClass('tf-nav-large');
        $('.tf-status-icon').addClass('tf-status-large');
        break;
    }
};

/**
 * Add the PoD to the map
 */

function setPodLayers(pod) {
    map.removeLayer(inshoreLegsLayer);
    map.removeLayer(offshoreLegsLayer);
    map.removeLayer(turningPointsLayer);
    map.removeLayer(startPointsLayer);

    if (pod) {
        var podSpec = pod.getTerrain();
        turningPointsLayer =
            mkPointsLayer(podSpec.turningPoints, 'TurningPoints',
                          TURN_POINT_COLOR);
        startPointsLayer =
            mkPointsLayer(podSpec.startPoints, 'StartPoints',
                          START_POINT_COLOR);
        inshoreLegsLayer =
            mkLegsLayer(podSpec.inshoreLegs, 'InshoreLegs',
                        INSHORE_LEG_COLOR);
        offshoreLegsLayer =
            mkLegsLayer(podSpec.offshoreLegs, 'OffshoreLegs',
                        OFFSHORE_LEG_COLOR);

        map.addLayer(inshoreLegsLayer);
        map.addLayer(offshoreLegsLayer);
        map.addLayer(turningPointsLayer);
        map.addLayer(startPointsLayer);
    } else {
        inshoreLegsLayer = undefined;
        offshoreLegsLayer = undefined;
        turningPointsLayer = undefined;
        startPointsLayer = undefined;
    }
};

function stateSetupDone() {
    if (!inshoreLegsLayer) {
        setPodLayers(curState.defaultPod);
    }
    if (curState.mode.get() == 'showRegatta') {
        showRegatta(curState.showRegattaId.get());
        return;
    }

    // 1. center on 580 initially
    // 2. then if we have a latest logged position, center there.
    // 3. else if we have start point, center there.
    // 4. otherwise use geolocation.
    //
    // In this process, 2 and 3 may be, and 4 will be, delayed
    // operations.  If the user has panned the map, don't change the
    // center.

    var centerSet = false;
    var curLogBook = curState.curLogBook.get();
    if (curLogBook) {
        var p = curLogBook.getLastPoint();
        if (!p) {
            p = curLogBook.getStartPoint();
        }
        if (p) {
            var pod = curState.curRace.get().getPod();
            if (pod) {
                var point = pod.getPoint(p);
                if (point && !initialCenterChanged) {
                    var center = transform(point.coords,
                                           'EPSG:4326', 'EPSG:3857');
                    view.setCenter(center);
                    centerSet = true;
                }
            }
        }
    }
    if (!centerSet && navigator && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                if (!initialCenterChanged) {
                    var center = transform([pos.coords.longitude,
                                            pos.coords.latitude],
                                           'EPSG:4326',
                                           'EPSG:3857');
                    view.setCenter(center);
                }
            },
            function() {
                //alert('geo-error: ' + error.code);
            },
            {
                timeout: 1 * 60 * 1000,   // 1 minute
                maximumAge: 2 * 60 * 1000 // 2 minutes old is ok
            });
    }
    updateAll();
};


$(document).ready(function() {
    $('.dialog-close').on('click', function() {
        popPage();
        return false;
    });
    var url = URL + '/agreements/latest';
    if (isCordova) {
        $('#privacy-policy').on('click', function() {
            SafariViewController.isAvailable(function(available) {
                if (available) {
                    SafariViewController.show({
                        url: url,
                        hidden: false,
                        animated: false
                        //barColor: "#0000ff", // default is white (iOS 10 only)
                        //tintColor: "#ffffff" // default is ios blue
                    });
                } else {
                    window.open(url);
                }
            });
        });
    } else {
        $('#privacy-policy').attr('href', url);
    }
});

export function initMapUI() {
    initMap();
    initPopup();
    initNavbar();

    var mapLayer = mkMapLayer();

    //tf.ui.patchTileUrls();

    map.addLayer(mapLayer);

    map.addOverlay(pointPopup);
    map.addOverlay(plannedPointPopup);

    var coords = [18.387, 59.44]; // 580 is the initial center

    var center = transform(coords, 'EPSG:4326', 'EPSG:3857');

    view = new View({
        center: center,
        minZoom: 7,
        maxZoom: 13,
        zoom: 10
    });

    view.once('change:center', function() {
        initialCenterChanged = true;
    });

    curState.loggedInPersonId.onChange(function() {
        updateAll();
    });

    curState.curRace.onChange(function() {
        if (curState.curRace.get()) {
            setPodLayers(curState.curRace.get().getPod());
        } else {
            setPodLayers(curState.defaultPod);
        }
        updateAll();
    });

    curState.curLogBook.onChange(function(logBook) {
        if (logBook) {
            if (curState.mode.get() == 'race' &&
                logBook.signed == false &&
                curState.loggedInPersonId.get() == logBook.teamData.skipper_id){
                var lateFinTime = moment(logBook.race.getStartTimes().start_to)
                    .add(logBook.race.getRaceLengthHours(), 'h')
                    .add(3, 'h');
                if (logBook.state == 'finished' ||
                    logBook.state == 'finished-early' ||
                    logBook.state == 'dns' ||
                    logBook.state == 'dnf') {
                    var reason;
                    if (logBook.state == 'dns') {
                        reason = 'Starar inte (DNS)';
                    } else if (logBook.state == 'dnf') {
                        reason = 'Bryter seglingen (DNF)';
                    } else {
                        reason = 'Målgång';
                    }
                    alert('<p>Du har loggat "' + reason +
                          '" men du har inte signerat loggboken.</p>' +
                          '<p>Kontrollera loggboken och signera' +
                          ' den sedan.</p>');
                } else if (moment().isAfter(lateFinTime)) {
                    alert('<p>Din segling verkar avslutad, men du har' +
                          ' inte loggat att du har gått i mål eller' +
                          ' brutit.</p>');
                }
            }
            logBook.onLogUpdate(updateAll, 100);
        }
        updateAll();
    });

    curState.curPlan.onChange(function(plan) {
        if (!plan) {
            $('#tf-nav-plan-name').html('');
            planModeActivate(false);
        } else {
            $('#tf-nav-plan-name').html(plan.name);
            updateAll();
            plan.onPlanUpdate(updateAll);
        }
    });

    curState.planMode.onChange(function(val) {
        planModeActivate(val);
    });

    $('#tf-nav-boats-badge').hide();

    curState.fontSize.onChange(function(val) {
        setFontSize(val);
    });
    var fs = curState.fontSize.get();
    if (fs == null) {
        // initial value; try to detect high dpi large screens,
        // and set font size large on these
        if (window.devicePixelRatio > 1.5 &&
            $('#tf-media').css('content') == '"md+"') {
            curState.fontSize.set('large');
        } else {
            curState.fontSize.set('normal');
        }
    }

    updateStatusBar();

    document.addEventListener('resume', updateStatusBarTime, false);

    map.setView(view);

    $('.tf-default-race-hidden').removeClass('tf-default-race-hidden');

/* I don't know if this is a good idea or not...

    // if no client id has been set, ask the user to provide one
    if (curState.clientId.get() == null) {
        tf.ui.addclientid.open(function() {
            setupLogin(stateSetupDone, openLoginPage);
        });
    } else {
        setupLogin(stateSetupDone, openLoginPage);
    }
*/

    setupLoginP()
        .then(function(res) {
            dbg('ui - login done: ' + res);
            setupContinue();
            stateSetupDone();
        })
        .catch(function(response) {
            dbg('ui - login fail: ' + response);
            dbg(response.stack);
            if (response == false) {
                openLoginPage();
                stateSetupDone(); // FIXME
            } else if (response == 'nonetwork') {
                alert('<p>Det finns inget nätverk.  Du måste logga in när ' +
                      'du har nätverk.</p>');
                stateSetupDone();
            } else if (typeof(response) == 'string') {
                alertUpgrade(response);
            } else {
                alert('<p>Något gick fel.</p>' +
                      '<p>' + response.errorStr + '</p>' +
                      '<p>' + response.url + '</p>' +
                      '<pre>' + response.stack + '</pre>');
            }
        });
};

var showTeams;
var showRaces;
var showPod;

function showRegatta(regattaId) {
    // tmp hack - don't set cur* and boat state when we show the regatta
    curState.curRegatta.set(null);
    curState.curRace.set(null);
    curState.curLogBook.set(null);
    curState.boatState.engine = false;
    curState.boatState.lanterns = false;
    curState.activeInterrupt = false;

    getRegattaRacesP(regattaId)
        .then(function(races) {
            showRaces = races;
            if (races.length == 0) {
                throw false;
            }
            return getPodP(races[0].terrain_id);
        })
        .then(function(pod) {
            showPod = pod;
            return getRegattaTeamsP(regattaId);
        })
        .then(function(teams) {
            showTeams = teams;
            return getRegattaLogsP(regattaId);
        })
        .then(function(logs) {
            var regatta = new Regatta(regattaId, showRaces[0].regatta_name,
                                      showRaces, showPod, showTeams, logs);
            $('#tf-nav-boats-badge').show();
            curState.curRegatta.set(regatta);
        });
};
