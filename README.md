# coast15

##TODO
 - [ ] sketch frontend
 - [ ] figure out interpolate algo
 - [ ] figure out which kind of vis.
         - clusters over map (i.e. hexbins)
         - smooth overlay (f.ex. http://mourner.github.io/simpleheat/demo/ fast!)

##DATA
http://www.naturalearthdata.com/features/
Useful guide for creting the geojson files: http://bost.ocks.org/mike/map/
Data from https://www.tidetimes.org.uk/
##REFs.
Coming.
##Architecture
```
┌─────────────┐                                             
│   Backend   │                                             
├─────────────┴────────────────────────────────────────────┐
│             ┌──────────────────────────────┐             │
│             │           Scraper            │             │
│             └──────────────────────────────┘             │
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
