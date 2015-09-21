
import db
import data_utils

# get location
# return pyplot image curve of single location

# grid
# rbf, contours, methods



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