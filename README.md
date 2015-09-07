# coast15

##TODO

 - [ ] mongo installation bash script
 - [ ] sketch frontend
 - [ ] figure out interpolate algo.
         - use RBF
         
             ```python
                import numpy as np
                import scipy.interpolate as interpolate
                M  = [2x2]
                M.shape == (r.size, c.size)),
                rr, cc = np.meshgrid(r, c)
                vals = ~np.isnan(M)
                f = interpolate.Rbf(rr[vals], cc[vals], M[vals], function='linear')
                interpolated = f(rr, cc)
             ```
             
             and play with the possilbe funcitons (and their parameter.)
           - use gaussian processes

             ```python
                from sklearn.gaussian_process import GaussianProcess
                gp = GaussianProcess(theta0=0.1, thetaL=.001, thetaU=1., nugget=0.01)
                gp.fit(X=np.column_stack([rr[vals],cc[vals]]), y=M[vals])
                rr_cc_as_cols = np.column_stack([rr.flatten(), cc.flatten()])
                interpolated = gp.predict(rr_cc_as_cols).reshape(M.shape)
             ```
             in this case there are oh so much parameters to try out.

 - [ ] figure out which kind of vis.
 
         - clusters over map (i.e. hexbins) see fe.x https://www.mapbox.com/blog/heatmaps-and-grids-with-turf/
         
         - smooth overlay (f.ex. http://mourner.github.io/simpleheat/demo/ fast!)
         
         - https://github.com/tmcw/chroniton for time slider 

##DATA

http://www.naturalearthdata.com/features/
Useful guide for creting the geojson files: http://bost.ocks.org/mike/map/
Data from https://www.tidetimes.org.uk/

##Architecture
```
┌─────────────┐                                             
│   Backend   │                                             
├─────────────┴────────────────────────────────────────────┐
│             ┌──────────────────────────────┐             │
│             │           Scraper            │             │
│             └──────────────────────────────┘             │
│                             │                            │
│                             ▼                            │
│              ┌─────────────────────────────┐             │
│              │          database           │             │
│              └─────────────────────────────┘             │
│                             │                            │
│                             │                            │
│                             ▼                            │
│             ┌──────────────────────────────┐             │
│             │       interpolate/grid       │             │
│             └──────────────────────────────┘             │
│                             │                            │
│                             ▼                            │
│              ┌─────────────────────────────┐             │
│              │          database           │             │
│              └─────────────────────────────┘             │
│                             ▲                            │
│                             │                            │
│                             │                            │
│              ┌────────────────────────────┐              │
│              │          REST_API          │              │
│              │                            │              │
│              └──────────────┬─────────────┘              │
└─────────────────────────────┼────────────────────────────┘
                              │                             
                              │                             
                              ▼                             

```
