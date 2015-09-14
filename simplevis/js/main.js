// create the leaflet map, centered in the center of uk
var map = L.map('map', {
        'zoomControl': false,
        'attributionControl': false,
}).setView([56, -4], 6);

// nuke attributes variable, clean mapping
L.Control.Attribution.prototype.options.prefix = '';

var geojsonLayer;
// control geojson map
function drawMap(geojson) {
        // control appearance of the map
        // first specify the domain of the quantile color map
        function feature_style(feature) {
                return {
                        weight: 0,
                        opacity: 1,
                        color: '#E9DAC8',
                        fillOpacity: 0.9,
                };
        }

        geojsonLayer = L.geoJson(geojson, {
                style: feature_style,
        }).addTo(map);
}



// draw the map
d3.json("subunits.json", function(mapData) {
        try {
                map.removeLayer(geojsonLayer);
        } catch (err) {
                console.log(err);
        }
        drawMap(mapData);
});

// return data at time t.
function getIndex(t, interp, array) {
        // bisect returns the   index of the value  that is closer to t from right
        idx = d3.bisect(array, t) - 1;
        val = array[idx];
        dataobject = interp[idx];
        data = dataobject[val];
        return data;
}

// we need to load the full json and keep in memory
// for now and later tune for performances
// maybe by using a coarse grid and the heatmap we can
// use few data to achieve the same result.
d3.json("gridded.json", function(interp) {
        arr = [];
        for (var k in interp) {
                for (var key in interp[k]) {
                        arr.push(key);
                }
        }
        // js wants milliseconds
        min_time = d3.min(arr);
        max_time = d3.max(arr);
        //
        min_timestamp = new Date(min_time * 1000);
        max_timestamp = new Date(max_time * 1000);
        //
        data = getIndex(min_time, interp, arr);
        //
        var max = d3.max(data, function(array) {
                return d3.max(array);
        });
        //
        heat = L.heatLayer(data, {
                "max": max,
                "blur": 18,
                "minOpacity": 0.2,
                "gradient": {
                        0.1: '#93AC90',
                        0.3: '#21325E',
                        0.4: 'blue',
                        1: '#111676'
                },
                "radius": 10,
        }).addTo(map);
        //slider
        //
        d3.select("#slider")
                .append('div')
                .call(
                        chroniton()
                        .domain([min_timestamp, max_timestamp])
                        .on('change', function(d) {
                                timestamp = d.getTime() / 1000;
                                data = getIndex(timestamp, interp, arr);
                                // reset and redraw heatmap in background
                                heat.setLatLngs(data);
                        })
                        .playButton(true)
                        .play()
                        .loop(true)
                );
});

d3.json("headlands.json",
        function(data) {
                for (var i = 0; i < data.length; i++) {
                        try {
                                var city = data[i];
                                var circle = L.circleMarker([city.lat, city.lng], {
                                        stroke: false,
                                        radius: 10,
                                        color: "white",
                                        //icon: greenIcon
                                }).addTo(map);
                        } catch (err) {
                                console.log("skip");
                        }
                }
        });

d3.json("harbors.json",
        function(data) {
                for (var i = 0; i < data.length; i++) {
                        try {
                                var city = data[i];
                                var circle = L.circleMarker([city.lat, city.lng], {
                                        stroke: false,
                                        radius: 10,
                                        color: "blac",
                                        //icon: greenIcon
                                }).addTo(map);
                        } catch (err) {
                                console.log("skip");
                        }
                }
        });
var data; // a global

  var mapLayer = {
    onAdd: function(map) {
      map.on('viewreset moveend', drawWithLoading);
      drawWithLoading();
    }
  };

d3.json("points.json", function(error, json) {
        if (error) return console.warn(error);

        //var width = 960,
        //height = 1160;

        //var projection = d3.geo.albers()
        //.center([0, 55.4])
        //.rotate([4.4, 0])
        //.parallels([50, 60])
        //.scale(2800)
        //.translate([width / 2, height / 2]);

        var tideScale = d3.scale.linear(); //.domain([-0.2,14.65]); // low and high historical tide level for mapping

        //var path = d3.geo.path()
        //.projection(projection);

        //var svg = d3.select("body").append("svg")
        //.attr("width", width)
        //.attr("height", height);

        var bounds = map.getBounds(),
                topLeft = map.latLngToLayerPoint(bounds.getNorthWest()),
                bottomRight = map.latLngToLayerPoint(bounds.getSouthEast()),
                existing = d3.set(),
                drawLimit = bounds.pad(0.4);
        var svg = d3.select(map.getPanes().overlayPane).append("svg")
                .attr('id', 'overlay')
                .attr("class", "leaflet-zoom-hide")
                .style("width", map.getSize().x + 'px')
                .style("height", map.getSize().y + 'px')
                .style("margin-left", topLeft.x + "px")
                .style("margin-top", topLeft.y + "px");


        var voronoi = d3.geom.voronoi()
                .x(function(d) {
                        return d.x;
                })
                .y(function(d) {
                        return d.y;
                })
                .clipExtent([
                        [0, 0],
                        [map.getSize().y, map.getSize().x]
                ]);


        var paths = svg.append("svg:g").attr("id", "voronoi-paths");

        locations = json.locations;
        //console.log(locations);

        var projection = d3.geo.albers()
            .center([0, 55.4])
            .rotate([4.4, 0])
            .parallels([50, 60])
            .scale(2800)
            .translate([map.getSize().y, map.getSize().x]);

        heights = [];
        locations.forEach(function(d) {
                heights.push(d.height);

                var position = projection([
                        d.latlng[1],
                        d.latlng[0]
                ]);
                d[0] = position[0];
                d[1] = position[1];

                d.x = position[1];
                d.y = position[0];

        });

        tideScale.domain([d3.min(heights), d3.max(heights)]);


        var buildPathFromPoint = function(point) {
        return "M" + point.cell.join("L") + "Z";
        };
        paths.selectAll("path")
                .data(d3.geom.voronoi(locations))
                .enter()
                .append("svg:path").attr("d", function(d) {
                        console.log(d);
                        return "M" + d.join(",") + "Z";
                })
                .attr("id", function(d, i) {
                        return "path-" + i;
                })
                .attr("clip-path", function(d, i) {
                        return "url(#clip-" + i + ")";
                })
                .style("fill", function(d, i) {
                        return d3.rgb(0, 255 - (tideScale(d.point.height) * 255), tideScale(d.point.height) * 255);
                })
                .style('fill-opacity', 1)
                .style('stroke-opacity', function(d) {
                        return tideScale(d.point.height);
                });
        //.style("stroke", function(d,i) {  return d3.rgb(200, 200, tideScale(d.point.height)*255);   });

});
