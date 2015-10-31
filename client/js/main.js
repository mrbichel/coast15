audio = {

    // Path to audio files
    audioPath: 'data/audio/',

    // Background audio
    backgroundSound: '12832hz.mp3',
    fastForwardSound: 'bell.mp3',
    // Random audio files
    randomAudio: new Array(
                'marine01.mp3',
                'marine02.mp3',
                'marine03.mp3',
                'marine04.mp3',
                'marine05.mp3',
                'marine06.mp3',
                'marine07.mp3',
                'marine08.mp3',
                'marine09.mp3',
                'marine10.mp3'
        ),

    // Timeout in seconds
    randomTimeout: 80,  

    // Bell sound
    bell: 'bell.mp3',
    
    init: function(){
        // Create necessary elements

        // Random 
        this.random = document.createElement('audio');
        setInterval('audio.playRandom()', this.randomTimeout * 1000);

        var fastForwardSrc = this.audioPath + this.fastForwardSound;
        this.fastForward = document.createElement('audio');
        this.fastForward.setAttribute('src', fastForwardSrc);

        // Background audio
        var bgsrc = this.audioPath + this.backgroundSound;
        this.bg = document.createElement('audio');
        this.bg.setAttribute('src', bgsrc);

        // Bell 
        bellsrc = this.audioPath + this.bell;
        this.bell = document.createElement('audio');
        this.bell.setAttribute('src', bellsrc);
    },
    playBackground: function(){
        this.bg.play();
        this.bg.addEventListener('ended', function() {
            audio.bg.currentTime = 0;
            audio.bg.play();
        }, false);

    },
    playRandom: function(){
        var rand = this.audioPath + this.randomAudio[Math.floor(Math.random() * this.randomAudio.length)];
        this.random.setAttribute('src', rand);
        this.random.volume = 0.15;
        this.random.play();
    },
    playBell: function(){
        this.bell.play();
    },
    resetBell: function(){        
        this.bell.pause();
        this.bell.currentTime = 0;
    },
    playFastForward: function(){
        this.fastForward.play();
    },
    stopFastForward: function(){        
        this.fastForward.pause();
        this.fastForward.currentTime = 0;
    },
    pause: function(){
        this.bg.pause();
    },
    play: function(){
        this.bg.play();
    },
}

var ringBell = false; 

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
    .scale(4600)
    .translate([width / 2, height / 2]);

var center = projection([0, 55.4]);

var path = d3.geo.path().projection(projection);

var svg = d3.select("body").append("svg")
    .style("opacity", "0")
    .attr("width", width)
    .attr("height", height);


var defs = svg.append('defs');

var blurAmount = 10;

//Blur filter
var filterBlur = defs.append('svg:filter')
    .attr({ id: 'blur' });

var blur = filterBlur.append('feGaussianBlur')
        .attr({
            'in': "SourceGraphic",
            'stdDeviation': blurAmount
        });

var pattern = defs.append("pattern")
    .attr('id', 'pattern')
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 120)
    .attr('height', 120)
    .attr("x", 0).attr("y", 0);

pattern.append("svg:image")
                .attr("xlink:href", "/data/img/bluetile.jpg")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", 120)
                .attr("height", 120);

var g = svg.append("g");

var format = d3.time.format("%A %H:%M");
var timelabel = d3.select("#timecontrol time");
var bgPatternLayer = g.append('rect').attr("id", "bgpattern")
.attr("width", 6000)
.attr("height", 6000)
.attr("x", -6000/2 + width/2)
.attr("y", -6000/2 + height/2)
.style("fill","url(#pattern)");

var bgLayer = g.append('g').attr("id", "bg").attr("filter","url(#blur)");
var midLayer = g.append('g').attr("id", "mid");
var topLayer = g.append('g').attr("id", "top");

var zoom = d3.behavior.zoom()
    .scaleExtent([1, 4])
    .on("zoomstart", zoomstart)
    .on("zoom", zoomed)
    .on("zoomend", zoomend);

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
    .clipExtent([[-4000 , -4000], [width+4000, height+4000]]);

var localColorScale  = d3.scale.linear();
//localColorScale.domain([0, 0.1, 0.9,  1])
//    .range([d3.rgb(0, 0, 0), d3.rgb(0, 0, 0), d3.rgb(60, 60, 60), d3.rgb(230, 230, 240)]);
//    .range([d3.rgb(15, 77, 41), d3.rgb(15, 77, 141), d3.rgb(131, 203, 197), d3.rgb(239, 248, 232)]);


// Atlas blues
//localColorScale.domain([0, 0.75, 0.8, 0.9,  1])
localColorScale.domain([1, 0.9, 0.8, 0.4,  0])
    .range([d3.rgb(170, 200, 228).darker(), d3.rgb(189, 219, 239), d3.rgb(211, 227, 241), d3.rgb(232, 242, 252), d3.rgb(250, 254, 255)]);

var localScale  = d3.scale.linear();
localScale.domain([0, 0.9, 1])
    .range([0, 0, 1]);

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
        }
        if(d.next && d.prev) {
            interpolate = d3.interpolateNumber(d.prev.height, d.next.height);

            delta = d.next.timestamp - d.prev.timestamp;
            weight = (t-d.prev.timestamp) / delta;

            d.height = interpolate(weight);

            if(d.next.height > d.prev.height) {
                d.localHeightNormalized = weight;
            } else {
                d.localHeightNormalized = 1-weight;
            }

        } else {
            d.height = null;
        }        
        if(d.name == "Penzance (Newlyn)"/*Land's end"*/ || d.name == "London Bridge (Tower Pier)") {
            if(d.localHeightNormalized > 0.98) {
                if(!ringBell) {
                    audio.playBell();
                    ringBell = true;
                }
            } else {
                ringBell = false;
            }
        }

    });
};

