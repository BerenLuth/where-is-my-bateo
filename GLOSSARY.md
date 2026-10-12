# ACTV Live

A rider-facing "where is my bus" web app for ACTV (Venice) bus and tram service, built on ACTV's open GTFS data.

## Language

**Vehicle**:
A physical bus, tram or boat (waterbus) that reports its position. Identified internally by a vehicle id and shown to riders by its fleet number.
_Avoid_: Bus (when trams or boats are included), unit, car

**Fleet number**:
The short number riders see on a Vehicle (the feed's `label`, e.g. "587"). Not the same as the internal vehicle id.
_Avoid_: Vehicle id, plate

**Kind**:
Whether a Vehicle is a bus, tram or boat. Taken from its Line, or from the feed it came from when it is out of service.
_Avoid_: Type, mode

**Line**:
What riders call a service, e.g. "24H" or "T1". Corresponds to one or more GTFS routes.
_Avoid_: Route (in user-facing text)

**Trip**:
One scheduled run of a Line in one direction at a given start time.
_Avoid_: Journey, run

**In service**:
A Vehicle that is currently assigned to a Trip.
_Avoid_: Active, running

**Out of service**:
A Vehicle that reports a position but has no Trip, so it has no Line and no Delay. Hidden on the map by default.
_Avoid_: Idle, inactive

**Fix**:
A Vehicle's last reported position with its own timestamp. Shown as a solid marker.
_Avoid_: Reading, ping

**Ghost**:
An estimated in-between position of a Vehicle, animated between Fixes and drawn in a distinct colour. Never a real report.
_Avoid_: Interpolated marker, prediction

**Stale fix**:
A Fix older than about two minutes, shown greyed out.
_Avoid_: Dead, lost

**Delay**:
How late a Vehicle's Trip is at its next unserved stop: late, on time (within one minute), or early. Unknown for Out of service Vehicles.
_Avoid_: Lateness, offset

**Feed age**:
Time since the feed's own timestamp, shown to the rider as "updated N s ago".
_Avoid_: Last refresh
