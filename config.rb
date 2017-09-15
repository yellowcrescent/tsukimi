###############################################################################
##
## config.rb
## tsukimi: Compass Project Configuration
##
## @author		Jacob Hipps - jacob@ycnrg.org
## @param 		vim: set ts=4 sw=4 noexpandtab syntax=ruby:
##
## @repo		https://bitbucket.org/yellowcrescent/tsukimi
##
###############################################################################
require 'compass/import-once/activate'

# Require any additional compass plugins here.

# Set this to the root of your project when deployed:
http_path = "app"
css_dir = "app/css"
sass_dir = "src/style"
images_dir = "app/img"
javascripts_dir = "app"

# You can select your preferred output style here (can be overridden via the command line):
# output_style = :expanded or :nested or :compact or :compressed
output_style = :compact

# To enable relative paths to assets via compass helper functions. Uncomment:
# relative_assets = true

# Misc options
line_comments = false
preferred_syntax = :scss
sourcemap = false
disable_warnings = true
sass_options = { :cache => false }
