#!/bin/bash
echo "Deploying commands..."
node src/deploy-commands.js
if [ $? -eq 0 ]; then
  echo "Command deployment successful, starting bot..."
  node src/index.js
else
  echo "Command deployment failed!"
  exit 1
fi