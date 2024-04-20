#!/bin/bash
# script should be located in folder that has the git cloned
echo "script should be located in dockerhub-v3:~/github/dltlly"
echo  "I am here $PWD"
cd ~/github/dltlly/ 
echo "Now I am here $PWD"

# Function to exit in case of an error
exit_on_error() {
    echo "An error occurred: $1"
    exit 1
}

# Run the Python scripts with error checking
python3 ~/docker/dltlly-v2/ytbplaylist.py || exit_on_error "Failed to run ytbplaylist.py"
python3 ~/docker/dltlly-v2/clean_up_v4.py || exit_on_error "Failed to run clean_up_v4.py"

# Copy files to current git folder
#cp ~/docker/dltlly-v2/battle_events.csv battle_events.csv 
#cp ~/docker/dltlly-v2/info.yml info.yml 

# Add the file to Git
git add history/* battle_events.csv info.yml  || exit_on_error "Failed to add battle_events.csv to git"

# Commit the changes
git commit -m "Updated battle_events.csv info.yml " || exit_on_error "Failed to commit battle_events.csv info.yml "

# Push to the main branch
git push || exit_on_error "Failed to push"


