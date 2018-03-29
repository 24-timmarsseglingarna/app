/* -*- js -*- */

goog.provide('tf.ui');

goog.require('tf');
goog.require('tf.LogBook');
goog.require('tf.Plan');
goog.require('tf.Pod');
goog.require('tf.Race');
goog.require('tf.serverData');
goog.require('tf.state');
goog.require('tf.storage');

/*
goog.require('ol.Map');
goog.require('ol.control');
goog.require('ol.format.GeoJSON');
goog.require('ol.interaction');
goog.require('ol.layer.Tile');
goog.require('ol.layer.Vector');
goog.require('ol.source.Vector');
goog.require('ol.source.XYZ');
goog.require('ol.style.Circle');
goog.require('ol.style.Fill');
goog.require('ol.style.Stroke');
goog.require('ol.style.Style');
goog.require('ol.style.Text');
*/


/**
 * Font for point labels on zoom levels 1-3
 * @const {string}
 */
tf.ui.POINT_LABEL_FONT_ZOOM_MIN = 'bold 13px sans-serif';

/**
 * Font for point labels on zoom levels 4-5.
 * @const {string}
 */
tf.ui.POINT_LABEL_FONT_ZOOM_MED = 'bold 15px sans-serif';

/**
 * Font for leg labels on zoom levels 1-4.
 * @const {string}
 */
tf.ui.LEG_LABEL_FONT_ZOOM_MED = 'bold 13px sans-serif';

/**
 * Font for leg labels on zoom level 5.
 * @const {string}
 */
tf.ui.LEG_LABEL_FONT_ZOOM_MAX = 'bold 15px sans-serif';

/**
 * Radius of visible circle around point
 * @const {number}
 */
tf.ui.POINT_RADUIS = 5;
tf.ui.POINT_RADUIS_ZOOM_MIN = 4;

/**
 * Radius of circle that accepts taps around point
 * @const {number}
 */
tf.ui.TAP_RADUIS = 16;

/**
 * Width of leg line on MIN zoom levels.
 * @const {number}
 */
tf.ui.LEG_WIDTH_MIN = 1;

/**
 * Width of next possible leg line on MIN zoom levels.
 * @const {number}
 */
tf.ui.NEXT_LEG_WIDTH_MIN = tf.ui.LEG_WIDTH_MIN + 2;

/**
 * Width of leg line on MED and MAX zoom levels.
 * @const {number}
 */
tf.ui.LEG_WIDTH_MED = 2;

/**
 * Width of next possible leg line on MED and MAX zoom levels.
 * @const {number}
 */
tf.ui.NEXT_LEG_WIDTH_MED = tf.ui.LEG_WIDTH_MED + 2;

/**
 * Width of leg line that has been logged once.
 * @const {number}
 */
tf.ui.LOGGED_1_LEG_WIDTH = 3;

/**
 * Width of leg line that has been logged twice.
 * @const {number}
 */
tf.ui.LOGGED_2_LEG_WIDTH = 5;

/**
 * Color of leg line that has been logged.
 * @const {string}
 */
tf.ui.LOGGED_LEG_COLOR = '#000000';

/**
 * Color of start point
 * @const {string}
 */
tf.ui.START_POINT_COLOR = '#e31a1c'; // red

/**
 * Color of turning point
 * @const {string}
 */
tf.ui.TURN_POINT_COLOR = '#000000';

/**
 * Color of inshore leg
 * @const {string}
 */
tf.ui.INSHORE_LEG_COLOR = '#0113e6'; // blue

/**
 * Color of offshore leg
 * @const {string}
 */
tf.ui.OFFSHORE_LEG_COLOR = '#f31b1f'; // some-other-red

/**
 * Detect environment
 */

tf.ui.isTouch = 'ontouchstart' in window || navigator.msMaxTouchPoints > 0;

/**
 * Handle the browser/phone back button.
 */

tf.ui.pageStack = [];

/**
 * Initialize ui ephemeral state variables
 */

tf.ui.showLegs = true;
tf.ui.planMode = false;
tf.ui.dragState = null;
tf.ui.initialCenterChanged = false;

/*
 * When we open a new page/modal, the code calls
 * pushPage(openfn, closefn).  The close function should close the window.
 * It MUST NOT call popPage().
 *
 * It order to go back to the previous page, the code must call
 * popPage(), e.g., when a 'cancel', 'save', or 'ok' button is clicked.
 * popPage() is set up to be the same as hitting the 'back' button.
 * In this case, the sentinel function is called to actually close the
 * open page.
 */
