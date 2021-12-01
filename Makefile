GO ?= go
NPX ?= npx

GO_BUILD   ?= $(GO) build -v
GO_BINDATA ?= $(GO) run -v github.com/go-bindata/go-bindata/go-bindata@latest
GODOTENV   ?= $(GO) run -v github.com/joho/godotenv/cmd/godotenv@latest
UGLIFY     ?= $(NPX) uglifyjs
STYLUS     ?= $(NPX) stylus
BROWSERIFY ?= $(NPX) browserify
BROWSERIFYINC ?= $(NPX) browserifyinc

BUNDLE_ENTRY = client/app.js
BUNDLE_FILES = $(shell find client -type f)

GO_FILES = $(shell find -type f -name '*.go')

all: static/bundle.js static/style.css trackingco.de

prod: static/bundle.min.js static/style.min.css $(GO_FILES)
	mv static/bundle.min.js static/bundle.js
	mv static/style.min.css static/style.css
	$(GO_BINDATA) static/...
	$(GO_BUILD) -o ./trackingco.de

trackingco.de: $(shell find . -name '*.go') bindata.go
	$(GO_BUILD) -o ./trackingco.de

bindata.go: $(shell find static/) $(shell find . -name '*.go')
	$(GO_BINDATA) -debug -nocompress static/...

watch:
	find client | entr make

static/bundle.js: $(BUNDLE_FILES)
	$(GODOTENV) -f .env $(BROWSERIFYINC) $(BUNDLE_ENTRY) -dv --outfile $@

static/bundle.min.js:  $(BUNDLE_FILES)
	$(BROWSERIFY) $(BUNDLE_ENTRY) -t babelify -g [ envify --NODE_ENV production ] -g uglifyify | $(UGLIFY) --compress --mangle > $@

static/style.css: client/style.styl
	$(STYLUS) < $< > $@

static/style.min.css: client/style.styl
	$(STYLUS) -c < $< > $@
