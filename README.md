# factorio-control-panel
Web admin interface for [Factorio](http://factorio.com/) headless game server

[![Build Status](https://travis-ci.org/Bertieio/factorio-control-panel.svg?branch=master)](https://travis-ci.org/bertieio/factorio-control-panel)

### Installation (Linux server)

- Install [Factorio headless server](http://www.factorio.com/download-headless/stable) and [Node.js](https://nodejs.org/en/download/).

- This is currently a dev build please feel free to fork and push updates

- Set environment variables and start the web server

        export FACTORIO_DIR='/usr/local/factorio'
        export ADMIN_PASSWORD='******'
        export PORT=8000
        factorio-control-panel
### Usage

- Navigate to the control panel at [http://localhost:8000](http://localhost:8000).

- Upload save files and mods for the server to use. Other players can download them from here.

- Click "Start Server." This and other admin actions require the `ADMIN_PASSWORD` set above.
