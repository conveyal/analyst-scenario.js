# analyst-scenario.js: Object-oriented Javascript library to create scenarios for Analyst Server

## General usage

You can define scenarios as Javascript files relatively easily (a scenario is just an array of modifications).
Modifications are created in a declarative style: you instantiate the class and then call functions on it to set
various parameters, à la d3. For example, to create a new transit line, you might run:

    var period = new TimePeriod()
      .speed(17) // speed of the vehicle during this time period
      .dwell(15) // seconds
      .headway(10 * 60) // seconds
      .startTime(5 * 3600) // seconds since GTFS midnight
      .endTime(23 * 3600) // again, seconds since GTFS midnight
      .monday(true) // or .weekday(true), .weekend(true)
      .tuesday(true)
      .wednesday(true)
      .thursday(true)
      .friday(true)
      .saturday(true)
      .sunday(true)

    var myLine = new TransitLine()
      .geometry(geojsonGeom) // The geometry of the line
      .stopSpacing(400) // meters
      .addTimePeriod(period)
      .make() // yields JSON representation of modification. The result is completely decoupled from the TransitLine object,
      // you can now make modifications to the object and regenerate (e.g. to run the other way)
