/* -*- js -*- */

import assert from "node:assert";
import {mkPod} from "./misc.js";

describe("PoD", function () {
    let pod;
    before(function() {
        pod = mkPod();
    });
    describe("#getDistance()", function () {
        it("should return 10 between 2 and 3", function () {
            assert.equal(pod.getDistance("2", "3"), 10);
        });
        it("should return 10 between 3 and 2", function () {
            assert.equal(pod.getDistance("3", "2"), 10);
        });
        it("should return -1 between 1 and 4", function () {
            assert.equal(pod.getDistance("1", "4"), -1);
        });
        it("should return -1 between 1 and 999", function () {
            assert.equal(pod.getDistance("1", "999"), -1);
        });
    });
    describe("#getNeighbors()", function () {
        it("should return 1, 3, 4 for 2", function () {
            assert.deepEqual(Object.keys(pod.getNeighbors("2")).sort(), ["1", "3", "4"]);
        });
    });
    describe("#getShortestPath()", function () {
        it("should return 1,2,3 for 1-3", function () {
            assert.deepEqual(pod.getShortestPath("1", "3", 6).points.sort(),
                             ["1", "2", "3"]);
        });
        it("should return 1,2,4 for 1-4", function () {
            assert.deepEqual(pod.getShortestPath("1", "4", 6).points.sort(),
                             ["1", "2", "4"]);
        });
        it("should return 1,2,4,5 for 1-5", function () {
            assert.deepEqual(pod.getShortestPath("1", "5", 6).points.sort(),
                             ["1", "2", "4", "5"]);
        });
        it("should return dist 35 for 1-5", function () {
            assert.deepEqual(pod.getShortestPath("1", "5", 6).dist, 35);
        });
        it("should return null for 2-8 with 4 steps", function () {
            assert.deepEqual(pod.getShortestPath("2", "8", 4), null);
        });
        it("should return dist 130 for 1-8 with 4 steps", function () {
            assert.equal(pod.getShortestPath("1", "8", 4).dist, 125);
        });
    });
});

