// Globally accesible
var locations = [];

var width = window.innerWidth,
    height = window.innerHeight;

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


var tideScale = d3.scale.linear();
tideScale.domain([-0.2, 14]);
                    //.range(["black", "cyan", "white"]);

var path = d3.geo.path().projection(projection);

var voronoi = d3.geom.voronoi()
.x(function(d) { return d.x; })
.y(function(d) { return d.y; })
.clipExtent([[0, 0], [width, height]]);

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


var bisect = d3.bisector(function(d) { return d.timestamp; }).right;

var interpolateHeightsForTime = function(t) {

    locations.forEach(function(d) {

        if(!d.next || t > d.next.timestamp || !d.prev || t < d.prev.timestamp) {
            id = bisect(d.logs, t);
            d.prev = d.logs[id-1];
            d.next = d.logs[id];
        }

        //id = d3.bisect(d.logs, timestamp);
        if(d.next && d.prev) {
            interpolate = d3.interpolateNumber(d.prev.height, d.next.height);
            delta = d.next.timestamp - d.prev.timestamp;
            weight = (t-d.prev.timestamp) / delta;
            d.height = interpolate(weight);
        } else {
            d.height = null;
        }

    });
};

d3.json("http://127.0.0.1:5000/cloc", function(json) {

        json.locations.forEach(function(d) {

                l = [];
                l.key = d[0];
                l.point = d[1];
                l.name = d[2];
                var position = projection(l.point);
                //d[0] = position[0];
                //d[1] = position[1];

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

        var ports = g.selectAll("circle")
            .data(locations, function(d) { return d.key; })
            .enter()
            .append("circle")
            .attr("class", "port")
            .datum(function(d) { return d;})
            .attr("id", function(d) { return d.key; })
            .attr("r", 2)
            .attr("color", "black")
            .attr("transform", function(d) {
            return "translate(" + projection(d.point) + ")";
          });
        time = Date.now();

        var update = function() {

            ports = d3.selectAll(".port")
                .data(locations)
                .attr("r", function(d) {

                    if(d.height) {
                        return tideScale(d.height)*20;
                    }
                    return 4;

                })
                .attr("fill",  function(d) {
                    if(d.height) {
                        return "blue";
                    } else {
                        return "red";
                    }
                });

           // ports.transition()
           // .attr("r", function(d) { return Math.random(60);} );

            /*d3.selectAll("port")
            .data(locations, function(d) { return d.key; })
            .enter()
            .append("circle")
            .attr("r", Math.random(10))
            .attr("color", "black")
            .attr("transform", function(d) {
                return "translate(" + projection(d.point) + ")";
              });*/

        };

        d3.timer(update, 20);


        d3.select("#slider")
            .append('div')
            .call(chroniton()
                .domain([start_time, end_time])
                .on('change', function(d) {
                    interpolateHeightsForTime(d.getTime());
                })
                .playButton(true)
                .playbackRate(1/2)
                .play()
                .loop(true)
            );


    });

function zoomed() {
  g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}





