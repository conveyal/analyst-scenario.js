import dbg from 'debug'
import distance from 'turf-distance'
import point from 'turf-point'
import polyline from 'polyline'

/** Represents a brand-new trip pattern */
export class TripPattern {
  constructor () {
    /** geometry, WGS84 GeoJSON */
    this._geometry = null;

    /** stop spacing in meters */
    this._spacing = null;

    /** One FrequencyEntry will be generated from each time period */
    this._windows = []

    /** Name of this trip pattern */
    this._name = "New trip pattern"
    
        
    /** is this reversed? */
    this._reversed = false;
  }
  
  /** reverse this trip pattern, keeping stops in the same locations etc. */
  reverse () {
    this._reversed = !this._reversed
    return this
  }
  
  name (name) {
    if (name !== undefined) {
      this._name = name;
      return this
    }
    
    return name
  }
  
  geometry (geometry) {
    if (geometry !== undefined) {
      this._geometry = geometry;
      return this;
    }
    
    return this._geometry
  }
  
  spacing (spacing) {
    if (spacing !== undefined) {
      this._spacing = spacing
      return this;
    }
    
    return this._spacing;
  }
    
  addTimeWindow (timeWindow) {
    this._windows.push(timeWindow)
    return this
  }

  /** Turn this transit line into an OTP AddTransitLine modification */
  make () {
    // figure out where the stops are
    let accumulator = 0;
    let nextStop = this._spacing / 1000 // convert m to km
    let stopIndices = [true] // array of t, f representing coord indices that are stop indices. first coord is always a stop
    let nStops = 2 // include first and last stops explicitly
    let hops = []
    
    // avoid concurrent modification, be non-destructive (TripPattern objects can be re used, for example to create two directions,
    // or local and rapid service)
    let newGeometry = {
      type: 'LineString',
      coordinates: []
    }
    
    newGeometry.coordinates.push(this._geometry.coordinates[0])
    
    for (let i = 1; i < this._geometry.coordinates.length; i++) {
      let segLen = distance(point(this._geometry.coordinates[i - 1]), point(this._geometry.coordinates[i]), 'kilometers')
      
      accumulator += segLen;
      
      while (accumulator > nextStop) {
        // insert a coord for the stop
        let frac = (segLen - (accumulator - nextStop)) / segLen
        let x1 = this._geometry.coordinates[i - 1][0], x2 = this._geometry.coordinates[i][0],
            y1 = this._geometry.coordinates[i - 1][1], y2 = this._geometry.coordinates[i][1];
        let interpolatedCoord = [x1 + (x2 - x1) * frac, y1 + (y2 - y1) * frac]
        
        nStops++;
        
        newGeometry.coordinates.push(interpolatedCoord)
        stopIndices.push(true)
        
        hops.push(this._spacing)
        
        nextStop = nextStop + this._spacing / 1000
      }
      
      newGeometry.coordinates.push(this._geometry.coordinates[i])
      
      // last coord is always a stop
      stopIndices.push(i == this._geometry.coordinates.length - 1)
    }
    
    // nextStop and the accumulator are in km, convert back to m to figure how far we've advanced since the last stop we inserted
    hops.push((accumulator - (nextStop - this._spacing / 1000)) * 1000)
    
    if (this._reversed) {
      hops.reverse()
      newGeometry.coordinates.reverse()
      stopIndices.reverse()
    }
    
    // create timetables
    let timetables = [];
    
    for (let i = 0; i < this._windows.length; i++) {
      let period = this._windows[i];
      
      let timetable = {
        startTime: period.startTime(),
        endTime: period.endTime(),
        headwaySecs: period.headway(),
        frequency: true,
        dwellTimes: new Array(nStops).fill(period.dwell()),
        // convert to kilometers, divide by km/h to get hours, convert to seconds
        hopTimes: hops.map(v => (v / 1000) / period.speed() * 3600),
        days: [period.monday(), period.tuesday(), period.wednesday(), period.thursday(), period.friday(), period.saturday(), period.sunday()]
      }
      
      console.log(period.dwell())
      
      timetables.push(timetable)
    }
    
    // make the JSON object
    return {
      type: 'add-trip-pattern',
      name: this._name,
      stops: stopIndices,
      timetables: timetables,
      // use the geometry with points added for interpolated stops
      geometry: polyline.encode(newGeometry.coordinates.map(c => [c[1], c[0]]))
    }
  } 
}

/** Defines what a transit line does during a particular time window */
export class TimeWindow {
  
  constructor () {
    // days of service
    this._mon = this._tue = this._wed = this._thurs = this._fri = this._sat = this._sun = true
    
    /** When this frequency entry is active, seconds since GTFS midnight */
    this._start = 0
    this._end = 24 * 3600 - 1

    /** time between trips, seconds */
    this._headway = 10 * 60;

    /** dwell time at stops, seconds */
    this._dwell = 0

    /** speed (kilometers/hour) */
    this._speed = 15
  }

  speed (speed) {
    if (speed !== undefined) {
      this._speed = speed
      return this
    }

    return this._speed
  }

  headway (headway) {
    if (headway !== undefined) {
      if (headway < 120)
        dbg("headway is less than 120 seconds; are you sure you didn't specify minutes by mistake?")
        
      this._headway = headway;
      
      return this
    }
    
    return this._headway;
  }

