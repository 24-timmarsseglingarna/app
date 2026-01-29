/* -*- js -*- */

import {curState} from './state.js';
import {pushPage} from './pageui.js';
import {fmtTimeHTML} from './util.js';

export function openPage() {
    var curPlan = curState.curPlan.get();
    var pod = curPlan.pod;

    $('#plan-list-name').html(curPlan.name);

    $('#plan-list-start-time').removeClass('is-invalid');
    $('#plan-list-start-date').removeClass('is-invalid');
    $('#plan-list-period').removeClass('is-invalid');
    $('#plan-list-finish-point').removeClass('is-invalid');

    var hasRace = Boolean(curPlan.logbook && curPlan.logbook.getRace());
    var startTime = null;
    var allowStartTimeMod = !hasRace;
    if (curPlan.startTime) {
        startTime = curPlan.startTime;
    } else if (hasRace) {
        startTime = curPlan.logbook.getRace().getStartTimes().start_from;
        if (!startTime.isSame(curPlan.logbook.getRace().getStartTimes().start_to)) {
            allowStartTimeMod = true;
        }
    }
    if (startTime) {
        var dt = moment(startTime);
        $('#plan-list-start-timepicker').datetimepicker('date', dt);
        $('#plan-list-start-datepicker').datetimepicker('date', dt);
    } else {
        $('#plan-list-start-timepicker').datetimepicker('date', null);
        $('#plan-list-start-datepicker').datetimepicker('date', null);
    }        

    var period = null;
    if (curPlan.period) {
        period = curPlan.period;
    } else if (curPlan.logbook && curPlan.logbook.getRace()) {
        period = curPlan.logbook.getRace().getRaceLengthHours();
    }
    
    $('#plan-list-period').val(period);

    var finishPoint = curPlan.getFinishPoint();
    $('#plan-list-finish-point').val(finishPoint);

    $('#plan-list-start-time').attr('disabled', !allowStartTimeMod);
    $('#plan-list-start-date').attr('disabled', hasRace);
    $('#plan-list-period').attr('disabled', hasRace);        
    $('#plan-list-finish-point').attr('disabled', hasRace);        

    if (curPlan.getRequiredSpeed() <= 0) {
        $('#plan-list-req-speed').val('--');
    } else {
        $('#plan-list-req-speed').val(curPlan.getRequiredSpeed().toFixed(1) + ' kn');
    }

    var rows = '';
    var eta = '';
    var rta = '';
    var point = '';
    var pointName;
    var p;
    for (var i = curPlan.firstPlanned; i >= 0 && i < curPlan.entries.length; i++) {
        var e = curPlan.entries[i];
        eta = '';
        if (e.eta) {
            eta = fmtTimeHTML(e.eta);
        }
        rta = '';
        if (e.rta) {
            rta = fmtTimeHTML(e.rta);
        }
        point = e.point || '';
        pointName = '';
        var media = $('#tf-media').css('content');
        if (e.point && (media == '"sm"' || media == '"md+"')) {
            p = pod.getPoint(point);
            if (p) {
                pointName = p.name;
            }
        }

        rows += '<tr data-logid="' + i + '">';
        rows += '<td><span class="badge badge-pill badge-secondary mr-2 align-middle">' +
            point + '</span>' + pointName + '</td>';
        rows += '<td>' + e.dist.toFixed(1) + '</td>';
        rows += '<td id="plan-list-eta-' + i + '">' + eta + '</td>';
        rows += '<td id="plan-list-rta-' + i + '">' + rta + '</td>';
        if (i == 0) {
            rows += '<td><input type="text" disabled="true" class="form-control"/></td>';
        } else {
            rows += '<td><input type="text" inputmode="numeric" ' +
                'data-id="' + i + '" ' +
                'class="form-control plan-list-planned-speed"' +
                'id="plan-list-planned-speed-' + i + '"';
            if (e.plannedSpeed) {
                rows += ' value="' + e.plannedSpeed.toFixed(1) + '"></td>';
            } else {
                rows += '></td>';
            }
        }
        rows += '</tr>';
    }

    // add "syntetic" row
    eta = '';
    if (curPlan.calculatedFinishETA) {
        eta = fmtTimeHTML(curPlan.calculatedFinishETA);
    }
    rta = '';
    if (curPlan.calculatedFinishRTA) {
        rta = fmtTimeHTML(curPlan.calculatedFinishRTA);
    }
    point = curPlan.getFinishPoint();
    pointName = '';
    if (point) {
        p = pod.getPoint(point);
        if (p) {
            pointName = p.name;
        }
    }
    rows += '<tr class="font-italic">';
    rows += '<td id="plan-list-point-finish">';
    if (point && curPlan.calculatedDistToFinish != undefined) {
        rows += '<span class="badge badge-pill badge-secondary mr-2 align-middle">' +
            point + '</span>' + pointName;
    }
    rows += '</td>';
    rows += '<td id="plan-list-dist-finish">';
    if (curPlan.calculatedDistToFinish != undefined) {
        rows += curPlan.calculatedDistToFinish.toFixed(1);
    }
    rows += '</td>';
    rows += '<td id="plan-list-eta-finish">' + eta + '</td>';
    rows += '<td id="plan-list-rta-finish">' + rta + '</td>';
    rows += '<td></td>';
    rows += '</tr>';


    $('#plan-list-entries').html(rows);

    $('.plan-list-planned-speed').on('blur', function(event) {
        var id = '#' + event.target.id;
        var val = $(id).val();

        var plannedSpeed = parseInt(val);
        if (val != '' && (isNaN(plannedSpeed) || plannedSpeed <= 0)) {
            $(id).addClass('is-invalid');
        } else {
            $(id).removeClass('is-invalid');
            if (val == '') {
                plannedSpeed = undefined;
            }
            var curPlan = curState.curPlan.get();
            var idx = $(id).data('id');
            curPlan.setPlannedSpeed(idx, plannedSpeed);
            reDisplay(curPlan);
        }
    });

    pushPage(
        function() { $('#plan-list-page').modal({backdrop: 'static'}); },
        function() { $('#plan-list-page').modal('hide'); });
    document.activeElement.blur();

};

