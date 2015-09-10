// create the leaflet map, centered in the center of uk
var map = L.map('map', {
        'zoomControl': false,
        'attributionControl': false,
}).setView([56, -4], 6);

// nuke attributes variable for mapping
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


// we need to load the full json and keep in memory
// for now and later tune for performances
// maybe by using a coarse grid and the heatmap we can
// use few data to achieve the same result.
d3.json("interpolated.json", function(interp) {
        arr = [];
        for (var k in interp){
                for (var key in interp[k]) {
                        arr.push(key);
                }
        }
        data = interp[0][arr[0]];
        var max = d3.max(data, function(array) {
                return d3.max(array);
        });
        heat = L.heatLayer(data, {
                "max": max,
                "blur": 18,
                "minOpacity":0.2,
                "gradient": {
                        0.1:'#93AC90', 
                        0.3: '#21325E',
                        0.4: 'blue',
                        1: '#111676'
                },
                "radius": 100,
        }).addTo(map);
});


//slider
d3.select("#slider")
        .append('div')
        .call(
                chroniton()
                .domain([new Date(+new Date() - 60 * 1000), new Date()])
                .on('change', function(d) {
                        console.log(d);
                })
        );