  dwell (dwell) {
    if (dwell !== undefined) {
      this._dwell = dwell;
      
      return this
    }
    
    return this._dwell
  }
  
  startTime (startTime) {
    if (startTime !== undefined) {
      if (startTime < 0 || startTime > 24 * 3600)
        throw "Start time must be between zero and 24 * 3600. It is expressed in seconds since GTFS midnight."

      this._start = startTime;
      
      return this
    }

    return this._start;
  }

  endTime (endTime) {
    if (endTime !== undefined) {
      if (endTime < 0 || endTime > 48 * 3600)
        throw "Start time must be between zero and 48 * 3600. It is expressed in seconds since GTFS midnight."

      this._end = endTime;
      
      return this
    }

    return this._end;
  }

  monday (monday) {
    if (monday !== undefined) {
      this._mon = monday
      return this
    }

    return this._mon
  }

  tuesday (tuesday) {
    if (tuesday !== undefined) {
      this._tue = tuesday
      return this
    }

    return this._tue;
  }

  wednesday (wednesday) {
    if (wednesday !== undefined) {
      this._wed = wednesday
      return this
    }

    return this._wed;
  }

  thursday (thursday) {
    if (thursday !== undefined) {
      this._thurs = thursday
      return this
    }

    return this._thurs;
  }

  friday (friday) {
    if (friday !== undefined) {
      this._fri = friday
      return this
    }

    return this._fri;
  }

  saturday (saturday) {
    if (saturday !== undefined) {
      this._sat = saturday
      return this
    }

    return this._sat;
  }

  sunday (sunday) {
    if (sunday !== undefined) {
      this._sun = sunday;
      return this
    }

    return this._sun
  }

  weekday (weekday) {
    if (weekday !== undefined) {
      this.monday(weekday)
      this.tuesday(weekday)
      this.wednesday(weekday)
      this.thursday(weekday)
      this.friday(weekday)
      
      return this
    }

    return this.monday() && this.tuesday() && this.wednesday() && this.thursday() && this.friday()
  }

  weekend (weekend) {
    if (weekend !== undefined) {
      this.saturday(weekend)
      this.sunday(weekend)
      
      return this
    }

    return this.saturday() && this.sunday()
  }
}

export class RemoveTrip {
  constructor () {
    this._agencyId = null;
    this._routeId = null;
    this._tripId = null;
    this._routeType = null;
  }
  
  agency (agency) {
    if (agency !== undefined) {
      this._agencyId = agency
      return this
    }
    
    return this._agencyId
  }
  
  addRoute (route) {
    if (this._routeId === null)
      this._routeId = [route]
    
    else
      this._routeId.push(route)
      
    return this
  }
  
  addTrip (trip) {
    if (this._tripId === null)
      this._tripId = [trip]
    else
      this._tripId.push(trip)
      
    return this
  }
  
  /** add a GTFS route type to remove */
  addType (type) {
    if (this._routeType === null)
      this._routeType = [type]
    else
      this._routeType.push(type)
      
    return this
  }
  
  make () {
    return {
      type: 'remove-trip',
      agencyId: this._agencyId,
      routeId: this._routeId,
      tripId: this._tripId,
      routeType: this._routeType
    }
  }
}

export class ConvertToFrequency {
  constructor () {
    this._routeId = []
    this._windowStart = 0
    this._windowEnd = 24 * 3600
    this._groupBy = 'ROUTE_DIRECTION'
  }

  addRoute (route) {
    this._routeId.push(route)
    return this
  }

  windowStart (windowStart) {
    if (windowStart !== undefined) {
      this._windowStart = windowStart
      return this
    }

    return this._windowStart
  }

  windowEnd (windowEnd) {
    if (windowEnd !== undefined) {
      this._windowEnd = windowEnd
      return this
    }

    return this._windowEnd
  }

  groupBy (groupBy) {
    if (groupBy !== undefined) {
      this._groupBy = groupBy
      return this
    }

    return this._groupBy
  }

  make () {
    return {
      type: 'convert-to-frequency',
      windowStart: this._windowStart,
      windowEnd: this._windowEnd,
      groupBy: this._groupBy,
      routeId: this._routeId
    }
  }
}

export class AdjustHeadway {
  constructor () {
    this._agencyId = null;
    this._routeId = null;
    this._tripId = null;
    this._routeType = null;
    this._headway = 600;
  }
  
  agency (agency) {
    if (agency !== undefined) {
      this._agencyId = agency
      return this
    }
    
    return this._agencyId
  }
  
  addRoute (route) {
    if (this._routeId === null)
      this._routeId = [route]
    
    else
      this._routeId.push(route)
      
    return this
  }
  
  addTrip (trip) {
    if (this._tripId === null)
      this._tripId = [trip]
    else
      this._tripId.push(trip)
      
    return this
  }
  
  /** add a GTFS route type to match */
  addType (type) {
    if (this._routeType === null)
      this._routeType = [type]
    else
      this._routeType.push(type)
      
    return this
  }

  /** set headway in seconds */
  headway (headway) {
    if (headway !== undefined) {
      this._headway = headway
      return this
    }

    return this._headway
  }
  
  make () {
    return {
      type: 'adjust-headway',
      agencyId: this._agencyId,
      routeId: this._routeId,
      tripId: this._tripId,
      routeType: this._routeType,
      headway: this._headway
    }
  }
}