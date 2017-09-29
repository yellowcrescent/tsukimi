
![](https://ycnrg.org/img/tsukimi_logo_v2_96.png)
# tsukimi media browser

__tsukimi__ is a cross-platform networked media browser built with [Electron](https://electron.atom.io/), [Angular](https://angularjs.org/), [Compass](http://compass-style.org/), and HTML5/CSS3. [mpv](https://mpv.io/) is used for high-quality video playback.

> Copyright © 2014-2017 Jacob Hipps / Neo-Retro Group, Inc.
> Licensed under the [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/)


## Status

__This project is still a work-in-progress!__ There are a lot of issues that need to be resolved before it can be considered stable or ready for general use.

Open issues & tasks can be viewed on the [Tsukimi JIRA page](https://jira.ycnrg.org/projects/TSK).

## Screenshots

- Group view, showing the posters for the various series in the chosen group. Series can be divided up into different categories, such as "Documentary" or "Anime"
![](https://ss.ycnrg.org/jotunn_20170925_033640.png)

- View of a series and its episodes, using the _Tiled_ view
![](https://ss.ycnrg.org/jotunn_20170925_033201.png)

- Watching a video in windowed mode with mpv overlay
![](https://ss.ycnrg.org/jotunn_20170925_035341.png)

- Using the _Image Selector_ to switch the images for a series (eg. poster, fanart, banner, etc.)
![](https://ss.ycnrg.org/jotunn_20170925_033409.png)

- Library management section, showing a recently-scanned series
![](https://ss.ycnrg.org/jotunn_20170218_204607.png)

- [TheTVDb](http://thetvdb.com/) search results for a TV series. Allows mass-updating all videos with the matching series tag, and automatically determining a matching episode ID when choosing a different series.
![](https://ss.ycnrg.org/jotunn_20170218_205715.png)

- _Import Configuration_ dialog. Allows associating videos with a particular grouping in the video browser (eg. _TV_, _Documentary_, _Anime_, _Cartoons_, _Music Videos_, etc.). Groups can be user-defined. If enabled, a screenshot will be automatically taken from the source media.
![](https://ss.ycnrg.org/jotunn_20170218_210051.png)


## External Dependencies

- [MongoDB](https://docs.mongodb.org/manual/installation/) is used as primary storage for all media information. It needs to either be installed locally, or on another machine on the local network that your tsukimi installation will share.
- [XBake](https://bitbucket.org/yellowcrescent/yc_xbake) is invoked by tsukimi to perform all media scraping, scanning, and cataloging tasks. It can also be used for transcoding and hardsubbing videos.

## Building from Source

### Prerequisites

This assumes that Node.js, `npm`, Ruby 1.9+, and `gem` are already installed.

Compass and Sass will also be installed. These require Ruby 1.9+ and Rubygems to be installed.

```
sudo gem install compass
sudo npm install -g bower gulp node-gyp
```

### Fetch & Build

```
git clone https://git.ycnrg.org/scm/tsk/tsukimi.git
cd tsukimi
npm install
gulp
```

If everything goes smoothly, you should now be able to run tsukimi after updating your `settings.json` file
(see _Configure_ section below). To start tsukmi, make sure you're in the base source directory, then run:

```
gulp run
```

Everything should be automagically built by Gulp. If for some reason that fails, or you
need to build dependencies yourself, instructions follow.

__Compile native modules__

Build `fs-xattr` (for 64-bit use `x64`, for 32-bit use `ia32`). Cross-compiling 32-bit on a 64-bit platform
requires gcc-multilib to be installed on your OS. This module is required to access extended file attributes.

```
cd node_modules/fs-xattr
node-gyp build --target=ELECTRON_VERSION --arch=ARCH --dist-url=https://atom.io/download/electron
```

Be sure to replace `ELECTRON_VERSION` with the current version of Electron in use.

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

## Building Release Distributions

### Platform-specific Prerequisites

__Linux & Windows__

The Windows packages are built on Linux, because building packages on Windows is a pain. Recommended build platform is Ubuntu 16.04 or Debian 8.

Install required software for packaging the release:
```
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 3FA7E0328081BFF6A14DA29AA6A19B38D3D831EF
echo "deb http://download.mono-project.com/repo/debian wheezy main" | sudo tee /etc/apt/sources.list.d/mono-xamarin.list
sudo apt-add-repository -y ppa:ubuntu-wine/ppa
sudo apt-get update
sudo apt-get -y install icoutils icnsutils ghostscript imagemagick libgs-dev rpm bsdtar snapcraft gcc-multilib g++-multilib p7zip-full wine1.8-amd64 wine1.8-i386 mono-devel ca-certificates-mon
```

__Mac OS X__

[Homebrew](https://brew.sh/) is recommended for dependency installation.

Install required software for packaging the release:
```
brew install ghostscript icoutils libicns p7zip
```

### Build

To build redist packages for the current platform (Windows, OS X, and Linux):
```
gulp build
```

Since there are native modules that need to be built, you will only be able to build for the current host platform.

### Artifacts

The following artifacts are produced by the build process:

- Linux
    - `tsukimi-${version}-x86_64.AppImage` - AppImage (64-bit x86)
    - `tsukimi-${version}-i386.AppImage` - AppImage (32-bit x86)
    - `tsukimi-${version}-linux-amd64.deb` - Debian/Ubuntu deb package (64-bit x86)
    - `tsukimi-${version}-linux-i386.deb` - Debian/Ubuntu deb package (32-bit x86)
    - `tsukimi-${version}-linux.pacman` - Arch pacman package (64-bit x86)
    - `tsukimi-${version}-linux-i686.pacman` - Arch pacman package (32-bit x86)
    - `tsukimi-${version}-linux-x86_64.rpm` - RPM package (64-bit x86)
    - `tsukimi-${version}-linux-i686.rpm` - RPM package (32-bit x86)
- Windows
    - `tsukimi-${version}-win.exe` - NSIS installer (32+64-bit x86)
    - `tsukimi-${version}-full.nupkg` - NuPkg full update (32+64-bit x86)
    - `tsukimi-${version}-delta.nupkg` - NuPkg delta update (32+64-bit x86)
- Mac OS X
    - `tsukimi-${version}-mac.dmg` - DMG disk image (64-bit x86)
    - `tsukimi-${version}-mac.pkg` - Application package (64-bit x86)
    - `tsukimi-${version}-mac.zip` - Update package (64-bit x86)

These should will uploaded to https://release.ycnrg.org/ to allow for auto-updates on supported platforms.


## Configure

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
    "xbake_path": "/usr/local/bin/xbake"
}
```

### Run

From the base source directory (directory containing `package.json`), execute `electron` or use `gulp`:

```
gulp
```