function reDisplay(curPlan) {
    var e, eta, rta;
    for (var i = curPlan.firstPlanned; i >= 0 && i < curPlan.entries.length; i++) {
        e = curPlan.entries[i];
        eta = '';
        rta = '';
        if (e.eta) {
            eta = fmtTimeHTML(e.eta);
        }
        if (e.rta) {
            rta = fmtTimeHTML(e.rta);
        }
        $('#plan-list-eta-' + i).html(eta);
        $('#plan-list-rta-' + i).html(rta);
    }

    eta = '';
    if (curPlan.calculatedFinishETA) {
        eta = fmtTimeHTML(curPlan.calculatedFinishETA);
    }
    $('#plan-list-eta-finish').html(eta);

    rta = '';
    if (curPlan.calculatedFinishRTA) {
        rta = fmtTimeHTML(curPlan.calculatedFinishRTA);
    }
    $('#plan-list-rta-finish').html(rta);

    var point = curPlan.getFinishPoint();
    var pointName = '';
    if (point && curPlan.calculatedDistToFinish != undefined) {
        var pod = curPlan.pod;
        var p = pod.getPoint(point);
        if (p) {
            pointName = p.name;
        }
        $('#plan-list-point-finish').html(
            '<span class="badge badge-pill badge-secondary mr-2 align-middle">' +
                point + '</span>' + pointName);
    } else {
        $('#plan-list-point-finish').html('');
    }
    if (curPlan.calculatedDistToFinish) {
        $('#plan-list-dist-finish').html(curPlan.calculatedDistToFinish.toFixed(1));
    } else {
        $('#plan-list-dist-finish').html('');
    }

    if (curPlan.getRequiredSpeed() <= 0) {
        $('#plan-list-req-speed').val('--');
    } else {
        $('#plan-list-req-speed').val(curPlan.getRequiredSpeed().toFixed(1) + ' kn');
    }
};

function saveStartTime(time, date, curPlan) {
    // combine the date with the time
    var t = time.toObject();
    var d = date.toObject();
    t.years = d.years;
    t.months = d.months;
    t.date = d.date;

    curPlan.setStartTime(moment(t));
};


/**
 * Set up handlers for buttons and form input.
 */
$(document).ready(function() {
    var icons = {
        date: 'icon-calendar',
        time: 'icon-clock',
        up: 'icon-angle-up',
        down: 'icon-angle-down',
        previous: 'icon-angle-left',
        next: 'icon-angle-right',
        close: 'icon-close'
    };
    $('#plan-list-start-timepicker').datetimepicker({
        format: 'HH:mm',
        stepping: 1,
        icons: icons,
        widgetPositioning: {
            horizontal: 'left',
            vertical: 'bottom'
        },
        focusOnShow: false,
        locale: 'sv',
        toolbarPlacement: 'top',
        buttons: {
            showClose: true
        }
    });
    $('#plan-list-start-datepicker').datetimepicker({
        // NOTE: if we don't use YYYY (or YY), tempusdominus will
        // use the current year.
        format: 'DD MMM YYYY',
        icons: icons,
        widgetPositioning: {
            horizontal: 'right',
            vertical: 'bottom'
        },
        focusOnShow: false,
        locale: 'sv',
        toolbarPlacement: 'top',
        buttons: {
            showClose: true
        }
    });
    $('#plan-list-start-time').blur(function() {
        var time = $('#plan-list-start-timepicker').datetimepicker('date');
        if (!time) {
            $('#plan-list-start-time').addClass('is-invalid');
        } else {
            $('#plan-list-start-time').removeClass('is-invalid');
            var date = $('#plan-list-start-datepicker').datetimepicker('date');
            if (date) {
                var curPlan = curState.curPlan.get();
                saveStartTime(time, date, curPlan);
                reDisplay(curPlan);
            }
        }
    });
    $('#plan-list-start-date').blur(function() {
        var date = $('#plan-list-start-datepicker').datetimepicker('date');
        if (!date) {
            $('#plan-list-start-date').addClass('is-invalid');
        } else {
            $('#plan-list-start-date').removeClass('is-invalid');
            var time = $('#plan-list-start-timepicker').datetimepicker('date');
            if (time) {
                var curPlan = curState.curPlan.get();
                saveStartTime(time, date, curPlan);
                reDisplay(curPlan);
            }
        }
    });

    $('#plan-list-period').on('change', function() {
        var period = parseInt($('#plan-list-period').val());
        if (isNaN(period)) {
            $('#plan-list-period').addClass('is-invalid');
        } else {
            $('#plan-list-period').removeClass('is-invalid');
            var curPlan = curState.curPlan.get();
            curPlan.setPeriod(period);
            reDisplay(curPlan);
        }
    });

    $('#plan-list-finish-point').on('change', function() {
        var finishPoint = Number($('#plan-list-finish-point').val());
        if (!Number.isInteger(finishPoint)) {
            $('#plan-list-finish-point').addClass('is-invalid');
        } else if (curState.curPlan.get().pod.getPoint(finishPoint) == undefined) {
            $('#plan-list-finish-point').addClass('is-invalid');
        } else {            
            $('#plan-list-finish-point').removeClass('is-invalid');
            var curPlan = curState.curPlan.get();
            curPlan.setFinishPoint(finishPoint);
            reDisplay(curPlan);
        }
    });

});
