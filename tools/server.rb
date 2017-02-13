#!/usr/local/bin/ruby
  require 'webrick'
  include WEBrick

  dir = Dir::pwd
  port = 8000

  puts "URL: http://localhost:#{port}"

  s = HTTPServer.new(
    :Port            => port,
    :DocumentRoot    => dir
  )

  trap("INT"){ s.shutdown }
  s.start