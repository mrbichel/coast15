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
        }
);

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
        }
);
