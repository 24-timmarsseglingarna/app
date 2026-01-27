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

    var startTime = null;
    if (curPlan.startTime) {
        startTime = curPlan.startTime;
    } else if (curPlan.logbook && curPlan.logbook.getRace()) {
        startTime = curPlan.logbook.getRace().getStartTimes().start_from;
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

    if (curPlan.logbook && curPlan.logbook.getRace()) {
        $('#plan-list-start-time').attr('disabled', true);
        $('#plan-list-start-date').attr('disabled', true);
        $('#plan-list-period').attr('disabled', true);        
    }

    if (curPlan.getRequiredSpeed() <= 0) {
        $('#plan-list-req-speed').val('--');
    } else {
        $('#plan-list-req-speed').val(curPlan.getRequiredSpeed().toFixed(1) + ' kn');
    }

    var rows = '';
    for (var i = curPlan.firstPlanned; i >= 0 && i < curPlan.entries.length; i++) {
        var e = curPlan.entries[i];
        var eta = '';
        var rta = '';
        if (e.eta) {
            eta = fmtTimeHTML(e.eta);
        }
        if (e.rta) {
            rta = fmtTimeHTML(e.rta);
        }
        var point = e.point || '';
        var pointName = '';
        var media = $('#tf-media').css('content');
        if (e.point && (media == '"sm"' || media == '"md+"')) {
            var p = pod.getPoint(point);
            if (p) {
                pointName = p.name;
            }
        }

        rows += '<tr data-logid="' + i + '">';
        rows += '<td id="plan-list-eta-' + i + '">' + eta + '</td>';
        rows += '<td id="plan-list-rta-' + i + '">' + rta + '</td>';
        rows += '<td><span class="badge badge-pill badge-secondary mr-2 align-middle">' +
            point + '</span>' + pointName + '</td>';
        rows += '<td>' + e.dist.toFixed(1) + '</td>';
        rows += '<td><input type="text" inputmode="numeric" ' +
            'data-id="' + i + '" ' +
            'class="form-control plan-list-planned-speed"' +
            'id="plan-list-planned-speed-' + i + '"';
        if (e.plannedSpeed) {
            rows += ' value="' + e.plannedSpeed.toFixed(1) + '"></td>';
        } else {
            rows += '></td>';
        }
        rows += '</tr>';
    }
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
    for (var i = curPlan.firstPlanned; i >= 0 && i < curPlan.entries.length; i++) {
        var e = curPlan.entries[i];
        var eta = '';
        var rta = '';
        if (e.eta) {
            eta = fmtTimeHTML(e.eta);
        }
        if (e.rta) {
            rta = fmtTimeHTML(e.rta);
        }
        $('#plan-list-eta-' + i).html(eta);
        $('#plan-list-rta-' + i).html(rta);
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

    $('#plan-list-period').on('blur', function() {
        var period = parseInt($('#plan-list-period').val());
        if (isNaN(period)) {
            $('#plan-list-period').addClass('is-invalid');
        } else {
            $('#plan-list-start-date').removeClass('is-invalid');
            var curPlan = curState.curPlan.get();
            curPlan.setPeriod(period);
            reDisplay(curPlan);
        }
    });

});
