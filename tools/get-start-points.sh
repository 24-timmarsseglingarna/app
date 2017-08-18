#!/bin/bash

kretsar=( `cat "$1" `)

# the cryptic sed expression is used to output a newline.  simply
# using \n doesn't work on OSX.

echo '<punkter>'
for k in "${kretsar[@]}"; do
    curl -s "http://dev.24-timmars.nu/PoD/xmlapi.php?krets=${k}" |
        sed 's/></>\'$'\n</g' | grep nummer
done
echo '</punkter>'

