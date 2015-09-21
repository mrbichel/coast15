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
from matplotlib import colors, ticker, cm
from scipy.interpolate import Rbf
from scipy.interpolate import griddata

app = Flask(__name__)
#app = create_app(config="config.yaml")

cors = CORS(app, resources={r"/*": {"origins": "*"}})

app.debug = True

client = MongoClient('localhost', 27017)
db = client.uk_tide
locations = db.locations


@app.route("/")
def hello():
    return "Coast API"


def get_coast15_match(fromDate, toDate, bounds=[[48, -26], [64, 10]]): # add bounds here
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

def get_coast15_locations(fromDate, toDate):

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


# Get Locations selected for coast15 # from date to date - optional get arguments all
@app.route("/cloc")
def coast_location():

    fromDate = datetime.utcnow() - timedelta(days=1)
    toDate = datetime.utcnow() + timedelta(days=1)
    locs = get_coast15_locations(fromDate, toDate)

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



# linear or nearest
def get_grid_frames(fromDate, toDate, resolution=60*15, method='linear'):

    # increase range so we clip of then en points as they do not have nice
    # cubic interpolation curves
    fr = fromDate-timedelta(days=1)
    to = toDate+timedelta(days=1)
    locs = list(get_coast15_locations(fr,to))

    newLocs = []

    # todo - db call shuld only return distinct latlng's
    for loc in locs:
        u = True
        for d in locs:
            if d['_id'] != loc['_id']:
                if d['latlng'] == loc['latlng']:
                    u = False

        if u:
            newLocs.append(loc)

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

    for loc in newLocs:

        logs = sorted(loc['logs'],key=lambda d: d['timestamp'])

        time_list = []
        height_list = []
        for l in logs:
            time_list.append(mktime(l['timestamp'].timetuple()))
            height_list.append(l['height'])

        time_list = np.array(time_list)
        height_list = np.array(height_list)

        if len(time_list) > 4 and len(height_list) > 4:
            #f =  interp1d(time_list, height_list)
            f = interp1d(time_list, height_list, kind='cubic')

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

    for frame in frames:

        frame['points'] = np.vstack((frame['lng'], frame['lat'])).T
        frame['values'] = np.array(frame['v'])

        latMax = np.max(frame['lat']) +1
        latMin = np.min(frame['lat']) -1
        lngMax = np.max(frame['lng']) +1
        lngMin = np.min(frame['lng']) -1

        valMin = np.min(frame['values'])
        valMax = np.max(frame['values'])

        cellsize = 0.25 # 0.2 about 5850 values -# this should be a parameter

        ncol = int(math.ceil(latMax-latMin)) / cellsize
        nrow = int(math.ceil(lngMax-lngMin)) / cellsize
        xres = (latMax - latMin) / float(ncol) #which should get back to original cell size
        yres = (lngMax - lngMin) / float(nrow)

        frame['gridx'], frame['gridy'] = np.mgrid[lngMin:lngMax:ncol*1j, latMin:latMax:nrow*1j]

        #grid_z0 = griddata(points, values, (gridx, gridy), method='nearest')

        # griddata function is much faster
        #frame['gridz'] = griddata(frame['points'], frame['values'], (frame['gridx'], frame['gridy']), method=method) #,fill_value=1)
        #Creating the interpolation function and populating the output matrix value

        rbf = Rbf(frame['lng'], frame['lat'], frame['values'], function=method, smooth=2)
        frame['gridz'] = rbf(frame['gridx'], frame['gridy'])

        frame['ncol'] = ncol
        frame['nrow'] = nrow

    return frames


@app.route("/grid") #fromDate, toDate, resolution, linear / nearest
def coast_grid(resolution=60*15): # resolution in seconds

    # todo: snap from time to even multiple of resolution so we can use cached frames
    fromDate = datetime.utcnow() - timedelta(days=0.2)
    toDate = datetime.utcnow() + timedelta(days=0.2)

    frames = get_grid_frames(fromDate, toDate, resolution)

    o = []
    for frame in frames:

        f_ret = []
        vals = frame['gridz'].ravel()
        x = frame['gridx'].ravel()
        y = frame['gridy'].ravel()

        for idx in range(0,len(vals)):
            if not math.isnan(vals[idx]):
                f_ret.append([
                        x[idx],
                        y[idx],
                        vals[idx]
                    ])

        # todo: cache individual grids by timestamp key
        # expire on frame['t'] - half duration of frontend viz
        o.append([ frame['t'], frame['gridz'] ])

    # todo: cache the complete response for resolution
    return Response(
        json_util.dumps(o),
        mimetype='application/json'
    )

#def get_coast15_logs():



def plot_grid():

    fromDate = datetime.utcnow() - timedelta(days=0.2)
    toDate = datetime.utcnow() + timedelta(days=0.2)

    frames = get_grid_frames(fromDate, toDate)

    frame = frames[0]

    latMax = np.max(frame['lat']) +2
    latMin = np.min(frame['lat']) -2
    lngMax = np.max(frame['lng']) +2
    lngMin = np.min(frame['lng']) -2

    gX, gY, gZ = frame['gridx'].T, frame['gridy'].T, frame['gridz'].T

    X, Y, Z = frame['lng'], frame['lat'], frame['values']

    plt.subplot(411)
    plt.scatter(frame['lng'],frame['lat'], c=frame['values'])  ##ocean
    plt.colorbar()

    plt.subplot(412)
    plt.imshow(frame['gridz'].T, extent=(lngMin,lngMax,latMin,latMax), origin='lower', cmap=cm.ocean)
    plt.colorbar()

    plt.subplot(413)
    plt.pcolor(gX, gY, gZ, cmap=cm.GnBu)
    plt.title('RBF interpolation')
    plt.colorbar()

    plt.subplot(414)
    plt.contourf(frame['gridx'].T, frame['gridy'].T, gZ, cmap=cm.GnBu)
    plt.colorbar()
    plt.title('Grid')

    plt.gcf().set_size_inches(6, 6)
    plt.show()



if __name__ == "__main__":
    app.run(use_debugger=app.debug)
    #coast_grid()
    #plot_grid()

