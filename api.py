from flask import Flask, jsonify, Response
from datetime import datetime
from urlparse import urlparse, parse_qs
from decimal import *
from bson import json_util
from bson.objectid import ObjectId
import json
from flask.ext.cors import CORS
import pymongo
from pymongo import MongoClient, GEO2D


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
