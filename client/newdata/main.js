
function distance(p1,p2){
    var dx = p2.x-p1.x;
    var dy = p2.y-p1.y;
    return Math.sqrt(dx*dx + dy*dy);
}

function distanceApprox(p1,p2){
    // Approximation by using octagons approach
    var x = p2.x-p1.x;
    var y = p2.y-p1.y;
    return 1.426776695*Math.min(0.7071067812*(Math.abs(x)+Math.abs(y)), Math.max (Math.abs(x), Math.abs(y)));
}


// The magic function - converts node positions into positions on screen.
function getScreenCoords(x, y, translate, scale) {
    var xn = translate[0] + x*scale;
    var yn = translate[1] + y*scale;
    return { x: xn, y: yn };
}


var width = window.innerWidth,
    height = window.innerHeight;


var scale,
    translate,
    area;

var locations = [];
var harbors = [];

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

var bgLayer = g.append('g').attr("id", "bg");
var midLayer = g.append('g').attr("id", "mid");
var topLayer = g.append('g').attr("id", "top");

var zoom = d3.behavior.zoom()
    .scaleExtent([1, 8])
    .on("zoom", zoomed);




svg.append("rect")
    .attr("class", "overlay")
    .attr("width", width)
    .attr("height", height);

svg
    .call(zoom)
    .call(zoom.event);






var voronoi = d3.geom.voronoi()
    .x(function(d) { return d.x; })
    .y(function(d) { return d.y; })
    .clipExtent([[-200, -200], [width + 400, height + 400]]);

var filter = svg.append("defs")
  .append("filter")
    .attr("id", "blur")
  .append("feGaussianBlur")
    .attr("stdDeviation", 0);

function blur() {
  filter.attr("stdDeviation", 1);
}

var localColorScale  = d3.scale.linear();
localColorScale.domain([0, 0.9,  1])
    .range([d3.rgb(0, 0, 0), d3.rgb(60, 60, 60), d3.rgb(230, 230, 240)]);
//    .range([d3.rgb(15, 77, 41), d3.rgb(15, 77, 141), d3.rgb(131, 203, 197), d3.rgb(239, 248, 232)]);


var localScale  = d3.scale.linear();
localScale.domain([0, 0.9, 1])
    .range([0, 0, 1]);

var colorScale = d3.scale.linear();
        // todo update with new data

colorScale.domain([-0.2, 8, 14])
    .range(["black", "black", "white"]);

var tideScale = d3.scale.linear();
tideScale.domain([-0.2, 14]);
                    //.range(["black", "cyan", "white"]);

var bisect = d3.bisector(function(d) { return d.timestamp; }).right;


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


            if(d.next.height > d.prev.height) {
                // going up
                d.localHeightNormalized = weight;
            } else {
                d.localHeightNormalized = 1-weight;
            }

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

// todo load headlands
// todo load harbors

d3.json("../data/uk.json", function(error, uk) {

    var subunits = topojson.feature(uk, uk.objects.subunits);
     midLayer.append('g').attr("id", "uk-map")
        .selectAll(".subunit")
        .data(topojson.feature(uk, uk.objects.subunits).features)
        .enter().append("path")
        .attr("class", function(d) { return "subunit " + d.id; })
        .attr("d", path)
        .attr("fill", localColorScale(0));
});

/*headlands = [];
d3.json("../data/headlands.json",
        function(_headlands) {
            headlands = _headlands;
            topLayer.append('g')
                .attr("id", "headlands")
                .selectAll("circle")
                .data(headlands)
                .enter()
                .append("circle")
                .attr("id", function(d) {
                    return d.name;
                })
                .attr("class", "port")
                .attr("transform", function(d) {
                    var p = projection([d.lng, d.lat]);
                    return "translate(" + p[0] + "," + p[1] + ")";
                }).attr("fill", "white")
                .attr('r', 0.3);

        }
);*/


