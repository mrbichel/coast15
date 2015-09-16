showHide = function(selector) {
        d3.select(selector).select('.hide').on('click', function() {
                d3.select(selector)
                        .classed('visible', false)
                        .classed('hidden', true);
        });

        d3.select(selector).select('.show').on('click', function() {
                d3.select(selector)
                        .classed('visible', true)
                        .classed('hidden', false);
        });
};

d3.selection.prototype.moveToBack = function() {
        return this.each(function() {
                var firstChild = this.parentNode.firstChild;
                if (firstChild) {
                        this.parentNode.insertBefore(this, firstChild);
                }
        });
};

function getIndex(t, interp, array) {
        // bisect returns the   index of the value  that is closer to t from right
        idx = d3.bisect(array, t) - 1;
        val = array[idx];
        dataobject = interp[idx];
        _data = dataobject[val];
        return _data;
}

// Globally accesible
data = {};
locations = {};
filteredPoints = [];

voronoiMap = function() {

        url = '../data/test/time_interpolated_1442233577.0.json';

        // create the leaflet map, centered in the center of uk
        map = L.map('map', {
                    'zoomControl': true,
                    'attributionControl': false,
        }).setView([56, -4], 6);

        console.log("load");

        var hs = [];
        locations = [];
        var colorScale = d3.scale.linear();

        var voronoi = d3.geom.voronoi()
                .x(function(d) {
                        return d.x;
                })
                .y(function(d) {
                        return d.y;
                });

        // load the map/data stuff below an hide
        var drawWithLoading = function(e) {
                d3.select('#loading').classed('visible', true);
                if (e && e.type == 'viewreset') {
                        d3.select('#overlay').remove();
                }
                setTimeout(function() {
                        draw();
                        d3.select('#loading').classed('visible', false);
                }, 0);
        };

        // todo update with new data
        colorScale.domain([-0.2, 4, 14])
                        .range(["black", "cyan", "white"]);

        var draw = function() {
                // cleans up previous frame
                console.log("redraw");

                d3.select("#voronoi").remove();

                // this removes overlay
                d3.select('#overlay').remove();

                var bounds = map.getBounds(),
                        topLeft = map.latLngToLayerPoint(bounds.getNorthWest()),
                        bottomRight = map.latLngToLayerPoint(bounds.getSouthEast()),
                        existing = d3.set(),
                        drawLimit = bounds.pad(0.4);

                // map the points into the right space
                filteredPoints = locations.filter(function(d) {

                        if(d.bad === true) {
                            return false;
                        }

                        var latlng = new L.LatLng(d.lat, d.lng);

                        if (!drawLimit.contains(latlng)) {
                                return false;
                        }

                        var point = map.latLngToLayerPoint(latlng);

                        key = point.toString();
                        if (existing.has(key)) {
                                return false;
                        }
                        existing.add(key);

                        d.x = point.x;
                        d.y = point.y;
                        return true;
                });

                voronoi(filteredPoints).forEach(function(d) {
                        d.point.cell = d;
                });

                var svg = d3.select(map.getPanes().overlayPane).append("svg")
                        .attr('id', 'voronoi')
                        .attr("class", "leaflet-zoom-hide")
                        .style("width", map.getSize().x + 'px')
                        .style("height", map.getSize().y + 'px')
                        .style("margin-left", topLeft.x + "px")
                        .style("margin-top", topLeft.y + "px");
                //  move it to back
                svg.moveToBack();
                var g = svg.append("g")
                        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

                svgPoints = g.attr("class", "points")
                        .selectAll("g")
                        .data(filteredPoints)
                        .enter().append("g")
                        .on("click", function(d) { console.log(d);})
                        .attr("class", "point");

                var buildPathFromPoint = function(point) {
                        return "M" + point.cell.join("L") + "Z";
                };

                svgPoints.append("path")
                        .attr("class", "point-cell")
                        .attr("id", function(d) { return d.uid;})
                        .datum(function(d) { return d;})
                        .attr("d", buildPathFromPoint)
                        .style('fill', function(d) {
                                return colorScale(d.h);
                        })
                        .on("click", function(d) { console.log(d);})
                        .style("fill-opacity", 1);

                // also map the points
                //svgPoints.append("circle")
                //.attr("transform", function(d) {
                //return "translate(" + d.x + "," + d.y + ")";
                //})
                //// use this if we want to fill the color
                //// NOTE can be defined per point
                //.style('fill', function(d) {
                //return '#' + d.color;
                //})
                //.attr("r", 2);
        };

        // this is the magic that allows easy linked zooming and panning
        var mapLayer = {
                onAdd: function(map) {
                        map.on('viewreset moveend', drawWithLoading);
                        drawWithLoading();
                }
        };

        var geojsonLayer;
        // control geojson map
        function drawMap(geojson) {
                // control appearance of the map
                // first specify the domain of the quantile color map
                function feature_style(feature) {
                        return {
                                weight: 0,
                                opacity: 1,
                                color: 'black',
                                fillOpacity: 1,
                        };
                }

                geojsonLayer = L.geoJson(geojson, {
                        style: feature_style,
                }).addTo(map);
        }

        d3.json(url, function(json) {
                var arr = [];
                for (var k in json) {
                        for (var key in json[k]) {
                                arr.push(key);
                        }
                }
                // js wants milliseconds
                min_time = d3.min(arr);
                max_time = d3.max(arr);

                console.log(min_time);
                console.log(max_time);

                min_timestamp = new Date(min_time * 1000);
                max_timestamp = new Date(max_time * 1000);

                data = getIndex(min_time, json, arr);
                dataMax = getIndex(max_time, json, arr);

                pI = 0;

                data.forEach(function(point) {
                        p = {};

                        p.uid = pI;//""+point[1]+point[0];
                        p.lat = point[1];
                        p.lng = point[0];
                        p.h = point[2];

                        p.bad = false;

                        if(dataMax[pI][2] > point[2] - 0.25 && dataMax[pI][2] < point[2] + 0.25 ) {
                            console.log("Check data from: " + point);
                            p.bad = true;
                        }


                        pI++;

                        locations.push(p);
                });

                map.addLayer(mapLayer);

                heights = hs;
                var rate = 2;

                d3.select("#slider")
                        .append('div')
                        .call(
                                chroniton()
                                .domain([min_timestamp, max_timestamp])
                                .on('change', function(d) {
                                        timestamp = d.getTime() / 1000;


                                        if (Math.floor(timestamp % rate) === 0) {

                                                hs = [];
                                                data = getIndex(timestamp, json, arr);

                                                locations.forEach(function(p) {
                                                        p.h = data[p.uid][2];
                                                });

                                                heights = hs;

                                                d3.selectAll(".point-cell")
                                                        .data(filteredPoints)
                                                        .style('fill',
                                                               function(d) {
                                                                //console.log(d);
                                                                return colorScale(d.h);
                                                        });

                                        }
                                })
                                .playButton(true)
                                .playbackRate(1/rate)
                                .play()
                                .loop(true)
                        );
        });
        // draw the map
        d3.json("subunits.json", function(mapData) {
                try {
                        map.removeLayer(geojsonLayer);
                } catch (err) {
                        console.log(err);
                }
                drawMap(mapData);
        });

};




// nuke attributes variable, clean mapping
L.Control.Attribution.prototype.options.prefix = '';

voronoiMap();
