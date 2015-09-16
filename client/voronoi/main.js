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
        data = dataobject[val];
        return data;
}

//global
var color = d3.scale.linear();
var svgPoints;

voronoiMap = function(map, url) {
        var hs = [];
        var pointTypes = d3.map(),
                heights = [],
                points = [],
                lastSelectedPoint;

        var voronoi = d3.geom.voronoi()
                .x(function(d) {
                        return d.x;
                })
                .y(function(d) {
                        return d.y;
                });

        // this allows us to make the poppy ups
        var selectPoint = function() {
                d3.selectAll('.selected').classed('selected', false);

                var cell = d3.select(this),
                        point = cell.datum();

                lastSelectedPoint = point;
                cell.classed('selected', true);

                d3.select('#selected h1')
                        .html('')
                        .append('a')
                        .text(point.name)
                        .attr('href', point.url)
                        .attr('target', '_blank');
        };

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

        var draw = function() {
                // cleans up previous frame
                d3.select("#voronoi").remove();
                var max = d3.max(heights);
                var min = d3.min(heights);
                color.domain([min, max])
                        .range(["blue", "white", "green"]);
                // this removes overlay
                d3.select('#overlay').remove();

                var bounds = map.getBounds(),
                        topLeft = map.latLngToLayerPoint(bounds.getNorthWest()),
                        bottomRight = map.latLngToLayerPoint(bounds.getSouthEast()),
                        existing = d3.set(),
                        drawLimit = bounds.pad(0.4);

                // map the points into the right space
                filteredPoints = points.filter(function(d) {
                        var latlng = new L.LatLng(d.latitude, d.longitude);

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
                        .attr("class", "point");

                var buildPathFromPoint = function(point) {
                        return "M" + point.cell.join("L") + "Z";
                };

                svgPoints.append("path")
                        .attr("class", "point-cell")
                        .attr("d", buildPathFromPoint)
                        .on('click', selectPoint)
                        .style('fill', function(d) {
                                return color(d[2]);
                        })
                        .style("fill-opacity", 0.1)
                        .classed("selected", function(d) {
                                return lastSelectedPoint == d;
                        });

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
                //
                min_timestamp = new Date(min_time * 1000);
                max_timestamp = new Date(max_time * 1000);
                //
                data = getIndex(min_time, json, arr);
                jpoints = data;
                jpoints.forEach(function(point) {
                        point.latitude = point[1];
                        point.longitude = point[0];
                        hs.push(point[2]);
                });
                map.addLayer(mapLayer);
                points = jpoints;
                heights = hs;
                var rate = 10;
                d3.select("#slider")
                        .append('div')
                        .call(
                                chroniton()
                                .domain([min_timestamp, max_timestamp])
                                .on('change', function(d) {
                                        timestamp = d.getTime() / 1000;
                                        //console.log(Math.floor(timestamp % 10));
                                        // TODO figure this out
                                        // need  to update  the data bind to the svgs
                                        if (Math.floor(timestamp % rate) === 0) {
                                                data = getIndex(timestamp, json, arr);
                                                jpoints.forEach(function(point) {
                                                        hs.push(point[2]);
                                                });
                                                // NOTE to make this work the draw func
                                                // may need some refactoring
                                                heights = hs;
                                                svgPoints.selectAll("paths")
                                                        .data(hs)
                                                        .style('fill', "red");
                                                               //function(d) {
                                                                //return color(d[2]);
                                                        //});

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
