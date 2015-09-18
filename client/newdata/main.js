d3.selection.prototype.moveToBack = function() {
        return this.each(function() {
                var firstChild = this.parentNode.firstChild;
                if (firstChild) {
                        this.parentNode.insertBefore(this, firstChild);
                }
        });
};

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

var colorScale = d3.scale.linear();
colorScale.domain([-0.2, 4, 14])
                    .range(["black", "cyan", "white"]);

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

//var vector = svg.append("path");

var bisect = d3.bisector(function(d) { return d[0]; }).right;

var interpolateHeightsForTime = function(t) {

    locations.forEach(function(d) {

        //id = d3.bisect(d.logs, timestamp);
        id = bisect(d.logs, t);

        prevLog = d.logs[id-1];
        nextLog = d.logs[id];
        if(nextLog && prevLog) {

            // TODO: only instantiate a new interpolator if we have new end points
            interpolate = d3.interpolateNumber(prevLog[1], nextLog[1]);

            tD = nextLog[0] - prevLog[0];
            nW = (t-prevLog[0]) / tD;

            d.nw = nW;

            //interpHeight = n['height'] * nWeight + b['height'] * bWeight
            //interpolate();
            d.height = interpolate(nW);
        }

    });
};

d3.json("http://127.0.0.1:5000/cloc", function(json) {
        console.log(json);

        json.locations.forEach(function(d) {
                d.key = d[0];
                d.point = d[1];
                d.name = d[2];
                var position = projection(d.point);
                //d[0] = position[0];
                //d[1] = position[1];

                d.x = position[0];
                d.y = position[1];

                d.logs = d[3];

                locations.push(d);
                d.height = 2;
        });

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

            time+=36000;

            interpolateHeightsForTime(time);

            //console.log(locations[0].height);
            // interpolate a height value attached to the location

            ports = d3.selectAll(".port")
                .data(locations)
                .attr("r", function(d) { return d.height; } );

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

    });

function zoomed() {
  g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}





