
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

```
sudo npm install -g nw@0.15.0-sdk
```

Install Sass & Compass

```
sudo gem install compass
```

Install Build Tools

```
sudo npm install -g bower grunt-cli nw-gyp nwbuild
```

### Fetch & Build

#### Clone git repo from Bitbucket

```
git clone https://bitbucket.org/yellowcrescent/tsukimi
cd tsukimi
```

#### Install Node modules

```
npm install
```

#### Compile native modules

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

#### Compile stylesheets

From `tsukimi` base directory, run

```
compass compile
```

#### Install Bower components

From `public/` directory, run

```
bower install
```

### Configure

Create a JSON file in the installation base named `settings.json` and populate at least the
following parameters (with common or example values shown below)

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
