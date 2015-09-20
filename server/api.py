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
from scipy.interpolate import interp1d
import math
import numpy as np
import matplotlib.pyplot as plt
from scipy.interpolate import griddata


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
    return "Coast API"


def get_coast15_match(fromDate, toDate, bounds=[[48, -46], [63, 5]]): # add bounds here
    coast15_match = {
          "latlng": {
                  #"$exists": True,
                  "$within": { "$box":  bounds } # world: [[0,0],[190,190]]
              },
          "logs": {
              "$elemMatch": { "timestamp": { "$gte": fromDate, "$lt": toDate } }
              },
          "source": {"$ne": 'tidetimes'},
          "missing_data":  {"$ne": True},
      }

    return coast15_match

def get_coast15_locations():

    fromDate = datetime.utcnow() - timedelta(days=4)
    toDate = datetime.utcnow() + timedelta(days=7)

    # todo match log count greater than ?

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

    fromDate = datetime.utcnow() - timedelta(days=1)
    toDate = datetime.utcnow() + timedelta(days=1)

    locs = get_coast15_locations()

    o = []
    for l in locs:
        logs = []
        for log in l['logs']:
            logs.append([
                mktime(log['timestamp'].timetuple())*1000, # javascript time
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


#def find_lt(a, x):
#    'Find rightmost value less than x'
#    i = bisect_left(a, x)
#    if i:
#        return a[i-1]
#    raise ValueError
#
#def find_le(a, x):
#    'Find rightmost value less than or equal to x'
#    i = bisect_right(a, x)
#    if i:
#        return a[i-1]
#    raise ValueError

#http://docs.scipy.org/doc/scipy-0.14.0/reference/tutorial/interpolate.html

# optimize by not sending lat and lng for every frame, ensure order and existense to match on indexes - maybe just insert empty list elements for bad data

@app.route("/grid") #fromDate, toDate, resolution, linear / nearest
def coast_grid(resolution=60*15): # resolution in seconds

    fromDate = datetime.utcnow() - timedelta(days=0.2)
    toDate = datetime.utcnow() + timedelta(days=0.2)

    # TODO: get more values than just from to date to improve the interp1d function
    locs = list(get_coast15_locations())

    duration = toDate - fromDate;

    total_frames = int(math.ceil(duration.total_seconds() / resolution))

    frame_times = []
    frames = []
    for frame in range(total_frames): #1
        # for all locations get interpolated time for current moment
        frameTime = fromDate + timedelta(seconds=frame*resolution)

        frames.append({
            "t": mktime(frameTime.timetuple()),
            "v": [],
            "lat": [],
            "lng": []
            })

        values = []
        times = []

    for loc in locs:
        #print loc
        logs = sorted(loc['logs'],key=lambda d: d['timestamp']) # todo: this sorting does not work, lets sort already from db

        time_list = []
        height_list = []
        for l in logs:
            time_list.append(mktime(l['timestamp'].timetuple()))
            height_list.append(l['height'])

        time_list = np.array(time_list)
        height_list = np.array(height_list)

        if len(time_list) > 4 and len(height_list) > 4:

            f =  interp1d(time_list, height_list)
            #f2 = interp1d(time_list, height_list, kind='cubic')

            # plot for 1 location
            # xnew = np.linspace(time_list[1], time_list[-2], 800)
            # plt.plot(time_list,height_list,'o',xnew,f(xnew),'-', xnew, f2(xnew),'--')
            # plt.legend(['data', 'linear', 'cubic'], loc='best')
            # plt.show()

            for frame in frames:
                try:
                    v = float(f(frame['t']))
                    frame['v'].append( v )
                    frame['lat'].append( loc['latlng'][0] )
                    frame['lng'].append( loc['latlng'][1] )
                except ValueError:
                    print "outside of range"

    o = []

    for frame in frames:

        points = np.vstack((frame['lng'], frame['lat'])).T
        values = np.array(frame['v'])

        latMax = np.max(frame['lat']) +1
        latMin = np.min(frame['lat']) -1
        lngMax = np.max(frame['lng']) +1
        lngMin = np.min(frame['lng']) -1

        valMin = np.min(values)
        valMax = np.max(values)

        cellsize = 0.5 # 0.2 about 5850 values

        ncol = int(math.ceil(latMax-latMin)) / cellsize
        nrow = int(math.ceil(lngMax-lngMin)) / cellsize
        xres = (latMax - latMin) / float(ncol) #which should get back to original cell size
        yres = (lngMax - lngMin) / float(nrow)

        gridx, gridy = np.mgrid[lngMin:lngMax:ncol*1j, latMin:latMax:nrow*1j]
        grid_z0 = griddata(points, values, (gridx, gridy), method='nearest')
        grid_z1 = griddata(points, values, (gridx, gridy), method='linear')

        #plt.subplot(211)
        #plt.imshow(grid_z0.T, extent=(lngMin,lngMax,latMin,latMax), origin='lower')
        #plt.scatter(frame['lng'],frame['lat'], c=values)
        #plt.colorbar()
        #plt.title('Nearest')
        #plt.subplot(212)
        #plt.imshow(grid_z1.T, extent=(lngMin,lngMax,latMin,latMax), origin='lower')
        #plt.scatter(frame['lng'],frame['lat'], c=values)
        #plt.colorbar()
        #plt.title('Linear')
        #plt.gcf().set_size_inches(6, 6)
        #plt.show()

        f_ret = []
        vals = grid_z1.ravel()
        x = gridx.ravel()
        y = gridy.ravel()

        for idx in range(0,len(vals)):
            if not math.isnan(vals[idx]):
                f_ret.append([
                        x[idx],
                        y[idx],
                        vals[idx]
                    ])

        o.append([frame['t'], f_ret])

    return Response(
        json_util.dumps({
            'frames' : o}),
        mimetype='application/json'
    )

#def get_coast15_logs():


if __name__ == "__main__":
    app.run(use_debugger=app.debug)
    #coast_grid()


