include vsn.mk

TGT_DIR ?= /non-existing

JS_SRC = $(wildcard src/js/*.js)

HTML_SRC = $(wildcard src/html/*.html)

TSS_GEOJSON = $(wildcard ships-routeing/*.geojson)

all: 	build/deps \
	build/pod.js \
	build/tss.js \
	build/index.html \
	build/24h.js \
	build/24h.css \
	build/icomoon.css \
	build/fonts

build/index.html: src/html/index.html.src $(HTML_SRC) vsn.mk
	m4 -D M4_APP_VERSION=$(VSN) -P -I src/html < $< > $@ || rm -f $@

build/24h.js: $(JS_SRC) deps/vsn.js build/pod.js
	node_modules/rollup/dist/bin/rollup -c --bundleConfigAsCjs

# This is the base PoD built into the app, which only is used
# if there is no network available.  If possible, the app will
# download the correct PoD from the server.
# You need to get a PoD.xml covering the entire area and
# store it here.
build/pod.js: PoD.xml tools/pod-xml-to-geojson.py
	tools/pod-xml-to-geojson.py --javascript --id 16 -i PoD.xml -o $@


# This is the base TSS file  built into the app. The app will download
# the latest TSS from the server, if possible.
build/tss.js: $(TSS_GEOJSON)
	ships-routeing/tools/mk-24h-json --javascript $@ $^

tss.json.gz: $(TSS_GEOJSON)
	ships-routeing/tools/mk-24h-json tss.json $^ && gzip tss.json

S3SERVER ?= gionaprod
# Build this for storage on S3.
.PHONY: publish-tss-to-s3
publish-tss-to-s3: tss.json.gz
	aws s3 cp tss.json.gz s3://$(S3SERVER) --acl public-read --content-type 'application/json' --content-encoding gzip


deps/vsn.js: deps vsn.mk
	echo "export var tfAppVsn = '$(VSN)';" > $@

PoD.xml:
	curl -s "https://24-timmars.se/PoD/xmlapi_app.php" > $@

build/icomoon.css: src/icomoon/style.css
	cp $< $@

build/24h.css: src/css/24h.css
	cp $< $@

build/fonts: src/icomoon/fonts
	cp -r $< build/

# copy all dependencies except the compiler and the map
build/deps:
	$(MAKE) depsjs; \
	rm -rf $@; mkdir $@; \
	cp node_modules/ol/ol.css $@/; \

	cp node_modules/jquery/dist/jquery.min.js $@/; \
	cp node_modules/jquery/dist/jquery.min.map $@/; \

	cp node_modules/popper.js/dist/umd/popper.min.js $@/; \
	cp node_modules/bootstrap/dist/css/bootstrap.min.css $@/; \
	cp node_modules/bootstrap/dist/css/bootstrap.min.css.map $@/; \
	cp node_modules/bootstrap/dist/js/bootstrap.min.js $@/; \
	cp node_modules/bootstrap/dist/js/bootstrap.min.js.map $@/; \

	cp node_modules/bootstrap-select/dist/css/bootstrap-select.min.css $@/; \
	cp node_modules/bootstrap-select/dist/js/bootstrap-select.min.js $@/; \
	cp node_modules/bootstrap-select/dist/js/bootstrap-select.min.js.map $@/; \
	cp node_modules/bootstrap-select/dist/js/i18n/defaults-sv_SE.min.js $@/; \

	cp node_modules/tempusdominus-bootstrap-4/build/css/tempusdominus-bootstrap-4.min.css $@/
	cp node_modules/tempusdominus-bootstrap-4/build/js/tempusdominus-bootstrap-4.min.js $@/

	cp node_modules/moment/min/moment.min.js $@/; \
	cp node_modules/moment/locale/sv.js $@/

# must set TGT_DIR to a dedicated directory for the app
# set WEBAPP=1 to build for the web (w/ extra features)
www-publish:
	$(MAKE) www-publish-no-map; \
	if [ ! -e $(TGT_DIR)/../tiles ]; then \
	  cp -r tiles $(TGT_DIR)/..; \
	fi

www-publish-no-map: all deps
	$(MAKE) copy-target; \
	touch $(TGT_DIR)/cordova.js; \
	ln -s ../tiles $(TGT_DIR)/tiles

copy-target:
	rm -rf $(TGT_DIR); \
	mkdir $(TGT_DIR); \
	cp -r build/* $(TGT_DIR)

app: 24h-app

# set PLATFORM_VSN to force a specific version of the cordova
# platform plugin, e.g,: env PLATFORM_VSN=@7.1.0 make build-app
ifeq ($(shell uname -s),Darwin)
PLATFORM=ios
APPID=nu.24-timmars
else
PLATFORM=android
#PLATFORM_VSN=@12.0.0
APPID=org.homenet.mbj.tjugofyratimmars
endif

apk: 24h-app
	cd 24h-app; \
	cordova build android --release -- \
		--keystore ~/.android/debug.keystore \
		--alias androiddebugkey \
		--storePassword android \
		--password android;

build-app: 24h-app
	cd 24h-app; \
	cordova build $(PLATFORM)

# for some reason, cordova doesn't keep the version in config.xml (it
# always sets it to 1.0.0), so we change it afterwards.
# remove debug files (css .map files)
24h-app: all src/cordova-template/template_src/res
	cordova create 24h-app --template ./src/cordova-template; \
	TGT_DIR=24h-app/www $(MAKE) copy-target; \
	cd 24h-app; \
	rm -f deps/*.map; \
	sed -e 's/version="1.0.0"/version="$(VSN)"/' \
	    -e 's/org.homenet.mbj.tjugofyratimmars/$(APPID)/' \
	    config.xml > c.xml; mv c.xml config.xml; \
	cordova platform add $(PLATFORM)$(PLATFORM_VSN); \
	rm -f www/tiles; \
	cp -r ../tiles www

cordova-template/template_src/res: \
	cordova-template/template_src/project/assets/icon.png \
	cordova-template/template_src/project/assets/splash.png
	cd cordova-template/template_src; \
	splashicon-generator --imagespath="project/assets"

.PHONY: depsjs
depsjs: node_modules/ol \
	node_modules/jquery \
	node_modules/popper.js \
	node_modules/bootstrap \
	node_modules/moment \
	node_modules/bootstrap-select \
	node_modules/tempusdominus-bootstrap-4 \
	node_modules/tempusdominus-core \
	node_modules/rollup \
	node_modules/@rollup/plugin-node-resolve \
	node_modules/@rollup/plugin-commonjs \
	node_modules/rollup-plugin-uglify \
	node_modules/rollup-plugin-jscc \
	node_modules/@rollup/plugin-eslint \
	node_modules/eslint-config-mourner

deps:
	mkdir deps; \
	$(MAKE) tiles

clean:
	rm -rf build/* docs

deps-clean:
	rm -rf deps
	rm -rf node_modules
	rm -rf tiles

mrproper: clean deps-clean
	rm -f start_points.xml
	rm -rf cordova-template/template_src/res

JQUERY_VSN=3.4.1
node_modules/jquery:
	npm install jquery@$(JQUERY_VSN)

# tapping on android doesn't work well in 6.x
# can't pan in 6.2.x
OL_VSN=5.3.3
#OL_VSN=8.2.0
node_modules/ol:
	npm install ol@$(OL_VSN) --no-audit

MOMENT_VSN=2.24.0
node_modules/moment:
	npm install moment@$(MOMENT_VSN) --no-audit

POPPER_VSN=2.5.4
node_modules/popper.js:
	npm install @popperjs/core@$(POPPER_VSN) --no-audit

BOOTSTRAP_VSN=4.5.3
node_modules/bootstrap:
	npm install bootstrap@$(BOOTSTRAP_VSN) --no-audit

BOOTSTRAP_SELECT_VSN=1.13.18
node_modules/bootstrap-select:
	npm install bootstrap-select@$(BOOTSTRAP_SELECT_VSN) --no-audit

TEMPUSDOMINUS_VSN=5.39.0
node_modules/tempusdominus-bootstrap-4:
	npm install tempusdominus-bootstrap-4@$(TEMPUSDOMINUS_VSN) --no-audit

TEMPUSDOMINUS_CORE_VSN=5.19.0
node_modules/tempusdominus-core:
	npm install tempusdominus-core@$(TEMPUSDOMINUS_CORE_VSN) --no-audit

node_modules/rollup:
	npm install --save-dev rollup --no-audit

node_modules/@rollup/plugin-node-resolve:
	npm install --save @rollup/plugin-node-resolve

node_modules/@rollup/plugin-commonjs:
	npm install --save @rollup/plugin-commonjs

node_modules/@rollup/plugin-eslint:
	npm install --save @rollup/plugin-eslint

node_modules/eslint-config-mourner:
	npm install --save eslint-config-mourner

node_modules/rollup-plugin-uglify:
	npm install --save-dev rollup-plugin-uglify --no-audit

node_modules/rollup-plugin-jscc:
	npm install --save-dev rollup-plugin-jscc --no-audit

tiles:
	wget https://4668.se/24h/map.tgz -O - | tar zx
