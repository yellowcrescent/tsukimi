###############################################################################
##
## Tsukimi NSIS installer script for Windows targets
## Copyright (c) 2017 J. Hipps / Neo-Retro Group, Inc.
##
## https://tsukimi.io/
## https://ycnrg.org/
##
## Should be defined at makensis runtime:
##   BUILDPATH - build path
##   TVERSION - version string
##   TVERSION_MAJ, TVERSION_MIN, TVERSION_PAT - major, minor, patch versions
##   WINARCH - platform (win32, win64)
##   RELTYPE - release type (release, rc, debug)
##

!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Tsukimi"
!define MAINICON "build/tsukimi.ico"

OutFile "tsukimi-$TVERSION-$WINARCH.exe"
SetCompressor /SOLID lzma


Name "Tsukimi client $TVERSION ($WINARCH)"
VIAddVersionKey "ProductName" "Tsukimi client installer"
VIAddVersionKey "CompanyName" "Neo-Retro Group, Inc."
VIAddVersionKey "LegalCopyright" "Copyright © 2014-2017 Jacob Hipps/Neo-Retro Group, Inc."
VIAddVersionKey "FileDescription" "Installer for Tsukimi media client"
VIAddVersionKey "FileVersion" "$TVERSION"
VIAddVersionKey "InternalName" "tsukimi-$TVERSION-$WINARCH-$RELTYPE"
VIProductVersion $TVERSION

LicenseData "LICENSE.txt"

InstallDir "$PROGRAMFILES\Tsukimi"

RequestExecutionLevel admin
ShowInstDetails show
ShowUninstDetails show
AllowSkipFiles off

Section "Install"

	# Install files
	SetOutPath "$INSTDIR"
	File "$BUILDPATH/tsukimi.exe"
	File "$BUILDPATH/chromedriver.exe"
	File "$BUILDPATH/nwjc.exe"
	File "$BUILDPATH/payload.exe"
	File "$BUILDPATH/d3dcompiler_47.dll"
	File "$BUILDPATH/ffmpeg.dll"
	File "$BUILDPATH/libEGL.dll"
	File "$BUILDPATH/libGLESv2.dll"
	File "$BUILDPATH/node.dll"
	File "$BUILDPATH/nw.dll"
	File "$BUILDPATH/nw_elf.dll"
	File "$BUILDPATH/nacl_irt_x86_64.nexe"
	File "$BUILDPATH/*.pak"
	File "$BUILDPATH/*.bin"
	File "$BUILDPATH/*.dat"
	File "$BUILDPATH/credits.html"

	SetOutPath "$INSTDIR\core"
	File /a /r "$BUILDPATH/core/"

	SetOutPath "$INSTDIR\public"
	File /a /r "$BUILDPATH/public/"

	#SetOutPath "$INSTDIR\public\controllers"
	#File "$BUILDPATH/public/controllers/*.*"
	#SetOutPath "$INSTDIR\public\css"
	#File "$BUILDPATH/public/css/*.*"
	#SetOutPath "$INSTDIR\public\img"
	#File "$BUILDPATH/public/img/*.*"
	#SetOutPath "$INSTDIR\public\theme"
	#File "$BUILDPATH/public/theme/*.*"
	#SetOutPath "$INSTDIR\public\vendor"
	#File "$BUILDPATH/public/vendor/*.*"

	# Create uninstaller
	WriteUninstaller "$INSTDIR\tsukimi-uninstall.exe"

	# Create entry in 'Add/Remove Programs' for uninstaller
	WriteRegStr HKLM "$UNINST_KEY" "DisplayName" "Tsukimi"
	WriteRegStr HKLM "$UNINST_KEY" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
	WriteRegStr HKLM "$UNINST_KEY" "QuietUninstallString" "$\"$INSTDIR\uninstall.exe$\" /S"
	WriteRegStr HKLM "$UNINST_KEY" "UninstallString" "$\"$INSTDIR\$MAINICON$\""
	WriteRegStr HKLM "$UNINST_KEY" "InstallLocation" "$\"$INSTDIR$\""
	WriteRegStr HKLM "$UNINST_KEY" "HelpLink" "https://tsukimi.io/docs"
	WriteRegStr HKLM "$UNINST_KEY" "URLUpdateInfo" "https://tsukimi.io/"
	WriteRegStr HKLM "$UNINST_KEY" "Publisher" "Neo-Retro Group, Inc."
	WriteRegStr HKLM "$UNINST_KEY" "ProductID" "tsukimi-$TVERSION-$WINARCH"
	WriteRegStr HKLM "$UNINST_KEY" "VersionMajor" $TVERSION_MAJ
	WriteRegStr HKLM "$UNINST_KEY" "VersionMinor" $TVERSION_MIN
	WriteRegStr HKLM "$UNINST_KEY" "NoModify" 1
	WriteRegStr HKLM "$UNINST_KEY" "NoRepair" 1

	# TODO: maybe calculate total install size for EstimatedSize key

SectionEnd

## Uninstaller ##
Section "Uninstall"

	RMDir /r "$INSTDIR\*.*"
	RMDir "$INSTDIR"

	Delete "$DESKTOP\Tsukimi.lnk"
	Delete "$SMPROGRAMS\Tsukimi\*.*"
	RMDir "$SMPROGRAMS\Tsukimi"

	# Remove installer & delete entry from Uninstall section in registry
	Delete "$INSTDIR\uninstall.exe"
	DeleteRegKey HKLM "$UNINST_KEY"

SectionEnd
