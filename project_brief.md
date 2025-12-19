# D3 Animated Map Reference

## Project Brief

*Generated 12/19/2025*

---

### Problem Statement

Cartographers have a difficult time creating D3 maps featuring project correct animations. It seems you can somewhat easily create a D3 map that does one or the other but not both. Because of the ad hoc nature of requests for animated maps featuring proper projection, Cartographers often retread the same problems, running into the same roadblocks that often result in avoiding the creation of animated maps featuring proper projection.

### Target Users

Cartographers new to code, and developers new to cartography.

### Success Criteria

Reduced production time that results in a reduction of products being killed because of the uncertainty of creating maps with proper projection and are animated.

### Constraints & Requirements

- Use D3
- Use Angular
- Frames per second (fps) greater than 23fps
- Support use of GEOJSON
- Support use of vector tiles
- Support use of raster tiles

### Risks & Unknowns

- It's unclear if vector tiles can be projected on the fly using D3
- It's unclear if raster tiles can be used in D3

### Minimum Viable Product

An animated map that maintains one projection while animating to different geographical extents with a fps greater than 23fps. Data for map is in Geojson format.

### Technology Stack

- D3
- Angular
- colorjs

