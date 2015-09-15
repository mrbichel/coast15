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
from scipy.interpolate import griddata
from scipy.interpolate import interp1d
import matplotlib.pyplot as plt
from sklearn.gaussian_process import GaussianProcess
from PIL import Image
import pyproj
import math
import simplejson
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

        # use interp1d
        #interp1d(x, y, kind='cubic')

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
    outputFile = open('./coast_shared_data/original_{}.json'.format(mktime(fromDate.timetuple())),'w+')

    for entry in tide_entries:

        loc = locations.find_one({"_id": ObjectId(entry['location'])})

        o = {"t": mktime(entry['timestamp'].timetuple()),
             "lat": loc['latlng'][0],
             "lng": loc['latlng'][1],
             "h": entry['height']}

        out.append(o)

    print(out)
    outputFile.write(json.dumps(out))
    outputFile.close()


def dataToInterpolatedFramesAsJson():

    frameResolutionInSeconds = 60*20

    fromDate = datetime.now() - timedelta(days=1)
    toDate = datetime.now() + timedelta(days=1)

    duration = toDate - fromDate;

    outputFile = open('./coast_shared_data/time_interpolated_{}.json'.format(mktime(fromDate.timetuple())),'w+')
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


def dataToInterpolatedGriddedFramesAsJson():
    valMin = 0.0
    valMax = 1.0

    frameResolutionInSeconds = 60*30

    fromDate = datetime.now() - timedelta(hours=12)
    toDate = datetime.now() + timedelta(days=0)

    duration = toDate - fromDate;

    outputFile = open('./coast_shared_data/gridded_frames_{}.json'.format(mktime(fromDate.timetuple())),'w+')
    out = []

    total_frames = int(math.ceil(duration.total_seconds() / frameResolutionInSeconds))

    for frame in range(total_frames): #total_frames

        #frameTime = datetime.now()
        frameTime = fromDate + timedelta(seconds=frame*frameResolutionInSeconds)

        xv=[] # lng
        yv=[] # lat
        values=[]
        frameObject = []

        print "Getting interpolated values for frame {} of {}, with timestamp {}".format(frame, total_frames, frameTime.isoformat())

        for loc in locations.find():

            val = getInterpolatedHeightForLocation(loc, frameTime)
            if val:
                xv.append(loc['latlng'][1])
                yv.append(loc['latlng'][0])
                values.append(val)

        points = np.vstack((xv, yv)).T

        # hardcode theese to the bounds we want
        latMax = np.max(yv) +1
        latMin = np.min(yv) -1
        lngMax = np.max(xv) +1
        lngMin = np.min(xv) -1

        valMin = np.min(values)
        valMax = np.max(values)

        cellsize = 0.22 # 0.2 about 5850 values

        ncol = int(math.ceil(latMax-latMin)) / cellsize
        nrow = int(math.ceil(lngMax-lngMin)) / cellsize
        xres = (latMax - latMin) / float(ncol) #which should get back to original cell size
        yres = (lngMax - lngMin) / float(nrow)

        gridx, gridy = np.mgrid[lngMin:lngMax:ncol*1j, latMin:latMax:nrow*1j]

        grid_z0 = griddata(points, np.array(values), (gridx, gridy), method='nearest')

        grid_z1 = griddata(points, values, (gridx, gridy), fill_value="1", method='linear')
        #grid_z2 = griddata(points, values, (gridx, gridy), fill_value="1",method='cubic')

        # for item in grid_z0
            # add to json with lng and lat

        #frameObject.append(simplejson.dumps(grid_z0.tolist()))
        #print grid_z0;

        vals = grid_z0.ravel()
        x = gridx.ravel()
        y = gridy.ravel()


        for i in range(grid_z0.size):
            l = []
            l.append(y[i]) #lat
            l.append(x[i]) #lng
            l.append(vals[i])
            frameObject.append(l)

        print grid_z0.size
        print gridx.size, gridy.size

        out.append({mktime(frameTime.timetuple()): frameObject})

       #plt.subplot(222)
       #plt.imshow(grid_z0.T, extent=(lngMin,lngMax,latMin,latMax), origin='lower')
       #plt.scatter(xv,yv, c=values)
       #plt.colorbar()
       #plt.title('Nearest')
       #plt.subplot(223)
       #plt.imshow(grid_z1.T, extent=(lngMin,lngMax,latMin,latMax), origin='lower')
       #plt.scatter(xv,yv, c=values)
       #plt.colorbar()
       #plt.title('Linear')
       #plt.gcf().set_size_inches(6, 6)
       #plt.show()

    outputFile.write(json.dumps(out))
    outputFile.close()


if __name__ == "__main__":
    dataToJson()
    dataToInterpolatedGriddedFramesAsJson()
    dataToInterpolatedFramesAsJson()
    # get all timestamps for 4 day period






