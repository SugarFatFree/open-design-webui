#!/usr/bin/env sh
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec "$DIR/open-design.sh" start
