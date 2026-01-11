/* -*- js -*- */

import assert from "node:assert";
import {Plan} from "../src/js/plan.js";
import {LogBook} from "../src/js/logbook.js";
import {mkPod} from "./misc.js";

describe("Plan w/o logbook", function () {
    var pod = mkPod();
    describe("empty plan", function () {
        var emptyplan = new Plan("test", pod);
        describe("#isPointPlanned", function() {
            it("should return false", function() {
                assert.equal(emptyplan.isPointPlanned("1"), false);
            });
        });
        describe("#getLastPoint", function() {
            it("should return null", function() {
                assert.equal(emptyplan.getLastPoint(), null);
            });
        });
        describe("#addPoint", function() {
            var plan1 = new Plan("test", pod);
            plan1.addPoint("1");
            it("should return 1", function() {
                assert.equal(plan1.getLastPoint(), "1");
            });
            var plan2 = new Plan("test", pod);
            plan2.addPoint("1");
            plan2.addPoint("2");
            it("should return 2 after adding 2", function() {
                assert.equal(plan2.getLastPoint(), "2");
            });
            it("should return distance 5", function() {
                assert.equal(plan2.getPlannedDistance(), 5);
            });
            it("should return requied speed -1", function() {
                assert.equal(plan2.getPlannedSpeed(), -1);
            });
        });

    });
});
