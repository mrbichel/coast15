import requests
from datetime import datetime
from datetime import timedelta
from urlparse import urlparse, parse_qs
from decimal import *
from bson import json_util
from bson.objectid import ObjectId
import json
import pymongo
from pymongo import MongoClient, GEO2D
from math import pow
from math import sqrt
import numpy as np
import matplotlib.pyplot as plt
from time import mktime


from PIL import Image
import pyproj
import math
## TODO: clean up unused imports

client = MongoClient('localhost', 27017)

db = client.uk_tide
locations = db.locations
tide_logs = db.tide_logs

def getInterpolatedHeightForLocation(loc, d):
    # get interpolated tide level for current time for location
    # get closest measure later than time
    interpolatedHeight = 0

    n = tide_logs.find_one({
        "location": ObjectId(loc['_id']),
        "timestamp": {"$gte": d}
        }, sort=[("timestamp", pymongo.ASCENDING)])

    b = tide_logs.find_one({
        "location": ObjectId(loc['_id']),
        "timestamp": {"$lte": d}
        }, sort=[("timestamp", pymongo.DESCENDING)])

    if n and b:
        totalTimeDelta = n['timestamp'] - b['timestamp']

        nTimeDelta = n['timestamp'] - d
        bTimeDelta = d - b['timestamp']

        nWeight = nTimeDelta.total_seconds() / totalTimeDelta.total_seconds()
        bWeight = bTimeDelta.total_seconds() / totalTimeDelta.total_seconds()

        interpolatedHeight = n['height'] * nWeight + b['height'] * bWeight

        return interpolatedHeight

    return None


def dataToJson():
    fromDate = datetime.now() - timedelta(days=2)
    toDate = datetime.now() + timedelta(days=2)

    tide_entries = tide_logs.find({"timestamp": {"$gte": fromDate, "$lte": toDate }})
    out = []
    outputFile = open('./coast_shared_data/tide_data_as_json_' + mktime(fromDate.timetuple()) + '.json','w+')

    for entry in tide_entries:

        #print entry

        loc = locations.find_one({"_id": ObjectId(entry['location'])})
        #print loc

        o = {"t": mktime(entry['timestamp'].timetuple()),
             "lat": loc['latlng'][0],
             "lng": loc['latlng'][1],
             "h": entry['height']}

        #print o
        out.append(o)

    print(out)
    outputFile.write(json.dumps(out))
    outputFile.close()


def dataToInterpolatedFramesAsJson():

    frameResolutionInSeconds = 60*20

    fromDate = datetime.now() - timedelta(days=1)
    toDate = datetime.now() + timedelta(days=1)

    duration = toDate - fromDate;

    outputFile = open('./coast_shared_data/tide_data_interpolated_frames_as_json_{}.json'.format(mktime(fromDate.timetuple())),'w+')
    out = []

    total_frames = int(math.ceil(duration.total_seconds() / frameResolutionInSeconds))

    for frame in range(total_frames):
        frameTime = fromDate + timedelta(seconds=frame*frameResolutionInSeconds)

        frameObject = []
        print "Getting interpolated values for frame {} of {}, with timestamp {}".format(frame, total_frames, frameTime.isoformat())

        for loc in locations.find():
            height = getInterpolatedHeightForLocation(loc, frameTime)
            l = []

            if(height):
                l.append(loc['latlng'][0])
                l.append(loc['latlng'][1])
                l.append(height)

                frameObject.append(l)


        print "framesize {}".format(len(frameObject))

        out.append({mktime(frameTime.timetuple()): frameObject})

    outputFile.write(json.dumps(out))
    outputFile.close()

def pointValue(x,y,power,smoothing,xv,yv,values):
    nominator=0
    denominator=0
    for i in range(0,len(values)):
        dist = sqrt((x-xv[i])*(x-xv[i])+(y-yv[i])*(y-yv[i])+smoothing*smoothing);
        #If the point is really close to one of the data points, return the data point value to avoid singularities
        if(dist<0.0000000001):
            return values[i]
        nominator=nominator+(values[i]/pow(dist,power))
        denominator=denominator+(1/pow(dist,power))
    #Return NODATA if the denominator is zero
    if denominator > 0:
        value = nominator/denominator
    else:
        value = -9999
    return value


def invDist(xv,yv,values,xSize,ySize,power,smoothing):
    valuesGrid = np.zeros((xSize,ySize))

    # Getting the interpolated values with method pointValue
    for x in range(0,xSize):
        for y in range(0,ySize):
            valuesGrid[x][y] = pointValue(x,y,power,smoothing,xv,yv,values)

    return valuesGrid

def dataToInterpolatedGriddedFramesAsJson():



    return


if __name__ == "__main__":

    #dataToJson()

    dataToInterpolatedFramesAsJson()

    # get all timestamps for 4 day period






