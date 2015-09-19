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




function zoomed() {
        g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}
