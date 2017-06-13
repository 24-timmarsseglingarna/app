TGT_DIR ?= /non-existing

JS_SRC = $(wildcard src/js/*.js)

HTML_SRC = $(wildcard src/html/*.html)

CLOSURE_COMPILER_VSN=20170409

ifeq ($(DEBUG),true)
  CLOSURE_ARGS= -O simple --debug --formatting=PRETTY_PRINT
else
  CLOSURE_ARGS= -O simple
#  CLOSURE_ARGS= -O ADVANCED --externs externs.js
endif


all: 	build/deps \
	build/pod.js \
	build/index.html \
	build/24h.js \
	build/24h.css \
	build/icomoon.css \
	build/fonts

build/index.html: src/html/index.html.src $(HTML_SRC)
	m4 -P -I src/html < $< > $@ || rm -f $@

build/24h.js: $(JS_SRC)
	java -jar deps/closure-compiler-v$(CLOSURE_COMPILER_VSN).jar \
	$(CLOSURE_ARGS) --js_output_file=$@ $^

# This is temporary.  The pod will be downloaded from the server.
# For now you need to get a PoD.kml covering the entire area and
# store it here.
build/pod.js: PoD.kml start_points.xml tools/pod-kml-to-geojson.py
	tools/pod-kml-to-geojson.py -i PoD.kml -s start_points.xml -o $@

start_points.xml: support/kretsar.txt tools/get-start-points.sh
	tools/get-start-points.sh $< > $@

build/icomoon.css: src/icomoon/style.css
	cp $< $@

build/24h.css: src/css/24h.css
	cp $< $@

build/fonts: src/icomoon/fonts
	cp -r $< $@

# copy all dependencies except the compiler and the map
build/deps: deps
	cp -r deps build/; \
	rm -f build/deps/closure-compiler*

lint:
	gjslint --nojsdoc -r src/js

docs: $(JS_SRC) support/jsdoc.json
	jsdoc -c support/jsdoc.json -d docs src/js

# must set TGT_DIR to a dedicated directory for the app
www-publish:
	$(MAKE) www-publish-no-map; \
	if [ ! -e $(TGT_DIR)/../tiles ]; then \
	  cp -r tiles $(TGT_DIR)/..; \
	fi

www-publish-no-map: all deps
	$(MAKE) copy-target; \
	touch $(TGT_DIR)/cordova.js; \
	ln -s ../tiles $(TGT_DIR)/tiles

copy-target: all
	rm -rf $(TGT_DIR); \
	mkdir $(TGT_DIR); \
	cp -r build/* $(TGT_DIR)

app: 24h-app

apk: 24h-app
	cd 24h-app; \
	cordova build android --release -- \
		--keystore ~/.android/debug.keystore \
		--alias androiddebugkey \
		--storePassword android \
		--password android;

24h-app: all src/cordova-template/template_src/res
	cordova create 24h-app --template src/cordova-template; \
	TGT_DIR=24h-app/www $(MAKE) copy-target; \
	cd 24h-app; \
	cordova platform add android@6.1.0; \
	cp -r ../tiles www

cordova-template/template_src/res: \
	cordova-template/template_src/project/assets/icon.png \
	cordova-template/template_src/project/assets/splash.png
	cd cordova-template/template_src; \
	splashicon-generator --imagespath="project/assets"

deps:
	mkdir deps; \
	$(MAKE) deps/closure-compiler
	$(MAKE) deps/jquery
	$(MAKE) deps/ol
	$(MAKE) deps/dialog-polyfill
	$(MAKE) deps/bootstrap
	$(MAKE) deps/bootstrap-datetimepicker
	$(MAKE) deps/moment
	$(MAKE) tiles

clean:
	rm -rf build/* docs

deps-clean:
	rm -rf deps
	rm -rf tiles

mrproper: clean deps-clean
	rm -f start_points.xml
	rm -rf cordova-template/template_src/res

# not proper make rules...

deps/closure-compiler:
	cd deps; \
	wget http://dl.google.com/closure-compiler/compiler-$(CLOSURE_COMPILER_VSN).tar.gz; \
	tar zxf compiler-$(CLOSURE_COMPILER_VSN).tar.gz closure-compiler-v$(CLOSURE_COMPILER_VSN).jar; \
	rm compiler-$(CLOSURE_COMPILER_VSN).tar.gz

JQUERY_VSN=3.2.1
deps/jquery:
	cd deps; \
	wget https://code.jquery.com/jquery-$(JQUERY_VSN).min.js -O jquery.min.js

OL_VSN=4.2.0
deps/ol:
	cd deps; \
	wget https://github.com/openlayers/openlayers/releases/download/v$(OL_VSN)/v$(OL_VSN)-dist.zip; \
	unzip -q v$(OL_VSN)-dist.zip; \
	rm -f v$(OL_VSN)-dist.zip; \
	mv v$(OL_VSN)-dist/ol-debug.js ol.js; \
	mv v$(OL_VSN)-dist/ol.css .; \
	rm -rf v$(OL_VSN)-dist

DIALOG_POLYFILL_VSN=0.4.7
deps/dialog-polyfill:
	cd deps; \
	wget https://github.com/GoogleChrome/dialog-polyfill/archive/$(DIALOG_POLYFILL_VSN).tar.gz; \
	tar zxf $(DIALOG_POLYFILL_VSN).tar.gz; \
	rm -f $(DIALOG_POLYFILL_VSN).tar.gz; \
	mv dialog-polyfill-$(DIALOG_POLYFILL_VSN)/dialog-polyfill.js .; \
	mv dialog-polyfill-$(DIALOG_POLYFILL_VSN)/dialog-polyfill.css .; \
	rm -rf dialog-polyfill-$(DIALOG_POLYFILL_VSN)

BOOTSTRAP_VSN=3.3.7
deps/bootstrap:
	cd deps; \
	wget https://github.com/twbs/bootstrap/releases/download/v$(BOOTSTRAP_VSN)/bootstrap-$(BOOTSTRAP_VSN)-dist.zip; \
	unzip -q bootstrap-$(BOOTSTRAP_VSN)-dist.zip; \
	rm -f bootstrap-$(BOOTSTRAP_VSN)-dist.zip; \
	mv bootstrap-$(BOOTSTRAP_VSN)-dist/css/bootstrap.min.css .; \
	mv bootstrap-$(BOOTSTRAP_VSN)-dist/js/bootstrap.min.js .; \
	rm -rf bootstrap-$(BOOTSTRAP_VSN)-dist

BOOTSTRAP_DATETIMEPICKER_VSN=4.17.47
deps/bootstrap-datetimepicker:
	cd deps; \
	wget https://github.com/Eonasdan/bootstrap-datetimepicker/archive/$(BOOTSTRAP_DATETIMEPICKER_VSN).tar.gz; \
	tar zxf $(BOOTSTRAP_DATETIMEPICKER_VSN).tar.gz; \
	rm -f $(BOOTSTRAP_DATETIMEPICKER_VSN).tar.gz; \
	mv bootstrap-datetimepicker-$(BOOTSTRAP_DATETIMEPICKER_VSN)/build/js/bootstrap-datetimepicker.min.js .; \
	mv bootstrap-datetimepicker-$(BOOTSTRAP_DATETIMEPICKER_VSN)/build/css/bootstrap-datetimepicker.min.css .; \
	rm -rf bootstrap-datetimepicker-$(BOOTSTRAP_DATETIMEPICKER_VSN)

MOMENT_VSN=2.18.1
deps/moment:
	cd deps; \
	wget https://github.com/moment/moment/archive/$(MOMENT_VSN).tar.gz; \
	tar zxf $(MOMENT_VSN).tar.gz; \
	rm -f $(MOMENT_VSN).tar.gz; \
	mv moment-$(MOMENT_VSN)/min/moment.min.js .; \
	mv moment-$(MOMENT_VSN)/locale/sv.js .; \
	rm -rf moment-$(MOMENT_VSN)

OL3_EXT_VSN=1.0.1
deps/ol3-ext:
	cd deps; \
	wget https://github.com/Viglino/ol3-ext/archive/v$(OL3_EXT_VSN).zip; \
	unzip -q v$(OL3_EXT_VSN).zip; \
	rm -f v$(OL3_EXT_VSN).zip; \
	mv ol3-ext-$(OL3_EXT_VSN)/interaction/longtouchinteraction.js .; \
	rm -rf ol3-ext-$(OL3_EXT_VSN)

tiles:
	wget http://mbj.homenet.org/24h/map.tgz -O - | tar zx
