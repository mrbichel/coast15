// Globally accesible
var locations = [];

var width = window.innerWidth-4,
    height = window.innerHeight-4;

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

var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height)
  .append("g");

var g = svg.append("g");

svg.append("rect")
    .attr("class", "overlay")
    .attr("width", width)
    .attr("height", height);

svg
    .call(zoom)
    .call(zoom.event);

var bgLayer = g.append('g').attr("id", "bg");

var contourLayer = g.append('g').attr("id", "contours");

var midLayer = g.append('g').attr("id", "mid");
var topLayer = g.append('g').attr("id", "top");



var voronoi = d3.geom.voronoi()
    .x(function(d) { return d.x; })
    .y(function(d) { return d.y; });

var filter = svg.append("defs")
  .append("filter")
    .attr("id", "blur")
  .append("feGaussianBlur")
    .attr("stdDeviation", 0);

function blur() {
  filter.attr("stdDeviation", 1);
}

var colorScale = d3.scale.linear();
        // todo update with new data
colorScale.domain([-0.2, 8, 14])
    .range(["black", "cyan", "w hite"]);

    var tideScale = d3.scale.linear();
    tideScale.domain([-0.2, 14] );
                        //.range(["black", "cyan", "white"]);

    var bisect = d3.bisector(function(d) { return d.timestamp; }).right;

var data;
var t = [];


d3.json("http://127.0.0.1:5000/grid", function(error, dataset) {

        if (error) { //If error is not null, something went wrong.
                console.log(error); //Log the error.
                return;
        } else {
                data = dataset;
        }

        for (var timestamp in data) {
                t.push(timestamp);
        }

        bounds = data[0][2];
            // conrec

    var gridx = data[0][3]; // get from api
    var gridy = data[0][4];
    var i = 0;

    var dat = data[0][1];
    console.log(gridx);
    console.log(gridy);
    console.log(bounds);
    console.log("----");

    var conrec = new Conrec();

    // this maps points to viewpoint
    //var y = d3.scale.linear().range([0, gridy]).domain([bounds[2], bounds[3]]),
    //    x = d3.scale.linear().range([0, gridx]).domain([bounds[0], bounds[1]]);



    var c = new Conrec();
    // those parameters are vital
    var xs = d3.range(0, dat.length),
        ys = d3.range(0, dat[0].length),
            //  decrese the step here and the calculation will be sloppy
            //  already 0.1 is noticeably slower
        zs = d3.range(-0.2, 14, 0.25),
        colours = d3.scale.linear().domain([-0.2, 14]).range(["blue", "white"]);

        x = d3.scale.linear().range([bounds[0], bounds[1]]).domain([0, dat.length]);
        y = d3.scale.linear().range([bounds[3], bounds[2] ]).domain([0, dat[0].length]);


    var line = d3.svg.line()
        .x(function(d) {
                //console.log(d.x)
                return (
                    projection([x(d.x),y(d.y)])[0]
                );
        })
        .y(function(d) {
                return (
                    projection([x(d.x),y(d.y)])[1]
                );
        })
        .interpolate("basis");



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

            contourLayer.selectAll("path")
                    .data(c.contourList())
                    .enter().append("path")
                    .style("stroke", "black")
                    .style("fill-opacity", 1)
                    .style("fill", function(d) {
                            return colours(d.level);
                    })
                    .attr("d", line);
        }




        //console.log(data[0][1]);
        // draw first
        contour(data[0][1]);
        //hack
        //d3.timer(updateContour, 500);
});


var interpolateHeightsForTime = function(t) {

    locations.forEach(function(d) {

        if(!d.next || t > d.next.timestamp || !d.prev || t < d.prev.timestamp) {
            id = bisect(d.logs, t);
            d.prev = d.logs[id-1];
            d.next = d.logs[id];

            if(d.next && d.prev) {

            }

        }

        //id = d3.bisect(d.logs, timestamp);
        if(d.next && d.prev) {

             //d.low = d3.min([d.prev.height, d.next.height]);
            //    d.high = d3.max([d.prev.height, d.next.height]);

            //d.heightScale.domain([d.low, d.low*1.01, d.high*0.99, d.high])
            //    .range(0,0.4,0.6,1);


            interpolate = d3.interpolateNumber(d.prev.height, d.next.height);

            delta = d.next.timestamp - d.prev.timestamp;
            weight = (t-d.prev.timestamp) / delta;
            d.height = interpolate(weight);

            d.high_flag = false;
            d.low_flag = false;

            if(weight>0.99) {
                if (d.next.type == "high") {
                    d.high_flag = true;
                } else {
                    d.low_flag = true;
                }
            }

            if(weight<0.01) {
                if (d.prev.type == "high") {
                    d.high_flag = true;
                } else {
                    d.low_flag = true;
                }
            }

        } else {
            d.height = null;
        }

    });
};


