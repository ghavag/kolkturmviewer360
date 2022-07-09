# Kolturm Viewer tools

## Object json generator

Objects in terms of things one can see on the picture are marked by rectangular areas. Those have a x and y coordinate as well as a height and width. With the help of the object json generator (aka `generateobjectjson.py) one can draw that so called object areas onto the image as rectangles using an vector image editor like Inkscape. Together with other object data provided as CSV input file the object json generator generates the json data that can be inserted into the json file used by the Kolturm Viewer as data source.

The object json generator is used like so:
```
$ ./generateobjectjson.py -h
usage: generateobjectjson.py [-h] csv file svg file

Generates object info json for the Kolkturm Viewer from CSV and SVG input data. The CSV data contains the information base for all objects. The coordinates and dimensions for the object areas is read from SVG
input.

positional arguments:
  csv file    CSV input file
  svg file    SVG input file

optional arguments:
  -h, --help  show this help message and exit
```

### CSV input file

The first row is the heading row. The columns provide the following data:

* Name of the object
* Additional name (optional)
* Address or GPS whatever coordinate
* Marker IDs (see below)
* Distance to the Kolkturm (line of sight)

The Marker IDs are one or more comma separated identifiers that must match the ID of a rectangle from the SVG input file (see below).

Example CSV file:
```
Name,Zusatz,Adresse/Koordinaten,Marker Ids,Entfernung zum Kolkturm (Luftlinie)
Halle Tower,,"Magdeburger Str. 23, 06112 Halle (Saale)",obj1,"5,2 Km"
Berliner Bruecke,,"Berliner Str. 15A, 06112 Halle (Saale)",obj2,"5,65 Km"
Wasserturm Nord,,"Am Wasserturm 5, 06114 Halle (Saale)",obj3,"5,04 Km"
Pauluskirche,,"Robert-Blum-Straße 11a, 06114 Halle (Saale)",obj5,"4,45 Km"
Studentenwohnheim,,"Wolfgang-Langenbeck-Straße 5, 06120 Halle (Saale)",obj6,"2,36 Km"
Studentenwohnheim,,"Wolfgang-Langenbeck-Straße 8, 06120 Halle (Saale)",obj7,"2,28 Km"
Studentenwohnheim,,"Kurt-Mothes-Straße 8, 06120 Halle (Saale)",obj4,"2,16 Km"
Studentenwohnheim,,"Kurt-Mothes-Straße 6, 06120 Halle (Saale)",obj8,"2,23 Km"
Martin-Luther-Universität,Institutsbereich Pharmazeutische Biologie und Pharmakologie ,"Hoher Weg 8, 06120 Halle (Saale)","obj13,obj14","1,82 Km"
Universitätsklinikum,"Haupteingang, Notaufnahme und Hubschrauberlandeplattform","Ernst-Grube-Straße 40, 06120 Halle (Saale)","obj9,obj12","1,72 Km"
```

### SVG input file

The image must be loaded into a vector image editor. When rectangles must be drawn around the objects. Some object might be visual divided. In that case multiple rectangles can be drawn. Each rectangular must have an ID assigned to it which matches up with a marker ID from the CSV input data (see above).

For example with Inkscape:
1. Directly open the image (choose `Link` as image import type)
2. Start drawing the rectangles (and assign the corresponding ID to each)
3. Save

Hint: For the DPI value 96 is assumed.