d3.json("../data/harbors.json", function(_harbors) {

        _harbors.forEach(function(d) {
                l = [];
                l.name = d.name;
                var position = projection([d.lng, d.lat]);
                l.x = position[0];
                l.y = position[1];
                harbors.push(l);
        });

        topLayer.append('g')
                .attr("id", "harbor")
                .selectAll("circle")
                .data(harbors)
                .enter()
                .append("circle")
                .attr("id", function(d) {
                    return d.name;
                })
                .attr("class", "harbor")
                .attr("transform", function(d) {
                    return "translate(" + d.x + "," + d.y+ ")";
                }).attr("fill", "grey")
                .attr('r', 0.3);


        var texts = topLayer.selectAll("text")
                .data(harbors)
                .enter();

        texts.append("text")
            .text(function(d){
                    return d.name;
                })

            .attr("transform", function(d) {
                    return "translate(" + d.x + "," + d.y+ ")";
            }).attr("fill", "grey");


        }
);


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

                locations.push(l);
        });

        var start_time = new Date(d3.max(locations, function(d) {
                    return d.start_time; }));
        var end_time = new Date(d3.min(locations, function(d) {
                    return d.end_time; }));

        voronoi(locations).forEach(function(d) {
                        d.point.cell = d;
                });

        var voroPoints = bgLayer.append('g').attr("id", "voropoints")
            .selectAll("g")
            .data(locations)
            .enter().append("g")
            .attr("class", "point");

        voroPoints.append("path")
            .attr("class", "point-cell")
            .attr("d", function(d) {
                if(d.cell){
                    return d.cell.length ? "M" + d.cell.join("L") + "Z" : null;
                }
            })
            .style("fill-opacity", 1);

        /*var sensorPoints = topLayer.append('g')
            .attr("id", "locations")
            .selectAll("circle")
            .data(locations)
            .enter()
            .append("circle")
            .attr("id", function(d) {
                return d.name;
            })
            .attr("class", "port")
            .attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")";
            });*/


        /*var texts = topLayer.selectAll("text")
                .data(locations)
                .enter();

        texts.append("text")
            .text(function(d){
                    return d.name;
                })
            .attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")"
            }).attr("fill", "red");*/
     // set position etc.



        /* Create the text for each block */
       /* sensorPoints.append("text")
            .attr("dx", function(d){return -20})
            .text(function(d){return d.name})
*/
        var time_change = true;
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

        svg.on('mousemove', function () {
            var coordinates = [0, 0];
            coordinates = d3.mouse(this);
            var x = coordinates[0]; //+ zoom.translate()[0]/zoom.scale();
            var y = coordinates[1]; //+ zoom.translate()[1]/zoom.scale();


            topLayer.selectAll("text")
            .data(harbors).transition()
            .attr("fill-opacity", function(d) {

                    coords = getScreenCoords(d.x, d.y, zoom.translate(), zoom.scale());

                    xd = x-coords.x;
                    yd = y-coords.y;

                    //cx = +circle.getAttribute('cx');
                    //cy = +circle.getAttribute('cy');

                    distance = Math.sqrt(xd*xd + yd*yd);

                    //if(d.name == "")
                    if(distance < 10*zoom.scale()) {
                        return 1;
                    } else {
                        return 0;
                    }
            });


        });



        var update = function() {




            time_change = true;

            date = new Date();
            if(time_change) {
                interpolateHeightsForTime(chron.getValue().getTime()/*date.getTime()*/);
                time_change = false;

                /*sensorPoints = d3.selectAll(".port")
                    .data(locations)
                    .attr("r", function(d) {

                        if(d.height) {
                            if(d.high_flag)
                                return //d.localHeightNormalized*200;
                            else
                                return //d.localHeightNormalized*100;
                        }

                        //return localScale(d.localHeightNormalized)*60;
                        return 0.5;

                    })
                    .style('fill',function(d) {
                           return 'none';
                       }
                    )
                    .style('stroke',
                           function(d) {
                            //return localColorScale(d.localHeightNormalized);
                            return 'none';
                    });*/


                d3.selectAll(".point-cell")
                    .data(locations)
                    .style('fill-opacity', function(d) {
                        //return 1-localScale(d.localHeightNormalized);
                        return 1;
                    })
                    .style("stroke-width", 0)
                    .style('stroke-opacity', function(d) {
                        return 1;
                        //return 1-localScale(d.localHeightNormalized);
                    })
                    .style('fill',
                           function(d) {
                            return localColorScale(d.localHeightNormalized);
                    })
                    .style('stroke',
                           function(d) {
                            return localColorScale(d.localHeightNormalized);
                    });
                    /*.style('mix-blend-mode',
                           function(d) {
                            return "hard-light";
                    });*/



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

   // when itsthe same style for all the points can we just set some css instead of doing the data thing?
   r=0;
   if(d3.event.scale > 2) {
        r= 1/d3.event.scale;
   }

   topLayer.selectAll(".harbor")
            .data(harbors)
            .attr('r', r );
}


