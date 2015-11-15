Installation steps on clean ubuntu server: 

# base system

    $ ssh -i "CoastTania.pem" ubuntu@52.16.36.238

    $ sudo apt-get update
    $ sudo apt-get upgrade
    $ sudo apt-get install nginx uwsgi uwsgi-plugin-python mongodb git python-pip python-dev

# dependencies for scipy
    
    $ sudo apt-get install libblas-dev liblapack-dev gfortran

# python

    $ sudo pip install virtualenv
    $ sudo pip install virtualenvwrapper
    $ export WORKON_HOME=~/.virtualenvs

Add this line to the end of ~/.bashrc so that the virtualenvwrapper commands are loaded.

    . /usr/local/bin/virtualenvwrapper.sh

Reload .bashrc with the command . .bashrc 

Create a new virtualenv

    $ mkvirtualenv coast

# Setting up the project

    $ mkdir srv
    $ cd ~/srv/
    $ git clone https://github.com/mrbichel/coast15.git
    $ cd ~/srv/coast15/server
    $ workon coast
    $ pip install -r requirements.txt

# Setup and download the database

    $ sudo mkdir /data
    (From local system) $ scp [initial_coast_db.tar.gz] ubuntu@52.16.36.238:~/db.tar.gz
    $ tar -zxvf ~/db.tar.gz
    $ sudo mv ~/db /data/
    $ sudo chown -R mongodb:mongodb /data/db

Edit `/etc/mongodb/mongodb.conf` at top of file change dbpath to:

    dbpath=/data/db

    $ sudo service mongodb reload


# Configure nginx 
    
Add nginx configuration file `/etc/nginx/sites-available/coast.conf` remember to replace domain.

```
server {
        listen 80;
        server_name [DOMAIN];

        location / {
                index index.html;
                root /home/coast/srv/coast15/client;
        }
}

server {
    listen 80;
    server_name api.[DOMAIN];

    location / {
       uwsgi_pass unix:///tmp/uwsgi_coast.sock;
       include uwsgi_params;
    }

}
```
    $ sudo ln -s /etc/nginx/sites-available/coast.conf /etc/nginx/sites-enabled/
    $ sudo service nginx reload


# Configure uwsgi 
    
Add a uwsgi configuration file `/etc/uwsgi/app-available/coast.ini`
    
```
[uwsgi]
user = ubuntu
uid = %(user)
pythonpath = /home/%(user)/srv/coast15/server
home = /home/%(user)/.virtualenvs/coast
module = app
socket = /tmp/uwsgi_%n.sock
chmod-socket = 666
plugins = http,python
touch-reload = /home/%(user)/srv/coast15/server/app.py
callable = app
```

    $ sudo ln -s /etc/uwsgi/apps-available/coast.ini /etc/uwsgi/apps-enabled/
    $ sudo service uwsgi reload

# Add crontab
    
    $ crontab -e

    Add 
        `0 0 1-31/2 * * /home/ubuntu/.virtualenvs/coast/bin/python /home/ubuntu/srv/coast15/server/ukho_scraper.py > /home/ubuntu/log/ukho_scraper.log`


