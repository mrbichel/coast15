from fabric.api import env, run, prefix, cd, sudo, local, get, put

env.user = 'coast' # host needs to be configured from sudo user
env.hosts = ['tango.johan.cc']
env.directory = '/home/coast/srv/coast15'
env.activate = 'source /home/coast/.virtualenvs/coast2015/bin/activate'


# with -u coast -

#def configure_host():
    # copy nginx.conf to server
    # add to /etc/nginx/sites-available

    # add reload uwsgi

def build_client():
    with cd('./client'):
        local('bower install')

def deploy_client():
    put('./client', env.directory)

def deploy_server():
    with cd(env.directory):
        with prefix(env.activate):
            run('git pull')
            # put all the server files
            #put('./server', env.directory)
            run('pip install -r requirements.txt')
            run('touch server/app.py') # this triggers a gracefull reload

def deploy():
    deploy_client()
    deploy_server()


#def dump_prod_data():
#    with cd(env.directory):
#        with prefix(env.activate):
#            run('python manage.py dumpdata articles files taggit  --indent 4 --natural > datadump.json')
#
#            get('datadump.json', 'datadump.json')