function updateContour() {
       /* i=0;

        var newdata = data[i][1];
        var cliff = -1000;

        newdata.push(d3.range(newdata[0].length).map(function() {
                return cliff;
        }));

        newdata.unshift(d3.range(newdata[0].length).map(function() {
                return cliff;
        }));

        newdata.forEach(function(d) {
                //console.log(d);
                d.push(cliff);
                d.unshift(cliff);
        });

        c.contour(newdata, 0, xs.length - 1, 0, ys.length - 1, xs, ys, zs.length, zs);
        contourLayer.selectAll("path")
                .data(c.contourList())
                //.style("stroke", "black")
                .style("fill", function(d) {
                        return colours(d.level);
                })
                .attr("d", line); // apply the new newdata values
        return (i > data.length);*/
}


// todo load headlands
// todo load harbors




d3.json("../data/uk.json", function(error, uk) {

    var subunits = topojson.feature(uk, uk.objects.subunits);
     midLayer.append('g').attr("id", "uk-map")
        .selectAll(".subunit")
        .data(topojson.feature(uk, uk.objects.subunits).features)
        .enter().append("path")
        .attr("class", function(d) { return "subunit " + d.id; })
        .attr("d", path);

});




d3.json("http://127.0.0.1:5000/cloc", function(json) {

        json.locations.forEach(function(d) {
                l = [];
                l.key = d[0];
                l.loc = d[1];
                l.name = d[2];

                var position = projection(l.loc);

                l.x = position[0];
                l.y = position[1];

                l.logs = [];
                d[3].forEach(function(log) {
                    ll = [];
                    ll.timestamp = log[0];
                    ll.height = log[1];
                    ll.type = log[2];

                    l.logs.push(ll);
                });

                _a = function(d) {
                    return d.timestamp;
                };

                l.start_time = d3.min(l.logs, _a);
                l.end_time = d3.max(l.logs, _a);

                l.heightScale = d3.scale.linear().domain([-0.2,14])
                    .range(0,1);

                locations.push(l);
        });

        var start_time = new Date(d3.max(locations, function(d) {
                    return d.start_time; }));
        var end_time = new Date(d3.min(locations, function(d) {
                    return d.end_time; }));

        voronoi(locations).forEach(function(d) {
                        d.point.cell = d;
                });

        /*var voroPoints = bgLayer.append('g').attr("id", "voropoints")

            .selectAll("g")
            .data(locations)
            .enter().append("g")
            .on("click", function(d) { console.log(d);})
            .attr("class", "point");

        voroPoints.append("path")
            .attr("class", "point-cell")
            .attr("d", function(d) {
                if(d.cell){
                    return d.cell.length ? "M" + d.cell.join("L") + "Z" : null;
                }
            })
            .style("fill-opacity", 1);*/

        /*var ports = topLayer.append('g')
            .attr("id", "locations")
            .selectAll("circle")
            .data(locations)
            .enter()
            .append("circle")
            .attr("class", "port")
            .attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")";
            });*/


        var rate = 20;
        var chron = chroniton()
                .width(width-60).height(50)
                .tapAxis(function(axis) {
                    axis.ticks(12);
                    axis.orient("bottom");
                    axis.tickPadding(0);
                })
                .domain([start_time, end_time])
                .on('change', function(d) {
                    time_change = true;
                })
                .playButton(false)
                .playbackRate(1/rate)
                .play()
                .loop(true);



        var update = function() {

            date = new Date();

            if(time_change) {
                interpolateHeightsForTime(chron.getValue().getTime()/*date.getTime()*/);
                time_change = false;

                ports = d3.selectAll(".port")
                    .data(locations)
                    .attr("r", function(d) {

                        if(d.height) {
                            if(d.high_flag)
                                return tideScale(d.height)*40;
                            else
                                return tideScale(d.height)*30;
                        }
                        return 1;

                    })
                    .style('fill',
                           'none'
                    )
                    .style('stroke',
                           function(d) {
                            if(d.high_flag) return 'black';
                            return 'grey';
                    });


                d3.selectAll(".point-cell")
                    .data(locations)
                    .style('fill',
                           function(d) {
                            return colorScale(d.height);
                    })
                    .style('stroke',
                           function(d) {
                            return colorScale(d.height);
                    });


            }
        };


        d3.timer(update, 200);


        d3.select("#slider")
            .append('div')
            .call(chron);

        d3.select("#slider")
            .attr("width", width-60)
            .style({"left": "30px"});

        d3.select(".chroniton")
            .attr("transform", "translate(0,-16)");
            /*.on("click", function() {
                console.log(chron)
                if( chron.playing() ) {
                    chron.pause();
                }
            });*/


    });

function zoomed() {
   g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");

   // redraw uk map smooth

}