tf.ui.pushPage = function(openfn, closefn) {
    // close current page, if there is one
    if (tf.ui.pageStack.length > 0) {
        cur = tf.ui.pageStack[tf.ui.pageStack.length - 1];
        cur.closefn();
    }
    tf.ui.pageStack.push({openfn: openfn,
                          closefn: closefn});
    history.pushState(tf.ui.pageStack.length, document.title, location.href);
    openfn();
};

/*
  FIXME: BUG: click logbook, click first entry's pen then Ändra,
              then back, works, but if you click back again, it doesn't work.
*/

/*
 * Note that this is an asynchronous function (on chrome), which means
 * that if you need to do more work after the page has closed (e.g.,
 * open a new page), it must be done in the continuefn.
 */
tf.ui.popPage = function(continuefn) {
    if (continuefn) {
        // ensure that we run both the original closefn, and the
        // continuefn when the history.back's popstate event actually
        // triggers.
        prev = tf.ui.pageStack.pop();
        tf.ui.pageStack.push({openfn: prev.openfn,
                              closefn: function() {
                                  prev.closefn();
                                  continuefn();
                              }});
    }
    history.back();
};

history.replaceState(0, document.title, location.href);

window.addEventListener('popstate', function(event) {
    // event.state is the state of the state we're going to
    if (tf.ui.pageStack.length > 0) {
        if (event.state + 1 > tf.ui.pageStack.length) {
            // user is trying to move forward; ignore
        } else {
            var steps = tf.ui.pageStack.length - event.state;
            for (var i = 0; i < steps; i++) {
                var prev = tf.ui.pageStack.pop();
                prev.closefn();
            }
            // re-open last page
            if (tf.ui.pageStack.length > 0) {
                cur = tf.ui.pageStack[tf.ui.pageStack.length - 1];
                cur.openfn();
            }
        }
    }
});

/**
 * We define 5 zoom levels; 5 is max zoomed in (small area)
 * and 1 is max zoomed out (large area).
 */
