#!/bin/bash
# Make the node_modules folder

SCRIPTPATH=`dirname $(readlink -f ./make.sh)`
mkdir -p node_modules

for f in ./mw-ocg*
do
	ln -s $SCRIPTPATH/node_modules $f/node_modules
	cd $f
	npm install
	NPMEXIT=$?

	cd ..
	#rm $f/node_modules

	if [ $NPMEXIT != 0 ]; then
		echo "npm install for $f exited with failure"
		exit $?
	fi
done

echo "Done! Apparent success"

