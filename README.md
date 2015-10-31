
Installing client:
Run bower install.
Update reference to api.coast.johan.cc in main.js

Installing server:

to get dependency scipy running:
$ install libblas-dev liblapack-dev

$ apt-get install gfortran

The rest should install using the requirements.txt file.

Install mongodb
$ apt-get install mongodb

Configure db path 

Start of with the copy of my database.

Configuring nginx

```
server {
        listen 80;
        server_name coast.johan.cc;

        location / {
                index index.html;
                root /home/coast/srv/coast15/client;
        }
}

server {
    listen 80;
    server_name api.coast.johan.cc;

    location / {
       uwsgi_pass unix:///tmp/uwsgi_coast.sock;
       include uwsgi_params;
    }

}
``


Confuring uwsgi, coast.init

```
[uwsgi]
user = coast

uid = %(user)
pythonpath = /home/%(user)/srv/coast15/server
home = /home/%(user)/.virtualenvs/coast2015
module = app
socket = /tmp/uwsgi_%n.sock
chmod-socket = 666
plugins = http,python
touch-reload = /home/%(user)/srv/coast15/server/app.py
callable = app
```

Set up a cron script to execute ukho_scraper.py at least weekly.




