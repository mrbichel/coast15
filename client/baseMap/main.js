//funcs
function zoomed() {
                g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        }
        // Globally accesible
var locations = [];

var width = window.innerWidth - 4,
        height = window.innerHeight - 4;

var scale,
        translate,
        area;

var zoom = d3.behavior.zoom()
        .scaleExtent([1, 8])
        .on("zoom", zoomed);

var projection = d3.geo.albers()
        .center([0, 55.4])
        .rotate([4.4, 0])
        .parallels([50, 60])
        .scale(2800)
        .translate([width / 2, height / 2]);

var center = projection([0, 55.4]);
var path = d3.geo.path().projection(projection);
var svg = d3.select("#map").append("svg")
        .attr("width", width)
        .attr("height", height);

// isn't this doing append twice?
var g = svg.append("g");

//svg.append("rect")
//.attr("class", "overlay")
//.attr("width", width)
//.attr("height", height);

svg
        .call(zoom)
        .call(zoom.event);

// init layers with different z-index
var bgLayer = g.append('g').attr("id", "bg");
var midLayer = g.append('g').attr("id", "mid");
var topLayer = g.append('g').attr("id", "top");


// init toolip for headlands and ports
var tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("z-index", "99999")
        .style("visibility", "hidden");

// set global radius
var pointRadius = 5;


// takes city and updates div on mouse over
// TODO add the stuff we want to add 
function point(city) {
        var xy = projection([city.lng, city.lat]);
        var x = xy[0];
        var y = xy[1];
        topLayer.append("svg:circle")
                .attr("fill", "#fefefe")
                .attr("r", pointRadius)
                .attr("cx", x)
                .attr("cy", y)
                .on("mouseover", function() {
                        tooltip.text(city.name);
                        return tooltip.style("visibility", "visible");
                })
                .on("mousemove", function() {
                        return tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 10) + "px");
                })
                .on("mouseout", function() {
                        return tooltip.style("visibility", "hidden");
                });
}



d3.json("../data/headlands.json",
        function(data) {
                for (var i = 0; i < data.length; i++) {
                        try {
                                var city = data[i];
                                point(city);
                        } catch (err) {
                                console.log("skip");
                        }
                }
        }
);

d3.json("../data/harbors.json",
        function(data) {
                for (var i = 0; i < data.length; i++) {
                        try {
                                var city = data[i];
                                point(city);
                        } catch (err) {
                                console.log("skip");
                        }
                }
        }
);
d3.json("../data/uk.json", function(error, uk) {
        var subunits = topojson.feature(uk, uk.objects.subunits);
        midLayer.append('g').attr("id", "uk-map")
                .selectAll(".subunit")
                .data(topojson.feature(uk, uk.objects.subunits).features)
                .enter().append("path")
                .attr("class", function(d) {
                        return "subunit " + d.id;
                })
                .attr("d", path);

});



// grid in the number of unique lat/long
var gridy = 82,
        gridx = 60;
// convert with a linear scale (are the lat/long from backend linear in the first
// place?)
var x = d3.scale.linear().range([0, width]).domain([0, gridx]),
        y = d3.scale.linear().range([height, 0]).domain([0, gridy]);
// init algo
var c = new Conrec();


// create grid
var xs = d3.range(0, gridx),
        ys = d3.range(0, gridy),
        zs = d3.range(-5, 3, 0.6),
        colours = d3.scale.linear().domain([-5, 0, 3])
        .range(["black", "cyan", "white"]);


// this will make the contour paths
var line = d3.svg.line()
        .x(function(d) {
                return x(d.x);
        })
        .y(function(d) {
                return y(d.y);
        })
        .interpolate("cardinal-close");

var i = 0;
//get ddata
var data;
var t = [];
d3.json("values.json", function(error, dataset) {
        if (error) { //If error is not null, something went wrong.
                console.log(error); //Log the error.
                return;
        } else {
                data = dataset;
        }
        for (var timestamp in data) {
                t.push(timestamp);
        }
        console.log(t);
        // js wants milliseconds
        min_time = d3.min(t);
        console.log(min_time);
        max_time = d3.max(t);
        console.log(max_time);
        //
        min_timestamp = new Date(min_time * 1000);
        max_timestamp = new Date(max_time * 1000);
        // draw first
        data0 = data[t[0]];
        contour(data0);
        var time_change = true;
        var rate = 10;
        var chron = chroniton()
                .width(width - 60).height(50)
                .tapAxis(function(axis) {
                        axis.ticks(48);
                        axis.orient("bottom");
                        axis.tickPadding(0);
                })
                .domain([min_timestamp, max_timestamp])
                .on('change', function(d) {
                        time_change = true;
                })
                .playButton(true)
                .playbackRate(1 / rate)
                .play()
                .loop(true);


        var update = function() {

                if (time_change) {
                        var time = chron.getValue().getTime();
                        d = getIndex(time, data, t);
                        //interpolateHeightsForTime(time);
                        updateframe(d);
                        time_change = false;
                }
        };

        d3.timer(update, 500);

        d3.select("#slider")
                .append('div')
                .call(chron);

        d3.select("#slider")
                .attr("width", width - 60)
                .style({
                        "left": "30px"
                });

        d3.select(".chroniton")
                .attr("transform", "translate(0,-16)");
});


// Add a "cliff edge" to force contour lines to close along the border.
var cliff = -10000;

function updateframe(newdata) {
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
        bgLayer.selectAll("path")
                .data(c.contourList())
                //.style("stroke", "black")
                .style("fill", function(d) {
                        return colours(d.level);
                })
                .attr("d", line); // apply the new newdata values
}

function contour(data) {
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
        bgLayer.selectAll("path")
                .data(c.contourList())
                .enter().append("path")
                //.style("stroke", "black")
                .style("fill", function(d) {
                        return colours(d.level);
                })
                .attr("d", line);
}


function getIndex(t, data, timestamps) {
        // data looks like {timestamp: [], timestamp []}
        // bisect returns the   index of the value  that is closer to t from right
        idx = d3.bisect(timestamps, t) - 1;
        val = timestamps[idx];
        var d = data[val];
        return d;
}

var interpolatArrayTime = function(t) {

        data.forEach(function(d) {
                if (!d.next || t > d.next || !d.prev || t < d.prevstamp) {
                        id = bisect(d.logs, t);
                        d.prev = d.logs[id - 1];
                        d.next = d.logs[id];
                }

                //id = d3.bisect(d.logs, timestamp);
                if (d.next && d.prev) {
                        interpolate = d3.interpolate(d.prev.height, d.next.height);
                        delta = d.next.timestamp - d.prev.timestamp;
                        weight = (t - d.prev.timestamp) / delta;
                        d.height = interpolate(weight);
                } else {
                        d.height = null;
                }

        });
};


//vim: set ts=2 et sw=2 tw=80:
