/* -*- js -*- */

import {curState} from './state.js';
import {pushPage, popPage} from './pageui.js';

export function openPage(coords, zoom) {
    setSizes();
    var r = 297/210;
    $('#chart-optimal-ratio').text(r.toFixed(4));

    $('#chart-coords').text(coords[0].toFixed(2) + ',' + coords[1].toFixed(2));
    $('#chart-zoom').val(zoom.toFixed(2));

    var organizersHtml = '';

    for (var orgId in organizerCharts) {
        var org = organizerCharts[orgId];
        var portraitrows = '';
        var landscaperows = '';
        for (var chartId in org.charts) {
            var c = org.charts[chartId];
            var s = '<tr onclick="window.tfUiChartSelect(\'' + orgId + '\',\'' + chartId + '\')"><td><a href="#" class="text-secondary">' +
                (c.alttitle || c.title) + '</a></td></tr>';
            if (c.orientation == 'portrait') {
                portraitrows += s;
            } else {
                landscaperows += s;
            }
        }
        var doShow = '';
        if (curState.chartuiOrgId == orgId) {
            doShow = 'show';
        }
        organizersHtml += orgHtml(orgId, org.name, doShow,
                                  portraitrows, landscaperows);
    }

    $('#organizers').html(organizersHtml);

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

window.tfUiChartSelect = function(orgId, chartId) {
    curState.chartuiOrgId = orgId;
    curState.curChart.set(organizerCharts[orgId].charts[chartId]);
    popPage();
    return false;
};

function orgHtml(orgId, orgName, doShow, portraitrows, landscaperows) {
    var s;
    s = `<div class="card">
           <div class="card-header">
             <button class="btn btn-link btn-block text-left"
                     type="button"
                     data-toggle="collapse" data-target="#${orgId}">
               <h4>${orgName}</h4>
             </button>
           </div>

           <div id="${orgId}" class="collapse ${doShow}"
                data-parent="#organizers">
             <div class="card-body">

               <div class="container">
                 <h5>Stående punktkort</h5>

                 <div class="table-responsive row">
                   <table class="table table-sm">
                     <colgroup>
                       <col class="tf-col-4"></col>
                     </colgroup>
                     <thead>
                       <tr>
                         <th>Område</th>
                       </tr>
                     </thead>
                     <tbody>
                       ${portraitrows}
                     </tbody>
                   </table>
                 </div>

                 <h5>Liggande punktkort</h5>

                 <div class="table-responsive row">
                   <table class="table table-sm">
                     <colgroup>
                       <col class="tf-col-4"></col>
                     </colgroup>
                     <thead>
                       <tr>
                         <th>Område</th>
                       </tr>
                     </thead>
                     <tbody>
                       ${landscaperows}
                     </tbody>
                   </table>
                 </div>
               </div>
             </div>
           </div>
         </div>`;
    return s;
};


/* MAYBE MOVE TO S3 */

/*
 * Unclear if it is a good idea to use startRanges.  That means that the
 * same chart would need to exist in different versions for different
 * organizers.  I think it is better to show them as start points on the
 * chart.
 */
const organizerCharts = {
    st: {
        name: 'Stockholm',
        charts: {
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
                orientation: 'portrait',
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
                orientation: 'portrait',
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
                orientation: 'portrait',
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
            aland: {
                orientation: 'landscape',
                title: 'Ålands och Åbolands skärgårdar',
                coords: [21.12, 60.06],
                zoom: 9.4,
                pointRanges: [[1,999],[1200,6399]],
                logoTop: '1%',
                logoLeft: '85%',
                headerTop: '1%',
                headerLeft: '57%',
                headerBackground: true
            },
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
        }
    },
    vk: {
        name: 'Västkusten',
        charts: {
            // portrait
            bohus: {
                orientation: 'portrait',
                title: 'Bohuslän',
                pointRanges: [[1,999],[1200,6399]],
                coords: [10.76, 58.38],
                zoom: 8.9,
                logoTop: '0%',
                logoLeft: '0%',
                headerTop: '0.4%',
                headerLeft: '70%',
                headerBackground: true
            },
            // landscape
            olso: {
                orientation: 'landscape',
                title: 'Oslo - Grebbestad',
                pointRanges: [[1,999],[1200,6399]],
//                coords: [10.12, 59.29],
                coords: [10.12, 59.08],
                zoom: 9.0,
                logoTop: '1%',
                logoLeft: '1%',
                headerTop: '10%',
                headerLeft: '1%',
                headerBackground: true
            },
            stromstad: {
                orientation: 'landscape',
                title: 'Strömstad - Göteborg',
                pointRanges: [[1,999],[1200,6399]],
//                coords: [10.50, 58.33],
                coords: [10.37, 58.34],
                zoom: 9.0,
                logoTop: '1%',
                logoLeft: '1%',
                headerTop: '10%',
                headerLeft: '1%',
                headerBackground: true
            },
            smogen: {
                orientation: 'landscape',
                title: 'Smögen - Varberg',
                pointRanges: [[1,999],[1200,6399]],
                coords: [11.25, 57.70],
                zoom: 9.0,
                logoTop: '11%',
                logoLeft: '80%',
                headerTop: '20%',
                headerLeft: '80%',
                headerBackground: true
            },
            marstrand: {
                orientation: 'landscape',
                title: 'Marstrand - Halmstad',
                pointRanges: [[1,999],[1200,6399]],
                coords: [11.15, 57.27],
                zoom: 9.0,
                logoTop: '1%',
                logoLeft: '80%',
                headerTop: '10%',
                headerLeft: '80%',
                headerBackground: true
            },
            onsala: {
                orientation: 'landscape',
                title: 'Onsala - Öresund',
                pointRanges: [[1,999],[1200,6399]],
                coords: [11.56, 56.67],
                zoom: 9.0,
                logoTop: '1%',
                logoLeft: '80%',
                headerTop: '10%',
                headerLeft: '80%',
                headerBackground: true
            },
            skagerack: {
                orientation: 'landscape',
                title: 'Skagerack',
                pointRanges: [[1,999],[1200,6399]],
                coords: [10.31, 58.25],
                zoom: 8.7,
                logoTop: '1%',
                logoLeft: '1%',
                headerTop: '10%',
                headerLeft: '1%',
                headerBackground: true
            },
            skagerack2: {
                orientation: 'landscape',
                alttitle: 'Skagerack - utan sträckor',
                title: 'Skagerack',
                pointRanges: [[1,999],[1200,6399]],
                coords: [10.31, 58.25],
                zoom: 8.7,
                logoTop: '1%',
                logoLeft: '1%',
                headerTop: '10%',
                headerLeft: '1%',
                headerBackground: true,
                noLegs: true
            },
            kattegatt: {
                orientation: 'landscape',
                title: 'Kattegatt',
                pointRanges: [[1,999],[1200,6399]],
                coords: [11.11, 56.95],
                zoom: 8.7,
                logoTop: '1%',
                logoLeft: '80%',
                headerTop: '10%',
                headerLeft: '80%',
                headerBackground: true
            },
            kattegatt2: {
                orientation: 'landscape',
                alttitle: 'Kattegatt - utan sträckor',
                title: 'Kattegatt',
                pointRanges: [[1,999],[1200,6399]],
                coords: [11.11, 56.95],
                zoom: 8.7,
                logoTop: '1%',
                logoLeft: '80%',
                headerTop: '10%',
                headerLeft: '80%',
                headerBackground: true,
                noLegs: true
            }
        }
    }
};
