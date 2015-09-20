/*
 * main.js
 * Copyright (C) 2015 giulio <giulioungaretti@me.com>
 *
 * Distributed under terms of the MIT license.
 */

//
var width = 800,
        height = 800,
        gridy = 106,
        gridx = 32;
var svg = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height);

// this maps points to viewpoint
var y = d3.scale.linear().range([0, width]).domain([0, gridy]),
        x = d3.scale.linear().range([height, 0]).domain([0, gridx]);

var c = new Conrec();
// those parameters are vital
var xs = d3.range(0, gridx),
        ys = d3.range(0, gridy),
        //  decrese the step here and the calculation will be sloppy
        //  already 0.1 is noticeably slower
        zs = d3.range(-5, 3, 0.5),
        colours = d3.scale.linear().domain([-5, 3]).range(["blue", "white"]);

var line = d3.svg.line()
        .x(function(d) {
                return (d.x);
        })
        .y(function(d) {
                return (d.y);
        })
        .interpolate("basis");
//hack
var i = 0;
var data;
var t = [];
d3.json("./new-numpy-grid-dump-linear.json.1", function(error, dataset) {
        if (error) { //If error is not null, something went wrong.
                console.log(error); //Log the error.
                return;
        } else {
                data = dataset;
        }
        for (var timestamp in data) {
                t.push(timestamp);
        }
        console.log(data[0][1]);
        // draw first
        contour(data[0][1]);
        //hack
        d3.timer(update, 500);
});


function update() {
        i++;
        var newdata = data[i][1];
        var cliff = -1000;
        newdata.push(d3.range(newdata[0].length).map(function() {
                return cliff;
        }));
        newdata.unshift(d3.range(newdata[0].length).map(function() {
                return cliff;
        }));
        newdata.forEach(function(d) {
                d.push(cliff);
                d.unshift(cliff);
        });
        c.contour(newdata, 0, xs.length - 1, 0, ys.length - 1, xs, ys, zs.length, zs);
        svg.selectAll("path")
                .data(c.contourList())
                //.style("stroke", "black")
                .style("fill", function(d) {
                        return colours(d.level);
                })
                .attr("d", line); // apply the new newdata values
        return (i > data.length);
}

function contour(data) {
        // Add a "cliff edge" to force contour lines to close along the border.
        var cliff = -1000;
        data.push(d3.range(data[0].length).map(function() {
                return cliff;
        }));
        data.unshift(d3.range(data[0].length).map(function() {
                return cliff;
        }));
        data.forEach(function(d) {
                d.push(cliff);
                d.unshift(cliff);
        });
        c.contour(data, 0, xs.length - 1, 0, ys.length - 1, xs, ys, zs.length, zs);
        svg.selectAll("path")
                .data(c.contourList())
                .enter().append("path")
                //.style("stroke", "black")
                .style("fill", function(d) {
                        return colours(d.level);
                })
                .attr("d", line);
}


//vim: set ts=2 et sw=2 tw=80:
