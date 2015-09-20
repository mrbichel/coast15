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


if __name__ == "__main__":
    app.run(use_debugger=app.debug)



