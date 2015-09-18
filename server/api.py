#!/usr/bin/env python
# -*- coding: utf-8 -*-
#  2015 giulio <giulioungaretti@me.com> johan <public@jhoan.cc>
"""
main api to query mongodb
"""
from flask import Flask, jsonify, Response
from datetime import datetime, timedelta
from urlparse import urlparse, parse_qs
from decimal import *
from bson import json_util
from bson.objectid import ObjectId
import json
from flask.ext.cors import CORS
import pymongo
from pymongo import MongoClient, GEO2D
from time import mktime
import pickle

def translate(value, leftMin, leftMax, rightMin, rightMax):
    # Figure out how 'wide' each range is
    leftSpan = leftMax - leftMin
    rightSpan = rightMax - rightMin

    # Convert the left range into a 0-1 range (float)
    valueScaled = float(value - leftMin) / float(leftSpan)

    # Convert the 0-1 range into a value in the right range.
    return rightMin + (valueScaled * rightSpan)

app = Flask(__name__)
#app = create_app(config="config.yaml")

cors = CORS(app, resources={r"/*": {"origins": "*"}})

app.debug = True

client = MongoClient('localhost', 27017)

db = client.uk_tide
locations = db.locations
tide_logs = db.tide_logs


@app.route("/")
def hello():
    return "Tide Data API."

#def get_coast15_logs():

def get_coast15_match(fromDate, toDate): # add bounds here
    coast15_match = {
          "latlng": {
                  #"$exists": True,
                  "$within": { "$box": [[48, -46], [63, 5]] }
              },
          "logs": {
              "$elemMatch": { "timestamp": { "$gte": fromDate, "$lt": toDate } }
              },
          "source": {"$ne": 'tidetimes'},
          "missing_data":  {"$ne": True},
      }

    return coast15_match

def get_coast15_locations():

    fromDate = datetime.utcnow() - timedelta(days=1)
    toDate = datetime.utcnow() + timedelta(days=1)

    locs = locations.aggregate([
            {"$match"  : get_coast15_match(fromDate, toDate) },
            {"$unwind" : "$logs"},

            {"$match"  : { "logs.timestamp": { "$gte": fromDate, "$lt": toDate }}},

            #{"$project": {"logs.timestamp":1}}
            { "$group": {
                "_id": "$_id",
                "latlng" : { "$first": '$latlng' },
                "name" : { "$first": '$name' },
                "logs": { "$addToSet": "$logs" }
            }},

        ]
    )

    return locs


## get high and low around time for all coast15 locations
# Get Locations selected for coast15
@app.route("/cloc_data")
def coast_location_data():

    locations = get_coast15_locations()

    ret = []
    for location in locations:
        logs = []
        for log in location['logs']:
            logs.append([
                mktime(log['timestamp'].timetuple()),
                log['height'],
                log['type']
                ])

        logs.sort()

        ret.append( [str(location['_id']), logs] )

    return Response(
        json_util.dumps({'logs' : ret}),
        mimetype='application/json'
    )

    #ids = []
    #for l in locs:
    #    ids.append(ObjectId(l['_id']))

    #tl = tide_logs.find({
   #        "location": {"$in": ids},
   #        "timestamp": {
   #            "$gte": fromDate,
   #            "$lt": toDate
   #        },
   #        })

    #retAll = {}
    #for l in locs:
    #    ret = {}
#
    #    tl = tide_logs.find({
    #        "location": ObjectId(l['_id']),
    #        "timestamp": {
    #            "$gte": fromDate,
    #            "$lt": toDate
    #        },
    #        })
#
    #    for t in tl:
    #        ret[mktime(t['timestamp'].timetuple())] = [t['height'], t['type']]
#
    #       retAll[str(l['_id'])] = ret





# Get Locations in bounds

# Get Locations selected for coast15
@app.route("/cloc")
def coast_location():
    locs = get_coast15_locations()

    o = []
    for l in locs:
        logs = []
        for log in l['logs']:
            logs.append([
                mktime(log['timestamp'].timetuple())*1000,
                log['height'],
                log['type']
                ])

        logs.sort()


        o.append([
                str(l['_id']),
                [
                    l['latlng'][1],
                    l['latlng'][0]
                ],
                l['name'],
                logs
            ])

    return Response(
        json_util.dumps({'locations' : o}),
        mimetype='application/json'
    )



@app.route("/loc")
def location():
    # return "Hello World!"
    locs = locations.find()
    json_locs = []

    d = datetime.now()

    for loc in locs:

        # get interpolated tide level for current time
        # print(loc);

        # get closest measure later than time
        n = tide_logs.find_one({
            "location": ObjectId(loc['_id']),
            "timestamp": {"$gte": d}
        }, sort=[("timestamp", pymongo.ASCENDING)])

        b = tide_logs.find_one({
            "location": ObjectId(loc['_id']),
            "timestamp": {"$lte": d}
        }, sort=[("timestamp", pymongo.DESCENDING)])

# ------- before ------- (lower than now - DESCENDING) now (greater than n
        interpolatedHeight = 0
        loc['height'] = 0

        if n and b:
            totalTimeDelta = n['timestamp'] - b['timestamp']
            # print(totalTimeDelta.total_seconds())

            nTimeDelta = n['timestamp'] - d
            bTimeDelta = d - b['timestamp']

            nWeight = nTimeDelta.total_seconds() / \
                totalTimeDelta.total_seconds()
            bWeight = bTimeDelta.total_seconds() / \
                totalTimeDelta.total_seconds()

            interpolatedHeight = n['height'] * nWeight + b['height'] * bWeight
            loc['height'] = interpolatedHeight
            loc['next'] = n
            loc['prev'] = b
            # print(n['height'])
            # print(b['height'])
            # print(interpolatedHeight)
        else:
            loc['height'] = 0

        # use .next to get next one

        # print(tide_logs.find_one({
        #    "location": ObjectId(loc['_id']),
        #    "timestamp": {"$grt": d}
        #    }).sort("timestamp"))

        # get closest mesure earlier than time

        # if we have two interpolate weighted betwe
        # if we only have 1 just returnen them, weight is 1/closest in seconds

        json_loc = json.loads(json.dumps(loc, default=json_util.default))
        json_locs.append(json_loc)

    return jsonify(locations=json_locs)


if __name__ == "__main__":
    app.run(use_debugger=app.debug)



