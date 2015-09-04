from flask import Flask, jsonify, Response
import requests
from datetime import datetime
from urlparse import urlparse, parse_qs
from decimal import *
from bson import json_util
from bson.objectid import ObjectId
import json
from flask.ext.cors import CORS
import pymongo
from pymongo import MongoClient, GEO2D

from math import pow  
from math import sqrt  
import numpy as np
import matplotlib.pyplot as plt

from PIL import Image


def translate(value, leftMin, leftMax, rightMin, rightMax):
    # Figure out how 'wide' each range is
    leftSpan = leftMax - leftMin
    rightSpan = rightMax - rightMin

    # Convert the left range into a 0-1 range (float)
    valueScaled = float(value - leftMin) / float(leftSpan)

    # Convert the 0-1 range into a value in the right range.
    return rightMin + (valueScaled * rightSpan)

# http://geoexamples.blogspot.dk/2012/05/creating-grid-from-scattered-data-using.html

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

def invDist(xv,yv,values,geotransform,proj,xSize,ySize,power,smoothing):  
    #Transform geographic coordinates to pixels  
    for i in range(0,len(xv)):  
         xv[i] = (xv[i]-geotransform[0])/geotransform[1]  
    for i in range(0,len(yv)):  
         yv[i] = (yv[i]-geotransform[3])/geotransform[5]



    #Creating the file  
    #driver = gdal.GetDriverByName( driverName )  
    ##ds = driver.Create( outFile, xSize, ySize, 1, gdal.GDT_Float32)  
    ##if proj is not None:  
    #ds.SetProjection(proj.ExportToWkt())  
    ##ds.SetGeoTransform(geotransform)  
    
    valuesGrid = np.zeros((ySize,xSize))  
    
    #Getting the interpolated values  
    for x in range(0,xSize):  
        for y in range(0,ySize):  
            valuesGrid[y][x] = pointValue(x,y,power,smoothing,xv,yv,values)  
      
    #ds.GetRasterBand(1).WriteArray(valuesGrid)  
    #ds = None  
    return valuesGrid  



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

def getInterpolatedHeightForLocation(loc):

    d = datetime.now()
    # get interpolated tide level for current time for location
    #print(loc);

    # get closest measure later than time
    n = tide_logs.find_one({
        "location": ObjectId(loc['_id']),
        "timestamp": {"$gte": d}
        }, sort=[("timestamp", pymongo.ASCENDING)])

    b = tide_logs.find_one({
        "location": ObjectId(loc['_id']),
        "timestamp": {"$lte": d}
        }, sort=[("timestamp", pymongo.DESCENDING)])

##### ------- before ------- (lower than now - DESCENDING) now (greater than now ASCENDING ) ------- next ------
    interpolatedHeight = 0

    if n and b:
        totalTimeDelta = n['timestamp'] - b['timestamp']
        #print(totalTimeDelta.total_seconds())

        nTimeDelta = n['timestamp'] - d
        bTimeDelta = d - b['timestamp']

        nWeight = nTimeDelta.total_seconds()/totalTimeDelta.total_seconds()
        bWeight = bTimeDelta.total_seconds()/totalTimeDelta.total_seconds()

        interpolatedHeight = n['height'] * nWeight + b['height'] * bWeight
    
    return interpolatedHeight


@app.route("/grid")
def grid(): 

    power=2  
    smoothing=0  
      
    zField='Z'  
    dataFile=None  
    outFile=None  
    driverName='GTiff'  
    proj=None  
  
    geotransform = None  
    latMax = -90
    latMin = 90
    lngMax = -180
    lngMin = 180

    valMin = 100
    valMax = -100

    xSize=500  
    ySize=500  

    locs = locations.find()

    data = {}  
    xv=[]  
    yv=[]  
    values=[]

    for loc in locs:
        

        latMax = max(latMax, loc['latlng'][0]) 
        latMin = min(latMin, loc['latlng'][0]) 
        lngMax = max(lngMax, loc['latlng'][1]) 
        lngMin = min(lngMin, loc['latlng'][1])

        #print loc['latlng']

        xv.append(loc['latlng'][0]) 
        yv.append(loc['latlng'][1]) 
        val = getInterpolatedHeightForLocation(loc)
        values.append(val)
        valMin = min(valMin, val)
        valMax = max(valMax, val)
    
    #print latMax
    #print latMin
    #print lngMax
    #print lngMin

    data['xv']=xv  
    data['yv']=yv  
    data['values']=values  
    data['proj'] = proj  
    ds = None  

    geotransform=[]  
    geotransform.append(latMin)  
    geotransform.append((latMax-latMin)/xSize)  
    geotransform.append(0)  
    geotransform.append(lngMax)  
    geotransform.append(0)  
    geotransform.append((lngMin-lngMax)/ySize)

    #proj = osr.SpatialReference() # match the projection we use with d3.js in the front end 

    ZI = invDist(data['xv'],data['yv'],data['values'],geotransform,None,xSize,ySize,power,smoothing)

    print ZI

    img = Image.new( 'RGB', (xSize,ySize), "black") 
    pixels = img.load()

    for i in range(img.size[0]):    # for every pixel:
        for j in range(img.size[1]):
            v = int( translate(ZI[i][j], valMin, valMax, 0, 255)  )
            pixels[i,j] = (v, v, v) # set the colour accordingly

    img.show()

    #ret = []
    #ret.append(json.dumps(ZI))
    return "done"

@app.route("/loc")
def location():
    #return "Hello World!"
    locs = locations.find()
    json_locs = []

    d = datetime.now()

    for loc in locs:

        # get interpolated tide level for current time
        #print(loc);

        # get closest measure later than time
        n = tide_logs.find_one({
            "location": ObjectId(loc['_id']),
            "timestamp": {"$gte": d}
            }, sort=[("timestamp", pymongo.ASCENDING)])

        b = tide_logs.find_one({
            "location": ObjectId(loc['_id']),
            "timestamp": {"$lte": d}
            }, sort=[("timestamp", pymongo.DESCENDING)])

##### ------- before ------- (lower than now - DESCENDING) now (greater than now ASCENDING ) ------- next ------
        interpolatedHeight = 0
        loc['height'] = 0

        if n and b:
            totalTimeDelta = n['timestamp'] - b['timestamp']
            #print(totalTimeDelta.total_seconds())

            nTimeDelta = n['timestamp'] - d
            bTimeDelta = d - b['timestamp']

            nWeight = nTimeDelta.total_seconds()/totalTimeDelta.total_seconds()
            bWeight = bTimeDelta.total_seconds()/totalTimeDelta.total_seconds()

            interpolatedHeight = n['height'] * nWeight + b['height'] * bWeight
            loc['height'] = interpolatedHeight

            loc['next'] = n
            loc['prev'] = b

            #print(n['height'])
            #print(b['height'])
            #print(interpolatedHeight)

        # use .next to get next one

        #print(tide_logs.find_one({
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



