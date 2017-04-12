#!/bin/bash

kretsar=( `cat "$1" `)

echo '<punkter>'
for k in "${kretsar[@]}"; do
    curl -s "http://dev.24-timmars.nu/PoD/xmlapi.php?krets=${k}" |
        sed 's/></>\n</g' | grep nummer
done
echo '</punkter>'

