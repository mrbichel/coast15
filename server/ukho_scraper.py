#!/usr/bin/env python
# -*- coding: utf-8 -*-

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

requests_cache.install_cache('ukho_cache', backend='sqlite', expire_after=172800) # 2 day cache
client = MongoClient('localhost', 27017)

db = client.uk_tide
locations = db.locations
tide_logs = db.tide_logs

# port selection at
# http://www.ukho.gov.uk/EASYTIDE/EasyTide/SelectPort.aspx

BASE_URL = "http://www.ukho.gov.uk/EasyTide/EasyTide/"


def get_port(port_id, predict_days=7):
    port = {}
    port['port_id'] = port_id
    port["missing_data"] = False

    predict_url = "{}ShowPrediction.aspx?PortID={}&PredictionLength={}".format(BASE_URL, port_id, predict_days)

    print "Requesting: {} ...".format(predict_url)

    req  = requests.get(predict_url, verify=False)
    soup = BeautifulSoup(req.text, "html.parser")

    content =  soup.find('div', attrs={'class':'content'})
    h1 = soup.find('h1')

    if h1.text.strip() == "An error has occurred":
        print "No port found"
        return False

    # Port details/name
    el =  soup.find_all('span', {'class':'PortName'})
    port['name'] = el[0].get_text()

    el =  soup.find_all('span', {'class':'CountryPredSummary'})
    port['country'] = el[0].get_text()

    # example: "Port predictions (Standard Local Time) are equal to UTC"
    el =  soup.find('span', {'id':'PredictionSummary1_lblZoneTimeOffset'})

    print el.get_text()
    utc_offset_string = re.search(
         "(?<=^Port predictions \(Standard Local Time\) are ).*(?=( to| from) UTC)",
         el.get_text()).group(0)

    utc_offset_seconds= 0;
    if utc_offset_string != "equal":
        m = re.match(
                "(?P<hours>(\+|\-)\d{1,2}(?= hour))?(?P<minutes>\d{1,2}(?= min))?",
                utc_offset_string)

        hoursOff = int(m.group('hours') or 0)
        minutesOff = int(m.group('minutes') or 0)

        utc_offset_seconds = (abs(hoursOff)*60*60)+minutesOff

        if (hoursOff<0):
            utc_offset_seconds *= -1

    el = soup.find('span', {'id':'PredictionSummary1_lblPredictionStart'})
    start_date_string = re.search(
         "(?<=^Today - ).*(?=( \(Standard Local Time))",
         el.get_text()).group(0)

    # Wednesday 16th September 2015
    start_date = dateutil.parser.parse(start_date_string)

    # tide data
    all_logs=[]
    for table in soup.find_all('table', {'class':'HWLWTable'} ):
        rows = table.find_all('tr')
        th = rows[0].find('th', {'class':'HWLWTableHeaderCell'})
        day = dateutil.parser.parse(th.string)

        # increment year if month number is less than previous month
        if day.month < start_date.month:
            day.year += timedelta(year=1)

        logs = []
        for i, th in enumerate(rows[1].findAll('th', {'class':'HWLWTableHWLWCell'})):
            if th.string == 'LW':
                t='low'
            elif th.string == 'HW':
                t='high'
            logs.append({'type':t})

        for i, td in enumerate(rows[2].findAll('td', {'class':'HWLWTableCell'})):
            t = td.string.strip() # ' 20:40'
            if len(t) == 5:
                minutes = int(t[:-3]) * 60 + int(t[-2:])
                timestamp = day + timedelta(minutes=minutes)

                # Convert to UTC
                timestamp += timedelta(seconds=utc_offset_seconds)
                logs[i]['timestamp'] = timestamp
            else:
                logs[i]['timestamp'] = None
                port["missing_data"] = True
                print "unrecognized time string {}".format(t)

        for i, td in enumerate(rows[3].findAll('td', {'class':'HWLWTableCell'})):
            # height above chart datum in meters
            m = re.search(".*(?=(.m))", td.string)

            if m:
                logs[i]['height']=float(m.group(0))
            else:
                port["missing_data"] = True

            if re.match("m\*", td.string):
                logs[i]['approx']=True

        for log in logs:
            all_logs.append(log)

    # Exit and warn if nothing scraped.
    port['has_data'] = True
    if len (all_logs) == 0:
        print "No tide data for port"
        port['has_data'] = False
    else:
        port['logs'] = all_logs

    print "Port: {}, {}".format(port['name'], port['country'])

    return port


def update_tide_data():

    for location in locations.find({u'port_id': {"$exists": True}, u'coast_select': True}):
        fetch_data = get_port(location[u'port_id'])

        if fetch_data['has_data']:

            s = {}
            if fetch_data["missing_data"]:
                s["missing_data"] = True

            s["last_fetched"] = datetime.utcnow()

            locations.update_one(
                {"_id": location['_id']},
                {
                    "$set": s,
                    "$push": {
                        "logs": {"$each": fetch_data['logs']}
                        }
                }
            )

def scan_all_ports():
    ports = []
    for i in range(1,9999):
        # port_ids may have letters - we are missing those e.g. 0176A

        portID = "%04d" % (i,) # ids are zero padded 4 digits
        port = get_port(portID)

        if port is not False:

            # uncomment to add to db
            #location = locations.find_one({"name": port['name']})
            #print location;
            #locations.update_one({"port_id": port['port_id']}, {"$set": {"name": port['name'], "country": port['country' ]}}, True) #upsert

            del port['tides_array']
            ports.append(p)

    #f = open('./ukho_ports_{}.json'.format(mktime(datetime.now().timetuple())),'w+')
    #f.write(json.dumps(ports))
    #f.close()


if __name__ == "__main__":
    update_tide_data()

