# README

En app för 24-timmarsseglingar.  Webbaserad, Android (iOS TBD).

PoD - punkt- och distanskarta

Loggbok

Planering

## Building

1. For now, a file "PoD.xml" must be present in the current
   directory.  The PoD should cover the entire area.  In the near
   future, the PoD will be downloaded from the server instead.
2. `make` - downloads all dependencies and builds the app.

### Build the Web application

Create a dedicated directory DIR from which the webserver can serve the
application.

1. `make`
2. `env TGT_DIR=<dir for webserver> make www-publish`

### Build the Android app

- Need `cordova` to build an Andriod (or iOS) app.

1. `make 24h-app`
2. `make apk`

