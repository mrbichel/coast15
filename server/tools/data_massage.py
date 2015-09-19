from bs4 import BeautifulSoup
import requests
import requests_cache
from datetime import datetime, timedelta
from urlparse import urlparse, parse_qs
from decimal import *
import pymongo
from pymongo import MongoClient, GEO2D
import json
from time import mktime
import re
import dateutil.parser
from bson.objectid import ObjectId

import geopy

from geopy.geocoders import Nominatim

requests_cache.install_cache('geocode_cache', backend='sqlite', expire_after=3600) # 2 hour
client = MongoClient('localhost', 27017)

db = client.uk_tide
locations = db.locations
tide_logs = db.tide_logs


def merge_tidetimes_locations():
    for loc in locations.find({u'port_id': None}):
        #print loc;
        locations.update_one({'_id': loc['_id']}, {"$set": {
                    "source": "tidetimes"}})
        #locs = locations.find({"name": loc["name"]})
        #if locs.count() > 1:
           # print locs[0]
            #print locs[1]

            #if locs[1]['_id'] is not loc['_id']:
            #
            #   locations.update_one({'_id': loc['_id']}, {"$set": {
            #        "country": locs[1]["country"],
            #        "port_id": locs[1]["port_id"],} })

            #   locations.remove({'_id': locs[1]['_id']})
    print locations.count()
    # [55.378051, -3.435973] mid england



def geocode(name, country):

    ret = {}
    found = False

    url = "https://maps.googleapis.com/maps/api/geocode/json"
    payload = {"address": name,
                   "components": "country:{}".format(country),
                   "key": "AIzaSyApa4ZMw-LY5s6i11DxBcivlJB1jzxVKJk"}

    res_json = requests.get(url, payload).json()
    print res_json

    if res_json['status'] == 'ZERO_RESULTS':
        print "{} not found using google".format(name)
        ret['geocode_flag'] = "not_found"
        ret['location_source'] = 'google'
        ret['latlng'] = None

    if len(res_json['results']) > 0:
        res = res_json['results'][0]

        try:
            if(res['partial_match'] == True):
                found = True
                print "{} partial_match found using google".format(name)
                ret['geocode_flag'] = "partial_match"

        except KeyError:
            found = True
            print "{} found using google".format(name)
            ret['geocode_flag'] = "found"

    if(found):
        ret['latlng'] = [res['geometry']['location']['lat'],res['geometry']['location']['lng']]
        ret['google_place_id'] = res['place_id']
        ret['location_type'] = res['geometry']['location_type']
        ret['location_source'] = 'google'

    return ret


def populate_location_data():
    locs = locations.find({u'latlng': None, 'location_source': {"$ne": "google"}})
    print locs.count()
    for loc in locs:
         ret_set = geocode(loc["name"], loc["country"])
         if(ret_set):
            locations.update_one({'_id': loc['_id']}, {"$set": ret_set})


def find_dupe_key(key):
    print "Finding dupes for: {}".format(key)
    locs = locations.find({key: {
                  "$exists": True },
                  #"country": ""
                  });

    ids = []
    dupe_list = []
    for loc in locs:
        dupes = locations.find({key: loc[key], "_id": {"$nin": ids}});

        if dupes.count() > 1:
            if loc[key] != None:
                ids.append(loc["_id"])
                dupe_list.append(loc)

    print "{} dupes found for key {}".format(len(dupe_list), key)
    return dupe_list


def create_geo_index():
    locations.create_index([("latlng", GEO2D)])

def remove_latlng_dupes():
    dupe_list = find_dupe_key("latlng")
    for dupe in dupe_list:
        print "{} {} {}".format(dupe["latlng"], dupe["name"], dupe["country"])

        ret_set = geocode(dupe["name"], dupe["country"])
        if(ret_set):
            locations.update_one({'_id': dupe['_id']}, {"$set": ret_set})

# some names from ukho are not compatible with geocoders, backup so we can change them
def move_ukho_info():
    locs = locations.find({})
    for loc in locs:
        locations.update_one({'_id': loc['_id']},
                             {"$set": {"ukho_name": loc['name'], "ukho_country": loc['country']} })


def search_replace_field(key, search_regex, replace):
    locations.update({key: {'$regex':search_regex} }, {"$set": {key: replace}}, multi=True)
    #locs = locations.find({})
    #for loc in locs:
    #    locations.update_one({'_id': loc['_id']},
    #                         {"$set": {"ukho_name": loc['name'], "ukho_country": loc['country']} })


def replace_country_names():

    replace = [
        ["^Peninsular Malaysia .* Coast"    , "Malaysia"],
        ["^India .* Coast"                  , "India"],
        ["^Philippine Islands"                , "Philippines"],
        ["^Australia .* Coast"             , "Australia"],
        ["^Korea .* Coast"                  , "Korea"],
        ["^Fiji Islands"                      , "Fiji"],
        ["^Japan .* Coast"                   , "Japan"],
        ["^Japan Nansei Shoto", "Japan"],
        ["^Thailand .* Coast"   , "Thailand"],
        ["^Canada, .*", "Canada"],
        ["^Sakhalin .* Coast", "Sakhalin"],
        ["^Jawa .* Coast", "Java"],
        ["^Sulawesi .* Coast", "Sulawesi"],
        ["^Sumatera .* Coast", "Sumatera"],
        ["^Greenland .* Coast", "Greenland"],
        ["^New Zealand .* Island", "New Zealand"],
    ]

    for s, r in replace:
        search_replace_field("country", s,r)

def fix_lat_lng_format():
    locs = locations.find({'latlng': {'$type': 3}})

    for loc in locs:
        locations.update_one({'_id': loc['_id']},
                 {"$set": { "latlng": [ loc['latlng']["lat"], loc['latlng']['lng'] ]   }})

        print loc['latlng']



def status_report():
    print "locations status"

    print "total: {}".format(
        locations.find({}).count())

    print "no latlng: {}".format(
        locations.find({'latlng': None}).count())

    print "partial match: {}".format(
        locations.find({'geocode_flag': 'partial_match'}).count())


if __name__ == "__main__":

    #fix_lat_lng_format()

    status_report()
    #replace_country_names()
    #print locations.distinct("country")

    #populate_location_data()
    #status_report()
    #geocode("Banate", "Philippines")
    #find_dupe_key("name")
    #find_dupe_key("port_id")
    populate_location_data()

    #find_dupe_key("latlng")

    locs = locations.find({u'latlng': None})
    for loc in locs:
        print "{}".format(loc["country"])





