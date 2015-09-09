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

from PIL import Image
import pyproj

client = MongoClient('localhost', 27017)

db = client.uk_tide
locations = db.locations
tide_logs = db.tide_logs

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

def invDist(xv,yv,values,xSize,ySize,power,smoothing):

    #pr = Proj("+proj=lcc +lat_1=64.25 +lat_2=65.75 +lat_0=65 +lon_0=-19 +x_0=1700000 +y_0=300000 +no_defs +a=6378137 +rf=298.257222101 +to_meter=1")

    # convert valuesGrid to projection
    # convert points

    #Creating the file
    #driver = gdal.GetDriverByName( driverName )
    #ds = driver.Create( "out.tiff", xSize, ySize, 1, gdal.GDT_Float32)

    #if proj is not None:
    #    ds.SetProjection(proj.ExportToWkt())

    #ds.SetGeoTransform(geotransform)
    valuesGrid = np.zeros((xSize,ySize))


    # http://spatialreference.org/ref/epsg/wgs-84/ - EPSG4326 - is basic lat lng
    EPSG4326 = pyproj.Proj("+init=EPSG:4326")
    #toP = pyproj.Proj("+init=SR-ORG:62")


    #http://www.remotesensing.org/geotiff/proj_list/albers_equal_area_conic.html

    toP = pyproj.Proj("+proj=aea +lat_1=50 +lat=60 +lat_0=0 +lon_0=55.4 +x_0=0 +y_0=0 +ellps=krass +units=m +no_defs")
    #osgb36=pyproj.Proj("+init=EPSG:27700") # UK Ordnance Survey, 1936 datum

    #toP = osgb36
    latMax = -900000
    latMin = 900000
    lngMax = -1800000
    lngMin = 1800000

    for i in range(0,len(xv)):
         xv[i], yv[i] = pyproj.transform(EPSG4326, toP, xv[i], yv[i])

         latMax = max(latMax, xv[i])
         latMin = min(latMin, xv[i])
         lngMax = max(lngMax, yv[i])
         lngMin = min(lngMin, yv[i])


    geotransform=[]
    geotransform.append(latMin)
    geotransform.append((latMax-latMin)/xSize)
    geotransform.append(0)
    geotransform.append(lngMax)
    geotransform.append(0)
    geotransform.append((lngMin-lngMax)/ySize)


    print latMax
    print latMin
    print lngMax
    print lngMin


    #Transform geographic coordinates to pixels
    for i in range(0,len(xv)):
         xv[i] = (xv[i]-geotransform[0])/geotransform[1]
         yv[i] = (yv[i]-geotransform[3])/geotransform[5]


    # Getting the interpolated values with method pointValue
    for x in range(0,xSize):
        for y in range(0,ySize):
            valuesGrid[x][y] = pointValue(x,y,power,smoothing,xv,yv,values)


    #ds.GetRasterBand(1).WriteArray(valuesGrid)
    #ds = None

    return valuesGrid

def getInterpolatedHeightForLocation(loc, d):

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

    loc["next"] = n
    loc["prev"] = b

    #print "NEXT:"
    #print n['timestamp']

    if n and b:
        totalTimeDelta = n['timestamp'] - b['timestamp']
        #print(totalTimeDelta.total_seconds())

        nTimeDelta = n['timestamp'] - d
        bTimeDelta = d - b['timestamp']

        #print(nTimeDelta)
        #print(bTimeDelta)
        nWeight = nTimeDelta.total_seconds() / totalTimeDelta.total_seconds()
        bWeight = bTimeDelta.total_seconds() / totalTimeDelta.total_seconds()

        #print("next: " + str(nWeight))
        #print("previus: "  + str(bWeight))
        interpolatedHeight = n['height'] * nWeight + b['height'] * bWeight

        return interpolatedHeight

    return None


def grid(d):
    locs = locations.find()

    valMin = -0.20
    valMax = 14.65
    #valMin = 0.0
    #valMax = 1.0
    power=2
    smoothing=2 #2

    xSize=116
    ySize=96 #reversed ??

    zField='Z'
    dataFile=None
    outFile=None
    proj=None

    data = {}
    xv=[]
    yv=[]
    values=[]

    clocations = []

    for loc in locs:
        val = getInterpolatedHeightForLocation(loc, d)

        if val:
            #print loc['latlng']
            xv.append(loc['latlng'][0])
            yv.append(loc['latlng'][1])
            #d = datetime.now()

            values.append(val)
            #valMin = min(valMin, val)
            #valMax = max(valMax, val)

            clocations.append(loc)

    data['xv']=xv
    data['yv']=yv
    data['values']=values
    data['proj'] = proj

    #print locations[0]
    #print "next height: " + str(clocations[0]['next']['height']) + " previus height: " + str(clocations[0]['prev']['height']) + " now: " + str(values[0]);


    ZI = invDist(data['xv'], data['yv'], data['values'], xSize, ySize, power, smoothing)
    #print ZI

    img = Image.new( 'RGB', (xSize,ySize), "black")
    pixels = img.load()

    for i in range(xSize):    # for every pixel:
        for j in range(ySize):
            v = int( translate(ZI[i][j], valMin, valMax, 0, 255)  )
            pixels[i,j] = (v, v, v) # set the colour accordingly

    #img.show()
    #
    img = img.transpose(Image.FLIP_LEFT_RIGHT)
    img = img.rotate(-90)

    img = img.resize((ySize*10, xSize*10), Image.ANTIALIAS)

    img.save(d.strftime("%Y%m%d_%H_%M_%S")+".png", "PNG")



if __name__ == "__main__":

    d = datetime.now() - timedelta(days=1)

    for i in range(0,480): #48
        d += timedelta(minutes=3)
        print(d.strftime("%Y%m%d_%H_%M_%S"))
        grid(d)