d3.json("./data/uk.json", function(error, uk) {
    var subunits = topojson.feature(uk, uk.objects.subunits);
     midLayer.append('g').attr("id", "uk-map")
        .selectAll(".subunit")
        .data(topojson.feature(uk, uk.objects.subunits).features)
        .enter().append("path")
        .attr("class", function(d) { return "subunit " + d.id; })
        .attr("d", path)
        .attr("fill", localColorScale(0));
});

d3.json("./data/harbors.json", function(_harbors) {

        _harbors.forEach(function(d) {
                l = [];
                l.name = d.name;
                var position = projection([d.lng, d.lat]);
                l.x = position[0];
                l.y = position[1];
                harbors.push(l);
        });

        topLayer.append('g')
                .attr("id", "harbors")
                .selectAll("circle")
                .data(harbors)
                .enter()
                .append("circle")
                .attr("id", function(d) {
                    return d.name;
                })
                .attr("class", "harbor_point")
                .attr("transform", function(d) {
                    return "translate(" + d.x + "," + d.y+ ")";
                }).attr("fill", d3.rgb(localColorScale(1)).brighter()
                )
                .attr('r', 0);

        var texts = topLayer.append('g').attr("id", "harbor_names")
                 .selectAll("text")
                .data(harbors)
                .enter();

        texts.append("text")
            .text(function(d){
                    return d.name;
                })
            .attr("transform", function(d) {
                    return "translate(" + d.x + "," + d.y+ ")";
            }).attr("fill", d3.rgb(localColorScale(1)).brighter())
            .attr("fill-opacity", 0)
            .attr("class", "harbor_label");

        svg.on('mousemove', function () {
            var coordinates = [0, 0];
            mouseCoords = d3.mouse(this);

            topLayer.selectAll(".harbor_label")
            .data(harbors)/*.transition()*/
            .attr("fill-opacity", function(d) {

                    coords = getScreenCoords(d.x, d.y, zoom.translate(), zoom.scale());
                    var distance = distanceApprox({x: mouseCoords[0], y: mouseCoords[1]}, coords);

                    if(distance < 50.0*zoom.scale()) {
                        return 1-(distance / 50.0*zoom.scale());
                    } else {
                        return 0;
                    }
        });
    });
});

var now = Date.now(); // unix time stamp
var delta = 60*60*12*1000; // 12 hours in milisseconds

var fromTime = new Date(now);
var toTime = new Date(now+delta);

var sim_time = now;

var isFastForward = false;
var fastForwardRate = 60000;

audio.init();

d3.json("http://api.coast.johan.cc/cloc?from=" + fromTime.toUTCString() + "&to=" + toTime.toUTCString(), function(json) {

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

                //if(locations.length < 400)
                locations.push(l);
        });


        var start_time = fromTime; //new Date(d3.max(locations, function(d) {   return d.start_time; }));
        var end_time = toTime; //new Date(d3.min(locations, function(d) { return d.end_time; }));

        console.log(start_time, end_time);

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
            });

        svg.transition().style("opacity", 1);

        audio.playBackground();

        var updateRate = 50;
        sim_time = now;


        var update = function() {

            //sim_time += updateRate /10;
            if(isFastForward) {
                sim_time += fastForwardRate / (updateRate/100);
            } else {
                interp = d3.interpolateNumber(Date.now(), sim_time);
                sim_time = interp(0.8);
            }

            if(sim_time > end_time) sim_time = +end_time;

            time_change = true;

            date = new Date();
            if(time_change) {
                interpolateHeightsForTime(sim_time);
                time_change = false;

                timelabel.text(format(new Date(sim_time)));


                d3.selectAll(".point-cell")
                    .data(locations)
                    //.transition()
                    .style('fill',
                           function(d) {
                            return localColorScale(d.localHeightNormalized);
                    })
                    .style('stroke',
                           function(d) {
                            return localColorScale(d.localHeightNormalized);
                    });

            }
        };

        d3.timer(update, updateRate);
        update();

        fastforward = d3.select("#fastforward");

        fastforward.on("mousedown", function() {
            isFastForward = true; 
            audio.playFastForward();

            //fastforward.text("slow");
        });

        d3.select("body")
        .on("mouseup", function() {
            isFastForward = false;
            audio.stopFastForward();

            //fastforward.text("slow");
        });

    });

function zoomstart() {

    //console.log("zoomstart");
    bgLayer.attr("filter","none"); //url(#blur)"

}

function zoomend() {

    //console.log("zoomend");
    bgLayer.attr("filter","url(#blur)");

}


function zoomed() {

    //console.log("zoomed");

   g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");

          // when itsthe same style for all the points can we just set some css instead of doing the data thing?
   r=0;
   fontSize = 0;
   if(d3.event.scale > 2) {
        r= 1.2/d3.event.scale;
        fontSize = 14/d3.event.scale;
   }

   topLayer.selectAll(".harbor_point")
            .data(harbors)
            .attr('r', r );

    topLayer.selectAll("#harbor_names").style("font-size", fontSize + "px");


}


