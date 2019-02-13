/* -*- js -*- */

import {curState} from './state.js';
import {pushPage, popPage} from './pageui.js';
import {alert} from './alertui.js';
import {Plan} from './plan.js';
import {numberToName} from './util.js';

export function openPage() {
    // create the plan buttons
    var btns = '<button type="button" autocomplete="off"' +
        ' class="list-group-item list-group-item-action' +
        '   align-items-start tf-plan-item"' +
        ' id="tf-plan-item-none"' +
        ' data-name="none">Ingen plan</button>';
    for (var i = 1; i <= curState.numberOfPlans.get(); i++) {
        var ch = numberToName(i);
        btns += '<button type="button" autocomplete="off"' +
        ' class="list-group-item list-group-item-action' +
        '   align-items-start tf-plan-item"' +
        ' id="tf-plan-item-' + ch + '"' +
        ' data-name="' + ch + '">Plan ' + ch + '</button>';
    }
    $('#plan-btns').html(btns);
    $('.tf-plan-item').off();
    $('.tf-plan-item').on('click', itemClick);

    // mark the active plan
    $('.tf-plan-item').removeClass('active');
    $('#tf-plan-plan').removeClass('disabled');
    var activeId;
    var curPlan = curState.curPlan.get();
    if (!curPlan) {
        $('#tf-plan-plan').addClass('disabled');
        activeId = '#tf-plan-item-none';
    } else {
        activeId = '#tf-plan-item-' + curPlan.name;
    }
    $(activeId).addClass('active');

    pushPage(
        function() { $('#plan-menu-page').modal({backdrop: 'static'}); },
        function() { $('#plan-menu-page').modal('hide'); });
    document.activeElement.blur();
};

function itemClick(event) {
    var name = $(event.target).data('name'); // html5 data-name attribute
    var plan = null;
    var curRace = curState.curRace.get();
    if (name == 'none') {
        $('#tf-plan-plan').addClass('disabled');
        curState.curPlan.set(null);
    } else if (curRace) {
        $('#tf-plan-plan').removeClass('disabled');
        plan = curRace.getPlan(name);
        curState.curPlan.set(plan);
        if (!plan.logbook) {
            plan.attachLogBook(curState.curLogBook.get());
            // add a function that checks if the plan no longer matches
            // the logbook, and the plan is current, then we no longer
            // use the plan as current.
            plan.onPlanUpdate(function(plan, how) {
                if (how == 'nomatch') {
                    if (curState.curPlan.get().name == plan.name) {
                        curState.curPlan.set(null);
                    }
                }
            });
        }
    } else {
        $('#tf-plan-plan').removeClass('disabled');
        plan = new Plan(name, curState.defaultPod, undefined);
        curState.curPlan.set(plan);
    }
    $('.tf-plan-item').removeClass('active');
    var activeId;
    if (!plan) {
        activeId = '#tf-plan-item-none';
    } else {
        activeId = '#tf-plan-item-' + plan.name;
    }
    $(activeId).addClass('active');

    curState.planMode.set(false);
    return false;
};

/**
 * Set up handlers for buttons and form input.
 */
$(document).ready(function() {

    $('#tf-plan-normal').on('click', function() {
        curState.planMode.set(false);
        popPage();
        return false;
    });

    $('#tf-plan-plan').on('click', function() {
        if (!curState.curPlan.get()) {
            alert('<p>Du måste välja en plan innan du kan ' +
                  'gå in i planeringsläget.</p>');
            return false;
        }
        curState.planMode.set(true);
        popPage();
        return false;
    });

});
