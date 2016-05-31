
# tsukimi media browser

__tsukimi__ is a networked media browser built with [NW.js](http://nwjs.io/), [Node.js](https://nodejs.org/), [Compass](http://compass-style.org/), and HTML5/CSS3. [mpv](https://mpv.io/) is used for high-quality video playback.

```
Copyright © 2014-2016 Jacob Hipps / Neo-Retro Group, Inc.
Licensed under MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
```

## External Dependencies

- [MongoDB](https://docs.mongodb.org/manual/installation/) is used as primary storage for all media information. It needs to either be installed locally, or on another machine on the local network that your tsukimi installation will share.
- [XBake](https://bitbucket.org/yellowcrescent/yc_xbake) is invoked by tsukimi to perform all media scraping, scanning, and cataloging tasks. It can also be used for transcoding and hardsubbing videos.
- [Redis](http://redis.io/) is used for caching, queues (such as playlists), and many other things that benefit from fast, easy, semi-volatile storage.


## Building from Source

### Prerequisites

This assumes that Node.js, `npm`, Ruby 1.9+, and `gem` are already installed.

For development, install the SDK build of NW.js, which allows using the Chromium Developer Tools.
If you don't want/need the SDK build, remove `-sdk` from the version string.

Compass and Sass will also be installed. These require Ruby 1.9+ and Rubygems to be installed.

```
sudo npm install -g nw@0.15.0-sdk
sudo gem install compass
sudo npm install -g bower gulp nw-gyp nw-builder
```

### Fetch & Build


```
git clone https://bitbucket.org/yellowcrescent/tsukimi
cd tsukimi
npm install --dev
gulp
```

If everything goes smoothly, you should now be able to run tsukimi after updating your `settings.json` file
(see _Configure_ section below). To start tsukmi, make sure you're in the base source directory, then run:

```
nw
```


#### Manually building dependencies

Everything should be automagically built by Gulp. If for some reason that fails, or you
need to build them yourself, instructions follow.

__Compile native modules__

Build `fs-xattr`

```
cd node_modules/fs-xattr
nw-gyp configure --version=0.15.0 --target=node-webkit
nw-gyp build
```

If you receive an error related to `openssl_fips` while configuring,
open up `~/.nw-gyp/0.15.0/common.gyp` and comment out lines 43 to 47
by prepending a hash (lines related to the `openssl_fips` condition check).
We don't need OpenSSL support for building any of our modules, so it's OK.

![](https://ss.ycnrg.org/jotunn_20160527_233435.png)

__Compile stylesheets__

From `tsukimi` base directory, run

```
compass compile
```

__Install Bower components__

From `tsukimi` base directory, run

```
bower install
```

### Configure

First, copy the example configuration

```
cp settings.json.sample settings.json
```

Now edit the parameters as necessary. If you have MongoDB running locally, then the default
values should work without modification. However, you will likely want to change the
`data_dir` value, as this will be where images and other files will be saved.

```
{
	"mongo": "mongodb://localhost:27017/tsukimi",
	"data_dir": "/opt/tsukimi",
	"xbake_path": "/usr/local/bin/yc_xbake"
}
```

### Run

From the base source directory (directory containing `package.json`), execute `nw` or use `npm`:

```
npm start
```
