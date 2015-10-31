Installation log; 

# base system

$ ssh -i "CoastTania.pem" ubuntu@52.16.36.238
$ sudo apt-get update
$ sudo apt-get upgrade
$ sudo apt-get install nginx uwsgi mongodb git python-pip

# python

$ sudo pip install virtualenv
$ sudo pip install virtualenvwrapper
$ export WORKON_HOME=~/.virtualenvs

Add this line to the end of ~/.bashrc so that the virtualenvwrapper commands are loaded.

. /usr/local/bin/virtualenvwrapper.sh

Reload .bashrc with the command . .bashrc 

Create a new virtualenv

$ mkvirtualenv coast
$ workon coast 

# Getting the project

$ mkdir srv
$ cd ~/srv/
$ git clone https://github.com/mrbichel/coast15.git