tf.ui.getZoomLevel = function(resolution) {
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

tf.ui.map = new ol.Map({
    target: 'map',
    /*
     * Increase moveTolerance in order to detect taps correctly on
     * Sony Xperia Z3 Compact and Z4 Tablet.
     */
    moveTolerance: 1.5,
    loadTilesWhileInteracting: true,
    //loadTilesWhileAnimating: true,
    controls: ol.control.defaults({
        attribution: false,
        rotate: false,
        zoom: !(tf.ui.isTouch) // no zoom on touch screen
    }),
    interactions: ol.interaction.defaults({
        altShiftDragRotate: false,
        pinchRotate: false,
        doubleClickZoom: false
    }).extend([new ol.interaction.Pointer({
        handleDownEvent: function(event) {
            return tf.ui.handleMapPointerDown(event);
        },
        handleUpEvent: function(event) {
            return tf.ui.handleMapPointerUp(event);
        }
    })])
});

tf.ui.mapURL =
    'tiles/{z}/{x}/{y}.png';

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

tf.ui.mkMapLayer = function() {
    tf.ui.mapSource = new ol.source.XYZ({
        url: tf.ui.mapURL
    });
    tf.ui.mapLayer = new ol.layer.Tile({
        source: tf.ui.mapSource,
        preload: 7
    });
};

/**
 * A cache for all ol.style.Styles we create, so that we don't create
 * unnecessary garbage.
 */
tf.ui.styleCache = {};

/**
 * Point Popup handling
 */

tf.ui.mkPointPopupHTML = function(number, name, descr, eta) {
    var s = '<p><b>' + number + ' ' + name + '</b></p>' +
        '<p>' + descr + '</p>';
    for (var i = 0; i < eta.length; i++) {
        s += '<p>Planerad rundningstid: ' + eta[i] + '</p>';
    }
    if (tf.state.curLogBook) {
        // we use a tabindex b/c bootstrap v4 styles a's w/o tabindex
        // and w/o href in a bad way
        s += '<p><a class="log-point-button" tabindex="0"' +
            ' onclick="tf.ui.logPoint(\'' + number + '\')">' +
            'Logga denna punkt</a></p>';
    }
    return s;
};

tf.ui.logPoint = function(number) {
    tf.ui.pointPopup.hide();
    tf.ui.logEntry.openLogEntry({point: number,
                                 type: 'round',
                                 logBook: tf.state.curLogBook});
};

tf.ui.mkPlannedPointPopupHTML = function(number, name) {
    var s = '<p><b>' + number + ' ' + name + '</b></p>' +
        '<p><a class="log-point-button" tabindex="0"' +
        ' onclick="tf.ui.delPlannedPoint(\'' + number + '\')">' +
        'Tag bort denna punkt</a></p>' +
        '<p><a class="log-point-button" tabindex="0"' +
        ' onclick="tf.ui.delTailPlan(\'' + number + '\')">' +
        'Tag bort resten av planen</a></p>' +
        '<p><a class="log-point-button" tabindex="0"' +
        ' onclick="tf.ui.delPlan()">' +
        'Tag bort hela planen</a></p>';
    return s;
};

tf.ui.delPlannedPoint = function(number) {
    tf.ui.plannedPointPopup.hide();
    tf.state.curPlan.get().delPoint(number);
};

tf.ui.delTailPlan = function(number) {
    tf.ui.plannedPointPopup.hide();
    tf.state.curPlan.get().delTail(number);
};

tf.ui.delPlan = function() {
    tf.ui.plannedPointPopup.hide();
    tf.state.curPlan.get().delAllPoints();
};

tf.ui.handleMapClick = function(event) {
    tf.ui.map.forEachFeatureAtPixel(
        event.pixel,
        function(feature) {
            var geom = feature.getGeometry();
            // Only popup when Points are clicked
            if (geom.getType() == 'Point') {
                var number = feature.get('number');
                var name = feature.get('name');
                var descr = feature.get('descr');
                if (descr) {
                    if (tf.ui.planMode) {
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
                        if (tf.state.curPlan.get().isPointPlanned(number)) {
                            if (event.type === 'singleclick') {
                                tf.state.curPlan.get().addPoint(number);
                            } else if (event.type === 'dblclick') {
                                var coord = geom.getCoordinates();
                                tf.ui.plannedPointPopup.show(
                                    coord,
                                    tf.ui.mkPlannedPointPopupHTML(number,
                                                                  name));
                            }
                        } else {
                            if (event.type === 'singleclick') {
                                tf.state.curPlan.get().addPoint(number);
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
                        var eta = [];
                        if (tf.state.curPlan.get()) {
                            eta = tf.state.curPlan.get().getETA(number);
                        }
                        // show the popup from the center of the point
                        var coord = geom.getCoordinates();
                        tf.ui.pointPopup.show(
                            coord,
                            tf.ui.mkPointPopupHTML(number, name, descr,
                                                   eta));
                    }
                }
            }
        });
};

tf.ui.handleMapPointerDown = function(event) {
    if (!tf.ui.planMode || tf.ui.dragState != null) {
        return false;
    }
    return tf.ui.map.forEachFeatureAtPixel(
        event.pixel,
        function(feature) {
            var geom = feature.getGeometry();
            // Only popup when Points are clicked
            if (geom.getType() == 'Point') {
                var number = feature.get('number');
                var p = tf.state.curPlan;
                if (p && p.get().isPointPlanned(number)) {
                    tf.ui.dragState = number;
                    return true;
                }
            }
        }
    );
};

tf.ui.handleMapPointerUp = function(event) {
    if (tf.ui.dragState != null) {
        tf.ui.map.forEachFeatureAtPixel(
            event.pixel,
            function(feature) {
                var geom = feature.getGeometry();
                // Only popup when Points are clicked
                if (geom.getType() == 'Point') {
                    var number = feature.get('number');
                    if (number != tf.ui.dragState) {
                        tf.state.curPlan.get().rePlan(tf.ui.dragState, number);
                    }
                }
            }
        );
        tf.ui.dragState = null;
    }
    return false;
};

$(document).ready(function() {
    tf.ui.pointPopup = new ol.Overlay.Popup();
    tf.ui.plannedPointPopup = new ol.Overlay.Popup();

    tf.ui.map.on('click', tf.ui.handleMapClick);
    tf.ui.map.on('singleclick', tf.ui.handleMapClick);
    tf.ui.map.on('dblclick', tf.ui.handleMapClick);
/*
    tf.ui.map.addInteraction(
        new ol.interaction.LongTouch({
            handleLongTouchEvent: tf.ui.handleMapClick
        })
    );
*/
});

/**
 * Points handling
 */

tf.ui.mkPointStyleFunc = function(color) {
    var basicPointStyle = tf.ui.styleCache['basicPoint' + color];
    var zoomMinPointStyle = tf.ui.styleCache['zoomMinPoint' + color];
    // The tapPointStyle is a larger, invisible circle, that makes
    // it easier to tap on the point on a touch screen.
    var tapPointStyle = tf.ui.styleCache['tapPoint'];
    if (!basicPointStyle) {
        basicPointStyle =
            new ol.style.Style({
                image: new ol.style.Circle({
                    radius: tf.ui.POINT_RADUIS,
                    fill: new ol.style.Fill({
                        color: color,
                        opacity: 1
                    })
                })
            });
        tf.ui.styleCache['basicPoint' + color] = basicPointStyle;
    }
    if (!zoomMinPointStyle) {
        zoomMinPointStyle =
            new ol.style.Style({
                image: new ol.style.Circle({
                    radius: tf.ui.POINT_RADUIS_ZOOM_MIN,
                    fill: new ol.style.Fill({
                        color: color,
                        opacity: 1
                    })
                })
            });
        tf.ui.styleCache['zoomMinPoint' + color] = zoomMinPointStyle;
    }
    if (!tapPointStyle) {
        tapPointStyle =
            new ol.style.Style({
                image: new ol.style.Circle({
                    radius: tf.ui.TAP_RADUIS
                })
            });
        tf.ui.styleCache['tapPoint'] = tapPointStyle;
    }

    pointStyleFunction =
        function(feature, resolution) {
            tf.ui.resolution = resolution;
            var number = feature.get('number');
            var label = number + ' ' + feature.get('name');
            var styleName = number + '1';
            var font = tf.ui.POINT_LABEL_FONT_ZOOM_MIN;
            var pointStyle = zoomMinPointStyle;
            if (tf.ui.getZoomLevel(resolution) > 3) {
                font = tf.ui.POINT_LABEL_FONT_ZOOM_MED;
                styleName = number + '2';
                pointStyle = basicPointStyle;
            } else if (tf.ui.getZoomLevel(resolution) < 3) {
                styleName = number + '3';
                label = number;
            }
            var labelStyle = tf.ui.styleCache[styleName];
            if (!labelStyle) {
                labelStyle = new ol.style.Style({
                    text: new ol.style.Text({
                        font: font,
                        text: label,
                        offsetY: -10
                    })
                });
                tf.ui.styleCache[styleName] = labelStyle;
            }
            if (tf.ui.getZoomLevel(resolution) < 2) {
                return [pointStyle, tapPointStyle];
            }
            return [pointStyle, tapPointStyle, labelStyle];
        };
    return pointStyleFunction;
};

tf.ui.mkPointsLayer = function(points, title, color) {
    var format = new ol.format.GeoJSON();
    var features = format.readFeatures(points,
                                       {dataProjection: 'EPSG:4326',
                                        featureProjection: 'EPSG:3857'});
    var source = new ol.source.Vector();
    source.addFeatures(features);

    return new ol.layer.Vector({
        source: source,
        style: tf.ui.mkPointStyleFunc(color),
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
tf.ui.forceLegDistances = 0;

tf.ui.getLegStyle = function(name, strokeOpts) {
    var style = tf.ui.styleCache[name];
    if (!style) {
        style =
            new ol.style.Style({
                stroke: new ol.style.Stroke(strokeOpts)
            });
        tf.ui.styleCache[name] = style;
    }
    return style;
};

tf.ui.mkLegStyleFunc = function(color) {
    // used for zoomed out maps
    var basicLegStyle0 =
        tf.ui.getLegStyle('basicLeg0' + color,
                         {width: tf.ui.LEG_WIDTH_MIN,
                          color: color});
    // used for next possible leg in zoomed out maps
    var nextLegStyle0 =
        tf.ui.getLegStyle('nextLeg0' + color,
                         {width: tf.ui.NEXT_LEG_WIDTH_MIN,
                          color: color});
    // used for zoom min and med maps
    var basicLegStyle1 =
        tf.ui.getLegStyle('basicLeg1' + color,
                         {width: tf.ui.LEG_WIDTH_MED,
                          color: color});
    // used for next possible leg in zoom min and med maps
    var nextLegStyle1 =
        tf.ui.getLegStyle('nextLeg1' + color,
                         {width: tf.ui.NEXT_LEG_WIDTH_MED,
                          color: color});
    // used when a leg is logged once
    var loggedLeg1Style =
        tf.ui.getLegStyle('loggedLeg1Style',
                         {width: tf.ui.LOGGED_1_LEG_WIDTH,
                          color: tf.ui.LOGGED_LEG_COLOR});
    // used when a leg is logged twice
    var loggedLeg2Style =
        tf.ui.getLegStyle('loggedLeg2Style',
                         {width: tf.ui.LOGGED_2_LEG_WIDTH,
                          color: tf.ui.LOGGED_LEG_COLOR});
    // used when a leg is planned once
    var plannedLeg1Style =
        tf.ui.getLegStyle('plannedLeg1Style',
                         {width: 4,
                          lineDash: [4, 10],
                          color: tf.ui.LOGGED_LEG_COLOR});
    // used when a leg is planned twice
    var plannedLeg2Style =
        tf.ui.getLegStyle('plannedLeg2Style',
                         {width: 7,
                          lineDash: [4, 15],
                          color: tf.ui.LOGGED_LEG_COLOR});
    // used when a leg is logged once and planned
    // FIXME: in order to do this, we need to keep track of the leg's
    // direction ('580-581' vs '581-580') in the logbook and in the plan,
    // and use this style iff one direction is logged, and the other sailed.
/*
    var plannedAndloggedLegStyle =
        tf.ui.getLegStyle('plannedAndloggedLegStyle',
                         {width: 8,
                          lineDash: [2, 15],
                          color: tf.ui.LOGGED_LEG_COLOR});
*/
    legStyleFunction =
        function(feature, resolution) {
            var legStyle = basicLegStyle1;
            var nextLegStyle = nextLegStyle1;
            var labelNo = '1';
            if (tf.ui.getZoomLevel(resolution) > 4) {
                labelNo = '2';
            } else if (tf.ui.getZoomLevel(resolution) < 4) {
                legStyle = basicLegStyle0;
                nextLegStyle = nextLegStyle0;
            }
            var src = feature.get('src');
            var dst = feature.get('dst');
            var logged = 0;
            if (tf.state.curLogBook) {
                logged = tf.state.curLogBook.getLegSailed(src, dst);
            }
            var planned = 0;
            var curPlan = tf.state.curPlan.get();
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
                if (tf.ui.planMode && curPlan) {
                    var p = curPlan.getLastPoint();
                    if (p == src || p == dst) {
                        legStyle = nextLegStyle;
                    }
                } else if (tf.state.curLogBook) {
                    var p = tf.state.curLogBook.getLastPoint();
                    if (p == src || p == dst) {
                        legStyle = nextLegStyle;
                    }
                }
            }
            if (tf.ui.showLegs &&
                (tf.ui.forceLegDistances == 1 ||
                 (tf.ui.forceLegDistances == 0 &&
                  tf.ui.getZoomLevel(resolution) > 3))) {
                // If zoomed in - show the distance as a text string
                var label = src + '-' + dst + labelNo;
                var labelStyle = tf.ui.styleCache[label];
                if (!labelStyle) {
                    var descr = feature.get('dist') + ' M';
                    var geometry = feature.getGeometry();
                    var rotation;
                    var offsetX;
                    var offsetY;
                    var font = tf.ui.LEG_LABEL_FONT_ZOOM_MED;
                    if (tf.ui.getZoomLevel(resolution) > 4) {
                        font = tf.ui.LEG_LABEL_FONT_ZOOM_MAX;
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
                    labelStyle = new ol.style.Style({
                        text: new ol.style.Text({
                            font: font,
                            text: descr,
                            rotation: -rotation,
                            offsetY: offsetY,
                            offsetX: offsetX
                        })
                    });
                    tf.ui.styleCache[label] = labelStyle;
                }
                return [legStyle, labelStyle];
            } else if (tf.ui.showLegs || logged || planned) {
                return [legStyle];
            } else {
                return [];
            }
        };
    return legStyleFunction;
};

tf.ui.mkLegsLayer = function(legs, title, color) {
    var format = new ol.format.GeoJSON();
    var features = format.readFeatures(legs,
                                       {dataProjection: 'EPSG:4326',
                                        featureProjection: 'EPSG:3857'});
    var source = new ol.source.Vector();
    source.addFeatures(features);

    return new ol.layer.Vector({
        source: source,
        style: tf.ui.mkLegStyleFunc(color),
        title: title,
        //updateWhileAnimating: true,
        updateWhileInteracting: true,
        visible: true
    });
};

/**
 * Buttonbar handling
 */

tf.ui.planModeActivate = function(active) {
    if (active) {
        tf.ui.planMode = true;
        $('#tf-nav-plan-mode').addClass('tf-plan-active');
    } else {
        tf.ui.planMode = false;
        $('#tf-nav-plan-mode').removeClass('tf-plan-active');
    }
    tf.ui.inshoreLegsLayer.changed();
    tf.ui.offshoreLegsLayer.changed();
    tf.ui.updateStatusBar();
};

tf.ui.showLegsActivate = function(active) {
    // We don't call the layer's setVisible() function, since
    // the logged and planned legs are just styles in these layers;
    // if we made the layer invisible, we wouldn't see the plan.
    tf.ui.showLegs = active;
    tf.ui.inshoreLegsLayer.changed();
    tf.ui.offshoreLegsLayer.changed();
};

$(document).ready(function() {
    // initiate the checkboxes according to default state
    $('#tf-nav-show-legs').prop('checked', tf.ui.showLegs);

    $('#tf-status-interrupt').on('click', function(event) {
        tf.ui.alert('<p>Du har ett pågående avbrott</p>');
        return false;
    });

    $('#tf-nav-show-legs').change(function(event) {
        tf.ui.showLegsActivate(event.target.checked);
    });

    /* FIXME: tmp debug test code */
    $('#tf-nav-log-get-others').on('click', function() {
        // close the dropdown
        $('#tf-nav-more').dropdown('toggle');
        if (!tf.state.curRegatta) {
            tf.ui._alert_no_race('hämta data');
        } else {
            tf.state.curRegatta.updateLogFromServer(function() {
                tf.ui.alert("data received from server");
            });
        }
        return false;
    });
    $('#tf-nav-log-get').on('click', function() {
        // close the dropdown
        $('#tf-nav-more').dropdown('toggle');
        if (!tf.state.curLogBook) {
            tf.ui._alert_no_race('hämta loggboken');
        } else {
            tf.state.curLogBook.updateFromServer(function() {
                tf.ui.alert("data received from server");
            });
        }
        return false;
    });
    $('#tf-nav-log-send').on('click', function() {
        // close the dropdown
        $('#tf-nav-more').dropdown('toggle');
        if (!tf.state.curLogBook) {
            tf.ui._alert_no_race('skicka in loggboken');
        } else {
            tf.state.curLogBook.sendToServer(function() {
                tf.ui.alert("data sent to server");
            });
        }
        return false;
    });

    /* END FIXME */

    $('.tf-nav-distances').change(function(event) {
        switch (event.target.value) {
        case 'auto':
            tf.ui.forceLegDistances = 0;
            break;
        case 'show':
            tf.ui.forceLegDistances = 1;
            break;
        case 'hide':
            tf.ui.forceLegDistances = -1;
            break;
        }
        tf.ui.inshoreLegsLayer.changed();
        tf.ui.offshoreLegsLayer.changed();
    });

    $('#tf-nav-boats').on('click', function(event) {
        if (!tf.state.curRace) {
            tf.ui._alert_no_race('se deltagande båtar');
            return false;
        }
        tf.ui.boats.openPage({race: tf.state.curRace});
        return false;
    });

    $('#tf-nav-log').on('click', function(event) {
        if (!tf.state.curLogBook) {
            tf.ui._alert_no_race('göra en loggboksanteckning');
            return false;
        }
        tf.ui.addLogEntry.openPage();
        return false;
    });

    $('#tf-nav-logbook').on('click', function(event) {
        if (!tf.state.curLogBook) {
            tf.ui._alert_no_race('öppna loggboken');
        } else {
            tf.ui.logBook.openLogBook({
                logBook: tf.state.curLogBook
            });
        }
        return false;
    });

    $('#tf-nav-plan-mode').on('click', function(event) {
        /*
        if (!tf.state.curRace) {
            tf.ui._alert_no_race('planera en rutt');
            return false;
        }
        */
        tf.ui.planMenu.openPage();
        return false;
    });

    $('#tf-nav-show-activate-race').on('click', function(event) {
        // close the dropdown
        $('#tf-nav-more').dropdown('toggle');
        if (!tf.state.isLoggedIn) {
            tf.ui.alert('<p>Du behöver logga in för att kunna ' +
                        'aktivera en segling.</p>');
            return false;
        }
        tf.ui.activateRace.openPage();
        return false;
    });

    $('#tf-nav-show-settings').on('click', function(event) {
        // close the dropdown
        $('#tf-nav-more').dropdown('toggle');
        tf.ui.settings.openPage();
        return false;
    });

    $('#tf-nav-show-help').on('click', function(event) {
        // close the dropdown
        $('#tf-nav-more').dropdown('toggle');
        tf.ui.pushPage(
            function() { $('#help-page').modal({backdrop: 'static'}); },
            function() { $('#help-page').modal('hide'); });
        document.activeElement.blur();
        return false;
    });

    $('#tf-nav-show-info').on('click', function(event) {
        // close the dropdown
        $('#tf-nav-more').dropdown('toggle');
        tf.ui.pushPage(
            function() { $('#info-page').modal({backdrop: 'static'}); },
            function() { $('#info-page').modal('hide'); });
        document.activeElement.blur();
        return false;
    });

    $('.dialog-close').on('click', function() {
        tf.ui.popPage();
        return false;
    });
});

tf.ui._alert_no_race = function(w) {
    var s = '<p>Du behöver ';
    if (!tf.state.isLoggedIn) {
        s += 'logga in och ';
    }
    s += 'aktivera en segling för att kunna ' + w + '.</p>';
    tf.ui.alert(s);
};

/**
 * @constructor
 * @extends {ol.control.Control}
 * @param {Object=} opt_options Control options.
 */
/*
tf.ui.ButtonControl = function(opt_options) {
    var element = $('<div>').addClass('ol-unselectable ol-control');

    var button = $('<button>').html(opt_options.html || '')
        .attr('title', opt_options.title)
        .on('click', opt_options.onClick)
        .appendTo(element);

    ol.control.Control.call(this, {
        element: element.get(0),
        target: opt_options.target
    });
};
ol.inherits(tf.ui.ButtonControl, ol.control.Control);
*/

/*
tf.ui.patchTileUrls = function() {

    tf.ui.mapSource.setTileUrlFunction(function(tileCoord, pixelRation, proj) {
        var key = tileCoord[0].toString() + '/' +
            tileCoord[1].toString() + '/' +
            (-tileCoord[2] - 1).toString();
        var sp = special_tiles[key];

        if (sp == 1) {
            return "tiles/yellow.png";
        } else if (sp == 2) {
            return "tiles/blue.png";
        }
        return 'tiles/' + key + '.png';
    });
}
*/


/**
 * Status bar handling
 */

tf.ui.updateStatusBar = function() {
    if (!tf.state.curRace) {
        $('#tf-status-time').text('--:--');
    }

    if (tf.state.boatState.lanterns) {
        $('#tf-status-lanterns-on').show();
    } else {
        $('#tf-status-lanterns-on').hide();
    }
    if (tf.state.boatState.engine) {
        $('#tf-status-engine-on').show();
    } else {
        $('#tf-status-engine-on').hide();
    }
    if (tf.state.activeInterrupt) {
        $('#tf-status-interrupt').show();
    } else {
        $('#tf-status-interrupt').hide();
    }

    var dist = 0;
    if (tf.state.curLogBook) {
        var start = tf.state.curLogBook.getStartTime();
        var speed = tf.state.curLogBook.getAverageSpeed();
        var finished = tf.state.curLogBook.hasFinished();
        dist = tf.state.curLogBook.getSailedDistance();

        $('#tf-status-boat').text(tf.state.curLogBook.teamData.boat_name);

        if (start) {
            if (!tf.ui.headerTimer && !finished) {
                // called first time from saveToLog
                // set interval to 5 seconds to get faster update after
                // sleep; otherwise 60 seconds would work as interval.
                tf.ui.updateStatusBarTime();
                tf.ui.headerTimer =
                    window.setInterval(tf.ui.updateStatusBarTime, 5000);
            } else if (finished && tf.ui.headerTimer) {
                window.clearInterval(tf.ui.headerTimer);
                tf.ui.headerTimer = null;
            }
            if (finished) {
                $('#tf-status-time').text('--:--');
            }
        } else {
            $('#tf-status-time').text('--:--');
            if (tf.ui.headerTimer) {
                window.clearInterval(tf.ui.headerTimer);
                tf.ui.headerTimer = null;
            }
        }
        $('#tf-status-speed').text(speed.toFixed(1) + ' kn');
        $('#tf-status-distance').text(dist.toFixed(1) + ' M');
    } else {
        $('#tf-status-distance').text('-.- M');
        $('#tf-status-speed').text('-.- kn');
        $('#tf-status-boat').text('');
        $('.tf-status-plan').hide();
        if (tf.ui.headerTimer) {
            window.clearInterval(tf.ui.headerTimer);
            tf.ui.headerTimer = null;
        }
    }

    var curPlan = tf.state.curPlan.get();
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

};

tf.ui.updateStatusBarTime = function() {
    var sign = '';
    function p(num) {
        return (num < 10 ? '0' : '') + num;
    }
    var raceLeft = tf.state.curLogBook.getRaceLeftMinutes();
    if (raceLeft < 0) {
        sign = '-';
        raceLeft = -raceLeft;
    }
    var hr = Math.floor(raceLeft / 60);
    var mi = Math.floor(raceLeft % 60);
    $('#tf-status-time').text(sign + p(hr) + ':' + p(mi));
};

tf.ui.headerTimer = null;

tf.ui.logBookChanged = function() {
    tf.ui.updateStatusBar();
    tf.ui.inshoreLegsLayer.changed();
    tf.ui.offshoreLegsLayer.changed();
};

tf.ui._setFontSize = function(val) {
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
 * Add the view and layers to the map
 */

$(document).ready(function() {
    var podSpec = basePodSpec;
    tf.ui.turningPointsLayer =
        tf.ui.mkPointsLayer(podSpec.turningPoints, 'TurningPoints',
                            tf.ui.TURN_POINT_COLOR);
    tf.ui.startPointsLayer =
        tf.ui.mkPointsLayer(podSpec.startPoints, 'StartPoints',
                            tf.ui.START_POINT_COLOR);

    tf.ui.inshoreLegsLayer =
        tf.ui.mkLegsLayer(podSpec.inshoreLegs, 'InshoreLegs',
                          tf.ui.INSHORE_LEG_COLOR);
    tf.ui.offshoreLegsLayer =
        tf.ui.mkLegsLayer(podSpec.offshoreLegs, 'OffshoreLegs',
                          tf.ui.OFFSHORE_LEG_COLOR);

    if (tf.state.isCordova) {
        document.addEventListener('deviceready', tf.ui.onDeviceReady, false);
    } else {
        tf.ui.onDeviceReady();
    }
});

tf.ui.centerChanged = function(event) {
    tf.ui.initialCenterChanged = true;
};

tf.ui.stateSetupDone = function() {
    // 1. center on 580 initially
    // 2. then if we have a latest logged position, center there.
    // 3. else if we have start point, center there.
    // 4. otherwise use geolocation.
    //
    // In this process, 2 and 3 may be, and 4 will be, delayed
    // operations.  If the user has panned the map, don't change the
    // center.

    var centerSet = false;
    if (tf.state.curLogBook) {
        var p = tf.state.curLogBook.getLastPoint();
        if (!p) {
            p = tf.state.curLogBook.getStartPoint();
        }
        if (p) {
            var pod = tf.state.curRace.getPod();
            var point = pod.getPoint(p);
            if (point && !tf.ui.initialCenterChanged) {
                var center = ol.proj.transform(point.coords,
                                               'EPSG:4326', 'EPSG:3857');
                tf.ui.view.setCenter(center);
                centerSet = true;
            }
        }
    }
    if (!centerSet && navigator && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                if (!tf.ui.initialCenterChanged) {
                    var center = ol.proj.transform([pos.coords.longitude,
                                                    pos.coords.latitude],
                                                   'EPSG:4326',
                                                   'EPSG:3857');
                    tf.ui.view.setCenter(center);
                }
            },
            function(error) {
                //alert('geo-error: ' + error.code);
            },
            {
                timeout: 1 * 60 * 1000,   // 1 minute
                maximumAge: 2 * 60 * 1000 // 2 minutes old is ok
            });
    }
    tf.ui.logBookChanged();
};

tf.ui.onDeviceReady = function() {
    // must be called after device ready since it accesses local files
    tf.ui.mkMapLayer();

    //tf.ui.patchTileUrls();

    tf.ui.map.addLayer(tf.ui.mapLayer);

    tf.ui.map.addLayer(tf.ui.inshoreLegsLayer);
    tf.ui.map.addLayer(tf.ui.offshoreLegsLayer);

    tf.ui.map.addLayer(tf.ui.turningPointsLayer);
    tf.ui.map.addLayer(tf.ui.startPointsLayer);

    tf.ui.map.addOverlay(tf.ui.pointPopup);
    tf.ui.map.addOverlay(tf.ui.plannedPointPopup);

    var coords = [18.387, 59.44]; // 580 is the initial center

    var center = ol.proj.transform(coords, 'EPSG:4326', 'EPSG:3857');

    tf.ui.view = new ol.View({
        center: center,
        minZoom: 7,
        maxZoom: 13,
        zoom: 10
    });

    tf.ui.view.once('change:center', function(event) {
        tf.ui.initialCenterChanged = true;
    });

    tf.state.curPlan.onChange(function(val) {
        if (!val) {
            $('#tf-nav-plan-name').html('');
            tf.ui.planModeActivate(false);
        } else {
            $('#tf-nav-plan-name').html(val.name);
        }
    });

    tf.state.init();

    tf.state.fontSize.onChange(function(val) {
        tf.ui._setFontSize(val);
    });
    var fs = tf.state.fontSize.get();
    if (fs == null) {
        // initial value; try to detect high dpi large screens,
        // and set font size large on these
        if (window.devicePixelRatio > 1.5 &&
            $('#tf-media').css('content') == '"md"') {
            tf.state.fontSize.set('large');
        } else {
            tf.state.fontSize.set('normal');
        }
    }

    tf.ui.updateStatusBar();

    tf.state.setupLogin(tf.ui.stateSetupDone);

    tf.ui.map.setView(tf.ui.view);

    $('.tf-default-hidden').removeClass('tf-default-hidden');

    if (tf.state.isCordova) {
        navigator.splashscreen.hide();
    }
};
