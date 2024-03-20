/* -*- js -*- */

import {curState} from './state.js';
import {pushPage, popPage} from './pageui.js';

export function openPage(coords, zoom) {
    setSizes();
    var r = 297/210;
    $('#chart-optimal-ratio').text(r.toFixed(4));

    $('#chart-coords').text(coords[0].toFixed(2) + ',' + coords[1].toFixed(2));
    $('#chart-zoom').val(zoom.toFixed(2));

    var portraitrows = '';
    var landscaperows = '';

    for (var id in charts) {
        var c = charts[id];
        var s = '<tr onclick="window.tfUiChartSelect(\'' + id + '\')"><td>' +
            c.title + '</td></tr>';
        if (c.orientation == 'portrait') {
            portraitrows += s;
        } else {
            landscaperows += s;
        }
    }

    $('#chart-portrait-entries').html(portraitrows);
    $('#chart-landscape-entries').html(landscaperows);

    pushPage(function() { $('#chart-page').modal({backdrop: 'static'}); },
             function() { $('#chart-page').modal('hide'); });
    document.activeElement.blur();
};

function setSizes() {
    $('#chart-width').text(window.innerWidth);
    $('#chart-height').text(window.innerHeight);
    var r;
    if (window.innerWidth > window.innerHeight) {
        // landscape
        $('#chart-orientation').text('liggande');
        r = window.innerWidth / window.innerHeight;
    } else {
        // portrait
        $('#chart-orientation').text('stående');
        r = window.innerHeight / window.innerWidth;
    }
    $('#chart-ratio').text(r.toFixed(4));
};    


/**
 * Set up handlers for buttons.
 */
$(document).ready(function() {
    window.addEventListener('resize', setSizes);
    
    $('#chart-cancel').on('click', function() {
        var zoom = $('#chart-zoom').val();
        curState.view.setZoom(zoom);
        popPage();
        return false;
    });
});

window.tfUiChartSelect = function(chartId) {
    curState.curChart.set(charts[chartId]);
    popPage();
    return false;
};

/* MAYBE MOVE TO S3 */

/*
 * Unclear if it is a good idea to use startRanges.  That means that the
 * same chart would need to exist in different versions for different
 * organizers.  I think it is better to show them as start points on the
 * chart.
 */
const charts = {
    // portrait
    hudik: {
        orientation: 'portrait',
        title: 'Hudiksvall - Sundsvall',
        coords: [17.58, 62.18],
//        startRanges: [[441,705], [905,905]],
        zoom: 9.4,
        logoTop: '1%',
        logoLeft: '1%',
        headerTop: '1%',
        headerLeft: '30%',
        headerBackground: true
    },
    jungfru: {
        orientation: 'portrait',
        title: 'Jungfrukusten',
        coords: [17.45, 61.18],
//        startRanges: [[441,705], [905,905]],
        zoom: 9.4,
        logoTop: '0%',
        logoLeft: '1%',
        headerTop: '1%',
        headerLeft: '62%',
        headerBackground: true
    },
    sthlm: {
        title: 'Stockholms innerskärgård',
        coords: [18.60, 59.30],
        zoom: 9.97,
        pointRanges: [[1,999],[1200,6399]],
        logoTop: '1%',
        logoLeft: '1%',
        headerTop: '1%',
        headerLeft: '33%',
        headerBackground: true
    },
    arholma: {
        title: 'Arholma - Örskär',
        coords: [18.81, 60.10],
        zoom: 9.55,
        pointRanges: [[1,999],[1200,6399]],
        logoTop: '1%',
        logoLeft: '70%',
        headerTop: '1%',
        headerLeft: '33%',
        headerBackground: true,
    },
    landsort: {
        title: 'Arholma - Landsort',
        coords: [18.63, 59.32],
        zoom: 9.24,
        pointRanges: [[1,999],[1200,6399]],
        logoTop: '1%',
        logoLeft: '1%',
        headerTop: '1%',
        headerLeft: '30%',
        headerBackground: true,
        noPointLabels: true
    },
    gotska: {
        orientation: 'portrait',
        title: 'Gotska sjön',
        coords: [18.10, 57.9],
        zoom: 8.7,
        logoTop: '1%',
        logoLeft: '1%',
        headerTop: '1%',
        headerLeft: '30%',
        headerBackground: true
    },
    stanna: {
        orientation: 'portrait',
        title: 'St Anna skärgård',
        coords: [16.76, 58.05],
//        startRanges: [[441,705], [905,905]],
        zoom: 9.1,
        logoTop: '1%',
        logoLeft: '1%',
        headerTop: '1%',
        headerLeft: '30%',
        headerBackground: true,
        noPointLabels: true
    },
    balt: {
        orientation: 'portrait',
        title: 'Gotland - Baltikum - Åland',
        coords: [20.65, 58.50],
        zoom: 8.1,
        logoTop: '1%',
        logoLeft: '1%',
        headerTop: '1%',
        headerLeft: '30%',
        headerBackground: true,
        noPointLabels: true
    },
    oland: {
        orientation: 'portrait',
        title: 'Öland',
        coords: [17.20, 56.985],
        zoom: 9.1,
        logoTop: '1%',
        logoLeft: '1%',
        headerTop: '1%',
        headerLeft: '40%',
        headerBackground: true,
        noPointLabels: true
    },
    // landscape
    sthlmN: {
        orientation: 'landscape',
        title: 'Stockholms norra skärgård',
        coords: [19.10, 59.60],
        zoom: 10.5,
        pointRanges: [[1,999],[1200,6399]],
        logoTop: '1%',
        logoLeft: '1%',
        headerTop: '1%',
        headerLeft: '17%',
        headerBackground: true
    },
    sthlmM: {
        orientation: 'landscape',
        title: 'Stockholms mellanskärgård',
        coords: [18.80, 59.30],
        pointRanges: [[1,999],[1200,6399]],
        zoom: 10.5,
        logoTop: '1%',
        logoLeft: '1%',
        headerTop: '1%',
        headerLeft: '17%',
        headerBackground: true
    },
    sthlmS: {
        orientation: 'landscape',
        title: 'Stockholms södra skärgård',
        coords: [18.40, 59.00],
        pointRanges: [[1,999],[1200,6399]],
        zoom: 10.5,
        logoTop: '1%',
        logoLeft: '1%',
        headerTop: '1%',
        headerLeft: '17%',
        headerBackground: true
    },
    sormland: {
        orientation: 'landscape',
        title: 'Sörmlands skärgård',
        pointRanges: [[1,999],[1200,6399]],
        coords: [17.19, 58.65],
        zoom: 10.2,
        logoTop: '1%',
        logoLeft: '1%',
        headerTop: '1%',
        headerLeft: '17%',
        headerBackground: true
    },
    uppland: {
        orientation: 'landscape',
        title: 'Upplandskusten',
        pointRanges: [[1,999],[1200,6399]],
        coords: [17.88, 60.6],
        zoom: 10.5,
        logoTop: '1%',
        logoLeft: '1%',
        headerTop: '8%',
        headerLeft: '1%',
        headerBackground: true
    }
};
