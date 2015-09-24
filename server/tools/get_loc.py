#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#  2015 giulio <giulioungaretti@me.com>
"""
Request lat long from google.
"""
import pandas as pd
import requests
import json
import time
# import sys

file_path = "./allhead.csv"
# file_path = "./all.csv"
# wtf
# sys.argv[1]
# if file_path == "(../../coast_shared_data/headlands_lands_end_to_london_clockwise.csv":
#    print("type filename with cityies")

df = pd.DataFrame.from_csv(file_path)
# "./data/headlands_lands_end_to_london_clockwise.csv")


payload = {"address": "Scabbacombe Head", "components": "country:Uk",
           "key": "AIzaSyApa4ZMw-LY5s6i11DxBcivlJB1jzxVKJk"}
all = []
for i in df.index:
    try:
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        payload = {"address": i,
                   "key": "AIzaSyApa4ZMw-LY5s6i11DxBcivlJB1jzxVKJk"}
        time.sleep(0.1)
        r = requests.get(url, payload)
        v = r.json()
        status = v['status'] 
        if status == "ZERO_RESULTS":
            print(i)
            continue
        res = v['results'][0]
        latlong = res['geometry']['location']
        name = res['address_components'][0]['long_name']
        latlong["name"] = i
        if name != "United Kingdom":
            all.append(latlong)
    except Exception as e:
        print(v)
        print(e)
        print(i)

with open('{}_latlong.json'.format(file_path.replace(".csv", "")), 'w') as fp:
    json.dump(all, fp)
# vim: autoindent tabstop=4 shiftwidth=4 expandtab softtabstop=4
# vim: filetype=python foldmethod=indent
